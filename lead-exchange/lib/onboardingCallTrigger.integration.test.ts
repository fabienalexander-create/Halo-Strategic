import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Database-level test of the onboarding-call guard against a REAL Postgres.
//
// Skipped unless TEST_PG_ADMIN_URL is set, e.g.
//   TEST_PG_ADMIN_URL=postgres://postgres@127.0.0.1:5432/postgres npx vitest run lib/onboardingCallTrigger
// It creates a brand-new throwaway database, applies every migration in order, runs the checks and
// drops the database again. It refuses to run against any host that is not localhost, so it can
// never touch a production or preview database.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);

describe.skipIf(!adminUrl)('onboarding call guard (real Postgres)', () => {
  const dbName = `lx_test_${Date.now()}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;

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
    const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
      await db.query(readFileSync(join(dir, f), 'utf8'));
    }
    await db.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('solar_battery', 'Solar', true)
                    ON CONFLICT (slug) DO NOTHING`);
  });

  afterAll(async () => {
    if (db) await db.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  let n = 0;
  async function insertBuyer(status: string, call = false): Promise<number> {
    n += 1;
    const r = await db.query(
      `INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id,
         application_status, application_reference, onboarding_call_completed_at, onboarding_call_conducted_by)
       SELECT 'Co ${n}', 'A', 'b${n}@x.com', '1', id, $1, 'T-${n}', $2, $3 FROM industries LIMIT 1 RETURNING id`,
      [status, call ? new Date() : null, call ? 'Fabien' : null]
    );
    return r.rows[0].id;
  }

  it('refuses a move to ACTIVE without a recorded call', async () => {
    const id = await insertBuyer('PENDING_COMMERCIALS');
    await expect(db.query(`UPDATE buyers SET application_status = 'ACTIVE' WHERE id = $1`, [id])).rejects.toThrow(
      /onboarding call/
    );
  });

  it('refuses inserting a buyer directly as ACTIVE without a call', async () => {
    await expect(insertBuyer('ACTIVE')).rejects.toThrow(/onboarding call/);
  });

  it('refuses a half-filled call record (time without conductor)', async () => {
    const id = await insertBuyer('PENDING_COMMERCIALS');
    await expect(
      db.query(`UPDATE buyers SET onboarding_call_completed_at = now() WHERE id = $1`, [id])
    ).rejects.toThrow(/onboarding_call_pair_check/);
  });

  it('allows activation once the call is recorded', async () => {
    const id = await insertBuyer('PENDING_COMMERCIALS');
    await db.query(
      `UPDATE buyers SET onboarding_call_completed_at = now(), onboarding_call_conducted_by = 'Fabien' WHERE id = $1`,
      [id]
    );
    await db.query(`UPDATE buyers SET application_status = 'ACTIVE' WHERE id = $1`, [id]);
    const r = await db.query(`SELECT application_status FROM buyers WHERE id = $1`, [id]);
    expect(r.rows[0].application_status).toBe('ACTIVE');
  });

  it('does not affect a buyer that was already ACTIVE before the migration (no call on record)', async () => {
    // Simulate a legacy ACTIVE buyer: disable the guard to create it, as it pre-dates the migration.
    const id = await insertBuyer('PENDING_COMMERCIALS');
    await db.query(`ALTER TABLE buyers DISABLE TRIGGER trg_buyers_require_onboarding_call`);
    await db.query(`UPDATE buyers SET application_status = 'ACTIVE' WHERE id = $1`, [id]);
    await db.query(`ALTER TABLE buyers ENABLE TRIGGER trg_buyers_require_onboarding_call`);
    await db.query(`UPDATE buyers SET application_status = 'ACTIVE', review_notes = 'edited' WHERE id = $1`, [id]);
    const r = await db.query(`SELECT review_notes FROM buyers WHERE id = $1`, [id]);
    expect(r.rows[0].review_notes).toBe('edited');
  });

  it('blocks a legacy ACTIVE buyer from returning to ACTIVE after suspension (documented future edge case)', async () => {
    const id = await insertBuyer('PENDING_COMMERCIALS');
    await db.query(`ALTER TABLE buyers DISABLE TRIGGER trg_buyers_require_onboarding_call`);
    await db.query(`UPDATE buyers SET application_status = 'ACTIVE' WHERE id = $1`, [id]);
    await db.query(`ALTER TABLE buyers ENABLE TRIGGER trg_buyers_require_onboarding_call`);
    await db.query(`UPDATE buyers SET application_status = 'SUSPENDED' WHERE id = $1`, [id]);
    await expect(db.query(`UPDATE buyers SET application_status = 'ACTIVE' WHERE id = $1`, [id])).rejects.toThrow(
      /onboarding call/
    );
  });
});
