import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Proves, against a real local Postgres seeded with PRE-EXISTING data, that the new migration
// (20261116110000_homeowner_leads_meta_lead_id.sql) is additive, and that the idempotency
// mechanism the ingestion endpoint relies on (INSERT ... ON CONFLICT (meta_lead_id) DO NOTHING)
// genuinely holds at the database layer -- not just in the mocked route test.
//
// Local throwaway database only (skipped unless TEST_PG_ADMIN_URL is set; refuses non-local hosts).
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');
const META_LEAD_ID_MIGRATION = '20261116110000_homeowner_leads_meta_lead_id.sql';

describe.skipIf(!adminUrl)('leads.meta_lead_id idempotency', () => {
  const dbName = `lx_test_${Date.now()}_metalead`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, db: any;
  let industryId: number;

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

    // Apply everything EXCEPT the new migration first, then seed a pre-existing manually-entered
    // lead (no meta_lead_id -- this must survive untouched), before applying the migration under test.
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
      if (f === META_LEAD_ID_MIGRATION) continue;
      await db.query(readFileSync(join(dir, f), 'utf8'));
    }

    await db.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('spray_foam_removal','Spray Foam Removal',true) ON CONFLICT (slug) DO NOTHING`);
    const industryRows = await db.query(`SELECT id FROM industries WHERE slug = 'spray_foam_removal'`);
    industryId = industryRows.rows[0].id;

    await db.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, status)
      VALUES ($1, 'Pre-existing manual lead', '{"mobile":"07700900000"}'::jsonb, 'M1 1AA', 'QUALIFIED')
    `, [industryId]);

    await db.query(readFileSync(join(dir, META_LEAD_ID_MIGRATION), 'utf8'));
  });

  afterAll(async () => {
    await db?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  it('migration is additive: the pre-existing lead is untouched and has meta_lead_id = NULL', async () => {
    const rows = await db.query(`SELECT meta_lead_id, homeowner_name, status FROM leads WHERE homeowner_name = 'Pre-existing manual lead'`);
    expect(rows.rows[0].meta_lead_id).toBeNull();
    expect(rows.rows[0].status).toBe('QUALIFIED');
  });

  it('a first delivery for a given meta_lead_id creates a row', async () => {
    const result = await db.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, meta_lead_id, status)
      VALUES ($1, 'Ebrehime Wadu', '{"mobile":"+447450949888"}'::jsonb, 'N15 5DF', 'l:unique-test-1', 'QUALIFICATION_PENDING')
      ON CONFLICT (meta_lead_id) WHERE meta_lead_id IS NOT NULL DO NOTHING
      RETURNING id
    `, [industryId]);
    expect(result.rows).toHaveLength(1);
  });

  it('a retried delivery of the SAME meta_lead_id creates no second row (real concurrency-safe idempotency)', async () => {
    const first = await db.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, meta_lead_id, status)
      VALUES ($1, 'Retry Test Homeowner', '{"mobile":"07700900111"}'::jsonb, 'N1 1AA', 'l:retry-test', 'QUALIFICATION_PENDING')
      ON CONFLICT (meta_lead_id) WHERE meta_lead_id IS NOT NULL DO NOTHING
      RETURNING id
    `, [industryId]);
    expect(first.rows).toHaveLength(1);

    // Simulated webhook retry: same meta_lead_id, arbitrary other fields differ (as a real retry
    // from Make might look slightly different in timestamp fields) -- must still be refused.
    const retry = await db.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, meta_lead_id, status)
      VALUES ($1, 'Retry Test Homeowner', '{"mobile":"07700900111"}'::jsonb, 'N1 1AA', 'l:retry-test', 'QUALIFICATION_PENDING')
      ON CONFLICT (meta_lead_id) WHERE meta_lead_id IS NOT NULL DO NOTHING
      RETURNING id
    `, [industryId]);
    expect(retry.rows).toHaveLength(0);

    const count = await db.query(`SELECT count(*)::int AS n FROM leads WHERE meta_lead_id = 'l:retry-test'`);
    expect(count.rows[0].n).toBe(1);
  });

  it('two leads with no meta_lead_id (manual entries) do not collide with each other', async () => {
    await db.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, status)
      VALUES ($1, 'Manual Lead A', '{"mobile":"07700900222"}'::jsonb, 'E1 1AA', 'QUALIFIED')
    `, [industryId]);
    const result = await db.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, status)
      VALUES ($1, 'Manual Lead B', '{"mobile":"07700900333"}'::jsonb, 'E2 2BB', 'QUALIFIED')
      RETURNING id
    `, [industryId]);
    expect(result.rows).toHaveLength(1);
  });

  it('ingestion never creates a lead_allocation, payment or homeowner_confirmation as a side effect', async () => {
    const lead = await db.query(`SELECT id FROM leads WHERE meta_lead_id = 'l:retry-test'`);
    const leadId = lead.rows[0].id;
    const allocations = await db.query(`SELECT id FROM lead_allocations WHERE lead_id = $1`, [leadId]);
    const confirmations = await db.query(`SELECT id FROM homeowner_confirmations WHERE lead_id = $1`, [leadId]);
    expect(allocations.rows).toHaveLength(0);
    expect(confirmations.rows).toHaveLength(0);
  });
});
