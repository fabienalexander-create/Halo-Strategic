-- Buyer prospect attribution: first-touch/last-touch split, channel tagging (website vs Meta
-- Instant Form), and a per-touch audit log separate from the summary row.
--
-- Three things this migration is NOT allowed to break, because real rows already exist on
-- production from the live Meta campaign:
--   1. Existing utm_source/utm_medium/utm_campaign values must be preserved exactly as the
--      first-touch record -- not reset, not reinterpreted.
--   2. The new "one active prospect per (email, industry)" rule must not fail to apply just
--      because duplicates already exist -- see the merge step below.
--   3. buyer_prospect_emails rows tied to a duplicate that gets merged away must not leave a
--      dangling foreign key.

-- --------------------------------------------------------------------------------------------
-- 1. New columns on buyer_prospects.
--
-- utm_source/utm_medium/utm_campaign (already existed) now have a fixed meaning: the FIRST touch.
-- fbclid is new and joins them as part of that same first-touch record. last_touch_* always
-- reflects whatever attribution was present at the most recent qualifying touch (which may be the
-- same event as first-touch, or a later one via either channel).
ALTER TABLE buyer_prospects
  ADD COLUMN fbclid TEXT,
  ADD COLUMN capture_channel TEXT NOT NULL DEFAULT 'website'
    CHECK (capture_channel IN ('website', 'meta_instant_form')),
  ADD COLUMN last_touch_channel TEXT NOT NULL DEFAULT 'website'
    CHECK (last_touch_channel IN ('website', 'meta_instant_form')),
  ADD COLUMN last_touch_utm_source TEXT,
  ADD COLUMN last_touch_utm_medium TEXT,
  ADD COLUMN last_touch_utm_campaign TEXT,
  ADD COLUMN last_touch_fbclid TEXT,
  ADD COLUMN last_touch_at TIMESTAMPTZ,
  -- Populated only for a touch that came in via the Meta Instant Form (either as first touch or
  -- a later one) -- see buyer_prospect_touches below for the full per-touch record. These columns
  -- hold the MOST RECENT Meta touch's details, for cheap querying without a join.
  ADD COLUMN meta_lead_id TEXT,
  ADD COLUMN meta_campaign_id TEXT,
  ADD COLUMN meta_campaign_name TEXT,
  ADD COLUMN meta_adset_id TEXT,
  ADD COLUMN meta_adset_name TEXT,
  ADD COLUMN meta_ad_id TEXT,
  ADD COLUMN meta_ad_name TEXT,
  ADD COLUMN meta_form_id TEXT,
  ADD COLUMN meta_form_name TEXT,
  ADD COLUMN meta_submitted_at TIMESTAMPTZ,
  -- What was actually shown to the prospect at the point of consent, and the raw answer set --
  -- never inferred, never assumed to match the website's fixed checkbox wording.
  ADD COLUMN consent_wording_version TEXT,
  ADD COLUMN raw_form_answers JSONB;

-- Backfill existing rows: every row so far came through the website, and is its own only touch
-- so far, so last-touch is identical to first-touch.
UPDATE buyer_prospects SET
  last_touch_channel = 'website',
  last_touch_utm_source = utm_source,
  last_touch_utm_medium = utm_medium,
  last_touch_utm_campaign = utm_campaign,
  last_touch_at = created_at
WHERE last_touch_at IS NULL;

ALTER TABLE buyer_prospects ALTER COLUMN last_touch_at SET NOT NULL;

-- --------------------------------------------------------------------------------------------
-- 2. Merge any pre-existing duplicate (contact_email, industry_id) ACTIVE (unconverted) rows
-- before the uniqueness rule below is introduced. There was no constraint stopping this until
-- now, so production may genuinely hold duplicates from repeated registrations. For each group,
-- the earliest row survives as the canonical prospect; later rows contribute only their
-- attribution (as a last-touch update, since that's genuinely a later real-world touch) and are
-- then removed. Their buyer_prospect_emails rows are removed with them -- that log is
-- operational send-state for a row that will no longer exist, not the historical record (that's
-- audit_log, which is untouched and keeps its own entries regardless of whether the entity they
-- describe still exists, same as every other merge/delete in this schema).
DO $$
DECLARE
  dup RECORD;
  survivor RECORD;
  latest RECORD;
BEGIN
  FOR dup IN
    SELECT contact_email, industry_id
    FROM buyer_prospects
    WHERE converted_buyer_id IS NULL
    GROUP BY contact_email, industry_id
    HAVING count(*) > 1
  LOOP
    SELECT * INTO survivor FROM buyer_prospects
      WHERE contact_email = dup.contact_email AND industry_id = dup.industry_id AND converted_buyer_id IS NULL
      ORDER BY created_at ASC, id ASC LIMIT 1;

    SELECT * INTO latest FROM buyer_prospects
      WHERE contact_email = dup.contact_email AND industry_id = dup.industry_id AND converted_buyer_id IS NULL
        AND id != survivor.id
      ORDER BY created_at DESC, id DESC LIMIT 1;

    UPDATE buyer_prospects SET
      last_touch_channel = latest.capture_channel,
      last_touch_utm_source = latest.utm_source,
      last_touch_utm_medium = latest.utm_medium,
      last_touch_utm_campaign = latest.utm_campaign,
      last_touch_fbclid = latest.fbclid,
      last_touch_at = latest.created_at
    WHERE id = survivor.id;

    INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
    VALUES (
      survivor.prospect_reference, 'BUYER_PROSPECT_DUPLICATES_MERGED', 'buyer_prospect', survivor.id,
      jsonb_build_object('duplicate_count', (SELECT count(*) FROM buyer_prospects WHERE contact_email = dup.contact_email AND industry_id = dup.industry_id AND converted_buyer_id IS NULL)),
      jsonb_build_object('survivor_id', survivor.id)
    );

    DELETE FROM buyer_prospect_emails WHERE prospect_id IN (
      SELECT id FROM buyer_prospects
      WHERE contact_email = dup.contact_email AND industry_id = dup.industry_id AND converted_buyer_id IS NULL AND id != survivor.id
    );
    DELETE FROM buyer_prospects
      WHERE contact_email = dup.contact_email AND industry_id = dup.industry_id AND converted_buyer_id IS NULL AND id != survivor.id;
  END LOOP;
END $$;

-- Only one ACTIVE (unconverted) prospect per (email, industry), across both channels. A
-- converted prospect is historical and explicitly excluded, so a business that re-registers after
-- actually becoming a buyer isn't blocked from a fresh registration.
CREATE UNIQUE INDEX uq_buyer_prospects_active_email_industry
  ON buyer_prospects (contact_email, industry_id) WHERE converted_buyer_id IS NULL;

-- --------------------------------------------------------------------------------------------
-- 3. Per-touch log: every qualifying submission (first or repeat, either channel) gets its own
-- row here, independent of whatever buyer_prospects' summary columns currently show. This is the
-- durable record of every Meta lead_id ever received, which the dedup logic in the application
-- API depends on -- a retried or re-delivered Meta webhook/Make run must never create a second
-- prospect or a second touch for the same lead.
CREATE TABLE buyer_prospect_touches (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER NOT NULL REFERENCES buyer_prospects(id),
  channel TEXT NOT NULL CHECK (channel IN ('website', 'meta_instant_form')),

  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  fbclid TEXT,

  meta_lead_id TEXT,
  meta_campaign_id TEXT,
  meta_campaign_name TEXT,
  meta_adset_id TEXT,
  meta_adset_name TEXT,
  meta_ad_id TEXT,
  meta_ad_name TEXT,
  meta_form_id TEXT,
  meta_form_name TEXT,
  meta_submitted_at TIMESTAMPTZ,

  consent_wording_version TEXT,
  raw_form_answers JSONB,

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_buyer_prospect_touches_prospect ON buyer_prospect_touches(prospect_id);
-- The dedup key for Meta re-deliveries/retries. Partial so website touches (no meta_lead_id)
-- never collide with each other.
CREATE UNIQUE INDEX uq_buyer_prospect_touches_meta_lead_id
  ON buyer_prospect_touches (meta_lead_id) WHERE meta_lead_id IS NOT NULL;

-- Backfill: one synthetic first-touch row per existing prospect, from its own first-touch columns,
-- so the touches table's history is complete from day one rather than starting mid-stream.
INSERT INTO buyer_prospect_touches (prospect_id, channel, utm_source, utm_medium, utm_campaign, fbclid, occurred_at)
SELECT id, capture_channel, utm_source, utm_medium, utm_campaign, fbclid, created_at
FROM buyer_prospects;
