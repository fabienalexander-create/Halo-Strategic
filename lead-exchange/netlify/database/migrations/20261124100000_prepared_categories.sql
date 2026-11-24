-- Seeds the categories defined in the central registry (lib/industries.ts CATEGORIES) that are not
-- yet live: Windows & Doors and Insulation (prepared), Heat Pumps, Kitchens and Bathrooms (future).
-- All are disabled. The application also refuses enquiries, buyers and allocation for any category
-- whose registry status is not 'live', so these rows cannot receive leads even if a flag were
-- flipped by mistake.
--
-- Additive only: existing industries, leads and buyers are untouched. ON CONFLICT keeps it safe to
-- re-run and leaves any row that somehow already exists exactly as it is.
-- Rollback (only while no lead or buyer references them):
--   DELETE FROM industries WHERE slug IN ('windows_doors','insulation','heat_pumps','kitchens','bathrooms');

INSERT INTO industries (slug, name, is_enabled) VALUES
  ('windows_doors', 'Windows & Doors', false),
  ('insulation', 'Insulation', false),
  ('heat_pumps', 'Heat Pumps', false),
  ('kitchens', 'Kitchens', false),
  ('bathrooms', 'Bathrooms', false)
ON CONFLICT (slug) DO NOTHING;
