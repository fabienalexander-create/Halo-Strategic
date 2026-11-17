import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Proves, against a real local Postgres, that the corrected uq_lead_allocations_live_per_lead
// index actually does what it's meant to: still refuses two live EXCLUSIVE_WINDOW allocations for
// the same lead (the original guarantee, unchanged), but now allows a SHARED allocation to coexist
// with an existing one of either type -- this is a real database constraint, not just app logic,
// so it has to be proven at the database layer, not only mocked.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');
const SHARED_ALLOCATION_MIGRATION = '20261117100000_shared_lead_allocation.sql';

describe.skipIf(!adminUrl)('shared lead allocation', () => {
  const dbName = `lx_test_${Date.now()}_shared`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, db: any;
  let industryId: number;
  let jamesId: number;
  let russellId: number;

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
      if (f === SHARED_ALLOCATION_MIGRATION) continue;
      await db.query(readFileSync(join(dir, f), 'utf8'));
    }

    await db.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('spray_foam_removal','Spray Foam Removal',true) ON CONFLICT (slug) DO NOTHING`);
    const industryRows = await db.query(`SELECT id FROM industries WHERE slug = 'spray_foam_removal'`);
    industryId = industryRows.rows[0].id;

    const james = await db.query(`
      INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status, agreed_price_per_lead, onboarding_call_completed_at, onboarding_call_conducted_by, application_reference)
      VALUES ('We Fix Roofs Limited', 'James', 'wefixroofsuk@gmail.com', '07931323468', $1, 'ACTIVE', 80, now(), 'admin@halostrategic.com', 'HLX-BYR-TEST-JAMES')
      RETURNING id
    `, [industryId]);
    jamesId = james.rows[0].id;

    const russell = await db.query(`
      INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status, agreed_price_per_lead, onboarding_call_completed_at, onboarding_call_conducted_by, application_reference)
      VALUES ('Russell Griffiths (business name pending)', 'Russell Griffiths', 'russellgriffiths@yahoo.com', '07700900000', $1, 'ACTIVE', 65, now(), 'admin@halostrategic.com', 'HLX-BYR-TEST-RUSSELL')
      RETURNING id
    `, [industryId]);
    russellId = russell.rows[0].id;

    // Pre-existing behaviour, from before this migration: two EXCLUSIVE_WINDOW allocations for the
    // same lead must already be impossible without the new migration -- establishes the baseline
    // this migration must not weaken.
    await db.query(readFileSync(join(dir, SHARED_ALLOCATION_MIGRATION), 'utf8'));
  });

  afterAll(async () => {
    await db?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  async function makeLeadAndConfirmation(buyerId: number, named: string) {
    const lead = await db.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, status)
      VALUES ($1, 'Nkechiyeuinm Onwuegbute', '{"mobile":"+447438810642"}'::jsonb, 'SW2 4UR', 'QUALIFIED')
      RETURNING id
    `, [industryId]);
    const leadId = lead.rows[0].id;
    const confirmation = await db.query(`
      INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
      VALUES ($1, $2, $3, 'to discuss removal', 'Asked if happy to be introduced', 'Yes', 'ADMIN_AFTER_CALL', now(), 'admin@halostrategic.com', 'call notes')
      RETURNING id
    `, [leadId, buyerId, named]);
    return { leadId, confirmationId: confirmation.rows[0].id };
  }

  it('still refuses a second EXCLUSIVE_WINDOW allocation for the same lead (unchanged baseline)', async () => {
    const { leadId, confirmationId } = await makeLeadAndConfirmation(jamesId, 'We Fix Roofs Limited');

    await db.query(`
      INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
      VALUES ($1, $2, 'EXCLUSIVE_WINDOW', 1, 'PURCHASED', 80, $3)
    `, [leadId, jamesId, confirmationId]);

    const { confirmationId: russellConfirmationId } = { confirmationId: (await db.query(`
      INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
      VALUES ($1, $2, 'Russell Griffiths', 'to discuss removal', 'Asked if happy to be introduced', 'Yes', 'ADMIN_AFTER_CALL', now(), 'admin@halostrategic.com', 'call notes')
      RETURNING id
    `, [leadId, russellId])).rows[0].id };

    await expect(
      db.query(`
        INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
        VALUES ($1, $2, 'EXCLUSIVE_WINDOW', 1, 'PURCHASED', 65, $3)
      `, [leadId, russellId, russellConfirmationId])
    ).rejects.toThrow(/already has another live allocation; cannot claim it exclusively/);
  });

  it('allows a SHARED allocation to coexist with an existing EXCLUSIVE_WINDOW allocation for the same lead', async () => {
    const { leadId, confirmationId } = await makeLeadAndConfirmation(jamesId, 'We Fix Roofs Limited');

    await db.query(`
      INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
      VALUES ($1, $2, 'EXCLUSIVE_WINDOW', 1, 'PURCHASED', 80, $3)
    `, [leadId, jamesId, confirmationId]);

    const russellConfirmation = await db.query(`
      INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
      VALUES ($1, $2, 'Russell Griffiths', 'to discuss removal', 'Asked if happy to be introduced', 'Yes', 'ADMIN_AFTER_CALL', now(), 'admin@halostrategic.com', 'call notes')
      RETURNING id
    `, [leadId, russellId]);

    await expect(
      db.query(`
        INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
        VALUES ($1, $2, 'SHARED', NULL, 'PURCHASED', 65, $3)
      `, [leadId, russellId, russellConfirmation.rows[0].id])
    ).resolves.toBeDefined();

    const live = await db.query(`SELECT buyer_id, allocation_type FROM lead_allocations WHERE lead_id = $1 ORDER BY id`, [leadId]);
    expect(live.rows).toHaveLength(2);
    expect(live.rows.map((r: { allocation_type: string }) => r.allocation_type)).toEqual(['EXCLUSIVE_WINDOW', 'SHARED']);
  });

  it('two SHARED allocations for the same lead, for two different buyers, both succeed', async () => {
    const lead = await db.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, status)
      VALUES ($1, 'Ebrehime Wadu', '{"mobile":"+447450949888"}'::jsonb, 'N15 5DF', 'QUALIFIED')
      RETURNING id
    `, [industryId]);
    const leadId = lead.rows[0].id;

    for (const buyerId of [jamesId, russellId]) {
      const confirmation = await db.query(`
        INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
        VALUES ($1, $2, 'specialist', 'to discuss removal', 'Asked if happy to be introduced', 'Yes', 'ADMIN_AFTER_CALL', now(), 'admin@halostrategic.com', 'call notes')
        RETURNING id
      `, [leadId, buyerId]);
      await expect(
        db.query(`
          INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
          VALUES ($1, $2, 'SHARED', NULL, 'PURCHASED', 70, $3)
        `, [leadId, buyerId, confirmation.rows[0].id])
      ).resolves.toBeDefined();
    }

    const live = await db.query(`SELECT buyer_id FROM lead_allocations WHERE lead_id = $1`, [leadId]);
    expect(live.rows).toHaveLength(2);
  });

  it('a second EXCLUSIVE_WINDOW allocation is still refused even when the existing one is SHARED', async () => {
    const lead = await db.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, status)
      VALUES ($1, 'Another Homeowner', '{"mobile":"07700900555"}'::jsonb, 'E1 1AA', 'QUALIFIED')
      RETURNING id
    `, [industryId]);
    const leadId = lead.rows[0].id;

    const c1 = await db.query(`
      INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
      VALUES ($1, $2, 'We Fix Roofs Limited', 'to discuss removal', 'Asked if happy to be introduced', 'Yes', 'ADMIN_AFTER_CALL', now(), 'admin@halostrategic.com', 'call notes')
      RETURNING id
    `, [leadId, jamesId]);
    await db.query(`
      INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
      VALUES ($1, $2, 'SHARED', NULL, 'PURCHASED', 80, $3)
    `, [leadId, jamesId, c1.rows[0].id]);

    const c2 = await db.query(`
      INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
      VALUES ($1, $2, 'Russell Griffiths', 'to discuss removal', 'Asked if happy to be introduced', 'Yes', 'ADMIN_AFTER_CALL', now(), 'admin@halostrategic.com', 'call notes')
      RETURNING id
    `, [leadId, russellId]);

    await expect(
      db.query(`
        INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
        VALUES ($1, $2, 'EXCLUSIVE_WINDOW', 1, 'PURCHASED', 65, $3)
      `, [leadId, russellId, c2.rows[0].id])
    ).rejects.toThrow(/already has another live allocation; cannot claim it exclusively/);
  });
});
