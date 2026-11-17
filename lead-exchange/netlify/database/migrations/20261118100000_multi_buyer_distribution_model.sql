-- Multi-buyer lead distribution is the default commercial model, not an admin override (Fabien,
-- 2026-11-18: "This is a fundamental change to the marketplace model, not simply an additional
-- admin option... exclusivity is being removed as the default").
--
-- The previous migration (20261117100000) made SHARED allocations possible alongside an existing
-- EXCLUSIVE_WINDOW one. This migration ties allocation_type to something that already exists and
-- is already binding: buyers.exclusivity_arrangement, the per-buyer commercial term an admin
-- agrees and records before a buyer can go ACTIVE (required by
-- app/api/admin/applications/[reference]/activate/route.ts since before this change). That field
-- is the actual contract with each buyer -- some buyers may still be sold exclusive leads, most
-- will not -- so the database should enforce allocations against the buyer's own agreed terms,
-- not against a platform-wide default.
--
-- The rule only looks at the buyer named on the row being written, so it is forward-only and
-- cannot retroactively disturb any existing allocation: James's existing EXCLUSIVE_WINDOW /
-- PURCHASED allocation is untouched regardless of what, if anything, is recorded against his
-- exclusivity_arrangement. A buyer with no recorded exclusivity_arrangement (NULL) is not blocked
-- by this check -- the metadata may simply not have been captured yet -- but the admin UI and
-- allocate route now surface and prefer the buyer's recorded arrangement rather than asking the
-- admin to pick a type from nothing.
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
