-- Buyer prospect attribution: first-touch/last-touch split, channel tagging (website vs Meta
-- Instant Form), and a per-touch audit log separate from the summary row.
--
-- Deliberately additive ONLY -- no merge, no delete, no uniqueness constraint added here. There
-- was never a rule stopping duplicate (contact_email, industry_id) ACTIVE (unconverted) rows, so
-- production may genuinely hold some; whether and how to resolve them is a decision for Fabien,
-- not something this migration should do silently. See
-- netlify/database/reports/buyer_prospects_duplicate_check.sql for a read-only report to run
-- first, and docs/BUYER_PROSPECT_ATTRIBUTION_ROLLBACK.md for the follow-up plan. Until that
-- uniqueness rule exists, the application write path (lib/buyerProspectCapture.ts) enforces
-- "one active prospect per email+industry" itself, via an explicit row lock rather than a
-- database constraint -- see that file's own comment for the narrow race window this leaves open
-- in the meantime.
--
-- utm_source/utm_medium/utm_campaign (already existed) now have a fixed meaning: the FIRST
-- touch. fbclid is new and joins them as part of that same first-touch record. last_touch_*
-- always reflects whatever attribution was present at the most recent qualifying touch (which
-- may be the same event as first-touch, or a later one via either channel).
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
  -- The actual consent question/answer shown to the prospect at first-touch, never the whole set
  -- of form answers -- see app/api/integrations/meta-lead-ads/route.ts. consent_wording_version
  -- is a short label; raw_form_answers holds ONLY that question/answer pair as JSON, not an
  -- unrestricted blob of whatever else a form happened to ask.
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
-- Per-touch log: every qualifying submission (first or repeat, either channel) gets its own row
-- here, independent of whatever buyer_prospects' summary columns currently show. This is the
-- durable record of every Meta lead_id ever received, which the dedup logic in
-- lib/buyerProspectCapture.ts depends on -- a retried or re-delivered Meta webhook/Make run must
-- never create a second prospect or a second touch for the same lead. It's also the small event
-- history Fabien asked for: when a buyer asks where an enquiry originated, every touch -- not
-- just the current summary -- is recoverable here.
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
-- Supports the lookup lib/buyerProspectCapture.ts does for "one active prospect per
-- email+industry" -- an ordinary (non-unique) index, since the rule itself is enforced in
-- application code for now, not by the database. See the module comment at the top of this file.
CREATE INDEX idx_buyer_prospects_email_industry_active
  ON buyer_prospects (lower(trim(contact_email)), industry_id) WHERE converted_buyer_id IS NULL;

-- Backfill: one synthetic first-touch row per existing prospect, from its own first-touch columns,
-- so the touches table's history is complete from day one rather than starting mid-stream.
INSERT INTO buyer_prospect_touches (prospect_id, channel, utm_source, utm_medium, utm_campaign, fbclid, occurred_at)
SELECT id, capture_channel, utm_source, utm_medium, utm_campaign, fbclid, created_at
FROM buyer_prospects;
