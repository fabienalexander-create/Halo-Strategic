-- Email delivery visibility and duplicate-send protection (Fabien, 2026-11-19). Additive: no
-- existing row changes meaning except the five historic failures named below.
--
-- Both buyer-facing outboxes (transactional_emails, lead_delivery_emails) gain:
--   status BOUNCED / COMPLAINED  set from Resend's signed webhook (app/api/webhooks/resend).
--   status SUPERSEDED            terminal: a stale message deliberately never sent. A guard
--                                trigger refuses moving a row out of SUPERSEDED, so no code path
--                                (retry button, bug, replayed request) can resend it.
--   send_claimed_at              set atomically just before calling Resend and cleared when the
--                                outcome is recorded. Only one request can hold the claim, so two
--                                simultaneous retries cannot both send.
--   outcome_unknown              true when a send attempt ended without a clear answer from
--                                Resend (network error, or a claim left behind by a crashed run).
--                                The message may have gone out, so it is not retried unless an
--                                admin confirms it was not received.
--   last_event, last_event_at    the latest Resend webhook event seen for the row.
--   bounced_at                   when Resend reported a bounce or complaint.
--   superseded_at, superseded_reason
--
-- Data change: transactional_emails ids 1, 2, 3, 5, 6 failed before RESEND_API_KEY existed
-- (6 to 18 Nov, error "RESEND_API_KEY is not configured"). Fabien, 2026-11-19: keep them marked
-- superseded rather than resend stale messages. The update is guarded by id, status and the
-- exact error, so it is a no-op anywhere those rows do not match.
--
-- Rollback (run only with approval, app rolled back first):
--   DROP TRIGGER IF EXISTS trg_transactional_emails_superseded_guard ON transactional_emails;
--   DROP TRIGGER IF EXISTS trg_lead_delivery_emails_superseded_guard ON lead_delivery_emails;
--   DROP FUNCTION IF EXISTS email_outbox_superseded_guard();
--   UPDATE transactional_emails SET status = 'FAILED' WHERE status = 'SUPERSEDED';
--   UPDATE transactional_emails SET status = 'SENT' WHERE status IN ('BOUNCED', 'COMPLAINED');
--   UPDATE lead_delivery_emails SET status = 'SENT' WHERE status IN ('BOUNCED', 'COMPLAINED');
--   UPDATE lead_delivery_emails SET status = 'FAILED' WHERE status = 'SUPERSEDED';
--   then restore both status checks to ('PENDING','SENT','FAILED','DELIVERED') and drop the new
--   columns (send_claimed_at, outcome_unknown, last_event, last_event_at, bounced_at,
--   superseded_at, superseded_reason).

DO $$
DECLARE
  t text;
  c text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transactional_emails', 'lead_delivery_emails'] LOOP
    FOR c IN
      SELECT con.conname FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = t AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%status%'
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, c);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE transactional_emails
  ADD CONSTRAINT transactional_emails_status_check
  CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'COMPLAINED', 'SUPERSEDED'));
ALTER TABLE lead_delivery_emails
  ADD CONSTRAINT lead_delivery_emails_status_check
  CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'COMPLAINED', 'SUPERSEDED'));

ALTER TABLE transactional_emails
  ADD COLUMN send_claimed_at TIMESTAMPTZ,
  ADD COLUMN outcome_unknown BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN last_event TEXT,
  ADD COLUMN last_event_at TIMESTAMPTZ,
  ADD COLUMN bounced_at TIMESTAMPTZ,
  ADD COLUMN superseded_at TIMESTAMPTZ,
  ADD COLUMN superseded_reason TEXT;
ALTER TABLE lead_delivery_emails
  ADD COLUMN send_claimed_at TIMESTAMPTZ,
  ADD COLUMN outcome_unknown BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN last_event TEXT,
  ADD COLUMN last_event_at TIMESTAMPTZ,
  ADD COLUMN bounced_at TIMESTAMPTZ,
  ADD COLUMN superseded_at TIMESTAMPTZ,
  ADD COLUMN superseded_reason TEXT;

-- Both tables already index provider_message_id (20261104161000, 20261110100000), which the
-- webhook lookups use.

CREATE FUNCTION email_outbox_superseded_guard() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'SUPERSEDED' AND NEW.status IS DISTINCT FROM 'SUPERSEDED' THEN
    RAISE EXCEPTION 'email % was superseded and can never be sent', OLD.id;
  END IF;
  IF NEW.status = 'SUPERSEDED' AND OLD.status IN ('SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED') THEN
    RAISE EXCEPTION 'email % already went out and cannot be marked superseded', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactional_emails_superseded_guard
  BEFORE UPDATE ON transactional_emails
  FOR EACH ROW EXECUTE FUNCTION email_outbox_superseded_guard();
CREATE TRIGGER trg_lead_delivery_emails_superseded_guard
  BEFORE UPDATE ON lead_delivery_emails
  FOR EACH ROW EXECUTE FUNCTION email_outbox_superseded_guard();

UPDATE transactional_emails
SET status = 'SUPERSEDED',
    superseded_at = now(),
    superseded_reason = 'Failed before email sending was configured. Superseded, not resent (Fabien, 2026-11-19).',
    updated_at = now()
WHERE id IN (1, 2, 3, 5, 6)
  AND status = 'FAILED'
  AND error_message = 'RESEND_API_KEY is not configured';
