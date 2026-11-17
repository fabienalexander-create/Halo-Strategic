import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Proves, against a real local Postgres, that an allocation's type must match what was actually
// agreed with the named buyer (buyers.exclusivity_arrangement) -- the rule added in
// 20261118100000_multi_buyer_distribution_model.sql -- and separately proves the multi-buyer
// safeguards instruction #3/#6 asked for directly against the database: independent payment
// verification and independent release per buyer on the same lead, and no allocation ever being
// writable without its own homeowner confirmation naming that specific buyer.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');

describe.skipIf(!adminUrl)('buyer exclusivity arrangement vs allocation type', () => {
  const dbName = `lx_test_${Date.now()}_excl`;
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

    await db.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('spray_foam_removal','Spray Foam Removal',true) ON CONFLICT (slug) DO NOTHING`);
    industryId = (await db.query(`SELECT id FROM industries WHERE slug = 'spray_foam_removal'`)).rows[0].id;
  });

  afterAll(async () => {
    await db?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  async function makeBuyer(name: string, arrangement: 'exclusive' | 'shared' | null, price: number) {
    const ref = `HLX-BYR-TEST-${name.replace(/\s+/g, '-').toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const row = await db.query(`
      INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status,
                           agreed_price_per_lead, exclusivity_arrangement, onboarding_call_completed_at,
                           onboarding_call_conducted_by, application_reference)
      VALUES ($1, $1, $1 || '@example.com', '07700900000', $2, 'ACTIVE', $3, $4, now(), 'admin@halostrategic.com', $5)
      RETURNING id
    `, [name, industryId, price, arrangement, ref]);
    return row.rows[0].id as number;
  }

  async function makeLeadAndConfirmation(buyerId: number, named: string) {
    const lead = await db.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, status)
      VALUES ($1, 'Test Homeowner', '{"mobile":"+447700900000"}'::jsonb, 'E1 1AA', 'QUALIFIED')
      RETURNING id
    `, [industryId]);
    const leadId = lead.rows[0].id;
    const confirmation = await db.query(`
      INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
      VALUES ($1, $2, $3, 'to discuss the enquiry', 'Asked if happy to be introduced', 'Yes', 'ADMIN_AFTER_CALL', now(), 'admin@halostrategic.com', 'call notes')
      RETURNING id
    `, [leadId, buyerId, named]);
    return { leadId, confirmationId: confirmation.rows[0].id };
  }

  it('refuses EXCLUSIVE_WINDOW for a buyer contracted shared', async () => {
    const buyerId = await makeBuyer('Shared Only Buyer', 'shared', 50);
    const { leadId, confirmationId } = await makeLeadAndConfirmation(buyerId, 'Shared Only Buyer');

    await expect(
      db.query(`
        INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
        VALUES ($1, $2, 'EXCLUSIVE_WINDOW', 1, 'PURCHASED', 50, $3)
      `, [leadId, buyerId, confirmationId])
    ).rejects.toThrow(/contracted for shared leads only/);
  });

  it('refuses SHARED for a buyer contracted exclusive', async () => {
    const buyerId = await makeBuyer('Exclusive Only Buyer', 'exclusive', 90);
    const { leadId, confirmationId } = await makeLeadAndConfirmation(buyerId, 'Exclusive Only Buyer');

    await expect(
      db.query(`
        INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
        VALUES ($1, $2, 'SHARED', NULL, 'PURCHASED', 90, $3)
      `, [leadId, buyerId, confirmationId])
    ).rejects.toThrow(/contracted for exclusive leads only/);
  });

  it('allows EXCLUSIVE_WINDOW for a buyer contracted exclusive, and SHARED for one contracted shared', async () => {
    const exclusiveBuyer = await makeBuyer('Still Exclusive Buyer', 'exclusive', 90);
    const sharedBuyer = await makeBuyer('Still Shared Buyer', 'shared', 50);

    const lead1 = await makeLeadAndConfirmation(exclusiveBuyer, 'Still Exclusive Buyer');
    await expect(
      db.query(`
        INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
        VALUES ($1, $2, 'EXCLUSIVE_WINDOW', 1, 'PURCHASED', 90, $3)
      `, [lead1.leadId, exclusiveBuyer, lead1.confirmationId])
    ).resolves.toBeDefined();

    const lead2 = await makeLeadAndConfirmation(sharedBuyer, 'Still Shared Buyer');
    await expect(
      db.query(`
        INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
        VALUES ($1, $2, 'SHARED', NULL, 'PURCHASED', 50, $3)
      `, [lead2.leadId, sharedBuyer, lead2.confirmationId])
    ).resolves.toBeDefined();
  });

  it('is permissive for a buyer with no exclusivity_arrangement recorded (NULL) -- a data gap, not grounds to refuse', async () => {
    const buyerId = await makeBuyer('No Arrangement Recorded Buyer', null, 60);
    const { leadId, confirmationId } = await makeLeadAndConfirmation(buyerId, 'No Arrangement Recorded Buyer');

    await expect(
      db.query(`
        INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
        VALUES ($1, $2, 'SHARED', NULL, 'PURCHASED', 60, $3)
      `, [leadId, buyerId, confirmationId])
    ).resolves.toBeDefined();
  });

  it('does not retroactively disturb an existing allocation when the buyer later gets an exclusivity_arrangement recorded', async () => {
    const buyerId = await makeBuyer('Later Labelled Buyer', null, 70);
    const { leadId, confirmationId } = await makeLeadAndConfirmation(buyerId, 'Later Labelled Buyer');
    const alloc = await db.query(`
      INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
      VALUES ($1, $2, 'EXCLUSIVE_WINDOW', 1, 'PURCHASED', 70, $3)
      RETURNING id
    `, [leadId, buyerId, confirmationId]);

    // Recording the buyer's arrangement afterwards must not touch the allocation already written.
    await db.query(`UPDATE buyers SET exclusivity_arrangement = 'shared' WHERE id = $1`, [buyerId]);
    const row = await db.query(`SELECT allocation_type, status FROM lead_allocations WHERE id = $1`, [alloc.rows[0].id]);
    expect(row.rows[0]).toEqual({ allocation_type: 'EXCLUSIVE_WINDOW', status: 'PURCHASED' });
  });

  it('verifies payment and releases independently for two buyers sharing the same lead', async () => {
    const buyerA = await makeBuyer('Independent Payment Buyer A', 'shared', 50);
    const buyerB = await makeBuyer('Independent Payment Buyer B', 'shared', 60);
    const lead = await db.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, status)
      VALUES ($1, 'Shared Lead Homeowner', '{"mobile":"+447700900111"}'::jsonb, 'E2 2BB', 'QUALIFIED')
      RETURNING id
    `, [industryId]);
    const leadId = lead.rows[0].id;

    const confA = await db.query(`
      INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
      VALUES ($1, $2, 'Independent Payment Buyer A', 'to discuss', 'Asked', 'Yes', 'ADMIN_AFTER_CALL', now(), 'admin@halostrategic.com', 'notes')
      RETURNING id
    `, [leadId, buyerA]);
    const confB = await db.query(`
      INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
      VALUES ($1, $2, 'Independent Payment Buyer B', 'to discuss', 'Asked', 'Yes', 'ADMIN_AFTER_CALL', now(), 'admin@halostrategic.com', 'notes')
      RETURNING id
    `, [leadId, buyerB]);

    const allocA = await db.query(`
      INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
      VALUES ($1, $2, 'SHARED', NULL, 'PURCHASED', 50, $3) RETURNING id
    `, [leadId, buyerA, confA.rows[0].id]);
    const allocB = await db.query(`
      INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
      VALUES ($1, $2, 'SHARED', NULL, 'PURCHASED', 60, $3) RETURNING id
    `, [leadId, buyerB, confB.rows[0].id]);

    // Buyer A pays; buyer B has not. Releasing to A must succeed; releasing to B must still be
    // refused -- payment and release are per allocation, never shared across buyers on the lead.
    await db.query(`
      INSERT INTO payments (lead_allocation_id, expected_amount, status, amount_received, transaction_reference, verified_by, verified_at)
      VALUES ($1, 50, 'PAID', 50, 'TIDE-REF-A', 'admin@halostrategic.com', now())
    `, [allocA.rows[0].id]);

    await expect(
      db.query(`INSERT INTO deliveries (lead_allocation_id, delivery_method, delivered_to_email, delivered_at, status)
                VALUES ($1, 'email', 'a@example.com', now(), 'SENT')`, [allocA.rows[0].id])
    ).resolves.toBeDefined();

    await expect(
      db.query(`INSERT INTO deliveries (lead_allocation_id, delivery_method, delivered_to_email, delivered_at, status)
                VALUES ($1, 'email', 'b@example.com', now(), 'SENT')`, [allocB.rows[0].id])
    ).rejects.toThrow(/has no verified payment and cannot be released/);
  });

  it('refuses an allocation with no homeowner confirmation naming that specific buyer -- no redistribution outside recorded consent', async () => {
    const buyerA = await makeBuyer('Consent Scope Buyer A', 'shared', 50);
    const buyerB = await makeBuyer('Consent Scope Buyer B', 'shared', 60);
    const { leadId, confirmationId } = await makeLeadAndConfirmation(buyerA, 'Consent Scope Buyer A');

    // Buyer B's allocation must not be writable using buyer A's confirmation -- consent is
    // recorded per lead AND buyer, never inferred across buyers sharing the same lead.
    await expect(
      db.query(`
        INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
        VALUES ($1, $2, 'SHARED', NULL, 'PURCHASED', 60, $3)
      `, [leadId, buyerB, confirmationId])
    ).rejects.toThrow(/homeowner confirmation .* is for a different lead or buyer/);
  });
});
