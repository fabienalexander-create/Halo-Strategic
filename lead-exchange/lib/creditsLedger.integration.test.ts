import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import {
  decideReplacementRequest, recordPackageRefund, recordReplacementRequest, resolveReplacementRequest,
} from './creditsLedger';

// Technical PR A (credits ledger), approved by Fabien 2026-11-26. Runs against a real, local,
// throwaway Postgres (skipped unless TEST_PG_ADMIN_URL is set; refuses non-local hosts):
//   1. builds the schema exactly as production has it today (every migration before this one),
//   2. seeds production-like data (a package part-used, paid and package leads delivered, a legacy
//      replacement request), snapshots it,
//   3. applies 20261126100000_credits_ledger.sql and proves every existing row is unchanged,
//   4. proves each rule (expiry, balance, restore once, refunds, free replacements, tamper refusal),
//   5. races concurrent operations against the same credits,
//   6. runs the rollback in docs/CREDITS_LEDGER_ROLLBACK.md, checks the previous behaviour and data
//      are back, then re-applies the migration.
// Contact details are placeholders: the repo is public.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const migrationsDir = join(__dirname, '..', 'netlify', 'database', 'migrations');
const LEDGER = '20261126100000_credits_ledger.sql';
const ADMIN = 'admin@halostrategic.com';

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@netlify/database', () => ({ getDatabase: () => holder.db }));
const sendLeadDeliveryEmailMock = vi.hoisted(() => vi.fn());
vi.mock('./leadDeliveryEmail', () => ({ sendLeadDeliveryEmail: sendLeadDeliveryEmailMock }));
vi.mock('./requireAdmin', () => ({
  requireAdmin: vi.fn(async () => ({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } })),
  requireOwner: vi.fn(async () => ({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } })),
}));

describe.skipIf(!adminUrl)('credits ledger (real Postgres)', () => {
  const dbName = `lx_test_${Date.now()}_ledger`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, pool: any;
  let industryId: number, buyerId: number, otherBuyerId: number;
  let legacyPackageId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let snapshot: Record<string, any[]>;
  let seq = 0;
  const q = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
  const one = async (text: string, values: unknown[] = []) => (await q(text, values))[0];
  const uniq = (p: string) => `${p}-${Date.now()}-${++seq}`;

  async function newLead() {
    return (await one(
      `INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, property_type, service_requirement, status)
       VALUES ($1, 'Test Homeowner', '{"mobile":"+447700900123","email":"homeowner@example.test"}'::jsonb, 'MK15 9AA', 'House', 'Removal', 'NEW')
       RETURNING id`, [industryId])).id as number;
  }
  async function confirm(leadId: number, buyer = buyerId) {
    return (await one(
      `INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
       VALUES ($1, $2, 'Test Buyer Ltd', 'to contact you about your enquiry', 'Happy to be introduced?', 'Yes', 'ADMIN_AFTER_CALL', now(), $3, 'Called homeowner')
       RETURNING id`, [leadId, buyer, ADMIN])).id as number;
  }
  async function packageAllocation(packageId: number, buyer = buyerId) {
    const leadId = await newLead();
    const conf = await confirm(leadId, buyer);
    return (await one(
      `INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, status, package_id, homeowner_confirmation_id)
       VALUES ($1, $2, 'SHARED', 'PURCHASED', $3, $4) RETURNING id`, [leadId, buyer, packageId, conf])).id as number;
  }
  async function deliver(allocationId: number) {
    return (await one(`INSERT INTO deliveries (lead_allocation_id, delivered_at, status) VALUES ($1, now(), 'SENT') RETURNING id`, [allocationId])).id as number;
  }
  async function deliveredPackageLead(packageId: number) {
    const allocationId = await packageAllocation(packageId);
    await deliver(allocationId);
    return allocationId;
  }
  async function deliveredPaidLead(price = 85) {
    const leadId = await newLead();
    const conf = await confirm(leadId);
    const allocationId = (await one(
      `INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, status, agreed_price, homeowner_confirmation_id)
       VALUES ($1, $2, 'SHARED', 'PURCHASED', $3, $4) RETURNING id`, [leadId, buyerId, price, conf])).id as number;
    await q(
      `INSERT INTO payments (lead_allocation_id, expected_amount, status, verified_by, verified_at, transaction_reference, amount_received)
       VALUES ($1, $2, 'PAID', $3, now(), $4, $2)`, [allocationId, price, ADMIN, uniq('TIDE-PAY')]);
    await deliver(allocationId);
    return { allocationId, leadId };
  }
  async function newPackage(opts: { paid?: number; leads?: number; verifiedAgo?: string; definitionId?: number | null; buyer?: number } = {}) {
    const verified = opts.verifiedAgo ? `now() - interval '${opts.verifiedAgo}'` : 'now()';
    return (await one(
      `INSERT INTO buyer_packages (buyer_id, package_definition_id, amount_paid, leads_included, transaction_reference, paid_at, verified_by, verified_at)
       VALUES ($1, $2, $3, $4, $5, now(), $6, ${verified}) RETURNING id`,
      [opts.buyer ?? buyerId, opts.definitionId ?? null, opts.paid ?? 425, opts.leads ?? 5, uniq('TIDE-PKG'), ADMIN])).id as number;
  }
  const pkgRow = (id: number) => one(`SELECT * FROM buyer_packages WHERE id = $1`, [id]);
  const balance = (id: number) => one(`SELECT * FROM package_balances WHERE buyer_package_id = $1`, [id]);
  async function approvedRequest(allocationId: number) {
    const { id } = await recordReplacementRequest(pool, ADMIN, {
      leadAllocationId: allocationId, reasonCode: 'INVALID_CONTACT', reason: 'Number disconnected', reportedAt: new Date().toISOString(),
    });
    await decideReplacementRequest(pool, ADMIN, id, 'APPROVED');
    return id;
  }

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client, Pool } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    pool = new Pool({ connectionString: url.toString(), max: 12 });
    const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
      return (await pool.query(text, values)).rows;
    };
    holder.db = { sql, pool };

    // 1. Production schema as it is today.
    for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith('.sql') && n < LEDGER).sort()) {
      await pool.query(readFileSync(join(migrationsDir, f), 'utf8'));
    }

    // 2. Production-like data, recorded before the ledger exists.
    await q(`INSERT INTO industries (slug, name, is_enabled) VALUES ('spray_foam_removal','Spray Foam Removal',true) ON CONFLICT (slug) DO NOTHING`);
    industryId = (await one(`SELECT id FROM industries WHERE slug = 'spray_foam_removal'`)).id;
    const buyer = async (name: string, email: string, ref: string) => (await one(`
      INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status,
        agreed_price_per_lead, exclusivity_arrangement, agreed_weekly_capacity, coverage_type,
        onboarding_call_completed_at, onboarding_call_conducted_by, application_reference)
      VALUES ($1, $1, $2, '07700900000', $3, 'ACTIVE', 85, 'shared', 40, 'national', now(), $4, $5)
      RETURNING id`, [name, email, industryId, ADMIN, ref])).id as number;
    buyerId = await buyer('Test Buyer Ltd', 'buyer@example.test', 'HLX-BYR-TEST-LEDGER-1');
    otherBuyerId = await buyer('Other Buyer Ltd', 'other@example.test', 'HLX-BYR-TEST-LEDGER-2');

    legacyPackageId = await newPackage({ paid: 200, leads: 5 });            // the "£200 trial" shape
    const legacyAlloc1 = await packageAllocation(legacyPackageId);
    const legacyDelivery = await deliver(legacyAlloc1);
    await packageAllocation(legacyPackageId);                               // 2 of 5 used
    await deliveredPaidLead(80);                                            // a paid, delivered pay-per-lead sale
    await q(`INSERT INTO replacement_requests (delivery_id, requested_by_buyer_id, reason, status, decided_by, decided_at)
             VALUES ($1, $2, 'Legacy claim', 'DENIED', $3, now())`, [legacyDelivery, buyerId, ADMIN]);

    snapshot = {};
    for (const t of ['buyer_packages', 'lead_allocations', 'payments', 'deliveries', 'replacement_requests', 'leads', 'buyers']) {
      snapshot[t] = await q(`SELECT * FROM ${t} ORDER BY id`);
    }

    // 3. The migration under test.
    await pool.query(readFileSync(join(migrationsDir, LEDGER), 'utf8'));
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

  describe('existing data is preserved', () => {
    it('leaves every pre-existing row unchanged (new columns aside)', async () => {
      for (const [table, before] of Object.entries(snapshot)) {
        const after = await q(`SELECT * FROM ${table} WHERE id <= $1 ORDER BY id`, [before[before.length - 1]?.id ?? 0]);
        expect(after.length, table).toBe(before.length);
        before.forEach((row, i) => {
          for (const key of Object.keys(row)) expect(after[i][key], `${table}.${key} (id ${row.id})`).toEqual(row[key]);
        });
      }
    });

    it('gives existing packages no expiry and zero restored/refunded credits', async () => {
      const p = await pkgRow(legacyPackageId);
      expect(p.expires_at).toBeNull();
      expect(p.credits_restored).toBe(0);
      expect(p.credits_refunded).toBe(0);
      expect(p.leads_used).toBe(2);
      expect((await balance(legacyPackageId)).credits_remaining).toBe(3);
    });

    it('still lets an existing package be used, however old', async () => {
      await packageAllocation(legacyPackageId);
      expect((await pkgRow(legacyPackageId)).leads_used).toBe(3);
    });
  });

  describe('expiry', () => {
    it('sets expiry six months after verification for a new ad hoc package', async () => {
      const id = await newPackage();
      const r = await one(`SELECT expires_at = verified_at + interval '6 months' AS ok FROM buyer_packages WHERE id = $1`, [id]);
      expect(r.ok).toBe(true);
    });

    it("uses the package definition's validity when there is one", async () => {
      const def = (await one(`INSERT INTO package_definitions (industry_id, name, price, leads_included, validity_months)
                               VALUES ($1, 'Starter (test)', 425, 5, 3) RETURNING id`, [industryId])).id;
      const id = await newPackage({ definitionId: def });
      const r = await one(`SELECT expires_at = verified_at + interval '3 months' AS ok FROM buyer_packages WHERE id = $1`, [id]);
      expect(r.ok).toBe(true);
    });

    it('ignores any expiry the caller tries to set', async () => {
      const r = await one(`INSERT INTO buyer_packages (buyer_id, amount_paid, leads_included, transaction_reference, paid_at, verified_by, expires_at)
                           VALUES ($1, 425, 5, $2, now(), $3, now() + interval '10 years') RETURNING expires_at > now() + interval '7 months' AS long`, [buyerId, uniq('T'), ADMIN]);
      expect(r.long).toBe(false);
    });

    it('refuses to use an expired package and shows it as Refund Due', async () => {
      const id = await newPackage({ paid: 625, verifiedAgo: '7 months' });
      await expect(packageAllocation(id)).rejects.toThrow(/expired/);
      const b = await balance(id);
      expect(b.balance_status).toBe('REFUND_DUE');
      expect(Number(b.refund_due_amount)).toBe(625);
    });

    it('refuses to change the expiry afterwards', async () => {
      const id = await newPackage();
      await expect(q(`UPDATE buyer_packages SET expires_at = now() + interval '5 years' WHERE id = $1`, [id])).rejects.toThrow(/expiry is fixed/);
    });
  });

  describe('balance can never be overspent or edited by hand', () => {
    it('refuses a sixth lead on a five-credit package', async () => {
      const id = await newPackage();
      for (let i = 0; i < 5; i++) await packageAllocation(id);
      await expect(packageAllocation(id)).rejects.toThrow();
      expect((await balance(id)).balance_status).toBe('USED_UP');
    });

    it('refuses direct edits to the counters and financial fields', async () => {
      const id = await newPackage();
      await expect(q(`UPDATE buyer_packages SET leads_used = 0 WHERE id = $1`, [id])).resolves.toBeDefined(); // no-op: already 0
      await packageAllocation(id);
      await expect(q(`UPDATE buyer_packages SET leads_used = 0 WHERE id = $1`, [id])).rejects.toThrow(/maintained automatically/);
      await expect(q(`UPDATE buyer_packages SET credits_restored = 1 WHERE id = $1`, [id])).rejects.toThrow(/maintained automatically/);
      await expect(q(`UPDATE buyer_packages SET credits_refunded = 1 WHERE id = $1`, [id])).rejects.toThrow(/maintained automatically/);
      await expect(q(`UPDATE buyer_packages SET amount_paid = 1 WHERE id = $1`, [id])).rejects.toThrow(/cannot be changed/);
      await expect(q(`UPDATE buyer_packages SET leads_included = 50 WHERE id = $1`, [id])).rejects.toThrow(/cannot be changed/);
    });
  });

  describe('replacement credit restoration', () => {
    it('restores the credit for an approved package-lead claim, once', async () => {
      const id = await newPackage();
      const allocationId = await deliveredPackageLead(id);
      expect((await balance(id)).credits_remaining).toBe(4);
      const reqId = await approvedRequest(allocationId);
      await resolveReplacementRequest(pool, ADMIN, reqId, { resolution: 'CREDIT_RESTORED' });
      const b = await balance(id);
      expect(b.credits_remaining).toBe(5);
      expect(b.credits_restored).toBe(1);
      await expect(resolveReplacementRequest(pool, ADMIN, reqId, { resolution: 'CREDIT_RESTORED' })).rejects.toThrow(/already resolved/);
      await expect(q(`UPDATE replacement_requests SET resolution = NULL, resolved_by = NULL, resolved_at = NULL WHERE id = $1`, [reqId])).rejects.toThrow(/already resolved/);
      expect((await balance(id)).credits_remaining).toBe(5);
      const audit = await one(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'PACKAGE_CREDIT_RESTORED' AND entity_id = $1`, [reqId]);
      expect(audit.n).toBe(1);
    });

    it('lets a full package be used again after a restore', async () => {
      const id = await newPackage();
      const first = await deliveredPackageLead(id);
      for (let i = 0; i < 4; i++) await packageAllocation(id);
      await expect(packageAllocation(id)).rejects.toThrow();
      await resolveReplacementRequest(pool, ADMIN, await approvedRequest(first), { resolution: 'CREDIT_RESTORED' });
      await expect(packageAllocation(id)).resolves.toBeGreaterThan(0);
    });

    it('allows only one open claim per delivered lead, and a new one after a denial', async () => {
      const id = await newPackage();
      const allocationId = await deliveredPackageLead(id);
      const input = { leadAllocationId: allocationId, reasonCode: 'DUPLICATE' as const, reason: 'Already supplied', reportedAt: new Date().toISOString() };
      const { id: first } = await recordReplacementRequest(pool, ADMIN, input);
      await expect(recordReplacementRequest(pool, ADMIN, input)).rejects.toThrow(/conflicts/);
      await decideReplacementRequest(pool, ADMIN, first, 'DENIED', 'Not a duplicate');
      await expect(decideReplacementRequest(pool, ADMIN, first, 'APPROVED')).rejects.toThrow(/already been decided/);
      await expect(recordReplacementRequest(pool, ADMIN, input)).resolves.toHaveProperty('id');
    });

    it('refuses a claim on a lead that was never delivered, or by the wrong buyer', async () => {
      const id = await newPackage();
      const allocationId = await packageAllocation(id);
      await expect(recordReplacementRequest(pool, ADMIN, { leadAllocationId: allocationId, reasonCode: 'OTHER', reason: 'x', reportedAt: new Date().toISOString() }))
        .rejects.toThrow(/not been delivered/);
      const deliveryId = await deliver(allocationId);
      await expect(q(`INSERT INTO replacement_requests (delivery_id, requested_by_buyer_id, reason, reason_code, reported_at, recorded_by)
                      VALUES ($1, $2, 'x', 'OTHER', now(), $3)`, [deliveryId, otherBuyerId, ADMIN])).rejects.toThrow(/different buyer/);
    });

    it('refuses to resolve before approval, and refuses deletion', async () => {
      const id = await newPackage();
      const allocationId = await deliveredPackageLead(id);
      const { id: reqId } = await recordReplacementRequest(pool, ADMIN, { leadAllocationId: allocationId, reasonCode: 'OTHER', reason: 'x', reportedAt: new Date().toISOString() });
      await expect(resolveReplacementRequest(pool, ADMIN, reqId, { resolution: 'CREDIT_RESTORED' })).rejects.toThrow(/approved/);
      await expect(q(`DELETE FROM replacement_requests WHERE id = $1`, [reqId])).rejects.toThrow(/cannot be deleted/);
    });

    it('refuses to restore a credit for a pay-per-lead lead', async () => {
      const { allocationId } = await deliveredPaidLead();
      const reqId = await approvedRequest(allocationId);
      await expect(resolveReplacementRequest(pool, ADMIN, reqId, { resolution: 'CREDIT_RESTORED' })).rejects.toThrow(/paid per lead/);
    });
  });

  describe('free replacement for a pay-per-lead lead (allocate route)', () => {
    async function allocate(body: Record<string, unknown>, leadId: number) {
      const { POST } = await import('../app/api/admin/leads/[id]/allocate/route');
      const res = await POST(new NextRequest(`http://localhost/api/admin/leads/${leadId}/allocate`, { method: 'POST', body: JSON.stringify(body) }), { params: { id: String(leadId) } });
      return { status: res.status, body: await res.json() };
    }

    it('supplies a free lead: no payment, released, request resolved, never twice', async () => {
      const { allocationId: original } = await deliveredPaidLead();
      const reqId = await approvedRequest(original);
      const newLeadId = await newLead();
      const conf = await confirm(newLeadId);
      const res = await allocate({ buyer_id: buyerId, homeowner_confirmation_id: conf, replacement_request_id: reqId }, newLeadId);
      expect(res.status).toBe(200);
      expect(res.body.released).toBe(true);
      expect(res.body.payment_reference).toBeNull();
      const alloc = await one(`SELECT * FROM lead_allocations WHERE id = $1`, [res.body.allocation_id]);
      expect(Number(alloc.agreed_price)).toBe(0);
      expect((await q(`SELECT 1 FROM payments WHERE lead_allocation_id = $1`, [alloc.id])).length).toBe(0);
      expect((await q(`SELECT 1 FROM deliveries WHERE lead_allocation_id = $1`, [alloc.id])).length).toBe(1);
      const rr = await one(`SELECT * FROM replacement_requests WHERE id = $1`, [reqId]);
      expect(rr.resolution).toBe('REPLACEMENT_SUPPLIED');
      expect(rr.replacement_allocation_id).toBe(alloc.id);
      const offer = sendLeadDeliveryEmailMock.mock.calls.find((c) => c[1].emailType === 'LEAD_OFFER')?.[1];
      expect(offer.text).toContain('free replacement for');

      // Never charged: a payment can't be marked paid on it.
      await expect(q(`INSERT INTO payments (lead_allocation_id, expected_amount, status, verified_by, verified_at, transaction_reference, amount_received)
                      VALUES ($1, 0, 'PAID', $2, now(), $3, 0)`, [alloc.id, ADMIN, uniq('T')])).rejects.toThrow(/free replacement/);
      // Never twice: the same request can't fund a second free lead.
      const another = await newLead();
      const res2 = await allocate({ buyer_id: buyerId, homeowner_confirmation_id: await confirm(another), replacement_request_id: reqId }, another);
      expect(res2.status).toBe(409);
    });

    it('refuses a free lead for an unapproved request, a package lead, another buyer, or the same lead', async () => {
      const { allocationId, leadId } = await deliveredPaidLead();
      const { id: pending } = await recordReplacementRequest(pool, ADMIN, { leadAllocationId: allocationId, reasonCode: 'OTHER', reason: 'x', reportedAt: new Date().toISOString() });
      const l1 = await newLead();
      expect((await allocate({ buyer_id: buyerId, homeowner_confirmation_id: await confirm(l1), replacement_request_id: pending }, l1)).status).toBe(409);
      await decideReplacementRequest(pool, ADMIN, pending, 'APPROVED');
      const l2 = await newLead();
      expect((await allocate({ buyer_id: otherBuyerId, homeowner_confirmation_id: await confirm(l2, otherBuyerId), replacement_request_id: pending }, l2)).status).toBe(400);
      const existingConf = (await one(`SELECT id FROM homeowner_confirmations WHERE lead_id = $1 AND buyer_id = $2`, [leadId, buyerId])).id;
      expect((await allocate({ buyer_id: buyerId, homeowner_confirmation_id: existingConf, replacement_request_id: pending }, leadId)).status).toBeGreaterThanOrEqual(400);
      const pkg = await newPackage();
      const pkgReq = await approvedRequest(await deliveredPackageLead(pkg));
      const l3 = await newLead();
      expect((await allocate({ buyer_id: buyerId, homeowner_confirmation_id: await confirm(l3), replacement_request_id: pkgReq }, l3)).status).toBe(409);
      // And the database refuses the same things directly.
      const l4 = await newLead();
      const c4 = await confirm(l4);
      await expect(q(`INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, status, agreed_price, homeowner_confirmation_id, replacement_request_id)
                      VALUES ($1, $2, 'SHARED', 'PURCHASED', 0, $3, $4)`, [l4, buyerId, c4, pkgReq])).rejects.toThrow(/package lead/);
      await expect(q(`INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, status, agreed_price, homeowner_confirmation_id, replacement_request_id)
                      VALUES ($1, $2, 'SHARED', 'PURCHASED', 85, $3, $4)`, [l4, buyerId, c4, pending])).rejects.toThrow(/price of 0/);
    });

    it('refuses the allocate route for an expired package', async () => {
      const pkg = await newPackage({ verifiedAgo: '7 months' });
      const l = await newLead();
      const res = await allocate({ buyer_id: buyerId, homeowner_confirmation_id: await confirm(l), package_id: pkg }, l);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/expired/);
    });
  });

  describe('refunds', () => {
    it('records an unused-credit refund at the package price per credit and reduces the balance', async () => {
      const id = await newPackage({ paid: 625 });
      await packageAllocation(id);
      const r = await recordPackageRefund(pool, ADMIN, { buyerPackageId: id, credits: 4, reason: 'BUYER_STOPPED', transactionReference: uniq('TIDE-RF'), refundedAt: new Date().toISOString() });
      expect(r.amount).toBe(500);
      const b = await balance(id);
      expect(b.credits_remaining).toBe(0);
      expect(b.credits_refunded).toBe(4);
      await expect(packageAllocation(id)).rejects.toThrow();
    });

    it('refuses refunding more credits than remain, a wrong amount, or a reused Tide reference', async () => {
      const id = await newPackage({ paid: 425 });
      await packageAllocation(id);
      await expect(recordPackageRefund(pool, ADMIN, { buyerPackageId: id, credits: 5, reason: 'BUYER_STOPPED', transactionReference: uniq('R'), refundedAt: new Date().toISOString() }))
        .rejects.toThrow(/unused credit/);
      await expect(q(`INSERT INTO package_refunds (buyer_package_id, credits_refunded, amount, reason, transaction_reference, refunded_at, recorded_by)
                      VALUES ($1, 1, 100, 'BUYER_STOPPED', $2, now(), $3)`, [id, uniq('R'), ADMIN])).rejects.toThrow(/does not equal/);
      const ref = uniq('R');
      await recordPackageRefund(pool, ADMIN, { buyerPackageId: id, credits: 1, reason: 'BUYER_STOPPED', transactionReference: ref, refundedAt: new Date().toISOString() });
      await expect(recordPackageRefund(pool, ADMIN, { buyerPackageId: id, credits: 1, reason: 'BUYER_STOPPED', transactionReference: ref, refundedAt: new Date().toISOString() }))
        .rejects.toThrow(/conflicts/);
      expect((await balance(id)).credits_remaining).toBe(3);
    });

    it('allows an expiry refund only once the package has expired, and clears Refund Due', async () => {
      const live = await newPackage();
      await expect(recordPackageRefund(pool, ADMIN, { buyerPackageId: live, credits: 1, reason: 'CREDITS_EXPIRED', transactionReference: uniq('R'), refundedAt: new Date().toISOString() }))
        .rejects.toThrow(/has not expired/);
      const expired = await newPackage({ paid: 625, verifiedAgo: '7 months' });
      await recordPackageRefund(pool, ADMIN, { buyerPackageId: expired, credits: 5, reason: 'CREDITS_EXPIRED', transactionReference: uniq('R'), refundedAt: new Date().toISOString() });
      expect((await balance(expired)).balance_status).toBe('USED_UP');
    });

    it('keeps refund records permanent', async () => {
      const id = await newPackage();
      const { id: refundId } = await recordPackageRefund(pool, ADMIN, { buyerPackageId: id, credits: 1, reason: 'BUYER_STOPPED', transactionReference: uniq('R'), refundedAt: new Date().toISOString() });
      await expect(q(`UPDATE package_refunds SET amount = 1 WHERE id = $1`, [refundId])).rejects.toThrow(/permanent record/);
      await expect(q(`DELETE FROM package_refunds WHERE id = $1`, [refundId])).rejects.toThrow(/permanent record/);
    });

    it('records a 9.4 refund at the price paid, for pay-per-lead and package leads', async () => {
      const { allocationId } = await deliveredPaidLead(85);
      const reqId = await approvedRequest(allocationId);
      const r = await resolveReplacementRequest(pool, ADMIN, reqId, { resolution: 'REFUNDED', refundTransactionReference: uniq('R94'), refundedAt: new Date().toISOString() });
      expect(r.amount).toBe(85);
      await expect(q(`UPDATE replacement_requests SET refund_amount = 1 WHERE id = $1`, [reqId])).rejects.toThrow(/already resolved/);

      const pkg = await newPackage({ paid: 625 });
      const pkgReq = await approvedRequest(await deliveredPackageLead(pkg));
      const r2 = await resolveReplacementRequest(pool, ADMIN, pkgReq, { resolution: 'REFUNDED', refundTransactionReference: uniq('R94'), refundedAt: new Date().toISOString() });
      expect(r2.amount).toBe(125);
      expect((await balance(pkg)).credits_restored).toBe(0); // refunded, not also restored

      const third = await approvedRequest((await deliveredPaidLead(85)).allocationId);
      await expect(q(`UPDATE replacement_requests SET resolution = 'REFUNDED', resolved_by = $2, resolved_at = now(),
                      refund_amount = 50, refund_transaction_reference = $3, refunded_at = now() WHERE id = $1`, [third, ADMIN, uniq('R')]))
        .rejects.toThrow(/does not equal the price paid/);
    });
  });

  describe('concurrency', () => {
    it('lets only as many simultaneous allocations through as there are credits', async () => {
      const id = await newPackage();
      for (let i = 0; i < 3; i++) await packageAllocation(id);           // 2 credits left
      const results = await Promise.allSettled(Array.from({ length: 10 }, () => packageAllocation(id)));
      expect(results.filter((r) => r.status === 'fulfilled').length).toBe(2);
      const p = await pkgRow(id);
      expect(p.leads_used).toBe(5);
      const count = await one(`SELECT count(*)::int AS n FROM lead_allocations WHERE package_id = $1`, [id]);
      expect(count.n).toBe(5);
    });

    it('restores a credit only once when the same claim is resolved simultaneously', async () => {
      const id = await newPackage();
      const reqId = await approvedRequest(await deliveredPackageLead(id));
      const results = await Promise.allSettled(Array.from({ length: 8 }, () => resolveReplacementRequest(pool, ADMIN, reqId, { resolution: 'CREDIT_RESTORED' })));
      expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
      const b = await balance(id);
      expect(b.credits_restored).toBe(1);
      expect(b.credits_remaining).toBe(5);
    });

    it('accepts only one of several simultaneous claims on the same delivered lead', async () => {
      const allocationId = await deliveredPackageLead(await newPackage());
      const results = await Promise.allSettled(Array.from({ length: 8 }, () => recordReplacementRequest(pool, ADMIN, {
        leadAllocationId: allocationId, reasonCode: 'OTHER', reason: 'race', reportedAt: new Date().toISOString(),
      })));
      expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    });

    it('never spends the last credit twice when a refund and allocations race for it', async () => {
      const id = await newPackage();
      for (let i = 0; i < 4; i++) await packageAllocation(id);           // 1 credit left
      const results = await Promise.allSettled([
        recordPackageRefund(pool, ADMIN, { buyerPackageId: id, credits: 1, reason: 'BUYER_STOPPED', transactionReference: uniq('R'), refundedAt: new Date().toISOString() }),
        ...Array.from({ length: 6 }, () => packageAllocation(id)),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
      const p = await pkgRow(id);
      expect(p.leads_used + p.credits_refunded).toBe(5);
    });

    it('records refunds of the same credits only once when submitted simultaneously', async () => {
      const id = await newPackage();
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => recordPackageRefund(pool, ADMIN, {
        buyerPackageId: id, credits: 5, reason: 'BUYER_STOPPED', transactionReference: uniq('R'), refundedAt: new Date().toISOString(),
      })));
      expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
      expect((await pkgRow(id)).credits_refunded).toBe(5);
    });
  });

  describe('rollback (docs/CREDITS_LEDGER_ROLLBACK.md)', () => {
    it('restores the previous schema and behaviour with existing data intact, then re-applies', async () => {
      // A database that has the ledger but no restorations, refunds or APPROVED requests -- the
      // state in which the document says rollback is safe.
      const rdb = `${dbName}_rb`;
      await admin.query(`CREATE DATABASE ${rdb}`);
      const url = new URL(adminUrl!);
      url.pathname = `/${rdb}`;
      const { Pool } = require('pg');
      const p2 = new Pool({ connectionString: url.toString(), max: 2 });
      try {
        for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith('.sql')).sort()) {
          await p2.query(readFileSync(join(migrationsDir, f), 'utf8'));
        }
        await p2.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('solar_battery','Solar',true) ON CONFLICT (slug) DO NOTHING`);
        const b = (await p2.query(`INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status, application_reference)
                                   SELECT 'RB', 'A', 'rb@example.test', '1', id, 'PENDING_REVIEW', 'RB-1' FROM industries LIMIT 1 RETURNING id`)).rows[0].id;
        await p2.query(`INSERT INTO buyer_packages (buyer_id, amount_paid, leads_included, transaction_reference, paid_at, verified_by)
                        VALUES ($1, 425, 5, 'RB-TIDE', now(), 'x')`, [b]);

        const doc = readFileSync(join(__dirname, '..', 'docs', 'CREDITS_LEDGER_ROLLBACK.md'), 'utf8');
        const sql = doc.split('<!-- rollback-sql:start -->')[1].split('<!-- rollback-sql:end -->')[0].replace(/```sql|```/g, '');
        await p2.query(sql);

        const cols = (await p2.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'buyer_packages'`)).rows.map((r: { column_name: string }) => r.column_name);
        expect(cols).not.toContain('expires_at');
        expect((await p2.query(`SELECT to_regclass('package_refunds') AS t`)).rows[0].t).toBeNull();
        const pkg = (await p2.query(`SELECT * FROM buyer_packages WHERE transaction_reference = 'RB-TIDE'`)).rows[0];
        expect(pkg.leads_used).toBe(0);
        await expect(p2.query(`UPDATE buyer_packages SET leads_used = 3 WHERE id = $1`, [pkg.id])).rejects.toThrow(/maintained automatically/);
        await expect(p2.query(`INSERT INTO replacement_requests (delivery_id, requested_by_buyer_id, reason, status) VALUES (1, 1, 'x', 'APPROVED')`))
          .rejects.toThrow(/status_check|violates/);

        await p2.query(readFileSync(join(migrationsDir, LEDGER), 'utf8'));
        const again = (await p2.query(`SELECT expires_at, credits_refunded FROM buyer_packages WHERE id = $1`, [pkg.id])).rows[0];
        expect(again.expires_at).toBeNull();
        expect(again.credits_refunded).toBe(0);
      } finally {
        await p2.end();
        await admin.query(`DROP DATABASE IF EXISTS ${rdb}`);
      }
    });
  });
});
