# Buyer prospect attribution — rollback notes

Covers `20261113120000_buyer_prospect_attribution.sql` and `20261113130000_buyer_application_attribution.sql`.

## This migration is purely additive — no merge, no delete

Earlier drafts of this migration auto-merged pre-existing duplicate (`contact_email`,
`industry_id`) **active** (unconverted) `buyer_prospects` rows before adding a uniqueness rule.
Fabien asked for that to stop: resolving real duplicates is his decision, made from a read-only
report, not something a migration should do on his behalf. This migration now only adds columns
and the new `buyer_prospect_touches` table — nothing existing is changed, merged, or deleted.

**There is currently no database-level uniqueness constraint** enforcing "one active prospect per
email+industry". That rule is enforced in application code instead
(`lib/buyerProspectCapture.ts`), via a `pg_advisory_xact_lock` keyed on `(industrySlug,
normalisedEmail)` taken before the row-lock lookup — not the row lock alone, which can't protect
a row that doesn't exist yet. This was a real gap: two genuinely concurrent *first* submissions for
the same brand-new email+industry produced two rows before the advisory lock existed (confirmed
directly, not assumed), and produce exactly one afterwards (see
`lib/buyerProspectAttribution.integration.test.ts`, "two truly concurrent FIRST submissions").
The same lock is taken in `app/api/buyer-applications/route.ts` before its own prospect match, so
an application being submitted and a last-second repeat touch for the same person can't race
each other either. The partial unique index below remains worth adding once production duplicates
are reviewed, but as defence-in-depth, not as the fix for this specific race — the advisory lock
is believed sufficient on its own.

## Before adding a uniqueness constraint

Run `netlify/database/reports/buyer_prospects_duplicate_check.sql` (read-only) against production
first. It reports:
- how many duplicate groups and rows exist under case-insensitive, trimmed email matching,
- the details of each group (ids, channels, attribution, time span between touches),
- same email registered under different industries (not a duplicate under this rule, but worth a
  look), and
- a sanity check for null/empty emails.

Only once Fabien has reviewed that report and decided how (or whether) to resolve any real
duplicates should a follow-up migration add the partial unique index
(`ON buyer_prospects (lower(trim(contact_email)), industry_id) WHERE converted_buyer_id IS NULL`)
and the application code be switched from its current SELECT-then-branch logic back to an atomic
`INSERT ... ON CONFLICT` upsert (which is simpler and closes the race window, but requires the
index to exist first).

## Mechanical rollback (columns, table, indexes)

Verified against a local throwaway database with real pre-existing duplicate data (see
`lib/buyerProspectAttribution.integration.test.ts`), which also confirms the migration leaves
that seeded duplicate pair completely untouched:

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
DROP INDEX idx_buyer_prospects_email_industry_active;
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
`buyer_prospects` and `buyers` already existing). Since nothing is merged or deleted, this rollback
is fully symmetric — unlike the earlier draft of this migration.

## What rolling back does NOT undo

- Any `converted_buyer_id`/`converted_at` links already written by `/api/buyer-applications` stay
  on `buyer_prospects` (those columns pre-date this migration) — rolling back only removes the
  attribution columns, not the link itself.
- The `audit_log` entries for `BUYER_PROSPECT_REPEAT_TOUCH` and `BUYER_PROSPECT_CONVERTED` are
  untouched, as `audit_log` is append-only by design (see `20261112140000_audit_log_append_only.sql`).
  They'll reference columns/tables that no longer exist after a rollback — expected, same as every
  other historical audit entry in this schema.
