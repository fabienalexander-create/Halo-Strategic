-- Adds ADMIN_NEW_APPLICATION as a valid transactional_emails.email_type, for the new
-- admin-facing notification sent whenever a buyer application is submitted (any industry).
-- Separate migration, not an edit to 20261104160000_transactional_emails.sql or
-- 20261104161000_transactional_emails_outbox.sql, since both are already applied --
-- migrations are append-only once applied.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'transactional_emails' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%email_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE transactional_emails DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE transactional_emails
  ADD CONSTRAINT transactional_emails_email_type_check
  CHECK (email_type IN (
    'APPLICATION_RECEIVED',
    'APPLICATION_APPROVED_FOR_COMMERCIAL_REVIEW',
    'ADMIN_NEW_APPLICATION'
  ));
