import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { autoAuthoriseContactFromApplication } from './buyerProspectAutoAuthorise';

// Proves, against a real local Postgres, that auto-authorisation from a buyer application does
// exactly what the manual admin flow does (same columns, same guard trigger satisfied, same
// activity + audit trail) and nothing more -- it must never touch a prospect that already has its
// own authorisation or has moved further through the sales pipeline than NEW.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');

describe.skipIf(!adminUrl)('auto-authorise contact from a buyer application', () => {
  const dbName = `lx_test_${Date.now()}_autoauth`;
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

    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
      await db.query(readFileSync(join(dir, f), 'utf8'));
    }

    await db.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('solar_battery','Solar',true) ON CONFLICT (slug) DO NOTHING`);
    industryId = (await db.query(`SELECT id FROM industries WHERE slug = 'solar_battery'`)).rows[0].id;
  });

  afterAll(async () => {
    await db?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  async function seedProspect(overrides: { sales_stage?: string; personal_contact_authorised_at?: string | null } = {}) {
    const ref = `HLX-PROSPECT-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const row = await db.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at)
      VALUES ($1, $2, 'Test Co', 'Test Contact', $3, '07700900000', true, $4, now())
      RETURNING id
    `, [ref, industryId, `${ref}@example.com`, `tok-${ref}`]);
    const id = row.rows[0].id;
    // The guard trigger requires authorisation to already be set before sales_stage can move past
    // NEW, so the authorisation UPDATE must run first.
    if (overrides.personal_contact_authorised_at !== undefined) {
      await db.query(
        `UPDATE buyer_prospects SET personal_contact_authorised_at = $1, personal_contact_authorised_by = 'admin@halostrategic.com', contact_authorisation_basis = 'manual test basis' WHERE id = $2`,
        [overrides.personal_contact_authorised_at, id]
      );
    }
    if (overrides.sales_stage) {
      await db.query(`UPDATE buyer_prospects SET sales_stage = $1 WHERE id = $2`, [overrides.sales_stage, id]);
    }
    return id as number;
  }

  it('authorises a brand-new prospect (NEW, unauthorised) on application submission', async () => {
    const prospectId = await seedProspect();

    const result = await autoAuthoriseContactFromApplication(db, {
      prospectId, currentSalesStage: 'NEW', personalContactAuthorisedAt: null, applicationReference: 'HLX-BYR-000042',
    });
    expect(result).toBe(true);

    const row = (await db.query(`SELECT sales_stage, personal_contact_authorised_at, personal_contact_authorised_by, contact_authorisation_basis FROM buyer_prospects WHERE id = $1`, [prospectId])).rows[0];
    expect(row.sales_stage).toBe('CONTACT_AUTHORISED');
    expect(row.personal_contact_authorised_at).not.toBeNull();
    expect(row.personal_contact_authorised_by).toBe('system');
    expect(row.contact_authorisation_basis).toContain('HLX-BYR-000042');

    const activity = (await db.query(`SELECT activity_type, previous_stage, new_stage, recorded_by FROM buyer_prospect_sales_activity WHERE prospect_id = $1`, [prospectId])).rows;
    expect(activity).toEqual([{ activity_type: 'STAGE_CHANGE', previous_stage: 'NEW', new_stage: 'CONTACT_AUTHORISED', recorded_by: 'system' }]);

    const audit = (await db.query(`SELECT actor, action FROM audit_log WHERE entity_type = 'buyer_prospect' AND entity_id = $1`, [prospectId])).rows;
    expect(audit).toEqual([{ actor: 'system', action: 'BUYER_PROSPECT_CONTACT_AUTHORISED' }]);
  });

  it('does not touch a prospect an admin already authorised manually', async () => {
    const prospectId = await seedProspect({ sales_stage: 'CONTACT_AUTHORISED', personal_contact_authorised_at: '2026-11-01T09:00:00Z' });
    const before = (await db.query(`SELECT * FROM buyer_prospects WHERE id = $1`, [prospectId])).rows[0];

    const result = await autoAuthoriseContactFromApplication(db, {
      prospectId, currentSalesStage: 'CONTACT_AUTHORISED', personalContactAuthorisedAt: before.personal_contact_authorised_at, applicationReference: 'HLX-BYR-000043',
    });
    expect(result).toBe(false);

    const after = (await db.query(`SELECT * FROM buyer_prospects WHERE id = $1`, [prospectId])).rows[0];
    expect(after).toEqual(before);
    expect((await db.query(`SELECT count(*)::int n FROM buyer_prospect_sales_activity WHERE prospect_id = $1`, [prospectId])).rows[0].n).toBe(0);
  });

  it('does not advance a prospect already further along the pipeline', async () => {
    const prospectId = await seedProspect();
    // Manually run the prospect through the pipeline the normal way first, same as an admin would.
    await db.query(
      `UPDATE buyer_prospects SET sales_stage = 'CONTACT_AUTHORISED', personal_contact_authorised_at = now(), personal_contact_authorised_by = 'admin@halostrategic.com', contact_authorisation_basis = 'phoned, verbally agreed' WHERE id = $1`,
      [prospectId]
    );
    await db.query(`UPDATE buyer_prospects SET sales_stage = 'CONTACTED' WHERE id = $1`, [prospectId]);
    const before = (await db.query(`SELECT * FROM buyer_prospects WHERE id = $1`, [prospectId])).rows[0];

    const result = await autoAuthoriseContactFromApplication(db, {
      prospectId, currentSalesStage: 'CONTACTED', personalContactAuthorisedAt: before.personal_contact_authorised_at, applicationReference: 'HLX-BYR-000044',
    });
    expect(result).toBe(false);

    const after = (await db.query(`SELECT * FROM buyer_prospects WHERE id = $1`, [prospectId])).rows[0];
    expect(after).toEqual(before);
  });

  it('a prospect this touches satisfies the sales_stage guard trigger (proves it would also pass through the real route)', async () => {
    const prospectId = await seedProspect();
    await autoAuthoriseContactFromApplication(db, {
      prospectId, currentSalesStage: 'NEW', personalContactAuthorisedAt: null, applicationReference: 'HLX-BYR-000045',
    });
    // The trigger would have thrown during the UPDATE above if authorisation weren't set first --
    // reaching this point with no error is the proof. A further stage change should now be legal.
    await expect(
      db.query(`UPDATE buyer_prospects SET sales_stage = 'CONTACTED' WHERE id = $1`, [prospectId])
    ).resolves.toBeDefined();
  });
});
