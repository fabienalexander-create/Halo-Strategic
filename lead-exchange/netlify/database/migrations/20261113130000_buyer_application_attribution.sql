-- Buyer application attribution: first-touch (copied from the linked prospect, if any -- or this
-- application's own submission, if it's a direct one with no prior prospect) and last-touch
-- (always this application's own submission, since applying IS the most recent touch by
-- definition). Kept as plain columns on buyers rather than a join, since an application's
-- attribution is fixed at submission time and never updated afterwards.
--
-- converted_buyer_id/converted_at on buyer_prospects already exist (added for this purpose back
-- when buyer_prospects was first created) but nothing has ever written to them -- this migration
-- doesn't need to touch that table, only make buyers able to receive the copied values.
ALTER TABLE buyers
  ADD COLUMN first_touch_utm_source TEXT,
  ADD COLUMN first_touch_utm_medium TEXT,
  ADD COLUMN first_touch_utm_campaign TEXT,
  ADD COLUMN first_touch_fbclid TEXT,
  ADD COLUMN first_touch_channel TEXT CHECK (first_touch_channel IN ('website', 'meta_instant_form')),
  ADD COLUMN last_touch_utm_source TEXT,
  ADD COLUMN last_touch_utm_medium TEXT,
  ADD COLUMN last_touch_utm_campaign TEXT,
  ADD COLUMN last_touch_fbclid TEXT;

-- Existing buyers rows (all pre-dating attribution) have no real first/last-touch data to
-- backfill -- left NULL deliberately rather than guessed. The admin UI should read a NULL here
-- as "applied before attribution tracking existed", not as "organic".
