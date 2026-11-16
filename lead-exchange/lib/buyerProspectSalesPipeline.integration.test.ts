import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordSalesActivity } from './buyerProspectSalesPipeline';

// Proves, against a real local Postgres seeded with PRE-EXISTING data (not an empty database),
// that the new migration (20261116100000_buyer_prospect_sales_pipeline.sql) is additive, that a
// Stuart-like quarantined record is left completely untouched by it, and that the authorisation
// and package-agreement guard trigger works independently of recordSalesActivity's own checks.
//
// Local throwaway database only (skipped unless TEST_PG_ADMIN_URL is set; refuses non-local hosts).
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');
const SALES_PIPELINE_MIGRATION = '20261116100000_buyer_prospect_sales_pipeline.sql';

describe.skipIf(!adminUrl)('buyer_prospects sales pipeline', () => {
  const dbName = `lx_test_${Date.now()}_pipeline`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, pgClient: any;
  let industryId: number;
  let packageDefinitionId: number;
  const db = { sql: undefined as unknown, pool: { connect: async () => ({ query: (t: string, v: unknown[]) => pgClient.query(t, v), release: () => {} }) } };

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    pgClient = new Client({ connectionString: url.toString() });
    await pgClient.connect();

    // Apply everything EXCEPT the new migration first, then seed PRE-EXISTING data -- including a
    // Stuart-like quarantined prospect -- so the new migration is tested against a database that
    // already has rows in it, matching real production, not a clean slate.
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
      if (f === SALES_PIPELINE_MIGRATION) continue;
      await pgClient.query(readFileSync(join(dir, f), 'utf8'));
    }

    await pgClient.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('solar_battery','Solar',true) ON CONFLICT (slug) DO NOTHING`);
    const industryRows = await pgClient.query(`SELECT id FROM industries WHERE slug = 'solar_battery'`);
    industryId = industryRows.rows[0].id;

    const pkg = await pgClient.query(`
      INSERT INTO package_definitions (industry_id, name, price, leads_included, active)
      VALUES ($1, 'Verified Enquiries', 425, 10, true) RETURNING id
    `, [industryId]);
    packageDefinitionId = pkg.rows[0].id;

    // A Stuart-like record: real prospect, nurture_status PAUSED, no sales activity whatsoever.
    // This must come out the other side of the migration with every new column at its default
    // (NEW stage, no authorisation) -- proving the migration grants nothing to anyone.
    await pgClient.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at, nurture_status)
      VALUES ('HLX-PROSPECT-000003-SIM', $1, 'the batt man', 'Stuart Goodman', 'sg@l2mc.co.uk', '+447738377422', true, encode(gen_random_bytes(32),'hex'), now(), 'PAUSED')
    `, [industryId]);

    // Now apply the new migration -- the actual moment under test.
    await pgClient.query(readFileSync(join(dir, SALES_PIPELINE_MIGRATION), 'utf8'));
  });

  afterAll(async () => {
    await pgClient?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  it('migration is additive: the Stuart-like quarantined record is left untouched', async () => {
    const row = await pgClient.query(
      `SELECT sales_stage, personal_contact_authorised_at, nurture_status FROM buyer_prospects WHERE prospect_reference = 'HLX-PROSPECT-000003-SIM'`
    );
    expect(row.rows[0].sales_stage).toBe('NEW');
    expect(row.rows[0].personal_contact_authorised_at).toBeNull();
    expect(row.rows[0].nurture_status).toBe('PAUSED'); // untouched by this migration
  });

  it('the database itself refuses to move a prospect past NEW without authorisation (direct SQL, no app code)', async () => {
    const prospect = await pgClient.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at)
      VALUES ('HLX-PROSPECT-GUARD-TEST', $1, 'Guard Co', 'Guard Person', 'guard@example.test', '07700900010', true, encode(gen_random_bytes(32),'hex'), now())
      RETURNING id
    `, [industryId]);

    await expect(
      pgClient.query(`UPDATE buyer_prospects SET sales_stage = 'CONTACTED' WHERE id = $1`, [prospect.rows[0].id])
    ).rejects.toThrow(/personal_contact_authorised_at/);
  });

  it('the database itself refuses PACKAGE_AGREED without an agreed package id (direct SQL, no app code)', async () => {
    const prospect = await pgClient.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at, personal_contact_authorised_at, personal_contact_authorised_by)
      VALUES ('HLX-PROSPECT-PKG-GUARD', $1, 'Pkg Co', 'Pkg Person', 'pkg@example.test', '07700900011', true, encode(gen_random_bytes(32),'hex'), now(), now(), 'admin@halostrategic.com')
      RETURNING id
    `, [industryId]);

    await expect(
      pgClient.query(`UPDATE buyer_prospects SET sales_stage = 'PACKAGE_AGREED' WHERE id = $1`, [prospect.rows[0].id])
    ).rejects.toThrow(/agreed_package_definition_id/);
  });

  it('recordSalesActivity drives a real prospect from NEW through PACKAGE_AGREED against the real database', async () => {
    const prospect = await pgClient.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at)
      VALUES ('HLX-PROSPECT-FULL-FLOW', $1, 'Flow Co', 'Flow Person', 'flow@example.test', '07700900012', true, encode(gen_random_bytes(32),'hex'), now())
      RETURNING id
    `, [industryId]);
    const prospectId = prospect.rows[0].id;

    await recordSalesActivity(db, {
      prospectId, activityType: 'STAGE_CHANGE', newStage: 'CONTACT_AUTHORISED',
      recordedBy: 'admin@halostrategic.com', authorisationBasis: 'Replied to email confirming interest, 2026-11-16.',
    });
    await recordSalesActivity(db, { prospectId, activityType: 'STAGE_CHANGE', newStage: 'CONTACTED', recordedBy: 'admin@halostrategic.com' });
    await recordSalesActivity(db, { prospectId, activityType: 'STAGE_CHANGE', newStage: 'RESPONDED', recordedBy: 'admin@halostrategic.com' });
    await recordSalesActivity(db, { prospectId, activityType: 'STAGE_CHANGE', newStage: 'QUALIFIED', recordedBy: 'admin@halostrategic.com' });
    await recordSalesActivity(db, { prospectId, activityType: 'STAGE_CHANGE', newStage: 'CALL_COMPLETED', recordedBy: 'admin@halostrategic.com' });
    await recordSalesActivity(db, {
      prospectId, activityType: 'STAGE_CHANGE', newStage: 'PACKAGE_AGREED',
      recordedBy: 'admin@halostrategic.com', agreedPackageDefinitionId: packageDefinitionId,
    });

    const row = await pgClient.query(`SELECT sales_stage, agreed_package_definition_id FROM buyer_prospects WHERE id = $1`, [prospectId]);
    expect(row.rows[0].sales_stage).toBe('PACKAGE_AGREED');
    expect(row.rows[0].agreed_package_definition_id).toBe(packageDefinitionId);

    const activity = await pgClient.query(`SELECT activity_type, new_stage FROM buyer_prospect_sales_activity WHERE prospect_id = $1 ORDER BY id`, [prospectId]);
    expect(activity.rows).toHaveLength(6);
    expect(activity.rows.map((r: { activity_type: string }) => r.activity_type)).toEqual(Array(6).fill('STAGE_CHANGE'));

    const auditRow = await pgClient.query(
      `SELECT action FROM audit_log WHERE entity_type = 'buyer_prospect' AND entity_id = $1 AND action = 'BUYER_PROSPECT_CONTACT_AUTHORISED'`,
      [prospectId]
    );
    expect(auditRow.rows).toHaveLength(1);
  });

  it('recordSalesActivity rejects skipping a stage against the real database', async () => {
    const prospect = await pgClient.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at)
      VALUES ('HLX-PROSPECT-SKIP-TEST', $1, 'Skip Co', 'Skip Person', 'skip@example.test', '07700900013', true, encode(gen_random_bytes(32),'hex'), now())
      RETURNING id
    `, [industryId]);

    await expect(
      recordSalesActivity(db, { prospectId: prospect.rows[0].id, activityType: 'STAGE_CHANGE', newStage: 'QUALIFIED', recordedBy: 'admin@halostrategic.com' })
    ).rejects.toThrow(/one step at a time/);

    const row = await pgClient.query(`SELECT sales_stage FROM buyer_prospects WHERE id = $1`, [prospect.rows[0].id]);
    expect(row.rows[0].sales_stage).toBe('NEW'); // unchanged -- rejected before any write
  });

  it('a non-stage-changing activity log entry does not disturb sales_stage', async () => {
    const prospect = await pgClient.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at, sales_stage, personal_contact_authorised_at, personal_contact_authorised_by)
      VALUES ('HLX-PROSPECT-NOTE-TEST', $1, 'Note Co', 'Note Person', 'note@example.test', '07700900014', true, encode(gen_random_bytes(32),'hex'), now(), 'CONTACT_AUTHORISED', now(), 'admin@halostrategic.com')
      RETURNING id
    `, [industryId]);
    const prospectId = prospect.rows[0].id;

    await recordSalesActivity(db, { prospectId, activityType: 'QUALIFICATION_NOTE', recordedBy: 'admin@halostrategic.com', note: 'Has a south-facing roof, budget confirmed.' });

    const row = await pgClient.query(`SELECT sales_stage FROM buyer_prospects WHERE id = $1`, [prospectId]);
    expect(row.rows[0].sales_stage).toBe('CONTACT_AUTHORISED');

    const activity = await pgClient.query(`SELECT activity_type, note FROM buyer_prospect_sales_activity WHERE prospect_id = $1`, [prospectId]);
    expect(activity.rows).toHaveLength(1);
    expect(activity.rows[0].activity_type).toBe('QUALIFICATION_NOTE');
  });
});
