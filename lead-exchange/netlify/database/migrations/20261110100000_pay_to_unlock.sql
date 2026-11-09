-- Pay-to-unlock lead delivery (Pay-to-Unlock Lead Delivery Design, Revision 2, approved 9 Nov 2026).
--
-- Additive only: new tables, new columns, new indexes, checks and guard triggers. Nothing
-- existing is dropped, renamed or rewritten, and no existing row is UPDATEd (pre-existing
-- allocations are marked exempt by the new column's default). Existing forms, consent records,
-- the Google Sheets sync and application emails are unaffected.
--
-- What this enables (built in later PRs, not here):
--   * Packages (e.g. a buyer's first two leads for a fixed price) consumed exactly once per lead.
--   * A recorded homeowner YES to the named specialist before any offer is made.
--   * One live allocation per lead, a per-allocation price snapshot, one payment and one
--     delivery per allocation.
--   * Buyer offer/unlock emails and internal copies, tracked separately from payment state.

-- Configurable package terms. A buyer's package is a row here, never a constant in code.
CREATE TABLE package_definitions (
  id SERIAL PRIMARY KEY,
  industry_id INTEGER NOT NULL REFERENCES industries(id),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  leads_included INTEGER NOT NULL CHECK (leads_included > 0),
  currency TEXT NOT NULL DEFAULT 'GBP',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A package a buyer has paid for and an admin has verified. leads_used is maintained only by the
-- lead_allocations guard trigger below: it starts at 0, rises by one in the same transaction as
-- each allocation that uses the package (the row lock makes simultaneous allocations queue), and
-- can't be edited by hand.
CREATE TABLE buyer_packages (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES buyers(id),
  package_definition_id INTEGER REFERENCES package_definitions(id),
  amount_paid NUMERIC NOT NULL CHECK (amount_paid >= 0),
  currency TEXT NOT NULL DEFAULT 'GBP',
  leads_included INTEGER NOT NULL CHECK (leads_included > 0),
  leads_used INTEGER NOT NULL DEFAULT 0,
  transaction_reference TEXT NOT NULL UNIQUE,              -- Tide reference for the package payment
  paid_at TIMESTAMPTZ NOT NULL,
  verified_by TEXT NOT NULL,                                -- admin who confirmed it in Tide
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (leads_used >= 0 AND leads_used <= leads_included)
);
CREATE INDEX idx_buyer_packages_buyer ON buyer_packages(buyer_id);

-- The homeowner's YES to being introduced to one named business. Required before any offer.
-- Never inferred from the enquiry form's general sharing consent. Until SMS exists, an admin
-- records it after a phone call, with notes.
CREATE TABLE homeowner_confirmations (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  buyer_id INTEGER NOT NULL REFERENCES buyers(id),
  named_business TEXT NOT NULL,                              -- exactly as told to the homeowner
  purpose TEXT NOT NULL,                                     -- e.g. 'to contact you about a spray foam assessment'
  wording_used TEXT NOT NULL,                                -- the exact question or SMS text put to the homeowner
  homeowner_response TEXT NOT NULL,                          -- their answer, as given
  method TEXT NOT NULL CHECK (method IN ('SMS_YES', 'ADMIN_AFTER_CALL')),
  confirmed_at TIMESTAMPTZ NOT NULL,                         -- date and time of the call or reply
  recorded_by TEXT NOT NULL,                                 -- who took the call, or 'system' for SMS
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  evidence_ref TEXT,                                         -- SMS message id, or call log reference
  withdrawn_at TIMESTAMPTZ,
  withdrawn_recorded_by TEXT,
  withdrawal_notes TEXT,
  CHECK (length(trim(named_business)) > 0 AND length(trim(purpose)) > 0
         AND length(trim(wording_used)) > 0 AND length(trim(homeowner_response)) > 0),
  CHECK (method <> 'ADMIN_AFTER_CALL' OR length(trim(coalesce(notes, ''))) > 0),
  CHECK (withdrawn_at IS NULL OR withdrawn_recorded_by IS NOT NULL)
);

-- At most one ACTIVE confirmation per lead and buyer. A withdrawn one stays as history, and a
-- homeowner who later agrees again gets a new row, so no evidence is ever overwritten.
CREATE UNIQUE INDEX uq_homeowner_confirmations_active
  ON homeowner_confirmations(lead_id, buyer_id)
  WHERE withdrawn_at IS NULL;

-- Confirmations are evidence: once recorded, nothing can be edited except recording a withdrawal,
-- once. A withdrawal can't be undone (renewal is a new row) and rows can't be deleted.
CREATE FUNCTION homeowner_confirmations_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'homeowner confirmations cannot be deleted (confirmation %)', OLD.id;
  END IF;
  IF OLD.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'confirmation % is withdrawn and cannot be changed; record a new one', OLD.id;
  END IF;
  IF (NEW.lead_id, NEW.buyer_id, NEW.named_business, NEW.purpose, NEW.wording_used,
      NEW.homeowner_response, NEW.method, NEW.confirmed_at, NEW.recorded_by, NEW.recorded_at,
      NEW.notes, NEW.evidence_ref)
     IS DISTINCT FROM
     (OLD.lead_id, OLD.buyer_id, OLD.named_business, OLD.purpose, OLD.wording_used,
      OLD.homeowner_response, OLD.method, OLD.confirmed_at, OLD.recorded_by, OLD.recorded_at,
      OLD.notes, OLD.evidence_ref) THEN
    RAISE EXCEPTION 'confirmation % is evidence and cannot be edited; only a withdrawal can be recorded', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_homeowner_confirmations_guard
  BEFORE UPDATE OR DELETE ON homeowner_confirmations
  FOR EACH ROW EXECUTE FUNCTION homeowner_confirmations_guard();

-- Link allocations to the package that covered them and the confirmation that allowed them.
ALTER TABLE lead_allocations
  ADD COLUMN package_id INTEGER REFERENCES buyer_packages(id),
  ADD COLUMN homeowner_confirmation_id INTEGER REFERENCES homeowner_confirmations(id);

-- Every allocation created from this migration onwards needs a homeowner confirmation and either
-- a price snapshot (agreed_price, copied from the buyer's own rate at offer time) or a package.
--
-- Allocations that already exist are exempt, marked by pre_pay_to_unlock: adding the column with
-- DEFAULT true gives every existing row true, then the default switches to false so every new row
-- is checked. No existing row is UPDATEd. (A plain NOT VALID check is not enough: Postgres still
-- applies it to UPDATEs, which would stop an old offer from ever being expired.)
ALTER TABLE lead_allocations ADD COLUMN pre_pay_to_unlock BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE lead_allocations ALTER COLUMN pre_pay_to_unlock SET DEFAULT false;
ALTER TABLE lead_allocations
  ADD CONSTRAINT lead_allocations_confirmed_check
    CHECK (pre_pay_to_unlock OR homeowner_confirmation_id IS NOT NULL),
  ADD CONSTRAINT lead_allocations_price_check
    CHECK (pre_pay_to_unlock OR agreed_price IS NOT NULL OR package_id IS NOT NULL);

-- Guards on every new or changed allocation, enforced by the database rather than app code:
--   * The exemption can't be claimed or changed: every INSERT is forced to false, whatever the
--     caller sends, and any UPDATE that tries to change the flag is rejected. Only rows that
--     existed when this migration ran keep true.
--   * The homeowner confirmation must be for this lead AND this buyer, and not withdrawn.
--   * A package must belong to this buyer. Using it consumes one slot here, in the same
--     transaction as the allocation: the package row is locked by the UPDATE, so simultaneous
--     allocations queue, and the leads_used CHECK refuses the one that would exceed the package.
--     The counter can't drift from the allocations, go negative, or be spent twice.
--   * Once set, an allocation's package and confirmation can't be swapped.
CREATE FUNCTION lead_allocations_guard() RETURNS trigger AS $$
DECLARE
  c homeowner_confirmations%ROWTYPE;
  pkg_buyer INTEGER;
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_allocations_guard
  BEFORE INSERT OR UPDATE ON lead_allocations
  FOR EACH ROW EXECUTE FUNCTION lead_allocations_guard();

-- leads_used is maintained only by the allocation trigger above: a new package always starts at
-- 0, and any other change to the counter is refused. So the counter always equals the number of
-- allocations that used the package.
CREATE FUNCTION buyer_packages_guard_leads_used() RETURNS trigger AS $$
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

CREATE TRIGGER trg_buyer_packages_guard_leads_used
  BEFORE INSERT OR UPDATE ON buyer_packages
  FOR EACH ROW EXECUTE FUNCTION buyer_packages_guard_leads_used();

-- A lead can be live with only one buyer at a time, and a package covers a given lead once.
CREATE UNIQUE INDEX uq_lead_allocations_live_per_lead
  ON lead_allocations(lead_id)
  WHERE status IN ('OFFERED', 'ACCEPTED', 'PURCHASED');
CREATE UNIQUE INDEX uq_lead_allocations_package_lead
  ON lead_allocations(package_id, lead_id)
  WHERE package_id IS NOT NULL;

-- Payment verification record. A payment arriving after its offer expired is recorded as
-- UNDER_REVIEW and resolved by an admin, never released automatically.
ALTER TABLE payments
  ADD COLUMN amount_received NUMERIC,
  ADD COLUMN payment_reference TEXT UNIQUE,                  -- e.g. HLX-PAY-000123, quoted by the buyer
  ADD COLUMN late_resolution TEXT
    CHECK (late_resolution IN ('REOPENED_AND_RELEASED', 'REFUNDED')),
  ADD COLUMN late_resolved_by TEXT,
  ADD COLUMN late_resolved_at TIMESTAMPTZ;
CREATE UNIQUE INDEX uq_payments_transaction_reference
  ON payments(transaction_reference)
  WHERE transaction_reference IS NOT NULL;
CREATE UNIQUE INDEX uq_payments_one_paid_per_allocation
  ON payments(lead_allocation_id)
  WHERE status IN ('PAID', 'SETTLED');

-- A payment can only be marked PAID or SETTLED (for allocations made from this migration on) if:
-- an admin has verified it (who and when), it carries a Tide transaction reference, the amount
-- received covers the allocation's frozen price, the allocation isn't package-covered (package
-- leads take no payment), and the offer is still live. A payment arriving after expiry must stay
-- UNDER_REVIEW until an admin reopens the offer; it can never mark an expired offer paid. A
-- payment can't be moved to a different allocation.
CREATE FUNCTION payments_guard() RETURNS trigger AS $$
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

CREATE TRIGGER trg_payments_guard
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION payments_guard();

-- One delivery per allocation, so a retry can never release twice.
CREATE UNIQUE INDEX uq_deliveries_allocation ON deliveries(lead_allocation_id);

-- The release gate. Homeowner details are released by a delivery record or an unlock email. For
-- allocations made from this migration on, either is refused unless the allocation is
-- PURCHASED, its homeowner confirmation is not withdrawn, and it is package-covered or has a
-- PAID/SETTLED payment (which payments_guard has already validated).
CREATE FUNCTION allocation_release_check(alloc_id INTEGER) RETURNS void AS $$
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

CREATE FUNCTION deliveries_release_guard() RETURNS trigger AS $$
BEGIN
  PERFORM allocation_release_check(NEW.lead_allocation_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deliveries_release_guard
  BEFORE INSERT ON deliveries
  FOR EACH ROW EXECUTE FUNCTION deliveries_release_guard();

-- Offer and unlock emails to buyers, plus internal copies to the admin mailbox. Separate from
-- payment state: a failed email is retried without touching the payment. Kept apart from
-- transactional_emails, whose one-per-buyer-per-type rule suits application emails only.
CREATE TABLE lead_delivery_emails (
  id SERIAL PRIMARY KEY,
  lead_allocation_id INTEGER NOT NULL REFERENCES lead_allocations(id),
  email_type TEXT NOT NULL CHECK (email_type IN (
    'LEAD_OFFER', 'LEAD_UNLOCKED', 'INTERNAL_OFFER_COPY', 'INTERNAL_RELEASE_COPY'
  )),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DELIVERED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_allocation_id, email_type)
);
CREATE INDEX idx_lead_delivery_emails_status ON lead_delivery_emails(status);

-- The unlock email and its internal copy carry the homeowner's details, so they pass the same
-- release gate as a delivery record.
CREATE FUNCTION lead_delivery_emails_release_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.email_type IN ('LEAD_UNLOCKED', 'INTERNAL_RELEASE_COPY') THEN
    PERFORM allocation_release_check(NEW.lead_allocation_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_delivery_emails_release_guard
  BEFORE INSERT ON lead_delivery_emails
  FOR EACH ROW EXECUTE FUNCTION lead_delivery_emails_release_guard();
CREATE INDEX idx_lead_delivery_emails_provider_message_id ON lead_delivery_emails(provider_message_id);
