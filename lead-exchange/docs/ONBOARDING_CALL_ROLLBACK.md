# Onboarding call gate: rollback and recovery

Status: DOCUMENTATION ONLY. None of the SQL below has been run anywhere. Do not run it without explicit approval.

## What the migration adds (20261112130000_onboarding_call.sql)

- Columns on `buyers`: `onboarding_call_completed_at`, `onboarding_call_conducted_by`
- Check constraint: `buyers_onboarding_call_pair_check`
- Function: `buyers_require_onboarding_call()`
- Trigger: `trg_buyers_require_onboarding_call` (BEFORE INSERT OR UPDATE OF application_status)

No existing rows are modified by the migration (no backfill). Existing ACTIVE buyers are untouched.

## Before any production migration

1. Take a Netlify DB snapshot/backup. The launch-readiness doc notes snapshots are supported but a restore has never been tested, so treat the snapshot as a safety net and also export the `buyers` and `audit_log` tables (pg_dump of those two tables) to a secure location.
2. Run the migration on a preview or local database first and run `lib/onboardingCallTrigger.integration.test.ts` (see below).
3. Record the count of ACTIVE buyers before and after: `SELECT count(*) FROM buyers WHERE application_status = 'ACTIVE';` The two numbers must match.

## Rollback SQL (run in one transaction, only with approval)

```sql
BEGIN;
DROP TRIGGER IF EXISTS trg_buyers_require_onboarding_call ON buyers;
DROP FUNCTION IF EXISTS buyers_require_onboarding_call();
ALTER TABLE buyers DROP CONSTRAINT IF EXISTS buyers_onboarding_call_pair_check;
-- OPTIONAL, DESTROYS DATA: only if the recorded call data is not wanted.
-- Take a table export first (see recovery below).
ALTER TABLE buyers DROP COLUMN IF EXISTS onboarding_call_completed_at;
ALTER TABLE buyers DROP COLUMN IF EXISTS onboarding_call_conducted_by;
COMMIT;
```

Minimum rollback to unblock activations quickly: only the first two statements (drop trigger, drop function). This removes the database guard but keeps the recorded data. The application-level check in the activate route would also need reverting (revert the code change or deploy the previous build).

Consequences:
- Dropping the columns permanently loses every recorded call (who and when). `audit_log` entries of type `BUYER_ONBOARDING_CALL_RECORDED` remain and preserve the history.
- After rollback, the old deployed code must be running, otherwise the new routes will fail on the missing columns.
- Buyers activated while the gate was live stay ACTIVE.

## Recovery

- Preserve call data before the optional column drop: `CREATE TABLE buyers_onboarding_call_backup AS SELECT id, application_reference, onboarding_call_completed_at, onboarding_call_conducted_by FROM buyers WHERE onboarding_call_completed_at IS NOT NULL;`
- Re-apply: re-run the migration file (it is written to be applied once; if columns were kept, add IF NOT EXISTS guards or apply only the missing pieces) and restore data from the backup table with an UPDATE joined on `id`.
- Full restore from snapshot is the last resort and untested. Prefer the targeted steps above.

## Known edge case: suspended buyers

The trigger blocks any move to ACTIVE when no call is recorded, including SUSPENDED to ACTIVE. No code path currently reactivates a suspended buyer, so nothing breaks today. But a legacy buyer who became ACTIVE before this migration has no recorded call, so if they are suspended and later reactivated, the trigger will refuse.

Future requirement when a reactivation feature is built: either record the call for the legacy buyer first (owner-only, with a clear "pre-existing relationship" reason in the audit log), or add an explicit, audited owner override. Do not weaken the trigger silently. This is covered by a test that documents the current behaviour.

## Correcting a mistaken call record (built)

`POST /api/admin/applications/[reference]/onboarding-call/correct`
- Owner only, only while the buyer is `PENDING_COMMERCIALS`, and only if a call is recorded
- Requires `confirm_correction: true` and a written reason (10 to 500 characters, no angle brackets)
- One SQL statement locks the row, clears both call columns and inserts the audit entry `BUYER_ONBOARDING_CALL_CORRECTED` (previous conductor and time in `previous_state`, the reason in `new_state`). The change and its audit entry succeed or fail together
- The original `BUYER_ONBOARDING_CALL_RECORDED` entry is never touched; the call can then be recorded again normally
- Never available once the buyer is ACTIVE (a post-activation correction would need a separate, deliberate process)

## Audit log protection (built, separate migration 20261112140000_audit_log_append_only.sql)

Triggers make UPDATE, DELETE and TRUNCATE on `audit_log` fail at the database. INSERT and SELECT are unaffected. Every existing writer only inserts (all 13 call sites checked), the table has no foreign keys, and nothing cascades into it.

Privileged maintenance exception (database owner or superuser only, deliberate and visible, for example a legal erasure request):

```sql
BEGIN;
ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_no_update_delete;
ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_no_truncate;
-- the maintenance statement
ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_no_update_delete;
ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_no_truncate;
COMMIT;
```

Rollback of this migration (independent of the onboarding migration; run only with approval):

```sql
DROP TRIGGER IF EXISTS trg_audit_log_no_update_delete ON audit_log;
DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON audit_log;
DROP FUNCTION IF EXISTS audit_log_reject_change();
```

Migration order: 20261112130000 (onboarding call) then 20261112140000 (audit protection), both after the separate 20261112100000_buyer_prospects migration. The second depends on nothing from the first and can be rolled back separately. Note the app's own database role may itself be the table owner, so the triggers, not privileges, are the protection.

## Admin session role revalidation (built)

`requireAdmin` and `requireOwner` are now async. After verifying the signed cookie they look the admin up in `admin_users` on every request and use the CURRENT role. A demoted admin loses owner access on their next request, a promoted admin gains it, a deleted admin (or an id that now belongs to a different email) is rejected with 401, and a database failure fails closed with 503. Cost: one indexed primary-key lookup per admin request. Also fixed: logout cleared the cookie with the wrong path, so the cookie was never actually removed from the browser; it now uses the same path it was set with.

## Per-admin session version (built, migration 20261112150000_admin_session_version.sql)

- `admin_users.session_version` (integer, default 0). The signed cookie carries the version current at login; `requireAdmin` compares it with the database value using the lookup it already does (no extra query). Any mismatch returns 401. Cookies with no version (issued before this release) are rejected, so every admin signs in once after release.
- Bumped by the application on logout (guarded: `WHERE session_version = <cookie version>`, so a stale cookie cannot kick out a newer session). Logout therefore also ends the same admin's other devices and any stolen copy of the cookie.
- Bumped by a database trigger whenever `role` or `password_hash` changes, however the change is made (there is no in-app password-change or role-change screen today, so these happen by hand in the database and the trigger covers them). Other updates such as `last_login_at` do not bump. A role change in either direction bumps (a promoted admin signs in again).
- Fails closed: if the lookup or the logout bump cannot be saved, access is refused (503) and logout reports it.
- Not covered: a stolen cookie works until the legitimate admin signs out, the password or role changes, or 12 hours pass. No per-device list or revoke (that is the server-side session table, deliberately not built).
- Page shells under /admin only check the cookie signature to decide whether to redirect to login (UX only). All data comes from the API routes, which revalidate every request.

Rollback of this migration (independent of the other two; run only with approval):

```sql
DROP TRIGGER IF EXISTS trg_admin_users_bump_session_version ON admin_users;
DROP FUNCTION IF EXISTS admin_users_bump_session_version();
ALTER TABLE admin_users DROP COLUMN IF EXISTS session_version;
```

Roll the application back first or together: the new build needs the column, the previous build ignores it (and its cookies, which carry no version, work only on the previous build).

## Release checklist (when approved)

1. Take a verified backup of the production database immediately before release (snapshot plus a pg_dump of `buyers`, `admin_users` and `audit_log`).
2. Migration order: 20261112130000 (onboarding call), 20261112140000 (audit append-only), 20261112150000 (session version). They are independent of each other and each has its own rollback above.
3. After release: sign in as the owner (one forced sign-in), then confirm that a reviewer cannot activate, an owner can record a call on a test application, and that logout works.

## Automated trigger tests

`lib/onboardingCallTrigger.integration.test.ts` and `lib/auditAndCorrection.integration.test.ts` run against a real Postgres, skipped unless `TEST_PG_ADMIN_URL` is set. It refuses any non-local host, creates a throwaway database, applies all migrations, runs the scenarios and drops the database.

```
TEST_PG_ADMIN_URL=postgres://postgres@127.0.0.1:5432/postgres npx vitest run
```
