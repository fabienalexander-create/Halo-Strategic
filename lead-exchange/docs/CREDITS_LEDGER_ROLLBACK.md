# Credits ledger: rollback and recovery

Status: DOCUMENTATION ONLY. None of the SQL below has been run anywhere except a local throwaway
test database (`lib/creditsLedger.integration.test.ts` runs it, checks the previous behaviour is
back and the existing data intact, then re-applies the migration). Do not run it against
production without Fabien's explicit approval.

## What the migration adds (20261126100000_credits_ledger.sql)

- `package_definitions.validity_months` (default 6)
- `buyer_packages.expires_at`, `credits_restored`, `credits_refunded`, and the check constraint
  `buyer_packages_credit_balance_check`
- `replacement_requests`: the status check widened to also allow `APPROVED` (a superset: every
  existing value stays valid), new columns for the reason code, report time, resolution and refund,
  the check `replacement_requests_resolution_rules_check`, the unique index
  `uq_replacement_requests_open_per_delivery` and the trigger `trg_replacement_requests_guard`
- `lead_allocations.replacement_request_id` and the unique index `uq_lead_allocations_replacement_request`
- Table `package_refunds` and its trigger `trg_package_refunds_guard`
- View `package_balances`
- Replaced functions (every earlier rule kept, new rules added): `lead_allocations_guard`,
  `buyer_packages_guard_leads_used`, `payments_guard`, `allocation_release_check`

No existing row is modified. Packages that already exist keep `expires_at = NULL` (no expiry),
`credits_restored = 0` and `credits_refunded = 0`.

## Before any production migration

1. Take a Netlify DB snapshot, and export `buyer_packages`, `lead_allocations`, `payments`,
   `deliveries`, `replacement_requests` and `audit_log` (pg_dump of those tables) to a secure location.
2. Run the migration on a preview or local database first and run
   `lib/creditsLedger.integration.test.ts`.
3. Record before and after, and check they match:
   `SELECT count(*), sum(leads_used) FROM buyer_packages;`
   `SELECT count(*) FROM lead_allocations;`  `SELECT count(*) FROM payments;`
   `SELECT count(*), count(*) FILTER (WHERE status = 'DENIED') FROM replacement_requests;`

## When a rollback is safe

- **Safe:** before any credit has been restored or refunded through the new screens (no
  `package_refunds` rows, no `replacement_requests` with a `resolution`).
- **Not safe without reconciling first:** after a credit has been restored or refunded. A restore
  lowers `leads_used`; a refund is held in `credits_refunded`, which the rollback drops, so the
  old schema would show refunded credits as spendable again. Export the records first (below) and
  agree how each package should be represented before rolling back.
- The rollback re-adds the original status check on `replacement_requests`. If any row has status
  `APPROVED`, that step fails and the transaction rolls back: resolve or deny those requests first.

## Rollback SQL (run in one transaction, only with approval)

<!-- rollback-sql:start -->
```sql
BEGIN;
DROP VIEW IF EXISTS package_balances;
DROP TRIGGER IF EXISTS trg_package_refunds_guard ON package_refunds;
DROP FUNCTION IF EXISTS package_refunds_guard();
DROP TRIGGER IF EXISTS trg_replacement_requests_guard ON replacement_requests;
DROP FUNCTION IF EXISTS replacement_requests_guard();

-- Previous definitions, exactly as in 20261118100000_multi_buyer_distribution_model.sql
-- (lead_allocations_guard) and 20261110100000_pay_to_unlock.sql (the other three).
CREATE OR REPLACE FUNCTION lead_allocations_guard() RETURNS trigger AS $$
DECLARE
  c homeowner_confirmations%ROWTYPE;
  pkg_buyer INTEGER;
  buyer_arrangement TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.pre_pay_to_unlock := false;
  ELSE
    IF NEW.pre_pay_to_unlock IS DISTINCT FROM OLD.pre_pay_to_unlock THEN
      RAISE EXCEPTION 'pre_pay_to_unlock cannot be changed (allocation %)', OLD.id;
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
    SELECT buyer_id INTO pkg_buyer FROM buyer_packages WHERE id = NEW.package_id;
    IF pkg_buyer <> NEW.buyer_id THEN
      RAISE EXCEPTION 'package % belongs to a different buyer', NEW.package_id;
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION buyer_packages_guard_leads_used() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.leads_used := 0;
  ELSIF NEW.leads_used IS DISTINCT FROM OLD.leads_used
        AND coalesce(current_setting('hlx.package_slot', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'leads_used is maintained automatically (package %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION payments_guard() RETURNS trigger AS $$
DECLARE
  a lead_allocations%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.lead_allocation_id IS DISTINCT FROM OLD.lead_allocation_id THEN
    RAISE EXCEPTION 'payment % cannot be moved to another allocation', OLD.id;
  END IF;
  IF NEW.status IN ('PAID', 'SETTLED')
     AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('PAID', 'SETTLED')) THEN
    SELECT * INTO a FROM lead_allocations WHERE id = NEW.lead_allocation_id;
    IF NOT a.pre_pay_to_unlock THEN
      IF a.package_id IS NOT NULL THEN
        RAISE EXCEPTION 'allocation % is covered by a package and takes no payment', a.id;
      END IF;
      IF NEW.verified_by IS NULL OR NEW.verified_at IS NULL THEN
        RAISE EXCEPTION 'payment must be verified by an admin before it is marked paid';
      END IF;
      IF NEW.transaction_reference IS NULL OR length(trim(NEW.transaction_reference)) = 0 THEN
        RAISE EXCEPTION 'payment must carry the Tide transaction reference';
      END IF;
      IF NEW.amount_received IS NULL OR NEW.amount_received < a.agreed_price THEN
        RAISE EXCEPTION 'amount received % is below the agreed price % (allocation %)',
          NEW.amount_received, a.agreed_price, a.id;
      END IF;
      IF a.status NOT IN ('OFFERED', 'ACCEPTED', 'PURCHASED') THEN
        RAISE EXCEPTION 'allocation % is % and cannot be marked paid; keep the payment under review', a.id, a.status;
      END IF;
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
       SELECT 1 FROM payments WHERE lead_allocation_id = a.id AND status IN ('PAID', 'SETTLED')) THEN
    RAISE EXCEPTION 'allocation % has no verified payment and cannot be released', a.id;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP INDEX IF EXISTS uq_lead_allocations_replacement_request;
ALTER TABLE lead_allocations DROP COLUMN IF EXISTS replacement_request_id;
DROP TABLE IF EXISTS package_refunds;
DROP INDEX IF EXISTS uq_replacement_requests_open_per_delivery;
ALTER TABLE replacement_requests
  DROP CONSTRAINT IF EXISTS replacement_requests_resolution_rules_check,
  DROP COLUMN IF EXISTS reason_code,
  DROP COLUMN IF EXISTS reported_at,
  DROP COLUMN IF EXISTS recorded_by,
  DROP COLUMN IF EXISTS resolution,
  DROP COLUMN IF EXISTS resolved_by,
  DROP COLUMN IF EXISTS resolved_at,
  DROP COLUMN IF EXISTS replacement_allocation_id,
  DROP COLUMN IF EXISTS refund_amount,
  DROP COLUMN IF EXISTS refund_transaction_reference,
  DROP COLUMN IF EXISTS refunded_at;
ALTER TABLE replacement_requests DROP CONSTRAINT replacement_requests_status_check;
ALTER TABLE replacement_requests
  ADD CONSTRAINT replacement_requests_status_check
    CHECK (status IN ('PENDING_ADMIN_REVIEW','APPROVED_REPLACED','DENIED'));
ALTER TABLE buyer_packages
  DROP CONSTRAINT IF EXISTS buyer_packages_credit_balance_check,
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS credits_restored,
  DROP COLUMN IF EXISTS credits_refunded;
ALTER TABLE package_definitions DROP COLUMN IF EXISTS validity_months;
COMMIT;
```
<!-- rollback-sql:end -->

After the rollback, deploy the previous application build: the new admin routes and the allocate
route's `replacement_request_id` depend on the dropped columns. Remove the migration file from
the repository so it is not re-applied, and remove its entry from the migrations record Netlify
DB keeps.

## Recovery

- Preserve the ledger first:
  `CREATE TABLE package_refunds_backup AS SELECT * FROM package_refunds;`
  `CREATE TABLE replacement_requests_backup AS SELECT * FROM replacement_requests;`
  `CREATE TABLE buyer_packages_ledger_backup AS SELECT id, expires_at, credits_restored, credits_refunded, leads_used FROM buyer_packages;`
- Re-apply: re-run the migration file, then restore refunds and resolutions from the backup tables
  through the admin routes (so the triggers re-check every figure), not by direct inserts.
- Full restore from snapshot is the last resort and has never been tested.
- `audit_log` keeps every `PACKAGE_CREDIT_RESTORED`, `PACKAGE_CREDITS_REFUNDED`,
  `REPLACEMENT_*` entry whatever happens to the tables.
