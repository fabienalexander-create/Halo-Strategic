# Booked appointments: rollback and recovery

Status: DOCUMENTATION ONLY. None of the SQL below has been run anywhere except local throwaway
test databases (`lib/bookedAppointments.integration.test.ts` runs it before and after real use,
checks the previous behaviour and data are back, then re-applies the migration). Do not run it
against production without Fabien's explicit approval.

## What the migration adds (20261126150000_booked_appointments.sql)

- `lead_type` (`VERIFIED_ENQUIRY` default, or `BOOKED_APPOINTMENT`) on `leads`,
  `package_definitions` and `buyer_packages`
- `buyers.agreed_price_per_appointment` (NULL = the buyer doesn't buy appointments)
- Tables `lead_appointments` (one per allocation) and `lead_appointment_events` (append-only
  history), with triggers `trg_lead_appointments_guard`, `trg_lead_appointments_history`,
  `trg_lead_appointment_events_guard`
- Deferred constraint trigger `trg_appointment_allocation_requires_booking` on `lead_allocations`
- Triggers `trg_leads_lead_type_guard` and `trg_buyer_packages_lead_type_guard`
- Replacement reason codes widened (a superset) with `HOMEOWNER_NO_SHOW` and
  `APPOINTMENT_CANCELLED_BY_HOMEOWNER`
- Replaced functions (every earlier rule kept, new rules added): `lead_allocations_guard`,
  `replacement_requests_guard`, `allocation_release_check`
- `package_balances` view: `lead_type` appended as the last column

No existing row is modified: existing leads, packages and definitions become `VERIFIED_ENQUIRY`
through the column default, which is what they are.

This migration builds on the credits ledger. If both ever had to be rolled back, roll this one
back first, then the ledger (docs/CREDITS_LEDGER_ROLLBACK.md).

## Before the production migration

1. Netlify takes an on-publish snapshot automatically; also export `leads`, `buyer_packages`,
   `package_definitions`, `buyers`, `lead_allocations` and `replacement_requests` (pg_dump).
2. Check the deploy preview applied the migration to its branch database, and run
   `lib/bookedAppointments.integration.test.ts` locally.
3. Record before and after, and check they match (read-only):
   `SELECT count(*) FROM leads;`  `SELECT count(*), sum(leads_used) FROM buyer_packages;`
   `SELECT count(*) FROM lead_allocations;`  `SELECT count(*) FROM replacement_requests;`
   After: `SELECT lead_type, count(*) FROM leads GROUP BY 1;` shows only `VERIFIED_ENQUIRY`.

## When a rollback is safe

Before any appointment has been recorded, rollback simply removes the new objects.

After real use it is still safe, but it **refuses to run** (step 0) while any of these exist,
because the old schema could not protect them:
- an appointment still `BOOKED` or `RESCHEDULED` (its date would be lost);
- an appointment allocation that is live but not yet delivered (a cancelled one could then be
  released by the old release check);
- a booked-appointment package with unused credits (they would turn into enquiry credits).

Once those are resolved, the rollback:
- **loses nothing:** every appointment, its full history, every lead/package/definition type, every
  appointment price and every appointment reason code is copied to `booked_appointments_backup_*`
  tables first, in the same transaction; `audit_log` keeps `APPOINTMENT_STATUS_RECORDED`,
  `LEAD_TYPE_CHANGED` and `BUYER_APPOINTMENT_PRICE_SET` entries;
- **cannot preserve** in the old schema: which past leads were appointments (all read as ordinary
  leads), and the two appointment reason codes (shown as `OTHER`; originals in the backup).

After go-live, **a fix forward (a new migration) is preferred to a rollback.**

## Rollback SQL (run in one transaction, only with approval)

<!-- rollback-sql:start -->
```sql
BEGIN;

-- 0. Refuse while anything would be left in an unsafe state. The old schema has no idea what an
--    appointment is: a future appointment would lose its date, a cancelled-but-undelivered one
--    could be released by the old release check, and unused appointment credits would turn into
--    enquiry credits. Resolve these first (record outcomes, refund unused credits), then run this.
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM lead_appointments WHERE status IN ('BOOKED', 'RESCHEDULED');
  IF n > 0 THEN RAISE EXCEPTION 'rollback refused: % appointment(s) still booked; record their outcome first', n; END IF;
  SELECT count(*) INTO n FROM lead_appointments ap JOIN lead_allocations la ON la.id = ap.lead_allocation_id
   WHERE la.status IN ('OFFERED', 'ACCEPTED', 'PURCHASED')
     AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.lead_allocation_id = la.id);
  IF n > 0 THEN RAISE EXCEPTION 'rollback refused: % appointment allocation(s) live but not delivered; close them first', n; END IF;
  SELECT count(*) INTO n FROM buyer_packages
   WHERE lead_type = 'BOOKED_APPOINTMENT' AND leads_included - leads_used - credits_refunded > 0;
  IF n > 0 THEN RAISE EXCEPTION 'rollback refused: % booked-appointment package(s) have unused credits; refund or use them first', n; END IF;
END $$;

-- 1. Keep everything the old schema cannot hold.
CREATE TABLE booked_appointments_backup_lead_appointments AS SELECT * FROM lead_appointments;
CREATE TABLE booked_appointments_backup_lead_appointment_events AS SELECT * FROM lead_appointment_events;
CREATE TABLE booked_appointments_backup_leads AS SELECT id, lead_type FROM leads WHERE lead_type <> 'VERIFIED_ENQUIRY';
CREATE TABLE booked_appointments_backup_buyer_packages AS SELECT id, lead_type FROM buyer_packages WHERE lead_type <> 'VERIFIED_ENQUIRY';
CREATE TABLE booked_appointments_backup_package_definitions AS SELECT id, lead_type FROM package_definitions WHERE lead_type <> 'VERIFIED_ENQUIRY';
CREATE TABLE booked_appointments_backup_buyers AS SELECT id, agreed_price_per_appointment FROM buyers WHERE agreed_price_per_appointment IS NOT NULL;
CREATE TABLE booked_appointments_backup_replacement_requests AS
  SELECT id, reason_code FROM replacement_requests WHERE reason_code IN ('HOMEOWNER_NO_SHOW', 'APPOINTMENT_CANCELLED_BY_HOMEOWNER');

-- 2. Map the two appointment reason codes onto OTHER (original codes are in the backup), then
--    restore the previous reason-code check. The guard forbids editing a recorded request, so it
--    is paused for this one statement only.
ALTER TABLE replacement_requests DISABLE TRIGGER trg_replacement_requests_guard;
UPDATE replacement_requests SET reason_code = 'OTHER'
 WHERE reason_code IN ('HOMEOWNER_NO_SHOW', 'APPOINTMENT_CANCELLED_BY_HOMEOWNER');
ALTER TABLE replacement_requests ENABLE TRIGGER trg_replacement_requests_guard;
ALTER TABLE replacement_requests DROP CONSTRAINT replacement_requests_reason_code_check;
ALTER TABLE replacement_requests
  ADD CONSTRAINT replacement_requests_reason_code_check CHECK (reason_code IN (
    'INVALID_CONTACT', 'INCORRECT_INDIVIDUAL', 'NO_GENUINE_INTEREST', 'INCORRECT_SERVICE',
    'DUPLICATE', 'UNREACHABLE_DOCUMENTED', 'INACCURATE_DETAILS', 'OTHER'));

-- 3. Previous guard functions, exactly as in 20261126100000_credits_ledger.sql.
CREATE OR REPLACE FUNCTION lead_allocations_guard() RETURNS trigger AS $$
DECLARE
  c homeowner_confirmations%ROWTYPE;
  pkg_buyer INTEGER;
  pkg_expires TIMESTAMPTZ;
  buyer_arrangement TEXT;
  rr RECORD;
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
    SELECT buyer_id, expires_at INTO pkg_buyer, pkg_expires FROM buyer_packages WHERE id = NEW.package_id FOR UPDATE;
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
  IF TG_OP = 'INSERT' OR NEW.allocation_type IS DISTINCT FROM OLD.allocation_type THEN
    SELECT exclusivity_arrangement INTO buyer_arrangement FROM buyers WHERE id = NEW.buyer_id;
    IF buyer_arrangement = 'shared' AND NEW.allocation_type = 'EXCLUSIVE_WINDOW' THEN
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
           oa.package_id AS original_package_id
      INTO rr
      FROM replacement_requests r
      JOIN deliveries d ON d.id = r.delivery_id
      JOIN lead_allocations oa ON oa.id = d.lead_allocation_id
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
END;
$$ LANGUAGE plpgsql;

-- 4. Previous package_balances view (without lead_type).
DROP VIEW package_balances;
CREATE VIEW package_balances AS
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
  END AS refund_due_amount
FROM buyer_packages bp;

-- 5. Drop the appointment objects.
DROP TRIGGER trg_appointment_allocation_requires_booking ON lead_allocations;
DROP TRIGGER trg_leads_lead_type_guard ON leads;
DROP TRIGGER trg_buyer_packages_lead_type_guard ON buyer_packages;
DROP TABLE lead_appointment_events;
DROP TABLE lead_appointments;
DROP FUNCTION appointment_allocation_requires_booking();
DROP FUNCTION leads_lead_type_guard();
DROP FUNCTION buyer_packages_lead_type_guard();
DROP FUNCTION lead_appointments_guard();
DROP FUNCTION lead_appointments_history();
DROP FUNCTION lead_appointment_events_guard();

-- 6. Drop the new columns.
ALTER TABLE leads DROP COLUMN lead_type;
ALTER TABLE package_definitions DROP COLUMN lead_type;
ALTER TABLE buyer_packages DROP COLUMN lead_type;
ALTER TABLE buyers DROP COLUMN agreed_price_per_appointment;

COMMIT;
```
<!-- rollback-sql:end -->

After the rollback, deploy the previous application build (the allocate, appointment and
lead-type routes depend on the dropped columns). Remove the migration file from the repository
so it is not re-applied, and remove its entry from the migrations record Netlify DB keeps.

## Recovery

- Re-apply the migration file. Every lead and package comes back as `VERIFIED_ENQUIRY`.
- Restore types from the backups before allocating anything, e.g.
  `UPDATE leads l SET lead_type = b.lead_type FROM booked_appointments_backup_leads b WHERE b.id = l.id;`
  (the lead-type guard allows this only for leads not yet allocated; allocated leads keep the
  record in the backup and in `audit_log`). Appointment prices:
  `UPDATE buyers u SET agreed_price_per_appointment = b.agreed_price_per_appointment FROM booked_appointments_backup_buyers b WHERE b.id = u.id;`
- Past appointments and their history stay in the backup tables as the record; they are not
  re-inserted (the guard only accepts future appointments).
- Full restore from the on-publish snapshot is the last resort.
