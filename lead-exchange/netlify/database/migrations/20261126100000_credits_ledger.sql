-- Credits ledger: starter-pack credit balance, expiry, replacements and refunds (Technical PR A).
-- Approved by Fabien 2026-11-26. Rollback: docs/CREDITS_LEDGER_ROLLBACK.md.
--
-- Additive. No existing row is UPDATEd or deleted: existing buyer packages keep no expiry
-- (expires_at stays NULL) and their counters are unchanged; existing allocations, payments,
-- deliveries and replacement_requests rows are untouched. The only non-additive steps are:
--   * replacement_requests' status CHECK is replaced by a SUPERSET (every existing value stays
--     valid; 'APPROVED' is added for "approved, awaiting resolution"), and
--   * four existing guard functions are replaced by versions that keep every existing rule and add
--     new ones (lead_allocations_guard, buyer_packages_guard_leads_used, payments_guard,
--     allocation_release_check). Their previous definitions are in the rollback document.
--
-- Credit model (buyer_packages):
--   credits remaining = leads_included - leads_used - credits_refunded
--   * leads_used     +1 when an allocation uses the package (existing trigger), -1 when an approved
--                    replacement restores that credit. Never edited directly.
--   * credits_restored  how many credits replacements have given back (for the record).
--   * credits_refunded  unused credits refunded through Tide (package_refunds).
--   A CHECK keeps leads_used + credits_refunded <= leads_included, so a balance can never go below
--   zero; the package row is locked by every write, so concurrent use, restore and refund queue.

-- 1. Package validity, configurable per package definition (default six months).
ALTER TABLE package_definitions
  ADD COLUMN validity_months INTEGER NOT NULL DEFAULT 6 CHECK (validity_months > 0);

-- 2. Balance and expiry columns on buyer packages.
ALTER TABLE buyer_packages
  ADD COLUMN expires_at TIMESTAMPTZ,                         -- NULL for packages recorded before this migration
  ADD COLUMN credits_restored INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN credits_refunded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE buyer_packages
  ADD CONSTRAINT buyer_packages_credit_balance_check
    CHECK (credits_restored >= 0 AND credits_refunded >= 0
           AND leads_used + credits_refunded <= leads_included);

-- 3. Replacement requests: extend the existing (so far unused) table rather than add a second one.
ALTER TABLE replacement_requests DROP CONSTRAINT replacement_requests_status_check;
ALTER TABLE replacement_requests
  ADD CONSTRAINT replacement_requests_status_check
    CHECK (status IN ('PENDING_ADMIN_REVIEW', 'APPROVED', 'APPROVED_REPLACED', 'DENIED'));
ALTER TABLE replacement_requests
  ADD COLUMN reason_code TEXT CHECK (reason_code IN (
    'INVALID_CONTACT', 'INCORRECT_INDIVIDUAL', 'NO_GENUINE_INTEREST', 'INCORRECT_SERVICE',
    'DUPLICATE', 'UNREACHABLE_DOCUMENTED', 'INACCURATE_DETAILS', 'OTHER')),
  ADD COLUMN reported_at TIMESTAMPTZ,                         -- when the buyer reported it (claim-window evidence)
  ADD COLUMN recorded_by TEXT,                                -- admin who recorded the request
  ADD COLUMN resolution TEXT CHECK (resolution IN ('CREDIT_RESTORED', 'REPLACEMENT_SUPPLIED', 'REFUNDED')),
  ADD COLUMN resolved_by TEXT,
  ADD COLUMN resolved_at TIMESTAMPTZ,
  ADD COLUMN replacement_allocation_id INTEGER UNIQUE REFERENCES lead_allocations(id),
  ADD COLUMN refund_amount NUMERIC CHECK (refund_amount > 0),
  ADD COLUMN refund_transaction_reference TEXT UNIQUE,        -- Tide reference of the refund
  ADD COLUMN refunded_at TIMESTAMPTZ;
ALTER TABLE replacement_requests
  ADD CONSTRAINT replacement_requests_resolution_rules_check CHECK (
    (resolution IS NULL OR (status = 'APPROVED' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
    AND ((coalesce(resolution, '') = 'REPLACEMENT_SUPPLIED') = (replacement_allocation_id IS NOT NULL))
    AND ((coalesce(resolution, '') = 'REFUNDED') = (refund_amount IS NOT NULL))
    AND ((refund_amount IS NULL) = (refund_transaction_reference IS NULL))
    AND ((refund_amount IS NULL) = (refunded_at IS NULL))
  );
-- At most one open or approved claim per delivered lead: a second claim for the same delivery is
-- refused unless the first was denied.
CREATE UNIQUE INDEX uq_replacement_requests_open_per_delivery
  ON replacement_requests(delivery_id)
  WHERE status <> 'DENIED';

-- 4. A free replacement allocation points at the request it fulfils.
ALTER TABLE lead_allocations
  ADD COLUMN replacement_request_id INTEGER REFERENCES replacement_requests(id);
CREATE UNIQUE INDEX uq_lead_allocations_replacement_request
  ON lead_allocations(replacement_request_id)
  WHERE replacement_request_id IS NOT NULL;

-- 5. Refunds of unused package credits (manual Tide refunds, recorded here). Append-only.
CREATE TABLE package_refunds (
  id SERIAL PRIMARY KEY,
  buyer_package_id INTEGER NOT NULL REFERENCES buyer_packages(id),
  credits_refunded INTEGER NOT NULL CHECK (credits_refunded > 0),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'GBP',
  reason TEXT NOT NULL CHECK (reason IN ('BUYER_STOPPED', 'CREDITS_EXPIRED')),
  transaction_reference TEXT NOT NULL UNIQUE CHECK (length(trim(transaction_reference)) > 0),
  refunded_at TIMESTAMPTZ NOT NULL,
  recorded_by TEXT NOT NULL CHECK (length(trim(recorded_by)) > 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
CREATE INDEX idx_package_refunds_package ON package_refunds(buyer_package_id);

-- 6. Guard functions.

-- buyer_packages: counters move only through the triggers below; expiry is set once at insert
-- (six months, or the package definition's validity, after the payment was verified) and never
-- changed; the financial fields the balance depends on cannot be edited after the fact.
CREATE OR REPLACE FUNCTION buyer_packages_guard_leads_used() RETURNS trigger AS $$
DECLARE
  months INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.leads_used := 0;
    NEW.credits_restored := 0;
    NEW.credits_refunded := 0;
    SELECT validity_months INTO months FROM package_definitions WHERE id = NEW.package_definition_id;
    NEW.expires_at := NEW.verified_at + make_interval(months => coalesce(months, 6));
    RETURN NEW;
  END IF;
  IF NEW.leads_used IS DISTINCT FROM OLD.leads_used
     AND coalesce(current_setting('hlx.package_slot', true), 'off') <> 'on'
     AND coalesce(current_setting('hlx.credit_slot', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'leads_used is maintained automatically (package %)', OLD.id;
  END IF;
  IF NEW.credits_restored IS DISTINCT FROM OLD.credits_restored
     AND coalesce(current_setting('hlx.credit_slot', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'credits_restored is maintained automatically (package %)', OLD.id;
  END IF;
  IF NEW.credits_refunded IS DISTINCT FROM OLD.credits_refunded
     AND coalesce(current_setting('hlx.refund_slot', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'credits_refunded is maintained automatically (package %)', OLD.id;
  END IF;
  IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'package expiry is fixed when the package is recorded (package %)', OLD.id;
  END IF;
  IF (NEW.buyer_id, NEW.amount_paid, NEW.leads_included, NEW.currency, NEW.verified_at)
     IS DISTINCT FROM (OLD.buyer_id, OLD.amount_paid, OLD.leads_included, OLD.currency, OLD.verified_at) THEN
    RAISE EXCEPTION 'package % financial details cannot be changed once recorded', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- lead_allocations: every existing rule kept; adds package expiry, a row lock on the package, and
-- the free-replacement rules.
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

-- payments: every existing rule kept; a free replacement allocation can never take a payment.
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
      IF a.replacement_request_id IS NOT NULL THEN
        RAISE EXCEPTION 'allocation % is a free replacement and takes no payment', a.id;
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

-- Release gate: every existing rule kept; additionally releases a free replacement allocation once
-- its approved request is resolved as REPLACEMENT_SUPPLIED and points back at it.
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

-- replacement_requests: a claim is recorded PENDING against a delivered lead, decided once
-- (APPROVED or DENIED), and an approved claim is resolved once. Rows are never deleted and decided
-- facts never change. Resolving moves the money/credit in the same transaction:
--   CREDIT_RESTORED       package lead: the credit used is given back (leads_used - 1).
--   REPLACEMENT_SUPPLIED  pay-per-lead lead: a free allocation (made through the allocate route
--                         with replacement_request_id) must already point at this request.
--   REFUNDED              no replacement within 30 days (Buyer Terms 9.4): the refund must equal
--                         the price paid for the lead (agreed price, or the package price per credit).
CREATE FUNCTION replacement_requests_guard() RETURNS trigger AS $$
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

CREATE TRIGGER trg_replacement_requests_guard
  BEFORE INSERT OR UPDATE OR DELETE ON replacement_requests
  FOR EACH ROW EXECUTE FUNCTION replacement_requests_guard();

-- package_refunds: append-only. Each refund locks its package, may not exceed the credits still
-- unused, must equal the package's own price per credit times the credits refunded, and (for an
-- expiry refund) the package must actually have expired. It raises credits_refunded in the same
-- transaction, so the balance and the refund record can never disagree.
CREATE FUNCTION package_refunds_guard() RETURNS trigger AS $$
DECLARE
  pkg buyer_packages%ROWTYPE;
  remaining INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'package refunds are a permanent record and cannot be changed or deleted';
  END IF;
  SELECT * INTO pkg FROM buyer_packages WHERE id = NEW.buyer_package_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'package % does not exist', NEW.buyer_package_id;
  END IF;
  remaining := pkg.leads_included - pkg.leads_used - pkg.credits_refunded;
  IF NEW.credits_refunded > remaining THEN
    RAISE EXCEPTION 'package % has % unused credit(s); cannot refund %', pkg.id, remaining, NEW.credits_refunded;
  END IF;
  IF NEW.currency <> pkg.currency THEN
    RAISE EXCEPTION 'refund currency % does not match the package currency %', NEW.currency, pkg.currency;
  END IF;
  IF round(NEW.amount, 2) <> round(pkg.amount_paid * NEW.credits_refunded / pkg.leads_included, 2) THEN
    RAISE EXCEPTION 'refund % does not equal % credit(s) at the package price per credit (%)',
      NEW.amount, NEW.credits_refunded, round(pkg.amount_paid * NEW.credits_refunded / pkg.leads_included, 2);
  END IF;
  IF NEW.reason = 'CREDITS_EXPIRED' AND (pkg.expires_at IS NULL OR now() < pkg.expires_at) THEN
    RAISE EXCEPTION 'package % has not expired; record this as BUYER_STOPPED if the buyer is leaving', pkg.id;
  END IF;
  PERFORM set_config('hlx.refund_slot', 'on', true);
  UPDATE buyer_packages SET credits_refunded = credits_refunded + NEW.credits_refunded WHERE id = pkg.id;
  PERFORM set_config('hlx.refund_slot', 'off', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_package_refunds_guard
  BEFORE INSERT OR UPDATE OR DELETE ON package_refunds
  FOR EACH ROW EXECUTE FUNCTION package_refunds_guard();

-- 7. Balances for the admin panel. REFUND_DUE: the package has expired with credits unused
-- (Fabien, 2026-11-26: expired credits are refunded, manually through Tide, and recorded).
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
