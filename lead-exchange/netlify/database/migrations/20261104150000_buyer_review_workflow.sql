-- Admin Priority 2: application review workflow.
--
-- Status model: PENDING_REVIEW -> (NEEDS_MORE_INFO | REJECTED | PENDING_COMMERCIALS) ->
-- (SUSPENDED is a side-state reachable from ACTIVE) -> ACTIVE.
-- Approving an application never jumps straight to ACTIVE -- it moves to PENDING_COMMERCIALS,
-- where an admin must configure real commercial terms before an explicit, separate "activate"
-- action makes the buyer eligible to receive leads.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'buyers' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%application_status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE buyers DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE buyers
  ADD CONSTRAINT buyers_application_status_check
  CHECK (application_status IN (
    'PENDING_REVIEW','NEEDS_MORE_INFO','REJECTED',
    'PENDING_COMMERCIALS','ACTIVE','SUSPENDED'
  ));

ALTER TABLE buyers
  ADD COLUMN exclusivity_arrangement TEXT CHECK (exclusivity_arrangement IN ('exclusive','shared')),
  ADD COLUMN agreed_currency TEXT DEFAULT 'GBP',
  ADD COLUMN agreed_weekly_capacity INTEGER,
  ADD COLUMN payment_arrangement_notes TEXT,
  ADD COLUMN commercials_configured_by TEXT,
  ADD COLUMN commercials_configured_at TIMESTAMPTZ,
  ADD COLUMN went_active_by TEXT,
  ADD COLUMN went_active_at TIMESTAMPTZ;

-- Internal review notes -- distinct from the append-only audit_log, which records decisions and
-- state transitions. This is for ongoing admin assessment/follow-up commentary, editable in the
-- sense that more notes get added over time, but each note itself is never edited once written.
CREATE TABLE buyer_review_notes (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES buyers(id),
  admin_email TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_buyer_review_notes_buyer ON buyer_review_notes(buyer_id);
