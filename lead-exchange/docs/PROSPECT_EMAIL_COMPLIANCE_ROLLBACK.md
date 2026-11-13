# Prospect email compliance remediation: rollback and recovery

Status: tested by hand against a fresh local Postgres (full migration history applied, then this
migration, then rollback, then reapply) in the implementing session. No automated
`.integration.test.ts` coverage exists for this yet -- see "Integration test coverage" below.

## What the migration adds (20261112160000_prospect_unsubscribe_and_suppression.sql)

- Columns on `buyer_prospects`: `unsubscribe_token` (unique, not null, random), `nurture_unsubscribed_at`,
  `marketing_unsubscribed_at`, `email_bounced_at`, `email_complained_at`.
- Extends `buyer_prospect_emails.status`'s CHECK to add `'BOUNCED'`, `'COMPLAINED'`, `'SUPPRESSED'`.
- Function + trigger `trg_buyer_prospect_emails_guard_suppression`: refuses to let an outbox row
  reach `SENT` if the prospect is unsubscribed (intro sequence), bounced or complained. Marketing-only
  unsubscribe is deliberately NOT part of this guard.
- `CREATE EXTENSION IF NOT EXISTS pgcrypto` (standard Postgres contrib extension, available on Neon;
  used only to generate the unsubscribe token backfill/default).

No existing rows are modified beyond the token backfill (which only fills a previously-absent value).

## Before any production migration

1. Take a Netlify DB snapshot/backup, same as the standing practice for every migration in this app.
2. Run the migration on a preview or local database first.
3. Record `SELECT count(*) FROM buyer_prospects;` and `SELECT count(*) FROM buyer_prospect_emails;`
   before and after -- both counts must be unchanged (this migration only adds columns/constraints,
   never deletes or modifies existing rows other than the token backfill).

## Rollback SQL (run in one transaction, only with approval)

```sql
BEGIN;
DROP TRIGGER IF EXISTS trg_buyer_prospect_emails_guard_suppression ON buyer_prospect_emails;
DROP FUNCTION IF EXISTS buyer_prospect_emails_guard_suppression();
DROP INDEX IF EXISTS idx_buyer_prospects_unsubscribe_token;
ALTER TABLE buyer_prospects DROP CONSTRAINT IF EXISTS buyer_prospects_unsubscribe_token_key;
ALTER TABLE buyer_prospects DROP COLUMN IF EXISTS unsubscribe_token;
ALTER TABLE buyer_prospects DROP COLUMN IF EXISTS nurture_unsubscribed_at;
ALTER TABLE buyer_prospects DROP COLUMN IF EXISTS marketing_unsubscribed_at;
ALTER TABLE buyer_prospects DROP COLUMN IF EXISTS email_bounced_at;
ALTER TABLE buyer_prospects DROP COLUMN IF EXISTS email_complained_at;
COMMIT;
```

**Important, found by testing this rollback by hand, not just reasoning about it:** do NOT attempt to
narrow `buyer_prospect_emails_status_check` back to its original four values (`PENDING, SENT, FAILED,
DELIVERED`) as part of rollback. If any row already holds `BOUNCED`, `COMPLAINED` or `SUPPRESSED` (which
it will, the moment this feature has run in production for any length of time), re-adding the narrower
constraint fails outright with `check constraint ... is violated by some row`, confirmed directly
against a real Postgres instance while preparing this document. The fix is simply to leave the status
CHECK permissive -- it is harmless to allow those three values even after the trigger and application
code that set them are reverted, since nothing will set them once that code is gone. Narrowing it back
is not worth the risk and is not included in the rollback above.

Rolling back the application code (reverting this PR, or deploying the previous build) alongside the
above is required either way -- the previous build doesn't reference the new columns, so they can
safely stay even if you want to additionally clean them up for cosmetic reasons later.

Consequences:
- Dropping the columns permanently loses recorded unsubscribe/bounce/complaint state. The
  `audit_log` has no entries for this feature (unsubscribe/suppression events are not currently
  audit-logged -- see "Not yet done" below), so there is no secondary record to recover from once
  columns are dropped.
- After rollback, suppression is no longer enforced anywhere -- the previous build (with no
  suppression check at all) is what would be running, which is a regression back to the state this
  PR fixes, not a neutral rollback. Only roll this back if the alternative (keeping the feature) is
  worse.

## Integration test coverage

`main` has no `.integration.test.ts` convention today -- that pattern is introduced by the separate,
still-unmerged `onboarding-call-gate` branch/PR, not by anything on `main`. Rather than add a second,
inconsistent real-Postgres test harness (and a new `pg` dependency) to this independent branch, this
migration and its trigger were instead verified by hand against a real local Postgres instance: full
migration history applied from scratch, every suppression scenario (ACTIVE/unsubscribed/bounced/
complained/marketing-only) exercised directly in SQL, rollback executed, data checked for survival,
and the migration reapplied with the trigger confirmed working again afterwards.

**Recommended follow-up once `onboarding-call-gate` merges:** port this migration's trigger behaviour
into that branch's `.integration.test.ts` harness, so it gets the same automated, real-Postgres
regression coverage as the onboarding-call gate and audit-log append-only triggers do.

## Not yet done (explicitly out of scope for this patch, per instruction)

- Unsubscribe and suppression events are not written to `audit_log`. Worth adding if an audit trail of
  who unsubscribed/bounced and when becomes a requirement.
- The nurture scheduler (steps 2-5) is still not built -- this patch makes it *safe* to build (the
  suppression check and database guard are in place), but building it is explicitly deferred per
  Fabien's instruction ("do not build the nurture scheduler yet").
