import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Proves the two new migrations are safe on a database that ALREADY holds data: they apply in
// order, leave existing rows untouched, do not interfere with audit inserts, roll back cleanly with
// the SQL in docs/ONBOARDING_CALL_ROLLBACK.md, and re-apply afterwards. Local throwaway database
// only (skipped unless TEST_PG_ADMIN_URL is set; refuses non-local hosts).
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');
const ONBOARDING = '20261112130000_onboarding_call.sql';
const AUDIT = '20261112140000_audit_log_append_only.sql';
const SESSION = '20261112150000_admin_session_version.sql';

describe.skipIf(!adminUrl)('migration sequence on a database with existing data', () => {
  const dbName = `lx_test_${Date.now()}_m`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, db: any;
  const q = (t: string, v: unknown[] = []) => db.query(t, v);
  const file = (f: string) => readFileSync(join(dir, f), 'utf8');

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    db = new Client({ connectionString: url.toString() });
    await db.connect();
    // Everything that already exists in production: all migrations EXCEPT the two new ones.
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
      if (f === ONBOARDING || f === AUDIT || f === SESSION) continue;
      await q(file(f));
    }
    await q(`INSERT INTO industries (slug, name, is_enabled) VALUES ('solar_battery','Solar',true) ON CONFLICT (slug) DO NOTHING`);
    for (const [ref, status] of [['L-1', 'ACTIVE'], ['L-2', 'ACTIVE'], ['L-3', 'PENDING_COMMERCIALS'], ['L-4', 'SUSPENDED']]) {
      await q(
        `INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status, application_reference)
         SELECT 'Legacy ' || $1, 'A', $1 || '@x.com', '1', id, $2, $1 FROM industries LIMIT 1`,
        [ref, status]
      );
    }
    await q(`INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state) VALUES ('legacy','OLD_EVENT','buyer',1,'{}'),('legacy','OLD_EVENT','buyer',2,'{}')`);
    await q(`INSERT INTO admin_users (email, password_hash, role) VALUES ('legacy-owner@x.com','h1','owner'),('legacy-rev@x.com','h2','reviewer')`);
  });

  afterAll(async () => {
    if (db) await db.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  const snapshot = async () => ({
    buyers: (await q(`SELECT id, application_reference, application_status, updated_at FROM buyers ORDER BY id`)).rows,
    audit: (await q(`SELECT id, actor, action FROM audit_log ORDER BY id`)).rows,
  });
  let before: Awaited<ReturnType<typeof snapshot>>;

  it('applies in order and leaves every existing row exactly as it was', async () => {
    before = await snapshot();
    await q(file(ONBOARDING));
    await q(file(AUDIT));
    await q(file(SESSION));
    expect(await snapshot()).toEqual(before);
    const admins = await q(`SELECT email, role, session_version FROM admin_users ORDER BY id`);
    expect(admins.rows).toEqual([
      { email: 'legacy-owner@x.com', role: 'owner', session_version: 0 },
      { email: 'legacy-rev@x.com', role: 'reviewer', session_version: 0 },
    ]);
  });

  it('existing ACTIVE buyers can still be edited and keep their status', async () => {
    await q(`UPDATE buyers SET company_name = 'Legacy L-1 renamed' WHERE application_reference = 'L-1'`);
    await q(`UPDATE buyers SET application_status = 'ACTIVE' WHERE application_reference = 'L-2'`);
    const r = await q(`SELECT count(*)::int AS n FROM buyers WHERE application_status = 'ACTIVE'`);
    expect(r.rows[0].n).toBe(2);
  });

  it('audit inserts from every writer shape still work, history cannot be changed', async () => {
    await q(`INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state) VALUES ('a','X','buyer',1,'{"k":1}')`);
    await q(`INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state) VALUES ('a','Y','buyer',1,'{}','{}')`);
    await q(`INSERT INTO audit_log (actor, action, entity_type, entity_id) VALUES ('system','Z','lead',NULL)`);
    await expect(q(`UPDATE audit_log SET actor = 'x'`)).rejects.toThrow(/append-only/);
    await expect(q(`DELETE FROM audit_log WHERE actor = 'legacy'`)).rejects.toThrow(/append-only/);
  });

  it('a failed correction leaves no partial state (audit insert failing rolls back the clear)', async () => {
    await q(`UPDATE buyers SET onboarding_call_completed_at = now(), onboarding_call_conducted_by = 'F' WHERE application_reference = 'L-3'`);
    await q(`CREATE FUNCTION test_fail_audit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'simulated audit failure'; END; $$ LANGUAGE plpgsql`);
    await q(`CREATE TRIGGER test_fail BEFORE INSERT ON audit_log FOR EACH ROW WHEN (NEW.action = 'BUYER_ONBOARDING_CALL_CORRECTED') EXECUTE FUNCTION test_fail_audit()`);
    const auditBefore = (await q(`SELECT count(*)::int n FROM audit_log`)).rows[0].n;
    await expect(
      q(`WITH prev AS (SELECT id, onboarding_call_completed_at c, onboarding_call_conducted_by w FROM buyers WHERE application_reference = 'L-3' FOR UPDATE),
              cleared AS (UPDATE buyers SET onboarding_call_completed_at = NULL, onboarding_call_conducted_by = NULL FROM prev WHERE buyers.id = prev.id RETURNING buyers.id),
              logged AS (INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
                         SELECT 'o', 'BUYER_ONBOARDING_CALL_CORRECTED', 'buyer', prev.id, '{}', '{}' FROM prev RETURNING id)
         SELECT (SELECT count(*) FROM cleared), (SELECT count(*) FROM logged)`)
    ).rejects.toThrow(/simulated audit failure/);
    const b = await q(`SELECT onboarding_call_conducted_by w FROM buyers WHERE application_reference = 'L-3'`);
    expect(b.rows[0].w).toBe('F');
    expect((await q(`SELECT count(*)::int n FROM audit_log`)).rows[0].n).toBe(auditBefore);
    await q(`DROP TRIGGER test_fail ON audit_log`);
    await q(`DROP FUNCTION test_fail_audit()`);
  });

  it('a rolled-back transaction around a correction leaves neither a cleared record nor an audit row', async () => {
    const auditBefore = (await q(`SELECT count(*)::int n FROM audit_log`)).rows[0].n;
    await q('BEGIN');
    await q(`UPDATE buyers SET onboarding_call_completed_at = NULL, onboarding_call_conducted_by = NULL WHERE application_reference = 'L-3'`);
    await q(`INSERT INTO audit_log (actor, action, entity_type, entity_id) VALUES ('o','BUYER_ONBOARDING_CALL_CORRECTED','buyer',3)`);
    await q('ROLLBACK');
    expect((await q(`SELECT onboarding_call_conducted_by w FROM buyers WHERE application_reference = 'L-3'`)).rows[0].w).toBe('F');
    expect((await q(`SELECT count(*)::int n FROM audit_log`)).rows[0].n).toBe(auditBefore);
  });

  it('session_version bumps on role or password change only', async () => {
    const v = async () => (await q(`SELECT session_version v FROM admin_users WHERE email = 'legacy-owner@x.com'`)).rows[0].v;
    await q(`UPDATE admin_users SET last_login_at = now() WHERE email = 'legacy-owner@x.com'`);
    expect(await v()).toBe(0);
    await q(`UPDATE admin_users SET role = 'reviewer' WHERE email = 'legacy-owner@x.com'`);
    expect(await v()).toBe(1);
    await q(`UPDATE admin_users SET password_hash = 'newhash' WHERE email = 'legacy-owner@x.com'`);
    expect(await v()).toBe(2);
    await q(`UPDATE admin_users SET role = 'reviewer', password_hash = 'newhash' WHERE email = 'legacy-owner@x.com'`); // no actual change
    expect(await v()).toBe(2);
    await q(`UPDATE admin_users SET role = 'owner' WHERE email = 'legacy-owner@x.com'`);
    expect(await v()).toBe(3);
    await q(`UPDATE admin_users SET session_version = session_version + 1 WHERE email = 'legacy-owner@x.com'`); // logout path
    expect(await v()).toBe(4);
  });

  it('the documented rollback SQL (session, audit, then onboarding migration) runs cleanly', async () => {
    await q(`DROP TRIGGER IF EXISTS trg_admin_users_bump_session_version ON admin_users;
             DROP FUNCTION IF EXISTS admin_users_bump_session_version();
             ALTER TABLE admin_users DROP COLUMN IF EXISTS session_version;`);
    const sv = await q(`SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'session_version'`);
    expect(sv.rows).toHaveLength(0);
    expect((await q(`SELECT count(*)::int n FROM admin_users`)).rows[0].n).toBe(2);
    const snap = (await q(`SELECT count(*)::int n FROM buyers WHERE application_status = 'ACTIVE'`)).rows[0].n;
    await q(`DROP TRIGGER IF EXISTS trg_audit_log_no_update_delete ON audit_log;
             DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON audit_log;
             DROP FUNCTION IF EXISTS audit_log_reject_change();`);
    await q(`UPDATE audit_log SET actor = 'maintenance' WHERE actor = 'legacy'`); // protection genuinely gone
    await q(`BEGIN;
             DROP TRIGGER IF EXISTS trg_buyers_require_onboarding_call ON buyers;
             DROP FUNCTION IF EXISTS buyers_require_onboarding_call();
             ALTER TABLE buyers DROP CONSTRAINT IF EXISTS buyers_onboarding_call_pair_check;
             ALTER TABLE buyers DROP COLUMN IF EXISTS onboarding_call_completed_at;
             ALTER TABLE buyers DROP COLUMN IF EXISTS onboarding_call_conducted_by;
             COMMIT;`);
    const cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_name = 'buyers' AND column_name LIKE 'onboarding_call%'`);
    expect(cols.rows).toHaveLength(0);
    expect((await q(`SELECT count(*)::int n FROM buyers WHERE application_status = 'ACTIVE'`)).rows[0].n).toBe(snap);
    // activation works again without the gate
    await q(`UPDATE buyers SET application_status = 'ACTIVE' WHERE application_reference = 'L-3'`);
  });

  it('re-applying all three migrations after a rollback works', async () => {
    await q(file(ONBOARDING));
    await q(file(AUDIT));
    await q(file(SESSION));
    await expect(q(`UPDATE audit_log SET actor = 'x'`)).rejects.toThrow(/append-only/);
  });
});
