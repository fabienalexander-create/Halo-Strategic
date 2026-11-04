-- Upgrades transactional_emails from a plain delivery log into a proper outbox: PENDING is now a
-- valid status (the row exists before a send is ever attempted), DELIVERED is distinct from SENT
-- (provider accepted vs. provider's webhook confirmed actual delivery), and (buyer_id, email_type)
-- becomes a hard uniqueness constraint -- this IS the idempotency key that makes outbox creation
-- safe to call on every retried request.
--
-- This is a separate migration, not an edit to 20261104160000_transactional_emails.sql, because
-- that migration had already been applied in at least one deploy context by the time this
-- change was made; migrations are append-only once applied.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'transactional_emails' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE transactional_emails DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE transactional_emails ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE transactional_emails
  ADD CONSTRAINT transactional_emails_status_check
  CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DELIVERED'));

ALTER TABLE transactional_emails
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN sent_at TIMESTAMPTZ,
  ADD COLUMN delivered_at TIMESTAMPTZ,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill for any rows written by the earlier, pre-outbox version of this table (e.g. in a
-- deploy preview that already ran against it): they were only ever written once, successfully or
-- not, so attempt_count = 1 and, for a SENT row, sent_at = when it was logged is accurate.
UPDATE transactional_emails SET attempt_count = 1, sent_at = created_at WHERE status = 'SENT';
UPDATE transactional_emails SET attempt_count = 1 WHERE status = 'FAILED';

DROP INDEX idx_transactional_emails_buyer_type;
CREATE UNIQUE INDEX idx_transactional_emails_buyer_type_unique ON transactional_emails(buyer_id, email_type);
CREATE INDEX idx_transactional_emails_status ON transactional_emails(status);
CREATE INDEX idx_transactional_emails_provider_message_id ON transactional_emails(provider_message_id);
