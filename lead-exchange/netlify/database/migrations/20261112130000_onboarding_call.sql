-- Mandatory onboarding call: a buyer cannot go ACTIVE until an admin has recorded that the call
-- took place (who held it, and when). Application review comes first, the call second, then
-- commercials, payment and activation (agreed operating model, 2026-11-12).
--
-- Two columns, no new status: the call is a recorded milestone on the existing status model
-- (PENDING_COMMERCIALS), not a new state. Existing ACTIVE buyers are not backfilled and are not
-- affected -- the guard below only fires on a transition INTO 'ACTIVE'.
ALTER TABLE buyers
  ADD COLUMN onboarding_call_completed_at TIMESTAMPTZ,
  ADD COLUMN onboarding_call_conducted_by TEXT,
  ADD CONSTRAINT buyers_onboarding_call_pair_check
    CHECK ((onboarding_call_completed_at IS NULL) = (onboarding_call_conducted_by IS NULL));

-- Database-level backstop behind the activate route's own check, same pattern as the other guard
-- triggers (allocation, payment, delivery release): even a future code path, a manual SQL update
-- or a bug cannot move a buyer into ACTIVE without a recorded onboarding call.
CREATE FUNCTION buyers_require_onboarding_call() RETURNS trigger AS $$
BEGIN
  IF NEW.application_status = 'ACTIVE'
     AND (TG_OP = 'INSERT' OR OLD.application_status IS DISTINCT FROM 'ACTIVE')
     AND NEW.onboarding_call_completed_at IS NULL THEN
    RAISE EXCEPTION 'buyer % cannot become ACTIVE without a recorded onboarding call', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_buyers_require_onboarding_call
  BEFORE INSERT OR UPDATE OF application_status ON buyers
  FOR EACH ROW EXECUTE FUNCTION buyers_require_onboarding_call();
