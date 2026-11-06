-- Roofing's industries row was inserted disabled in 20261106100000_multi_industry.sql, as a
-- placeholder for the homepage's "coming soon" card until its homeowner/buyer journey was built.
-- That journey now exists (this release), so Roofing goes live the same way Solar & Battery did:
-- flip the flag, nothing else to migrate.
UPDATE industries SET is_enabled = true WHERE slug = 'roofing';
