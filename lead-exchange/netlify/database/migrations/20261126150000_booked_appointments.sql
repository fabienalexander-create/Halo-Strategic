-- Booked appointments as a distinct lead type (Technical PR B). Plan and decisions approved by
-- Fabien 2026-11-26: one buyer only per appointment; Halo admin records the date, time and the
-- homeowner's confirmation by hand (no calendar integration). Rollback: docs/BOOKED_APPOINTMENTS_ROLLBACK.md.
--
-- Additive. Existing leads, packages and package definitions become VERIFIED_ENQUIRY through the
-- column default, which is what they are; no row is UPDATEd or deleted. The only non-additive
-- steps replace a check with a SUPERSET (replacement reason codes gain two appointment codes) and
-- replace three guard functions with versions that keep every existing rule and add new ones
-- (lead_allocations_guard, replacement_requests_guard, allocation_release_check). Their previous
-- definitions, from 20261126100000_credits_ledger.sql, are in the rollback document.
--
-- Rules the database enforces:
--   * a booked-appointment lead is allocated to ONE buyer (EXCLUSIVE_WINDOW only);
--   * it cannot be allocated without a future BOOKED appointment recorded in the same
--     transaction (deferred check at commit);
--   * a package's credits are for one lead type, and a replacement is like for like;
--   * a lead's type cannot change once it has been allocated;
--   * an appointment's outcome is recorded once, in order, with history kept (append-only);
--   * a cancelled appointment is never released to the buyer;
--   * a no-show/cancellation replacement claim needs that outcome recorded on the appointment.

-- 1. Lead type.
ALTER TABLE leads
  ADD COLUMN lead_type TEXT NOT NULL DEFAULT 'VERIFIED_ENQUIRY'
    CHECK (lead_type IN ('VERIFIED_ENQUIRY', 'BOOKED_APPOINTMENT'));
ALTER TABLE package_definitions
  ADD COLUMN lead_type TEXT NOT NULL DEFAULT 'VERIFIED_ENQUIRY'
    CHECK (lead_type IN ('VERIFIED_ENQUIRY', 'BOOKED_APPOINTMENT'));
ALTER TABLE buyer_packages
  ADD COLUMN lead_type TEXT NOT NULL DEFAULT 'VERIFIED_ENQUIRY'
    CHECK (lead_type IN ('VERIFIED_ENQUIRY', 'BOOKED_APPOINTMENT'));

-- 2. A second agreed price per buyer, for booked appointments. NULL = this buyer does not buy
-- appointments; the allocate route refuses an appointment allocation without it.
ALTER TABLE buyers
  ADD COLUMN agreed_price_per_appointment NUMERIC CHECK (agreed_price_per_appointment >= 0);

-- 3. Appointments, one per allocation, plus an append-only history of every change.
CREATE TABLE lead_appointments (
  id SERIAL PRIMARY KEY,
  lead_allocation_id INTEGER NOT NULL UNIQUE REFERENCES lead_allocations(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  appointment_kind TEXT NOT NULL CHECK (appointment_kind IN ('IN_PERSON', 'PHONE', 'VIDEO')),
  location_notes TEXT,                                       -- e.g. "at the property" or "buyer to call the homeowner"
  homeowner_confirmed_at TIMESTAMPTZ NOT NULL,                -- when the homeowner agreed this date and time
  arranged_by TEXT NOT NULL CHECK (length(trim(arranged_by)) > 0),
  status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN (
    'BOOKED', 'RESCHEDULED', 'CANCELLED_BY_HOMEOWNER', 'HOMEOWNER_NO_SHOW', 'CANCELLED_BY_BUYER', 'COMPLETED')),
  outcome_notes TEXT,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE lead_appointment_events (
  id SERIAL PRIMARY KEY,
  lead_appointment_id INTEGER NOT NULL REFERENCES lead_appointments(id),
  event TEXT NOT NULL,                                        -- BOOKED, RESCHEDULED, or the outcome status
  previous_status TEXT,
  new_status TEXT NOT NULL,
  previous_scheduled_at TIMESTAMPTZ,
  new_scheduled_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_appointment_events_appointment ON lead_appointment_events(lead_appointment_id);

-- 4. Replacement reason codes: a superset adding the two appointment outcomes.
ALTER TABLE replacement_requests DROP CONSTRAINT replacement_requests_reason_code_check;
ALTER TABLE replacement_requests
  ADD CONSTRAINT replacement_requests_reason_code_check CHECK (reason_code IN (
    'INVALID_CONTACT', 'INCORRECT_INDIVIDUAL', 'NO_GENUINE_INTEREST', 'INCORRECT_SERVICE',
    'DUPLICATE', 'UNREACHABLE_DOCUMENTED', 'INACCURATE_DETAILS', 'OTHER',
    'HOMEOWNER_NO_SHOW', 'APPOINTMENT_CANCELLED_BY_HOMEOWNER'));

-- 5. Guard functions.

-- lead_appointments: recorded BOOKED for a booked-appointment lead, in the future, with the
-- homeowner's confirmation; then moved through its outcome once. Rescheduling keeps the status
-- live and needs a new future time. A no-show or completion can only be recorded once the time
-- has passed. Final outcomes never change; rows are never deleted. Every insert and change is
-- written to lead_appointment_events.
CREATE FUNCTION lead_appointments_guard() RETURNS trigger AS $$
DECLARE
  lt TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'appointments cannot be deleted (appointment %)', OLD.id;
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT l.lead_type INTO lt FROM lead_allocations la JOIN leads l ON l.id = la.lead_id WHERE la.id = NEW.lead_allocation_id;
    IF lt IS DISTINCT FROM 'BOOKED_APPOINTMENT' THEN
      RAISE EXCEPTION 'allocation % is not for a booked-appointment lead', NEW.lead_allocation_id;
    END IF;
    IF NEW.status <> 'BOOKED' THEN
      RAISE EXCEPTION 'a new appointment must be recorded as BOOKED';
    END IF;
    IF NEW.scheduled_at <= now() THEN
      RAISE EXCEPTION 'the appointment time must be in the future';
    END IF;
    IF NEW.homeowner_confirmed_at > now() THEN
      RAISE EXCEPTION 'the homeowner confirmation time cannot be in the future';
    END IF;
    NEW.updated_by := NEW.arranged_by;
    RETURN NEW;
  END IF;

  IF (NEW.lead_allocation_id, NEW.appointment_kind, NEW.homeowner_confirmed_at, NEW.arranged_by, NEW.created_at)
     IS DISTINCT FROM (OLD.lead_allocation_id, OLD.appointment_kind, OLD.homeowner_confirmed_at, OLD.arranged_by, OLD.created_at) THEN
    RAISE EXCEPTION 'the recorded details of appointment % cannot be changed', OLD.id;
  END IF;
  IF OLD.status NOT IN ('BOOKED', 'RESCHEDULED') THEN
    RAISE EXCEPTION 'appointment % is already % and cannot be changed', OLD.id, OLD.status;
  END IF;
  IF coalesce(trim(NEW.updated_by), '') = '' THEN
    RAISE EXCEPTION 'record who changed appointment %', OLD.id;
  END IF;
  IF NEW.status = 'RESCHEDULED' THEN
    IF NEW.scheduled_at <= now() OR NEW.scheduled_at = OLD.scheduled_at THEN
      RAISE EXCEPTION 'a rescheduled appointment needs a new time in the future';
    END IF;
  ELSIF NEW.status = 'BOOKED' THEN
    RAISE EXCEPTION 'appointment % is already booked; reschedule it or record its outcome', OLD.id;
  ELSE
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
      RAISE EXCEPTION 'recording an outcome cannot also change the appointment time';
    END IF;
    IF NEW.status IN ('HOMEOWNER_NO_SHOW', 'COMPLETED') AND now() < OLD.scheduled_at THEN
      RAISE EXCEPTION 'appointment % has not happened yet; % can only be recorded after %', OLD.id, NEW.status, OLD.scheduled_at;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_appointments_guard
  BEFORE INSERT OR UPDATE OR DELETE ON lead_appointments
  FOR EACH ROW EXECUTE FUNCTION lead_appointments_guard();

CREATE FUNCTION lead_appointments_history() RETURNS trigger AS $$
BEGIN
  INSERT INTO lead_appointment_events (lead_appointment_id, event, previous_status, new_status,
    previous_scheduled_at, new_scheduled_at, notes, actor)
  VALUES (NEW.id, CASE WHEN TG_OP = 'INSERT' THEN 'BOOKED' ELSE NEW.status END,
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END, NEW.status,
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.scheduled_at END, NEW.scheduled_at,
          NEW.outcome_notes, NEW.updated_by);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_appointments_history
  AFTER INSERT OR UPDATE ON lead_appointments
  FOR EACH ROW EXECUTE FUNCTION lead_appointments_history();

CREATE FUNCTION lead_appointment_events_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'appointment history is a permanent record and cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_appointment_events_guard
  BEFORE UPDATE OR DELETE ON lead_appointment_events
  FOR EACH ROW EXECUTE FUNCTION lead_appointment_events_guard();

-- A booked-appointment allocation must have a future BOOKED appointment by the time its
-- transaction commits (the allocate route records both together).
CREATE FUNCTION appointment_allocation_requires_booking() RETURNS trigger AS $$
BEGIN
  IF (SELECT lead_type FROM leads WHERE id = NEW.lead_id) = 'BOOKED_APPOINTMENT'
     AND NOT EXISTS (SELECT 1 FROM lead_appointments
                      WHERE lead_allocation_id = NEW.id AND status = 'BOOKED' AND scheduled_at > now()) THEN
    RAISE EXCEPTION 'allocation % is for a booked appointment but has no future appointment recorded', NEW.id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_appointment_allocation_requires_booking
  AFTER INSERT ON lead_allocations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION appointment_allocation_requires_booking();

-- A lead's type is fixed once it has been allocated to anyone.
CREATE FUNCTION leads_lead_type_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.lead_type IS DISTINCT FROM OLD.lead_type
     AND EXISTS (SELECT 1 FROM lead_allocations WHERE lead_id = OLD.id) THEN
    RAISE EXCEPTION 'lead % has been allocated; its type cannot be changed', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_lead_type_guard
  BEFORE UPDATE OF lead_type ON leads
  FOR EACH ROW EXECUTE FUNCTION leads_lead_type_guard();

-- A package's lead type is fixed once recorded (it decides which leads its credits can buy).
CREATE FUNCTION buyer_packages_lead_type_guard() RETURNS trigger AS $$
DECLARE
  def_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.package_definition_id IS NOT NULL THEN
      SELECT lead_type INTO def_type FROM package_definitions WHERE id = NEW.package_definition_id;
      IF def_type IS DISTINCT FROM NEW.lead_type THEN
        RAISE EXCEPTION 'package lead type % does not match its definition (%)', NEW.lead_type, def_type;
      END IF;
    END IF;
  ELSIF NEW.lead_type IS DISTINCT FROM OLD.lead_type THEN
    RAISE EXCEPTION 'package % lead type cannot be changed once recorded', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_buyer_packages_lead_type_guard
  BEFORE INSERT OR UPDATE OF lead_type ON buyer_packages
  FOR EACH ROW EXECUTE FUNCTION buyer_packages_lead_type_guard();

-- lead_allocations: every earlier rule kept; adds package lead-type matching, like-for-like
-- replacements and one-buyer-only booked appointments.
CREATE OR REPLACE FUNCTION lead_allocations_guard() RETURNS trigger AS $$
DECLARE
  c homeowner_confirmations%ROWTYPE;
  pkg_buyer INTEGER;
  pkg_expires TIMESTAMPTZ;
  buyer_arrangement TEXT;
  rr RECORD;
  new_lead_type TEXT;
  pkg_lead_type TEXT;
  original_lead_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.pre_pay_to_unlock := false;
  ELSE
    IF NEW.pre_pay_to_unlock IS DISTINCT FROM OLD.pre_pay_to_unlock THEN
      RAISE EXCEPTION 'pre_pay_to_unlock cannot be changed (allocation %)', OLD.id;
    END IF;
    IF NEW.replacement_request_id IS DISTINCT FROM OLD.replacement_request_id THEN
      RAISE EXCEPTION 'the replacement link cannot be changed (allocation %)', OLD.id;
    END IF;
    IF OLD.package_id IS NOT NULL AND NEW.package_id IS DISTINCT FROM OLD.package_id THEN
      RAISE EXCEPTION 'package cannot be changed once used (allocation %)', OLD.id;
    END IF;
    IF OLD.homeowner_confirmation_id IS NOT NULL
       AND NEW.homeowner_confirmation_id IS DISTINCT FROM OLD.homeowner_confirmation_id THEN
      RAISE EXCEPTION 'homeowner confirmation cannot be changed (allocation %)', OLD.id;
    END IF;
  END IF;

  IF NEW.homeowner_confirmation_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.homeowner_confirmation_id IS NULL) THEN
    SELECT * INTO c FROM homeowner_confirmations WHERE id = NEW.homeowner_confirmation_id;
    IF c.lead_id <> NEW.lead_id OR c.buyer_id <> NEW.buyer_id THEN
      RAISE EXCEPTION 'homeowner confirmation % is for a different lead or buyer', c.id;
    END IF;
    IF c.withdrawn_at IS NOT NULL THEN
      RAISE EXCEPTION 'homeowner confirmation % has been withdrawn', c.id;
    END IF;
  END IF;

  IF NEW.package_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.package_id IS NULL) THEN
    -- Lock the package row so two allocations, or an allocation and a refund, using the same
    -- package are serialised; the balance check constraint is then evaluated on committed values.
    SELECT buyer_id, expires_at, lead_type INTO pkg_buyer, pkg_expires, pkg_lead_type FROM buyer_packages WHERE id = NEW.package_id FOR UPDATE;
    SELECT lead_type INTO new_lead_type FROM leads WHERE id = NEW.lead_id;
    -- A package's credits are for one lead type (booked appointments migration).
    IF pkg_lead_type IS DISTINCT FROM new_lead_type THEN
      RAISE EXCEPTION 'package % is for % leads and cannot be used for a % lead', NEW.package_id, pkg_lead_type, new_lead_type;
    END IF;
    IF pkg_buyer <> NEW.buyer_id THEN
      RAISE EXCEPTION 'package % belongs to a different buyer', NEW.package_id;
    END IF;
    -- Credits expire (packages recorded from the credits-ledger migration on). Packages that
    -- existed before it have no expiry and are never blocked here.
    IF pkg_expires IS NOT NULL AND now() >= pkg_expires THEN
      RAISE EXCEPTION 'package % expired on %; its credits cannot be used', NEW.package_id, pkg_expires;
    END IF;
    IF NEW.replacement_request_id IS NOT NULL THEN
      RAISE EXCEPTION 'a free replacement allocation cannot also use a package (allocation %)', NEW.id;
    END IF;
    PERFORM set_config('hlx.package_slot', 'on', true);
    UPDATE buyer_packages SET leads_used = leads_used + 1 WHERE id = NEW.package_id;
    PERFORM set_config('hlx.package_slot', 'off', true);
  END IF;

  -- An EXCLUSIVE_WINDOW allocation cannot be created (or transitioned into a live status) while
  -- ANY other live allocation already exists for this lead, whatever that other allocation's own
  -- type is. This is the actual meaning of "exclusive" -- the uniqueness index above only covers
  -- the EXCLUSIVE-vs-EXCLUSIVE case; this covers EXCLUSIVE-vs-SHARED too.
  IF NEW.allocation_type = 'EXCLUSIVE_WINDOW' AND NEW.status IN ('OFFERED', 'ACCEPTED', 'PURCHASED')
     AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('OFFERED', 'ACCEPTED', 'PURCHASED') OR OLD.allocation_type <> 'EXCLUSIVE_WINDOW') THEN
    IF EXISTS (
      SELECT 1 FROM lead_allocations
      WHERE lead_id = NEW.lead_id AND id <> NEW.id AND status IN ('OFFERED', 'ACCEPTED', 'PURCHASED')
    ) THEN
      RAISE EXCEPTION 'lead % already has another live allocation; cannot claim it exclusively (allocation %)', NEW.lead_id, NEW.id;
    END IF;
  END IF;

  -- The row's allocation_type must match what was actually agreed with this buyer. A buyer
  -- recorded as 'shared' has no basis to claim a lead exclusively; a buyer recorded as 'exclusive'
  -- is not the one to put into shared inventory without that being renegotiated and re-recorded
  -- first. A buyer with no recorded arrangement yet (NULL) is not blocked here -- that is a data
  -- gap for the admin UI to prompt for, not something the database should guess at or refuse on.
  -- A booked appointment is exempt from the 'shared' rule: the arrangement covers enquiries, and an
  -- appointment always goes to one buyer (booked appointments migration; enforced below).
  IF TG_OP = 'INSERT' OR NEW.allocation_type IS DISTINCT FROM OLD.allocation_type THEN
    SELECT exclusivity_arrangement INTO buyer_arrangement FROM buyers WHERE id = NEW.buyer_id;
    IF buyer_arrangement = 'shared' AND NEW.allocation_type = 'EXCLUSIVE_WINDOW'
       AND (SELECT lead_type FROM leads WHERE id = NEW.lead_id) IS DISTINCT FROM 'BOOKED_APPOINTMENT' THEN
      RAISE EXCEPTION 'buyer % is contracted for shared leads only; allocation % cannot be EXCLUSIVE_WINDOW', NEW.buyer_id, NEW.id;
    END IF;
    IF buyer_arrangement = 'exclusive' AND NEW.allocation_type = 'SHARED' THEN
      RAISE EXCEPTION 'buyer % is contracted for exclusive leads only; allocation % cannot be SHARED', NEW.buyer_id, NEW.id;
    END IF;
  END IF;

  -- A free replacement allocation (pay-per-lead leads only; a package lead's replacement restores
  -- its credit instead). It must point at an APPROVED, still-unresolved replacement request for
  -- the same buyer, for a different lead, and carry a zero price: it is released without payment
  -- (allocation_release_check) and can never take one (payments_guard).
  IF TG_OP = 'INSERT' AND NEW.replacement_request_id IS NOT NULL THEN
    SELECT r.status, r.resolution, oa.buyer_id AS original_buyer_id, oa.lead_id AS original_lead_id,
           oa.package_id AS original_package_id, ol.lead_type AS original_lead_type
      INTO rr
      FROM replacement_requests r
      JOIN deliveries d ON d.id = r.delivery_id
      JOIN lead_allocations oa ON oa.id = d.lead_allocation_id
      JOIN leads ol ON ol.id = oa.lead_id
     WHERE r.id = NEW.replacement_request_id
       FOR UPDATE OF r;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'replacement request % does not exist', NEW.replacement_request_id;
    END IF;
    IF rr.status <> 'APPROVED' OR rr.resolution IS NOT NULL THEN
      RAISE EXCEPTION 'replacement request % is not approved and awaiting a replacement', NEW.replacement_request_id;
    END IF;
    IF rr.original_buyer_id <> NEW.buyer_id THEN
      RAISE EXCEPTION 'replacement request % belongs to a different buyer', NEW.replacement_request_id;
    END IF;
    IF rr.original_package_id IS NOT NULL THEN
      RAISE EXCEPTION 'replacement request % is for a package lead; restore the credit instead', NEW.replacement_request_id;
    END IF;
    IF rr.original_lead_id = NEW.lead_id THEN
      RAISE EXCEPTION 'a replacement must be a different lead from the one it replaces';
    END IF;
    IF NEW.agreed_price IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'a free replacement allocation must have an agreed price of 0';
    END IF;
    -- A replacement is like for like: a booked appointment is replaced by a booked appointment.
    IF (SELECT lead_type FROM leads WHERE id = NEW.lead_id) IS DISTINCT FROM rr.original_lead_type THEN
      RAISE EXCEPTION 'a replacement must be the same lead type as the lead it replaces (%)', rr.original_lead_type;
    END IF;
  END IF;

  -- A booked appointment goes to one buyer only (Fabien, 2026-11-26): never shared.
  IF TG_OP = 'INSERT' OR NEW.allocation_type IS DISTINCT FROM OLD.allocation_type THEN
    IF (SELECT lead_type FROM leads WHERE id = NEW.lead_id) = 'BOOKED_APPOINTMENT' AND NEW.allocation_type <> 'EXCLUSIVE_WINDOW' THEN
      RAISE EXCEPTION 'a booked appointment can only be allocated to one buyer (EXCLUSIVE_WINDOW), allocation %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- replacement_requests: every earlier rule kept; appointment claims need the outcome recorded.
CREATE OR REPLACE FUNCTION replacement_requests_guard() RETURNS trigger AS $$
DECLARE
  oa lead_allocations%ROWTYPE;
  pkg buyer_packages%ROWTYPE;
  delivery_buyer INTEGER;
  lead_price NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'replacement requests cannot be deleted (request %)', OLD.id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDING_ADMIN_REVIEW' OR NEW.resolution IS NOT NULL OR NEW.decided_by IS NOT NULL
       OR NEW.decided_at IS NOT NULL OR NEW.replacement_allocation_id IS NOT NULL OR NEW.refund_amount IS NOT NULL THEN
      RAISE EXCEPTION 'a replacement request must be recorded as PENDING_ADMIN_REVIEW with no decision';
    END IF;
    IF NEW.reason_code IS NULL OR NEW.reported_at IS NULL OR coalesce(trim(NEW.recorded_by), '') = '' THEN
      RAISE EXCEPTION 'a replacement request needs a reason code, the time the buyer reported it and who recorded it';
    END IF;
    SELECT la.buyer_id INTO delivery_buyer
      FROM deliveries d JOIN lead_allocations la ON la.id = d.lead_allocation_id
     WHERE d.id = NEW.delivery_id AND d.delivered_at IS NOT NULL;
    IF delivery_buyer IS NULL THEN
      RAISE EXCEPTION 'delivery % has not been delivered; there is nothing to replace', NEW.delivery_id;
    END IF;
    IF delivery_buyer <> NEW.requested_by_buyer_id THEN
      RAISE EXCEPTION 'delivery % was made to a different buyer', NEW.delivery_id;
    END IF;
    -- A claim that a booked appointment fell through needs that outcome recorded on the
    -- appointment first (booked appointments migration): HOMEOWNER_NO_SHOW or
    -- CANCELLED_BY_HOMEOWNER, never one the buyer caused.
    IF NEW.reason_code IN ('HOMEOWNER_NO_SHOW', 'APPOINTMENT_CANCELLED_BY_HOMEOWNER') THEN
      IF NOT EXISTS (
        SELECT 1 FROM deliveries d JOIN lead_appointments ap ON ap.lead_allocation_id = d.lead_allocation_id
         WHERE d.id = NEW.delivery_id
           AND ap.status = CASE NEW.reason_code WHEN 'HOMEOWNER_NO_SHOW' THEN 'HOMEOWNER_NO_SHOW' ELSE 'CANCELLED_BY_HOMEOWNER' END
      ) THEN
        RAISE EXCEPTION 'record the appointment as % before claiming a replacement for it',
          CASE NEW.reason_code WHEN 'HOMEOWNER_NO_SHOW' THEN 'HOMEOWNER_NO_SHOW' ELSE 'CANCELLED_BY_HOMEOWNER' END;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF (NEW.delivery_id, NEW.requested_by_buyer_id, NEW.reason, NEW.reason_code, NEW.documented_contact_attempts,
      NEW.reported_at, NEW.recorded_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.delivery_id, OLD.requested_by_buyer_id, OLD.reason, OLD.reason_code, OLD.documented_contact_attempts,
      OLD.reported_at, OLD.recorded_by, OLD.created_at) THEN
    RAISE EXCEPTION 'the details of replacement request % cannot be changed once recorded', OLD.id;
  END IF;
  IF OLD.status IN ('DENIED', 'APPROVED_REPLACED') THEN
    RAISE EXCEPTION 'replacement request % is closed and cannot be changed', OLD.id;
  END IF;
  IF OLD.resolution IS NOT NULL THEN
    RAISE EXCEPTION 'replacement request % is already resolved and cannot be changed', OLD.id;
  END IF;
  IF NEW.status = 'APPROVED_REPLACED' THEN
    RAISE EXCEPTION 'APPROVED_REPLACED is a legacy status; approve the request and record a resolution instead';
  END IF;
  IF OLD.status = 'PENDING_ADMIN_REVIEW' THEN
    IF NEW.status = 'PENDING_ADMIN_REVIEW' THEN
      IF NEW.resolution IS NOT NULL THEN
        RAISE EXCEPTION 'replacement request % must be approved before it is resolved', OLD.id;
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.status NOT IN ('APPROVED', 'DENIED') OR coalesce(trim(NEW.decided_by), '') = '' OR NEW.decided_at IS NULL THEN
      RAISE EXCEPTION 'a decision on replacement request % needs APPROVED or DENIED, who decided and when', OLD.id;
    END IF;
    IF NEW.resolution IS NOT NULL THEN
      RAISE EXCEPTION 'replacement request % must be approved before it is resolved', OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  -- OLD.status = 'APPROVED', not yet resolved.
  IF NEW.status <> 'APPROVED' OR (NEW.decided_by, NEW.decided_at, NEW.admin_decision_notes)
     IS DISTINCT FROM (OLD.decided_by, OLD.decided_at, OLD.admin_decision_notes) THEN
    RAISE EXCEPTION 'the decision on replacement request % cannot be changed', OLD.id;
  END IF;
  IF NEW.resolution IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT la.* INTO oa FROM deliveries d JOIN lead_allocations la ON la.id = d.lead_allocation_id
   WHERE d.id = NEW.delivery_id;

  IF NEW.resolution = 'CREDIT_RESTORED' THEN
    IF oa.package_id IS NULL THEN
      RAISE EXCEPTION 'replacement request % is for a pay-per-lead lead; supply a free replacement or refund it', OLD.id;
    END IF;
    PERFORM 1 FROM buyer_packages WHERE id = oa.package_id FOR UPDATE;
    PERFORM set_config('hlx.credit_slot', 'on', true);
    UPDATE buyer_packages SET leads_used = leads_used - 1, credits_restored = credits_restored + 1
     WHERE id = oa.package_id;
    PERFORM set_config('hlx.credit_slot', 'off', true);
  ELSIF NEW.resolution = 'REPLACEMENT_SUPPLIED' THEN
    IF oa.package_id IS NOT NULL THEN
      RAISE EXCEPTION 'replacement request % is for a package lead; restore the credit instead', OLD.id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lead_allocations
                    WHERE id = NEW.replacement_allocation_id AND replacement_request_id = OLD.id) THEN
      RAISE EXCEPTION 'allocation % is not the free replacement made for request %', NEW.replacement_allocation_id, OLD.id;
    END IF;
  ELSIF NEW.resolution = 'REFUNDED' THEN
    IF oa.package_id IS NOT NULL THEN
      SELECT * INTO pkg FROM buyer_packages WHERE id = oa.package_id;
      lead_price := round(pkg.amount_paid / pkg.leads_included, 2);
    ELSE
      lead_price := oa.agreed_price;
    END IF;
    IF lead_price IS NULL THEN
      RAISE EXCEPTION 'the price paid for the lead behind request % is not recorded; it cannot be refunded here', OLD.id;
    END IF;
    IF round(NEW.refund_amount, 2) <> round(lead_price, 2) THEN
      RAISE EXCEPTION 'refund % does not equal the price paid for the lead (%)', NEW.refund_amount, lead_price;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Release gate: every earlier rule kept; a cancelled appointment is never released.
CREATE OR REPLACE FUNCTION allocation_release_check(alloc_id INTEGER) RETURNS void AS $$
DECLARE
  a lead_allocations%ROWTYPE;
BEGIN
  SELECT * INTO a FROM lead_allocations WHERE id = alloc_id;
  IF a.pre_pay_to_unlock THEN
    RETURN;
  END IF;
  IF a.status <> 'PURCHASED' THEN
    RAISE EXCEPTION 'allocation % is % and cannot be released', a.id, a.status;
  END IF;
  IF EXISTS (SELECT 1 FROM homeowner_confirmations
             WHERE id = a.homeowner_confirmation_id AND withdrawn_at IS NOT NULL) THEN
    RAISE EXCEPTION 'homeowner withdrew consent; allocation % cannot be released', a.id;
  END IF;
  IF a.package_id IS NULL AND NOT EXISTS (
       SELECT 1 FROM payments WHERE lead_allocation_id = a.id AND status IN ('PAID', 'SETTLED'))
     AND NOT EXISTS (
       SELECT 1 FROM replacement_requests r
        WHERE r.id = a.replacement_request_id AND r.status = 'APPROVED'
          AND r.resolution = 'REPLACEMENT_SUPPLIED' AND r.replacement_allocation_id = a.id) THEN
    RAISE EXCEPTION 'allocation % has no verified payment and cannot be released', a.id;
  END IF;
  -- A booked appointment whose appointment has been cancelled is never released (booked
  -- appointments migration): the buyer would be paying for an appointment that will not happen.
  IF EXISTS (SELECT 1 FROM lead_appointments
              WHERE lead_allocation_id = a.id AND status IN ('CANCELLED_BY_HOMEOWNER', 'CANCELLED_BY_BUYER')) THEN
    RAISE EXCEPTION 'the appointment for allocation % has been cancelled; it cannot be released', a.id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Package balances view: add the lead type (view columns appended at the end).
CREATE OR REPLACE VIEW package_balances AS
SELECT
  bp.id AS buyer_package_id,
  bp.buyer_id,
  bp.package_definition_id,
  bp.amount_paid,
  bp.currency,
  bp.leads_included,
  bp.leads_used,
  bp.credits_restored,
  bp.credits_refunded,
  bp.leads_included - bp.leads_used - bp.credits_refunded AS credits_remaining,
  round(bp.amount_paid / bp.leads_included, 2) AS price_per_credit,
  bp.transaction_reference,
  bp.verified_at,
  bp.expires_at,
  (bp.expires_at IS NOT NULL AND now() >= bp.expires_at) AS expired,
  CASE
    WHEN bp.leads_included - bp.leads_used - bp.credits_refunded = 0 THEN 'USED_UP'
    WHEN bp.expires_at IS NOT NULL AND now() >= bp.expires_at THEN 'REFUND_DUE'
    ELSE 'ACTIVE'
  END AS balance_status,
  CASE
    WHEN bp.expires_at IS NOT NULL AND now() >= bp.expires_at
         AND bp.leads_included - bp.leads_used - bp.credits_refunded > 0
    THEN round(bp.amount_paid * (bp.leads_included - bp.leads_used - bp.credits_refunded) / bp.leads_included, 2)
  END AS refund_due_amount,
  bp.lead_type
FROM buyer_packages bp;
