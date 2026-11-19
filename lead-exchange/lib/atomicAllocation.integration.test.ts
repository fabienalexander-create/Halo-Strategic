import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

// Fabien, 2026-11-19: "make allocation, lead status, audit record and payment record atomic;
// prevent duplicate or overlapping sales; preserve payment-before-release."
//
// This drives the real allocate route against a real, fully migrated local Postgres (every
// trigger and constraint as in production). Buyers mirror the live commercial terms: James
// exclusive at £80, Russell shared at £65, national. Contact details are placeholders on purpose:
// the repo is public.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const migrationsDir = join(__dirname, '..', 'netlify', 'database', 'migrations');

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@netlify/database', () => ({ getDatabase: () => holder.db }));
const sendLeadDeliveryEmailMock = vi.hoisted(() => vi.fn());
vi.mock('./leadDeliveryEmail', () => ({ sendLeadDeliveryEmail: sendLeadDeliveryEmailMock }));
vi.mock('./requireAdmin', () => ({
  requireAdmin: vi.fn(async () => ({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } })),
}));

describe.skipIf(!adminUrl)('allocation is all-or-nothing (real Postgres, real route)', () => {
  const dbName = `lx_test_${Date.now()}_atomic`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, pool: any;
  let industryId: number, jamesId: number, russellId: number;

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client, Pool } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    pool = new Pool({ connectionString: url.toString(), max: 6 });
    for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith('.sql')).sort()) {
      await pool.query(readFileSync(join(migrationsDir, f), 'utf8'));
    }
    // Same shape as @netlify/database: a tagged-template `sql` returning rows, plus a pg pool.
    const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
      return (await pool.query(text, values)).rows;
    };
    holder.db = { sql, pool };

    await pool.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('spray_foam_removal','Spray Foam Removal',true) ON CONFLICT (slug) DO NOTHING`);
    industryId = (await pool.query(`SELECT id FROM industries WHERE slug = 'spray_foam_removal'`)).rows[0].id;
    const buyer = async (name: string, email: string, price: number, arrangement: string, ref: string) =>
      (await pool.query(`
        INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status,
          agreed_price_per_lead, exclusivity_arrangement, agreed_weekly_capacity, coverage_type,
          onboarding_call_completed_at, onboarding_call_conducted_by, application_reference)
        VALUES ($1, $1, $2, '07700900000', $3, 'ACTIVE', $4, $5, 40, 'national', now(), 'admin@halostrategic.com', $6)
        RETURNING id`, [name, email, industryId, price, arrangement, ref])).rows[0].id as number;
    jamesId = await buyer('Exclusive Buyer (James terms)', 'james@example.test', 80, 'exclusive', 'HLX-BYR-TEST-EXCL');
    russellId = await buyer('Shared Buyer (Russell terms)', 'russell@example.test', 65, 'shared', 'HLX-BYR-TEST-SHRD');
  });

  afterAll(async () => {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  beforeEach(() => {
    sendLeadDeliveryEmailMock.mockReset();
    sendLeadDeliveryEmailMock.mockResolvedValue({ sent: true, skipped: false, blocked: false });
  });

  async function newLead(status = 'NEW') {
    return (await pool.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, property_type, service_requirement, status)
      VALUES ($1, 'Test Homeowner', '{"mobile":"+447700900123","email":"homeowner@example.test"}'::jsonb, 'MK15 9AA', 'House', 'Removal', $2)
      RETURNING id`, [industryId, status])).rows[0].id as number;
  }
  async function confirm(leadId: number, buyerId: number) {
    return (await pool.query(`
      INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
      VALUES ($1, $2, 'named business', 'to discuss removal', 'Asked if happy to be introduced', 'Yes', 'ADMIN_AFTER_CALL', now(), 'admin@halostrategic.com', 'call notes')
      RETURNING id`, [leadId, buyerId])).rows[0].id as number;
  }
  async function allocate(leadId: number, body: Record<string, unknown>) {
    const { POST } = await import('../app/api/admin/leads/[id]/allocate/route');
    const res = await POST(
      new NextRequest(`https://example.com/api/admin/leads/${leadId}/allocate`, { method: 'POST', body: JSON.stringify(body) }),
      { params: { id: String(leadId) } }
    );
    return { status: res.status, data: await res.json() };
  }
  async function state(leadId: number) {
    const lead = (await pool.query(`SELECT status FROM leads WHERE id = $1`, [leadId])).rows[0];
    const allocations = (await pool.query(`SELECT id, buyer_id, allocation_type FROM lead_allocations WHERE lead_id = $1 ORDER BY id`, [leadId])).rows;
    const ids = allocations.map((a: { id: number }) => a.id);
    const audits = (await pool.query(`SELECT entity_id FROM audit_log WHERE action = 'LEAD_ALLOCATED' AND entity_id = ANY($1::int[])`, [ids])).rows;
    const payments = (await pool.query(`SELECT id, lead_allocation_id, status, payment_reference, expected_amount FROM payments WHERE lead_allocation_id = ANY($1::int[]) ORDER BY id`, [ids])).rows;
    return { leadStatus: lead.status, allocations, audits, payments };
  }

  it('records allocation, RESERVED status, audit entry and a referenced PENDING payment together', async () => {
    const leadId = await newLead();
    const res = await allocate(leadId, { buyer_id: russellId, homeowner_confirmation_id: await confirm(leadId, russellId) });

    expect(res.status).toBe(200);
    const s = await state(leadId);
    expect(s.leadStatus).toBe('RESERVED');
    expect(s.allocations).toEqual([{ id: res.data.allocation_id, buyer_id: russellId, allocation_type: 'SHARED' }]);
    expect(s.audits).toHaveLength(1);
    expect(s.payments).toHaveLength(1);
    expect(s.payments[0]).toMatchObject({ status: 'PENDING', payment_reference: res.data.payment_reference });
    expect(Number(s.payments[0].expected_amount)).toBe(65);
  });

  it('leaves nothing behind when the payment write fails part-way: no allocation, no status change, no audit, no email', async () => {
    const leadId = await newLead();
    const confirmationId = await confirm(leadId, russellId);
    await pool.query(`
      CREATE FUNCTION test_fail_payment() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'simulated outage writing payment'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER test_fail_payment BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION test_fail_payment();`);
    try {
      const res = await allocate(leadId, { buyer_id: russellId, homeowner_confirmation_id: confirmationId });
      expect(res.status).toBe(500);
    } finally {
      await pool.query(`DROP TRIGGER test_fail_payment ON payments; DROP FUNCTION test_fail_payment();`);
    }

    const s = await state(leadId);
    expect(s.leadStatus).toBe('NEW');
    expect(s.allocations).toEqual([]);
    expect(s.payments).toEqual([]);
    expect((await pool.query(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'LEAD_ALLOCATED' AND new_state->>'lead_id' = $1`, [String(leadId)])).rows[0].n).toBe(0);
    expect(sendLeadDeliveryEmailMock).not.toHaveBeenCalled();

    // And the same request succeeds cleanly once the fault is gone: nothing stale blocks it.
    const retry = await allocate(leadId, { buyer_id: russellId, homeowner_confirmation_id: confirmationId });
    expect(retry.status).toBe(200);
  });

  it('two simultaneous allocations of the same lead to the same buyer produce exactly one sale and one payment', async () => {
    const leadId = await newLead();
    const confirmationId = await confirm(leadId, russellId);
    const results = await Promise.all(
      Array.from({ length: 4 }, () => allocate(leadId, { buyer_id: russellId, homeowner_confirmation_id: confirmationId }))
    );

    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409, 409]);
    const s = await state(leadId);
    expect(s.allocations).toHaveLength(1);
    expect(s.payments).toHaveLength(1);
    expect(s.audits).toHaveLength(1);
    expect(sendLeadDeliveryEmailMock.mock.calls.filter((c) => c[1].emailType === 'LEAD_OFFER')).toHaveLength(1);
  });

  it('racing an exclusive and a shared sale never leaves the exclusive buyer sharing with an earlier sale', async () => {
    for (let round = 0; round < 5; round++) {
      const leadId = await newLead();
      const [jamesConf, russellConf] = [await confirm(leadId, jamesId), await confirm(leadId, russellId)];
      const [j, r] = await Promise.all([
        allocate(leadId, { buyer_id: jamesId, homeowner_confirmation_id: jamesConf }),
        allocate(leadId, { buyer_id: russellId, homeowner_confirmation_id: russellConf }),
      ]);

      expect(r.status).toBe(200); // shared may always stack (unchanged rule, 2026-11-17)
      const s = await state(leadId);
      if (j.status === 200) {
        // Exclusive won the lock: it must be the first sale on the lead.
        expect(s.allocations[0]).toMatchObject({ buyer_id: jamesId, allocation_type: 'EXCLUSIVE_WINDOW' });
      } else {
        expect(j.status).toBe(409);
        expect(s.allocations.map((a: { buyer_id: number }) => a.buyer_id)).toEqual([russellId]);
      }
      // Every recorded sale has exactly one audit entry and one payment.
      expect(s.audits).toHaveLength(s.allocations.length);
      expect(s.payments).toHaveLength(s.allocations.length);
    }
  });

  it('keeps homeowner details locked until payment is verified', async () => {
    const leadId = await newLead();
    const res = await allocate(leadId, { buyer_id: jamesId, homeowner_confirmation_id: await confirm(leadId, jamesId) });
    expect(res.status).toBe(200);
    expect(res.data.released).toBe(false);

    // Only the offer goes out; the unlock (homeowner details) email does not.
    const types = sendLeadDeliveryEmailMock.mock.calls.map((c) => c[1].emailType);
    expect(types).toContain('LEAD_OFFER');
    expect(types).not.toContain('LEAD_UNLOCKED');
    expect(types).not.toContain('INTERNAL_RELEASE_COPY');

    // The database still refuses a delivery while the payment is unverified...
    await expect(pool.query(`INSERT INTO deliveries (lead_allocation_id, delivered_to_email) VALUES ($1, 'james@example.test')`, [res.data.allocation_id]))
      .rejects.toThrow(/no verified payment/);
    // ...and refuses marking it paid without admin verification.
    await expect(pool.query(`UPDATE payments SET status = 'PAID' WHERE lead_allocation_id = $1`, [res.data.allocation_id]))
      .rejects.toThrow(/verified by an admin/);

    // Once verified, release is allowed.
    await pool.query(`
      UPDATE payments SET status = 'PAID', verified_by = 'admin@halostrategic.com', verified_at = now(),
        transaction_reference = 'TIDE-TEST-1', amount_received = 80
      WHERE lead_allocation_id = $1`, [res.data.allocation_id]);
    await expect(pool.query(`INSERT INTO deliveries (lead_allocation_id, delivered_to_email) VALUES ($1, 'james@example.test')`, [res.data.allocation_id]))
      .resolves.toBeDefined();
  });

  it('refuses a lead still awaiting qualification and writes nothing', async () => {
    const leadId = await newLead('QUALIFICATION_PENDING');
    const res = await allocate(leadId, { buyer_id: russellId, homeowner_confirmation_id: await confirm(leadId, russellId) });

    expect(res.status).toBe(409);
    const s = await state(leadId);
    expect(s.allocations).toEqual([]);
    expect(s.leadStatus).toBe('QUALIFICATION_PENDING');
  });
});
