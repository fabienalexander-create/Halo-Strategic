-- Prospect email compliance remediation: unsubscribe, suppression, bounce/complaint handling.
--
-- Two distinct permissions are tracked separately, per Fabien's explicit requirement: withdrawing
-- from the bounded five-email introductory/registration sequence (nurture_status = 'UNSUBSCRIBED',
-- already defined by the previous migration) must never be conflated with withdrawing optional
-- ongoing marketing consent (marketing_unsubscribed_at, new here). Opting out of one must never be
-- treated as opting out of the other.
--
-- A hard bounce or a spam complaint is different again: it means the address itself should not be
-- emailed at all, for any purpose, so it is tracked separately again and checked everywhere
-- suppression is checked.
--
-- pgcrypto is a standard Postgres contrib extension (available on Neon) used only to generate the
-- random unsubscribe token; nothing here depends on it for anything else.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE buyer_prospects
  ADD COLUMN unsubscribe_token TEXT,
  ADD COLUMN nurture_unsubscribed_at TIMESTAMPTZ,
  ADD COLUMN marketing_unsubscribed_at TIMESTAMPTZ,
  ADD COLUMN email_bounced_at TIMESTAMPTZ,
  ADD COLUMN email_complained_at TIMESTAMPTZ;

-- Backfill any existing rows (there should be few or none in production -- this table is brand
-- new -- but the migration must be safe regardless) with a random, unguessable token before the
-- column is made mandatory and unique.
UPDATE buyer_prospects SET unsubscribe_token = encode(gen_random_bytes(32), 'hex') WHERE unsubscribe_token IS NULL;

ALTER TABLE buyer_prospects ALTER COLUMN unsubscribe_token SET NOT NULL;
ALTER TABLE buyer_prospects ADD CONSTRAINT buyer_prospects_unsubscribe_token_key UNIQUE (unsubscribe_token);
-- Belt and braces: the application generates its own token at insert time (Node's crypto, see
-- lib/buyerProspectEmail.ts), but a database-level default means a row can never end up without
-- one even if a future code path forgets to set it.
ALTER TABLE buyer_prospects ALTER COLUMN unsubscribe_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

CREATE INDEX idx_buyer_prospects_unsubscribe_token ON buyer_prospects(unsubscribe_token);

-- Three new terminal states for the per-email audit record, distinct from FAILED (a transient
-- provider failure that might be retried) and distinct from each other: BOUNCED/COMPLAINED record
-- what the provider reported about that specific send; SUPPRESSED records that this application
-- deliberately refused to even attempt the send because the prospect was already suppressed at the
-- time.
ALTER TABLE buyer_prospect_emails DROP CONSTRAINT buyer_prospect_emails_status_check;
ALTER TABLE buyer_prospect_emails ADD CONSTRAINT buyer_prospect_emails_status_check
  CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'SUPPRESSED'));

-- Database-level backstop, same pattern as every other guard trigger in this codebase (the
-- onboarding call gate, the lead allocation/release guards): even if application code has a bug, or
-- a future scheduler is written without this check, or there is a race between an unsubscribe
-- request and a send attempt already in flight, the database itself refuses to let a suppressed
-- prospect's outbox row ever reach SENT. Marketing-only unsubscribe (marketing_unsubscribed_at) is
-- deliberately NOT part of this guard -- opting out of ongoing marketing must never block the
-- registration-related introductory sequence.
CREATE FUNCTION buyer_prospect_emails_guard_suppression() RETURNS trigger AS $$
DECLARE
  p RECORD;
BEGIN
  IF NEW.status = 'SENT' THEN
    SELECT nurture_status, email_bounced_at, email_complained_at INTO p
    FROM buyer_prospects WHERE id = NEW.prospect_id;
    IF p.nurture_status = 'UNSUBSCRIBED' OR p.email_bounced_at IS NOT NULL OR p.email_complained_at IS NOT NULL THEN
      RAISE EXCEPTION 'prospect % is suppressed (unsubscribed, bounced or complained); outbox row % cannot be marked SENT', NEW.prospect_id, NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_buyer_prospect_emails_guard_suppression
  BEFORE INSERT OR UPDATE OF status ON buyer_prospect_emails
  FOR EACH ROW EXECUTE FUNCTION buyer_prospect_emails_guard_suppression();
