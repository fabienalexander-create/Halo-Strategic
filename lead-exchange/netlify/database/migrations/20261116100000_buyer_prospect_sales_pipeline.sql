-- Buyer prospect sales pipeline: the missing middle of the buyer journey, between "a Meta/website
-- registration exists" (buyer_prospects, already built) and "a formal application exists"
-- (buyers, already built). Qualify first, sell second, onboard third.
--
-- Deliberately additive only -- no existing column, table, or row touched. nurture_status,
-- application_status, buyer_packages, package_definitions and every existing consent/suppression
-- safeguard are untouched by this migration.
--
-- Mirrors two patterns already proven in this codebase rather than inventing new ones:
--   - current-state column + append-only log, same shape as capture_channel/last_touch_channel
--     alongside buyer_prospect_touches (20261113120000_buyer_prospect_attribution.sql).
--   - a notes-over-time table, same shape as buyer_review_notes (20261104150000_buyer_review_workflow.sql).

ALTER TABLE buyer_prospects
  ADD COLUMN sales_stage TEXT NOT NULL DEFAULT 'NEW'
    CHECK (sales_stage IN ('NEW', 'CONTACT_AUTHORISED', 'CONTACTED', 'RESPONDED', 'QUALIFIED', 'CALL_COMPLETED', 'PACKAGE_AGREED')),
  -- Deliberately separate from nurture_status, which governs the AUTOMATED marketing/nurture
  -- system only. This field governs whether a human may personally contact this prospect, and
  -- must never be inferred from a Meta registration, a phone number, or general interest -- see
  -- the guard trigger below, which enforces that in the database, not just in application code.
  -- Existing rows (including HLX-PROSPECT-000003) get NULL here by default, which is correct:
  -- nothing about this migration authorises contacting anyone.
  ADD COLUMN personal_contact_authorised_at TIMESTAMPTZ,
  ADD COLUMN personal_contact_authorised_by TEXT,
  ADD COLUMN contact_authorisation_basis TEXT,
  -- A package VERBALLY agreed on a call, distinct from buyer_packages (an actually PAID,
  -- admin-verified package). Agreeing to a price is not the same event as receiving it.
  ADD COLUMN agreed_package_definition_id INTEGER REFERENCES package_definitions(id),
  ADD COLUMN agreed_package_at TIMESTAMPTZ,
  ADD COLUMN agreed_package_by TEXT,
  ADD COLUMN next_follow_up_at TIMESTAMPTZ;

CREATE INDEX idx_buyer_prospects_sales_stage ON buyer_prospects(sales_stage);
CREATE INDEX idx_buyer_prospects_next_follow_up ON buyer_prospects(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;

-- Database-level backstop, same discipline as every other guard trigger in this codebase: even if
-- application code has a bug, or a future script advances a prospect's stage directly, the
-- database itself refuses to let sales_stage move past NEW without personal_contact_authorised_at
-- already being set. This is what makes "never automatically inferred" an enforced rule rather
-- than a convention -- the exact gap this whole feature exists to avoid repeating (see the
-- PAUSED-suppression incident this branch is stacked on top of).
CREATE FUNCTION buyer_prospects_guard_sales_stage_requires_authorisation() RETURNS trigger AS $$
BEGIN
  IF NEW.sales_stage != 'NEW' AND NEW.personal_contact_authorised_at IS NULL THEN
    RAISE EXCEPTION 'prospect % cannot move to sales_stage % without personal_contact_authorised_at being set first', NEW.id, NEW.sales_stage;
  END IF;
  -- PACKAGE_AGREED without recording which package makes the stage meaningless, and would leave
  -- the dashboard showing "agreed" with nothing to act on.
  IF NEW.sales_stage = 'PACKAGE_AGREED' AND NEW.agreed_package_definition_id IS NULL THEN
    RAISE EXCEPTION 'prospect % cannot move to PACKAGE_AGREED without agreed_package_definition_id', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_buyer_prospects_guard_sales_stage
  BEFORE INSERT OR UPDATE OF sales_stage ON buyer_prospects
  FOR EACH ROW EXECUTE FUNCTION buyer_prospects_guard_sales_stage_requires_authorisation();

-- The append-only activity history: every stage change, manual email/SMS sent, response received,
-- call attempted/completed, qualification note and follow-up scheduled. This -- not a single
-- current-stage column -- is what answers "who contacted them, what was discussed, what happened
-- next." Rows are never edited once written, same convention as buyer_review_notes and audit_log.
CREATE TABLE buyer_prospect_sales_activity (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER NOT NULL REFERENCES buyer_prospects(id),
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'STAGE_CHANGE', 'EMAIL_SENT', 'SMS_SENT', 'RESPONSE_RECEIVED',
    'CALL_ATTEMPTED', 'CALL_COMPLETED', 'QUALIFICATION_NOTE', 'FOLLOW_UP_SCHEDULED'
  )),
  previous_stage TEXT,
  new_stage TEXT,
  note TEXT,
  recorded_by TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_buyer_prospect_sales_activity_prospect ON buyer_prospect_sales_activity(prospect_id, occurred_at DESC);
