-- Read-only duplicate check for buyer_prospects, to run against PRODUCTION before deciding how
-- (or whether) to add a database-level uniqueness rule for "one active prospect per
-- email+industry". This makes no changes -- it only reports.
--
-- Run this via the Netlify database console / your usual read-only connection, not through a
-- migration. Nothing here is executed automatically.
--
-- Email comparison uses lower(trim(contact_email)) throughout, matching the normalisation the
-- application code now uses, so this report reflects real duplicates under that rule rather than
-- under a naive exact-string match.

-- 1. How many groups of duplicate ACTIVE (unconverted) prospects exist, and how many rows total?
SELECT
  count(*) AS duplicate_groups,
  sum(group_size) AS duplicate_rows_total
FROM (
  SELECT lower(trim(contact_email)) AS email, industry_id, count(*) AS group_size
  FROM buyer_prospects
  WHERE converted_buyer_id IS NULL
  GROUP BY 1, 2
  HAVING count(*) > 1
) groups;

-- 2. The groups themselves, with enough detail to judge each one: ids, channels, attribution,
-- and how far apart in time the touches are (a few seconds apart is probably a double-submit;
-- weeks apart is probably two genuine separate interests).
SELECT
  lower(trim(bp.contact_email)) AS normalised_email,
  bp.industry_id,
  i.slug AS industry_slug,
  array_agg(bp.id ORDER BY bp.created_at) AS prospect_ids,
  array_agg(bp.prospect_reference ORDER BY bp.created_at) AS prospect_references,
  array_agg(bp.capture_channel ORDER BY bp.created_at) AS channels,
  array_agg(bp.created_at ORDER BY bp.created_at) AS created_at_each,
  max(bp.created_at) - min(bp.created_at) AS span
FROM buyer_prospects bp
JOIN industries i ON i.id = bp.industry_id
WHERE bp.converted_buyer_id IS NULL
GROUP BY 1, 2, 3
HAVING count(*) > 1
ORDER BY span DESC;

-- 3. Same contact_email registered under DIFFERENT industries -- not a duplicate under the
-- planned rule (industry-scoped), but useful context: are these the same business genuinely
-- interested in more than one vertical, or a sign the industry field is being set wrong?
SELECT lower(trim(contact_email)) AS normalised_email, array_agg(DISTINCT industry_id) AS industry_ids, count(*) AS row_count
FROM buyer_prospects
WHERE converted_buyer_id IS NULL
GROUP BY 1
HAVING count(DISTINCT industry_id) > 1;

-- 4. Sanity check: does any row have a NULL or empty contact_email? (Shouldn't be possible --
-- the column is NOT NULL -- but worth confirming before trusting the normalisation above.)
SELECT count(*) FROM buyer_prospects WHERE contact_email IS NULL OR trim(contact_email) = '';
