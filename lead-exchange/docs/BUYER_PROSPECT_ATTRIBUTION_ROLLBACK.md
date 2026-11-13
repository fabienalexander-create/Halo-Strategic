# Buyer prospect attribution — rollback notes

Covers `20261113120000_buyer_prospect_attribution.sql` and `20261113130000_buyer_application_attribution.sql`.

## The one irreversible part

`20261113120000` merges any pre-existing duplicate **active** (unconverted) `buyer_prospects`
rows for the same `(contact_email, industry_id)` before creating the new uniqueness rule —
production had no such rule before this migration, so duplicates may genuinely exist from real
repeated registrations. The merge keeps the earliest row, folds the later row's attribution into
that survivor's `last_touch_*` columns, and **deletes** the later row (and its
`buyer_prospect_emails` rows) after logging the merge to `audit_log`.

**Rolling back the column/table changes does not undo this.** The deleted duplicate rows and their
original separate identities are gone. If this matters before deploying, take a snapshot or export
of `buyer_prospects` first. This was a deliberate choice, not an oversight: leaving the duplicates
in place would have meant the new `uq_buyer_prospects_active_email_industry` index could never be
created without the migration failing outright on production's real data.

## Mechanical rollback (columns, table, indexes)

Verified against a local throwaway database with real pre-existing duplicate data (see
`lib/buyerProspectAttribution.integration.test.ts`):

```sql
-- 20261113130000_buyer_application_attribution.sql
ALTER TABLE buyers
  DROP COLUMN first_touch_utm_source, DROP COLUMN first_touch_utm_medium,
  DROP COLUMN first_touch_utm_campaign, DROP COLUMN first_touch_fbclid,
  DROP COLUMN first_touch_channel,
  DROP COLUMN last_touch_utm_source, DROP COLUMN last_touch_utm_medium,
  DROP COLUMN last_touch_utm_campaign, DROP COLUMN last_touch_fbclid;

-- 20261113120000_buyer_prospect_attribution.sql
DROP TABLE buyer_prospect_touches;
DROP INDEX uq_buyer_prospects_active_email_industry;
ALTER TABLE buyer_prospects
  DROP COLUMN fbclid, DROP COLUMN capture_channel, DROP COLUMN last_touch_channel,
  DROP COLUMN last_touch_utm_source, DROP COLUMN last_touch_utm_medium,
  DROP COLUMN last_touch_utm_campaign, DROP COLUMN last_touch_fbclid, DROP COLUMN last_touch_at,
  DROP COLUMN meta_lead_id, DROP COLUMN meta_campaign_id, DROP COLUMN meta_campaign_name,
  DROP COLUMN meta_adset_id, DROP COLUMN meta_adset_name, DROP COLUMN meta_ad_id,
  DROP COLUMN meta_ad_name, DROP COLUMN meta_form_id, DROP COLUMN meta_form_name,
  DROP COLUMN meta_submitted_at, DROP COLUMN consent_wording_version, DROP COLUMN raw_form_answers;
```

Rolling back `20261113120000` after `20261113130000` has already been applied is fine — the two
migrations don't depend on each other's columns, only on table order (both come after
`buyer_prospects` and `buyers` already existing).

## What rolling back does NOT undo

- Any `converted_buyer_id`/`converted_at` links already written by `/api/buyer-applications` stay
  on `buyer_prospects` (those columns pre-date this migration) — rolling back only removes the
  attribution columns, not the link itself.
- The `audit_log` entries for `BUYER_PROSPECT_DUPLICATES_MERGED`, `BUYER_PROSPECT_REPEAT_TOUCH`,
  and `BUYER_PROSPECT_CONVERTED` are untouched, as `audit_log` is append-only by design (see
  `20261112140000_audit_log_append_only.sql`). They'll reference columns/tables that no longer
  exist after a rollback — expected, same as every other historical audit entry in this schema.
