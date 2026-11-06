-- Multi-industry expansion, phase 1: industry records only. No change to any existing row,
-- no change to buyers/leads structure -- a buyer and a lead each still belong to exactly one
-- industry (the buyer_industries junction table for multi-industry buyers is deliberately
-- deferred, per Fabien's explicit instruction not to rush that migration).
--
-- is_enabled lets an industry exist in the data (so e.g. a homepage card can reference it, or an
-- admin can see it coming) before its homeowner/buyer journeys are actually built and tested.
-- Both the homeowner-enquiry and buyer-application API routes must reject any industry_slug that
-- is unknown OR not enabled -- so inserting a disabled row here can never let real submissions
-- through for a vertical that isn't ready.
ALTER TABLE industries ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT true;

INSERT INTO industries (slug, name, is_enabled) VALUES
  ('solar_battery', 'Solar & Battery', true),
  ('roofing', 'Roofing', false);
