-- Closes a real enforcement gap found during a production incident review (HLX-PROSPECT-000003,
-- registered via an automation that hardcoded consent_contact=true for a Meta lead without real
-- consent evidence): PAUSED described a prospect's status but did not actually stop an email being
-- sent to them, at either the application check (lib/buyerProspectEmail.ts) or this database
-- trigger. Both are updated together so neither layer can silently diverge from the other.
--
-- Pure function replacement -- no table, column, or existing row touched. Additive and safe
-- regardless of what data currently exists.
CREATE OR REPLACE FUNCTION buyer_prospect_emails_guard_suppression() RETURNS trigger AS $$
DECLARE
  p RECORD;
BEGIN
  IF NEW.status = 'SENT' THEN
    SELECT nurture_status, email_bounced_at, email_complained_at INTO p
    FROM buyer_prospects WHERE id = NEW.prospect_id;
    IF p.nurture_status = 'UNSUBSCRIBED' OR p.nurture_status = 'PAUSED'
       OR p.email_bounced_at IS NOT NULL OR p.email_complained_at IS NOT NULL THEN
      RAISE EXCEPTION 'prospect % is suppressed (unsubscribed, paused, bounced or complained); outbox row % cannot be marked SENT', NEW.prospect_id, NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
