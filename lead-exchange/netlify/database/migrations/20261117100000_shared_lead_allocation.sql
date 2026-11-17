-- Allows a lead to be deliberately sold to more than one buyer at once (Fabien, 2026-11-17: "this
-- will be a regular thing"), without removing the exclusivity guarantee for ordinary leads.
--
-- The original schema always anticipated this: lead_allocations.allocation_type has allowed
-- 'EXCLUSIVE_WINDOW' and 'SHARED' since the very first migration, with allocation_sequence
-- documented as "null for shared". But the pay-to-unlock migration (20261110100000) later added a
-- blanket "only one live allocation per lead, ever" unique index that didn't account for SHARED at
-- all -- an oversight, not a deliberate policy. This migration corrects that gap rather than
-- removing the safeguard: EXCLUSIVE_WINDOW allocations are still limited to one live allocation
-- per lead (you cannot claim a lead as exclusively yours while someone else already has it, shared
-- or exclusive); SHARED allocations are explicitly exempt, since selling the same lead to multiple
-- buyers at once is the entire point of marking it SHARED.
DROP INDEX uq_lead_allocations_live_per_lead;
CREATE UNIQUE INDEX uq_lead_allocations_live_per_lead
  ON lead_allocations(lead_id)
  WHERE status IN ('OFFERED', 'ACCEPTED', 'PURCHASED') AND allocation_type = 'EXCLUSIVE_WINDOW';

-- The index above only stops two EXCLUSIVE_WINDOW rows coexisting for the same lead -- a partial
-- unique index can't express "no EXCLUSIVE_WINDOW row may coexist with ANY other live row,
-- regardless of that other row's own type" (a cross-row, cross-type rule), which is the other half
-- of what "exclusive" has to mean: an EXCLUSIVE_WINDOW claim must fail if the lead already has a
-- live SHARED allocation to someone else, not just another live EXCLUSIVE_WINDOW one. This extends
-- the existing lead_allocations_guard trigger (same function, CREATE OR REPLACE) to check that
-- directly, the same way every other cross-row rule in this codebase is enforced.
CREATE OR REPLACE FUNCTION lead_allocations_guard() RETURNS trigger AS $$
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
