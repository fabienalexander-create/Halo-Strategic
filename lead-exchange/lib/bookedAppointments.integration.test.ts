import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { decideReplacementRequest, recordReplacementRequest, resolveReplacementRequest } from './creditsLedger';

// Technical PR B (booked appointments as a distinct lead type), approved by Fabien 2026-11-26.
// Runs against a real, local, throwaway Postgres (skipped unless TEST_PG_ADMIN_URL is set;
// refuses non-local hosts):
//   1. builds the schema exactly as production has it (every migration before this one),
//   2. seeds production-like data (leads, packages part-used, paid and package sales, replacement
//      requests), snapshots it,
//   3. applies 20261126150000_booked_appointments.sql and proves every existing row is unchanged,
//   4. proves each rule through the database and the admin routes,
//   5. races concurrent operations on the same appointment lead and appointment,
//   6. runs the rollback in docs/BOOKED_APPOINTMENTS_ROLLBACK.md before and after real use, then
//      re-applies the migration.
// Contact details are placeholders: the repo is public.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const migrationsDir = join(__dirname, '..', 'netlify', 'database', 'migrations');
const APPTS = '20261126150000_booked_appointments.sql';
const LEDGER = '20261126100000_credits_ledger.sql';
const ADMIN = 'admin@halostrategic.com';
const rollbackSql = (doc: string) =>
  readFileSync(join(__dirname, '..', 'docs', doc), 'utf8').split('<!-- rollback-sql:start -->')[1].split('<!-- rollback-sql:end -->')[0].replace(/```sql|```/g, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const holder = vi.hoisted(() => ({ db: null as unknown, role: 'owner' }));
vi.mock('@netlify/database', () => ({ getDatabase: () => holder.db }));
const sendLeadDeliveryEmailMock = vi.hoisted(() => vi.fn());
vi.mock('./leadDeliveryEmail', () => ({ sendLeadDeliveryEmail: sendLeadDeliveryEmailMock }));
vi.mock('./requireAdmin', () => {
  const session = () => ({ session: { adminId: 1, email: 'admin@halostrategic.com', role: holder.role } });
  return {
    requireAdmin: vi.fn(async () => session()),
    requireOwner: vi.fn(async () => {
      if (holder.role !== 'owner') {
        const { NextResponse } = await import('next/server');
        return { response: NextResponse.json({ error: 'Owner role required.' }, { status: 403 }) };
      }
      return session();
    }),
  };
});

describe.skipIf(!adminUrl)('booked appointments (real Postgres)', () => {
  const dbName = `lx_test_${Date.now()}_appts`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, pool: any;
  let industryId: number, sharedBuyer: number, exclusiveBuyer: number, noApptPriceBuyer: number;
  let legacyPackageId: number, legacyLeadId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let snapshot: Record<string, any[]>;
  let seq = 0;
  const q = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
  const one = async (text: string, values: unknown[] = []) => (await q(text, values))[0];
  const uniq = (p: string) => `${p}-${Date.now()}-${++seq}`;
  const future = (mins = 60 * 24) => new Date(Date.now() + mins * 60_000).toISOString();

  async function newLead(type: 'VERIFIED_ENQUIRY' | 'BOOKED_APPOINTMENT' | null = 'BOOKED_APPOINTMENT') {
    const typeCol = type ? ', lead_type' : '';
    const typeVal = type ? `, '${type}'` : '';
    return (await one(
      `INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, property_type, service_requirement, status${typeCol})
       VALUES ($1, 'Test Homeowner', '{"mobile":"+447700900123","email":"homeowner@example.test"}'::jsonb, 'MK15 9AA', 'House', 'Removal', 'NEW'${typeVal})
       RETURNING id`, [industryId])).id as number;
  }
  async function confirm(leadId: number, buyer = sharedBuyer) {
    return (await one(
      `INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
       VALUES ($1, $2, 'Test Buyer Ltd', 'to contact you about your enquiry', 'Happy to be introduced?', 'Yes', 'ADMIN_AFTER_CALL', now(), $3, 'Called homeowner')
       RETURNING id`, [leadId, buyer, ADMIN])).id as number;
  }
  async function newPackage(opts: { leadType?: string; buyer?: number; paid?: number; leads?: number } = {}) {
    return (await one(
      `INSERT INTO buyer_packages (buyer_id, amount_paid, leads_included, transaction_reference, paid_at, verified_by${opts.leadType ? ', lead_type' : ''})
       VALUES ($1, $2, $3, $4, now(), $5${opts.leadType ? `, '${opts.leadType}'` : ''}) RETURNING id`,
      [opts.buyer ?? sharedBuyer, opts.paid ?? 625, opts.leads ?? 5, uniq('TIDE-PKG'), ADMIN])).id as number;
  }
  // An appointment allocation written directly, with its appointment, in one transaction.
  async function directAppointmentAllocation(opts: { leadId?: number; buyer?: number; packageId?: number | null; price?: number | null; at?: string } = {}) {
    const leadId = opts.leadId ?? await newLead();
    const buyer = opts.buyer ?? sharedBuyer;
    const conf = await confirm(leadId, buyer);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const a = (await c.query(
        `INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, package_id, homeowner_confirmation_id)
         VALUES ($1, $2, 'EXCLUSIVE_WINDOW', 1, 'PURCHASED', $3, $4, $5) RETURNING id`,
        [leadId, buyer, opts.packageId ? null : (opts.price ?? 125), opts.packageId ?? null, conf])).rows[0].id as number;
      const ap = (await c.query(
        `INSERT INTO lead_appointments (lead_allocation_id, scheduled_at, appointment_kind, homeowner_confirmed_at, arranged_by, updated_by)
         VALUES ($1, $2, 'IN_PERSON', now(), $3, $3) RETURNING id`, [a, opts.at ?? future(), ADMIN])).rows[0].id as number;
      await c.query('COMMIT');
      return { allocationId: a, appointmentId: ap, leadId };
    } catch (err) {
      await c.query('ROLLBACK');
      throw err;
    } finally {
      c.release();
    }
  }
  async function payAndDeliver(allocationId: number, price = 125) {
    await q(`INSERT INTO payments (lead_allocation_id, expected_amount, status, verified_by, verified_at, transaction_reference, amount_received)
             VALUES ($1, $2, 'PAID', $3, now(), $4, $2)`, [allocationId, price, ADMIN, uniq('TIDE-PAY')]);
    return (await one(`INSERT INTO deliveries (lead_allocation_id, delivered_at, status) VALUES ($1, now(), 'SENT') RETURNING id`, [allocationId])).id as number;
  }
  async function route(modulePath: string, url: string, params: Record<string, string>, body?: unknown, method = 'POST') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(modulePath);
    const req = new NextRequest(`http://localhost${url}`, body === undefined ? { method } : { method, body: JSON.stringify(body) });
    const res = await mod[method](req, { params });
    return { status: res.status as number, body: await res.json() };
  }
  const allocate = (leadId: number, body: Record<string, unknown>) =>
    route('../app/api/admin/leads/[id]/allocate/route', `/api/admin/leads/${leadId}/allocate`, { id: String(leadId) }, body);
  const setStatus = (id: number, body: Record<string, unknown>) =>
    route('../app/api/admin/appointments/[id]/status/route', `/api/admin/appointments/${id}/status`, { id: String(id) }, body);
  const appt = (id: number) => one(`SELECT * FROM lead_appointments WHERE id = $1`, [id]);
  const apptBody = (over: Record<string, unknown> = {}) => ({
    scheduled_at: future(), kind: 'IN_PERSON', location_notes: 'At the property', homeowner_confirmed_at: new Date(Date.now() - 60_000).toISOString(), ...over,
  });

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

    // 1. Production schema as it is today (credits ledger included).
    for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith('.sql') && n < APPTS).sort()) {
      await pool.query(readFileSync(join(migrationsDir, f), 'utf8'));
    }

    // 2. Production-like data recorded before appointments exist.
    await q(`INSERT INTO industries (slug, name, is_enabled) VALUES ('spray_foam_removal','Spray Foam Removal',true) ON CONFLICT (slug) DO NOTHING`);
    industryId = (await one(`SELECT id FROM industries WHERE slug = 'spray_foam_removal'`)).id;
    const buyer = async (name: string, ref: string, arrangement: string) => (await one(`
      INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status,
        agreed_price_per_lead, exclusivity_arrangement, agreed_weekly_capacity, coverage_type,
        onboarding_call_completed_at, onboarding_call_conducted_by, application_reference)
      VALUES ($1, $1, $2, '07700900000', $3, 'ACTIVE', 85, $4, 40, 'national', now(), $5, $6)
      RETURNING id`, [name, `${ref.toLowerCase()}@example.test`, industryId, arrangement, ADMIN, ref])).id as number;
    sharedBuyer = await buyer('Shared Buyer Ltd', 'HLX-BYR-TEST-APPT-1', 'shared');
    exclusiveBuyer = await buyer('Exclusive Buyer Ltd', 'HLX-BYR-TEST-APPT-2', 'exclusive');
    noApptPriceBuyer = await buyer('Enquiries Only Ltd', 'HLX-BYR-TEST-APPT-3', 'shared');

    await q(`INSERT INTO package_definitions (name, industry_id, leads_included, price, currency, active) VALUES ('Starter pack', $1, 5, 425, 'GBP', true)`, [industryId]);
    legacyPackageId = await newPackage({ paid: 425 });
    legacyLeadId = await newLead(null);
    const legacyConf = await confirm(legacyLeadId);
    const legacyAlloc = (await one(`INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, status, package_id, homeowner_confirmation_id)
                                    VALUES ($1, $2, 'SHARED', 'PURCHASED', $3, $4) RETURNING id`, [legacyLeadId, sharedBuyer, legacyPackageId, legacyConf])).id;
    const legacyDelivery = (await one(`INSERT INTO deliveries (lead_allocation_id, delivered_at, status) VALUES ($1, now(), 'SENT') RETURNING id`, [legacyAlloc])).id;
    const paidLead = await newLead(null);
    const paidAlloc = (await one(`INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, status, agreed_price, homeowner_confirmation_id)
                                  VALUES ($1, $2, 'SHARED', 'PURCHASED', 85, $3) RETURNING id`, [paidLead, sharedBuyer, await confirm(paidLead)])).id;
    await q(`INSERT INTO payments (lead_allocation_id, expected_amount, status, verified_by, verified_at, transaction_reference, amount_received)
             VALUES ($1, 85, 'PAID', $2, now(), 'TIDE-LEGACY-PAY', 85)`, [paidAlloc, ADMIN]);
    await recordReplacementRequest(pool, ADMIN, { leadAllocationId: legacyAlloc, reasonCode: 'INVALID_CONTACT', reason: 'Wrong number', reportedAt: new Date().toISOString() });
    void legacyDelivery;
    await newLead(null); // an unallocated lead

    snapshot = {};
    for (const t of ['leads', 'buyers', 'buyer_packages', 'package_definitions', 'lead_allocations', 'payments', 'deliveries', 'replacement_requests', 'homeowner_confirmations']) {
      snapshot[t] = await q(`SELECT * FROM ${t} ORDER BY id`);
    }

    // 3. The migration under test.
    await pool.query(readFileSync(join(migrationsDir, APPTS), 'utf8'));
    await q(`UPDATE buyers SET agreed_price_per_appointment = 125 WHERE id IN ($1, $2)`, [sharedBuyer, exclusiveBuyer]);
    await q(`INSERT INTO admin_users (email, password_hash, role) VALUES ($1, 'not-a-real-hash', 'owner') ON CONFLICT (email) DO NOTHING`, [ADMIN]);
  });

  afterAll(async () => {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  beforeEach(() => {
    holder.role = 'owner';
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

    it('makes every existing lead, package and definition a verified enquiry, with no appointment price', async () => {
      expect((await q(`SELECT DISTINCT lead_type FROM leads WHERE id <= $1`, [snapshot.leads.at(-1).id])).map((r: { lead_type: string }) => r.lead_type)).toEqual(['VERIFIED_ENQUIRY']);
      expect((await q(`SELECT DISTINCT lead_type FROM buyer_packages`)).map((r: { lead_type: string }) => r.lead_type)).toEqual(['VERIFIED_ENQUIRY']);
      expect((await one(`SELECT count(*)::int AS n FROM buyers WHERE agreed_price_per_appointment IS NOT NULL AND id = $1`, [noApptPriceBuyer])).n).toBe(0);
      expect((await one(`SELECT lead_type FROM package_balances WHERE buyer_package_id = $1`, [legacyPackageId])).lead_type).toBe('VERIFIED_ENQUIRY');
    });

    it('keeps the existing package usable for enquiries exactly as before', async () => {
      const lead = await newLead('VERIFIED_ENQUIRY');
      const res = await allocate(lead, { buyer_id: sharedBuyer, homeowner_confirmation_id: await confirm(lead), package_id: legacyPackageId });
      expect(res.status).toBe(200);
      expect(res.body.released).toBe(true);
      const alloc = await one(`SELECT allocation_type FROM lead_allocations WHERE id = $1`, [res.body.allocation_id]);
      expect(alloc.allocation_type).toBe('SHARED');
    });
  });

  describe('allocating a booked appointment (allocate route)', () => {
    it('needs a future time, the kind and the homeowner confirmation time', async () => {
      const lead = await newLead();
      const conf = await confirm(lead);
      expect((await allocate(lead, { buyer_id: sharedBuyer, homeowner_confirmation_id: conf })).status).toBe(400);
      expect((await allocate(lead, { buyer_id: sharedBuyer, homeowner_confirmation_id: conf, appointment: apptBody({ scheduled_at: new Date(Date.now() - 60_000).toISOString() }) })).status).toBe(400);
      expect((await allocate(lead, { buyer_id: sharedBuyer, homeowner_confirmation_id: conf, appointment: apptBody({ kind: 'CARRIER_PIGEON' }) })).status).toBe(400);
      expect((await allocate(lead, { buyer_id: sharedBuyer, homeowner_confirmation_id: conf, appointment: apptBody({ homeowner_confirmed_at: future() }) })).status).toBe(400);
      expect((await q(`SELECT 1 FROM lead_allocations WHERE lead_id = $1`, [lead])).length).toBe(0);
    });

    it('refuses appointment details on a verified enquiry, and SHARED on an appointment', async () => {
      const enquiry = await newLead('VERIFIED_ENQUIRY');
      expect((await allocate(enquiry, { buyer_id: sharedBuyer, homeowner_confirmation_id: await confirm(enquiry), appointment: apptBody() })).status).toBe(400);
      const lead = await newLead();
      expect((await allocate(lead, { buyer_id: sharedBuyer, homeowner_confirmation_id: await confirm(lead), allocation_type: 'SHARED', appointment: apptBody() })).status).toBe(409);
    });

    it('sells to one buyer at the appointment price, records the appointment and shows it in the offer', async () => {
      const lead = await newLead();
      const res = await allocate(lead, { buyer_id: sharedBuyer, homeowner_confirmation_id: await confirm(lead), appointment: apptBody() });
      expect(res.status).toBe(200);
      expect(res.body.lead_type).toBe('BOOKED_APPOINTMENT');
      const alloc = await one(`SELECT * FROM lead_allocations WHERE id = $1`, [res.body.allocation_id]);
      expect(alloc.allocation_type).toBe('EXCLUSIVE_WINDOW');   // a "shared" buyer still gets it exclusively
      expect(Number(alloc.agreed_price)).toBe(125);
      expect(Number((await one(`SELECT expected_amount FROM payments WHERE lead_allocation_id = $1`, [alloc.id])).expected_amount)).toBe(125);
      const a = await one(`SELECT * FROM lead_appointments WHERE lead_allocation_id = $1`, [alloc.id]);
      expect(a.status).toBe('BOOKED');
      expect(a.arranged_by).toBe(ADMIN);
      expect((await q(`SELECT event FROM lead_appointment_events WHERE lead_appointment_id = $1`, [a.id])).map((r: { event: string }) => r.event)).toEqual(['BOOKED']);
      const offer = sendLeadDeliveryEmailMock.mock.calls.find((c) => c[1].emailType === 'LEAD_OFFER')?.[1];
      expect(offer.subject).toContain('booked appointment');
      expect(offer.text).toMatch(/Appointment: \w+day, \d+ \w+ \d{4}, \d{2}:\d{2} \(in person\)/);
      expect(offer.text).not.toContain('homeowner@example.test');

      // One buyer only: a second buyer is refused, even with their own confirmation.
      const second = await allocate(lead, { buyer_id: exclusiveBuyer, homeowner_confirmation_id: await confirm(lead, exclusiveBuyer), appointment: apptBody() });
      expect(second.status).toBe(409);
    });

    it('refuses a buyer with no appointment price unless a package covers it', async () => {
      const lead = await newLead();
      const res = await allocate(lead, { buyer_id: noApptPriceBuyer, homeowner_confirmation_id: await confirm(lead, noApptPriceBuyer), appointment: apptBody() });
      expect(res.status).toBe(422);
    });

    it('spends an appointment credit, releases at once and puts the appointment in the unlock email', async () => {
      const pkg = await newPackage({ leadType: 'BOOKED_APPOINTMENT' });
      const lead = await newLead();
      const res = await allocate(lead, { buyer_id: sharedBuyer, homeowner_confirmation_id: await confirm(lead), package_id: pkg, appointment: apptBody() });
      expect(res.status).toBe(200);
      expect(res.body.released).toBe(true);
      expect((await one(`SELECT leads_used FROM buyer_packages WHERE id = $1`, [pkg])).leads_used).toBe(1);
      const unlocked = sendLeadDeliveryEmailMock.mock.calls.find((c) => c[1].emailType === 'LEAD_UNLOCKED')?.[1];
      expect(unlocked.text).toContain('Appointment:');
      expect(unlocked.text).toContain('At the property');
      expect(unlocked.text).toContain('within 48 hours');
      const internal = sendLeadDeliveryEmailMock.mock.calls.find((c) => c[1].emailType === 'INTERNAL_RELEASE_COPY')?.[1];
      expect(internal.text).toContain('Appointment:');
    });

    it('keeps package credits to their own lead type, in the route and the database', async () => {
      const enquiryPkg = await newPackage();
      const apptPkg = await newPackage({ leadType: 'BOOKED_APPOINTMENT' });
      const lead = await newLead();
      expect((await allocate(lead, { buyer_id: sharedBuyer, homeowner_confirmation_id: await confirm(lead), package_id: enquiryPkg, appointment: apptBody() })).status).toBe(409);
      const enquiry = await newLead('VERIFIED_ENQUIRY');
      expect((await allocate(enquiry, { buyer_id: sharedBuyer, homeowner_confirmation_id: await confirm(enquiry), package_id: apptPkg })).status).toBe(409);
      await expect(directAppointmentAllocation({ packageId: enquiryPkg })).rejects.toThrow(/is for VERIFIED_ENQUIRY leads/);
      expect((await one(`SELECT leads_used FROM buyer_packages WHERE id = $1`, [enquiryPkg])).leads_used).toBe(0);
    });
  });

  describe('database rules', () => {
    it('refuses an appointment allocation without a future booked appointment at commit', async () => {
      const lead = await newLead();
      await expect(q(`INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, agreed_price, homeowner_confirmation_id)
                      VALUES ($1, $2, 'EXCLUSIVE_WINDOW', 1, 'PURCHASED', 125, $3)`, [lead, sharedBuyer, await confirm(lead)]))
        .rejects.toThrow(/no future appointment recorded/);
      expect((await q(`SELECT 1 FROM lead_allocations WHERE lead_id = $1`, [lead])).length).toBe(0);
    });

    it('refuses a SHARED appointment allocation, and an appointment on a verified enquiry', async () => {
      const lead = await newLead();
      await expect(q(`INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, status, agreed_price, homeowner_confirmation_id)
                      VALUES ($1, $2, 'SHARED', 'PURCHASED', 125, $3)`, [lead, sharedBuyer, await confirm(lead)])).rejects.toThrow(/one buyer/);
      const enquiry = await newLead('VERIFIED_ENQUIRY');
      const a = (await one(`INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, status, agreed_price, homeowner_confirmation_id)
                            VALUES ($1, $2, 'SHARED', 'PURCHASED', 85, $3) RETURNING id`, [enquiry, sharedBuyer, await confirm(enquiry)])).id;
      await expect(q(`INSERT INTO lead_appointments (lead_allocation_id, scheduled_at, appointment_kind, homeowner_confirmed_at, arranged_by, updated_by)
                      VALUES ($1, $2, 'PHONE', now(), $3, $3)`, [a, future(), ADMIN])).rejects.toThrow(/not for a booked-appointment lead/);
    });

    it('refuses an appointment in the past and a second appointment for the same allocation', async () => {
      await expect(directAppointmentAllocation({ at: new Date(Date.now() - 60_000).toISOString() })).rejects.toThrow(/must be in the future/);
      const { allocationId } = await directAppointmentAllocation();
      await expect(q(`INSERT INTO lead_appointments (lead_allocation_id, scheduled_at, appointment_kind, homeowner_confirmed_at, arranged_by, updated_by)
                      VALUES ($1, $2, 'PHONE', now(), $3, $3)`, [allocationId, future(), ADMIN])).rejects.toThrow(/duplicate key|unique/);
    });

    it("fixes a lead's type once allocated, through the route and the database", async () => {
      const lead = await newLead('VERIFIED_ENQUIRY');
      const change = (id: number, lead_type: string) => route('../app/api/admin/leads/[id]/lead-type/route', `/api/admin/leads/${id}/lead-type`, { id: String(id) }, { lead_type });
      const first = await change(lead, 'BOOKED_APPOINTMENT');
      expect(first.status).toBe(200);
      expect(first.body.changed).toBe(true);
      expect((await one(`SELECT action FROM audit_log WHERE entity_type = 'lead' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [lead])).action).toBe('LEAD_TYPE_CHANGED');
      await directAppointmentAllocation({ leadId: lead });
      expect((await change(lead, 'VERIFIED_ENQUIRY')).status).toBe(409);
      await expect(q(`UPDATE leads SET lead_type = 'VERIFIED_ENQUIRY' WHERE id = $1`, [lead])).rejects.toThrow(/type cannot be changed/);
    });

    it("fixes a package's type, and requires it to match its definition", async () => {
      const pkg = await newPackage({ leadType: 'BOOKED_APPOINTMENT' });
      await expect(q(`UPDATE buyer_packages SET lead_type = 'VERIFIED_ENQUIRY' WHERE id = $1`, [pkg])).rejects.toThrow(/cannot be changed/);
      const def = await one(`SELECT id FROM package_definitions LIMIT 1`);
      if (def) {
        await expect(q(`INSERT INTO buyer_packages (buyer_id, package_definition_id, amount_paid, leads_included, transaction_reference, paid_at, verified_by, lead_type)
                        VALUES ($1, $2, 625, 5, $3, now(), $4, 'BOOKED_APPOINTMENT')`, [sharedBuyer, def.id, uniq('T'), ADMIN])).rejects.toThrow(/does not match its definition/);
      }
    });

    it('records packages by lead type through the buyer-packages route', async () => {
      const res = await route('../app/api/admin/buyer-packages/route', '/api/admin/buyer-packages', {}, {
        buyer_id: sharedBuyer, amount_paid: 625, leads_included: 5, transaction_reference: uniq('TIDE'), paid_at: new Date().toISOString(), lead_type: 'BOOKED_APPOINTMENT',
      });
      expect(res.status).toBe(201);
      expect(res.body.lead_type).toBe('BOOKED_APPOINTMENT');
      expect((await one(`SELECT lead_type FROM buyer_packages WHERE id = $1`, [res.body.id])).lead_type).toBe('BOOKED_APPOINTMENT');
    });
  });

  describe('appointment outcomes', () => {
    it('reschedules only to a new future time, keeping the history', async () => {
      const { appointmentId } = await directAppointmentAllocation();
      expect((await setStatus(appointmentId, { status: 'RESCHEDULED', scheduled_at: new Date(Date.now() - 1000).toISOString() })).status).toBe(400);
      const newTime = future(60 * 48);
      const res = await setStatus(appointmentId, { status: 'RESCHEDULED', scheduled_at: newTime, outcome_notes: 'Homeowner asked for Thursday' });
      expect(res.status).toBe(200);
      const a = await appt(appointmentId);
      expect(a.status).toBe('RESCHEDULED');
      expect(new Date(a.scheduled_at).toISOString()).toBe(newTime);
      const history = await q(`SELECT event, previous_scheduled_at, new_scheduled_at FROM lead_appointment_events WHERE lead_appointment_id = $1 ORDER BY id`, [appointmentId]);
      expect(history.map((h: { event: string }) => h.event)).toEqual(['BOOKED', 'RESCHEDULED']);
      expect(history[1].previous_scheduled_at).not.toBeNull();
      await expect(q(`UPDATE lead_appointment_events SET notes = 'x' WHERE lead_appointment_id = $1`, [appointmentId])).rejects.toThrow(/permanent record/);
      await expect(q(`DELETE FROM lead_appointment_events WHERE lead_appointment_id = $1`, [appointmentId])).rejects.toThrow(/permanent record/);
    });

    it('refuses a no-show or completion before the appointment time', async () => {
      const { appointmentId } = await directAppointmentAllocation();
      const res = await setStatus(appointmentId, { status: 'HOMEOWNER_NO_SHOW' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/has not happened yet/);
      await expect(q(`UPDATE lead_appointments SET status = 'COMPLETED', updated_by = $2 WHERE id = $1`, [appointmentId, ADMIN])).rejects.toThrow(/has not happened yet/);
    });

    it('records an outcome once, never changes it, and never deletes', async () => {
      const { appointmentId } = await directAppointmentAllocation();
      expect((await setStatus(appointmentId, { status: 'CANCELLED_BY_BUYER', outcome_notes: 'Buyer double-booked' })).status).toBe(200);
      expect((await setStatus(appointmentId, { status: 'RESCHEDULED', scheduled_at: future() })).status).toBe(409);
      await expect(q(`UPDATE lead_appointments SET status = 'COMPLETED', updated_by = $2 WHERE id = $1`, [appointmentId, ADMIN])).rejects.toThrow(/cannot be changed/);
      await expect(q(`UPDATE lead_appointments SET appointment_kind = 'PHONE', updated_by = $2 WHERE id = $1`, [appointmentId, ADMIN])).rejects.toThrow(/cannot be changed/);
      await expect(q(`DELETE FROM lead_appointments WHERE id = $1`, [appointmentId])).rejects.toThrow(/cannot be deleted/);
      expect((await one(`SELECT action FROM audit_log WHERE entity_type = 'lead_appointment' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [appointmentId])).action).toBe('APPOINTMENT_STATUS_RECORDED');
    });

    it('never releases a cancelled appointment, even after payment', async () => {
      const { allocationId, appointmentId } = await directAppointmentAllocation();
      await setStatus(appointmentId, { status: 'CANCELLED_BY_HOMEOWNER' });
      await q(`INSERT INTO payments (lead_allocation_id, expected_amount, status, verified_by, verified_at, transaction_reference, amount_received)
               VALUES ($1, 125, 'PAID', $2, now(), $3, 125)`, [allocationId, ADMIN, uniq('TIDE')]);
      await expect(q(`INSERT INTO deliveries (lead_allocation_id, delivered_at, status) VALUES ($1, now(), 'SENT')`, [allocationId])).rejects.toThrow(/has been cancelled/);
    });

    it('lists appointments with their history for the admin page', async () => {
      const res = await route('../app/api/admin/appointments/route', '/api/admin/appointments', {}, undefined, 'GET');
      expect(res.status).toBe(200);
      expect(res.body.appointments.length).toBeGreaterThan(0);
      expect(res.body.appointments[0]).toHaveProperty('history');
      expect(JSON.stringify(res.body)).not.toContain('homeowner@example.test');
    });
  });

  describe('no-shows and replacements', () => {
    it('needs the no-show recorded before the claim, then supplies a like-for-like free replacement', async () => {
      const { allocationId, appointmentId } = await directAppointmentAllocation({ at: new Date(Date.now() + 1500).toISOString() });
      await payAndDeliver(allocationId);
      const claim = () => recordReplacementRequest(pool, ADMIN, { leadAllocationId: allocationId, reasonCode: 'HOMEOWNER_NO_SHOW', reason: 'Nobody home at 10:00', reportedAt: new Date().toISOString() });
      await expect(claim()).rejects.toThrow(/record the appointment as HOMEOWNER_NO_SHOW/);
      await sleep(1800);
      expect((await setStatus(appointmentId, { status: 'HOMEOWNER_NO_SHOW', outcome_notes: 'Buyer waited 30 minutes' })).status).toBe(200);
      const { id: reqId } = await claim();
      await decideReplacementRequest(pool, ADMIN, reqId, 'APPROVED');

      // Like for like: an enquiry can't replace an appointment.
      const enquiry = await newLead('VERIFIED_ENQUIRY');
      expect((await allocate(enquiry, { buyer_id: sharedBuyer, homeowner_confirmation_id: await confirm(enquiry), replacement_request_id: reqId })).status).toBe(409);
      // A booked appointment can, free, with its own new appointment.
      const lead = await newLead();
      const res = await allocate(lead, { buyer_id: sharedBuyer, homeowner_confirmation_id: await confirm(lead), replacement_request_id: reqId, appointment: apptBody() });
      expect(res.status).toBe(200);
      expect(res.body.released).toBe(true);
      expect(Number((await one(`SELECT agreed_price FROM lead_allocations WHERE id = $1`, [res.body.allocation_id])).agreed_price)).toBe(0);
      expect((await one(`SELECT resolution FROM replacement_requests WHERE id = $1`, [reqId])).resolution).toBe('REPLACEMENT_SUPPLIED');
    });

    it('refuses a no-show claim when the buyer cancelled, and restores an appointment credit for a package no-show', async () => {
      const cancelled = await directAppointmentAllocation();
      await setStatus(cancelled.appointmentId, { status: 'CANCELLED_BY_BUYER' });
      await payAndDeliver(cancelled.allocationId).catch(() => undefined);   // released? never (cancelled)
      const pkg = await newPackage({ leadType: 'BOOKED_APPOINTMENT' });
      const { allocationId, appointmentId } = await directAppointmentAllocation({ packageId: pkg });
      await q(`INSERT INTO deliveries (lead_allocation_id, delivered_at, status) VALUES ($1, now(), 'SENT')`, [allocationId]);
      await setStatus(appointmentId, { status: 'CANCELLED_BY_HOMEOWNER', outcome_notes: 'Homeowner sold the house' });
      await expect(recordReplacementRequest(pool, ADMIN, { leadAllocationId: allocationId, reasonCode: 'HOMEOWNER_NO_SHOW', reason: 'x', reportedAt: new Date().toISOString() }))
        .rejects.toThrow(/record the appointment as HOMEOWNER_NO_SHOW/);
      const { id } = await recordReplacementRequest(pool, ADMIN, { leadAllocationId: allocationId, reasonCode: 'APPOINTMENT_CANCELLED_BY_HOMEOWNER', reason: 'Cancelled, could not rearrange', reportedAt: new Date().toISOString() });
      await decideReplacementRequest(pool, ADMIN, id, 'APPROVED');
      await resolveReplacementRequest(pool, ADMIN, id, { resolution: 'CREDIT_RESTORED' });
      const p = await one(`SELECT * FROM package_balances WHERE buyer_package_id = $1`, [pkg]);
      expect(p.credits_remaining).toBe(5);
      expect(p.lead_type).toBe('BOOKED_APPOINTMENT');
    });
  });

  describe('appointment price and permissions', () => {
    const setPrice = (ref: string, price: unknown) =>
      route('../app/api/admin/buyers/[reference]/appointment-price/route', `/api/admin/buyers/${ref}/appointment-price`, { reference: ref }, { agreed_price_per_appointment: price });

    it('lets the owner set and clear a price, with an audit entry, and refuses a reviewer', async () => {
      expect((await setPrice('HLX-BYR-TEST-APPT-3', -5)).status).toBe(400);
      expect((await setPrice('HLX-BYR-TEST-APPT-3', 110)).status).toBe(200);
      expect(Number((await one(`SELECT agreed_price_per_appointment FROM buyers WHERE id = $1`, [noApptPriceBuyer])).agreed_price_per_appointment)).toBe(110);
      expect((await one(`SELECT action FROM audit_log WHERE entity_type = 'buyer' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [noApptPriceBuyer])).action).toBe('BUYER_APPOINTMENT_PRICE_SET');
      expect((await setPrice('HLX-BYR-TEST-APPT-3', null)).status).toBe(200);
      holder.role = 'reviewer';
      expect((await setPrice('HLX-BYR-TEST-APPT-3', 90)).status).toBe(403);
      expect((await one(`SELECT agreed_price_per_appointment FROM buyers WHERE id = $1`, [noApptPriceBuyer])).agreed_price_per_appointment).toBeNull();
    });

    it("never changes an existing allocation's price when the buyer's price changes", async () => {
      const lead = await newLead();
      const res = await allocate(lead, { buyer_id: exclusiveBuyer, homeowner_confirmation_id: await confirm(lead, exclusiveBuyer), appointment: apptBody() });
      expect(res.status).toBe(200);
      await setPrice('HLX-BYR-TEST-APPT-2', 150);
      expect(Number((await one(`SELECT agreed_price FROM lead_allocations WHERE id = $1`, [res.body.allocation_id])).agreed_price)).toBe(125);
      await setPrice('HLX-BYR-TEST-APPT-2', 125);
    });
  });

  describe('concurrency', () => {
    it('lets only one of several buyers claim the same appointment lead at once', async () => {
      const lead = await newLead();
      const buyers = [sharedBuyer, exclusiveBuyer];
      const confs = await Promise.all(buyers.map((b) => confirm(lead, b)));
      const results = await Promise.all(buyers.map((b, i) => allocate(lead, { buyer_id: b, homeowner_confirmation_id: confs[i], appointment: apptBody() })));
      expect(results.filter((r) => r.status === 200).length).toBe(1);
      expect((await q(`SELECT 1 FROM lead_allocations WHERE lead_id = $1`, [lead])).length).toBe(1);
      expect((await q(`SELECT 1 FROM lead_appointments ap JOIN lead_allocations a ON a.id = ap.lead_allocation_id WHERE a.lead_id = $1`, [lead])).length).toBe(1);
    });

    it('records only one of two outcomes submitted at the same moment', async () => {
      const { appointmentId } = await directAppointmentAllocation();
      const results = await Promise.all([
        setStatus(appointmentId, { status: 'CANCELLED_BY_HOMEOWNER' }),
        setStatus(appointmentId, { status: 'CANCELLED_BY_BUYER' }),
      ]);
      expect(results.filter((r) => r.status === 200).length).toBe(1);
      expect((await q(`SELECT 1 FROM lead_appointment_events WHERE lead_appointment_id = $1`, [appointmentId])).length).toBe(2);
    });

    it('never spends the last appointment credit twice', async () => {
      const pkg = await newPackage({ leadType: 'BOOKED_APPOINTMENT', leads: 1, paid: 125 });
      const leads = await Promise.all([newLead(), newLead(), newLead()]);
      const confs = await Promise.all(leads.map((l) => confirm(l)));
      const results = await Promise.all(leads.map((l, i) => allocate(l, { buyer_id: sharedBuyer, homeowner_confirmation_id: confs[i], package_id: pkg, appointment: apptBody() })));
      expect(results.filter((r) => r.status === 200).length).toBe(1);
      expect((await one(`SELECT leads_used FROM buyer_packages WHERE id = $1`, [pkg])).leads_used).toBe(1);
    });
  });

  describe('rollback (docs/BOOKED_APPOINTMENTS_ROLLBACK.md)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function freshDb(suffix: string, fn: (q2: (t: string, v?: unknown[]) => Promise<any[]>, p2: any) => Promise<void>) {
      const rdb = `${dbName}_${suffix}`;
      await admin.query(`CREATE DATABASE ${rdb}`);
      const url = new URL(adminUrl!);
      url.pathname = `/${rdb}`;
      const { Pool } = require('pg');
      const p2 = new Pool({ connectionString: url.toString(), max: 4 });
      const q2 = async (t: string, v: unknown[] = []) => (await p2.query(t, v)).rows;
      try {
        for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith('.sql') && n <= APPTS).sort()) await p2.query(readFileSync(join(migrationsDir, f), 'utf8'));
        await fn(q2, p2);
      } finally {
        await p2.end();
        await admin.query(`DROP DATABASE IF EXISTS ${rdb}`);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function seed(q2: (t: string, v?: unknown[]) => Promise<any[]>) {
      await q2(`INSERT INTO industries (slug, name, is_enabled) VALUES ('spray_foam_removal','Spray Foam Removal',true) ON CONFLICT (slug) DO NOTHING`);
      const ind = (await q2(`SELECT id FROM industries WHERE slug = 'spray_foam_removal'`))[0].id;
      const b = (await q2(`INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status, agreed_price_per_lead, agreed_price_per_appointment, exclusivity_arrangement, agreed_weekly_capacity, coverage_type, onboarding_call_completed_at, onboarding_call_conducted_by, application_reference)
                           VALUES ('RB', 'RB', 'rb@example.test', '1', $1, 'ACTIVE', 85, 125, 'shared', 40, 'national', now(), 'x', $2) RETURNING id`, [ind, uniq('RB')]))[0].id;
      const lead = async (type = 'VERIFIED_ENQUIRY') => (await q2(`INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, property_type, service_requirement, status, lead_type) VALUES ($1, 'H', '{}'::jsonb, 'MK1 1AA', 'House', 'x', 'NEW', $2) RETURNING id`, [ind, type]))[0].id;
      const conf = async (l: number) => (await q2(`INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes) VALUES ($1, $2, 'RB', 'p', 'w', 'Yes', 'ADMIN_AFTER_CALL', now(), 'x', 'n') RETURNING id`, [l, b]))[0].id;
      const enquiryPkg = (await q2(`INSERT INTO buyer_packages (buyer_id, amount_paid, leads_included, transaction_reference, paid_at, verified_by) VALUES ($1, 425, 5, $2, now(), 'x') RETURNING id`, [b, uniq('RB')]))[0].id;
      return { ind, b, lead, conf, enquiryPkg };
    }

    it('before real use: removes everything, keeps the ledger working, then re-applies', async () => {
      await freshDb('rb', async (q2, p2) => {
        const s = await seed(q2);
        const l = await s.lead();
        await q2(`INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, status, package_id, homeowner_confirmation_id) VALUES ($1, $2, 'SHARED', 'PURCHASED', $3, $4)`, [l, s.b, s.enquiryPkg, await s.conf(l)]);
        const before = await q2(`SELECT id, leads_used FROM buyer_packages ORDER BY id`);

        await p2.query(rollbackSql('BOOKED_APPOINTMENTS_ROLLBACK.md'));

        expect((await q2(`SELECT to_regclass('lead_appointments') AS t`))[0].t).toBeNull();
        const cols = async (t: string) => (await q2(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [t])).map((r: { column_name: string }) => r.column_name);
        expect(await cols('leads')).not.toContain('lead_type');
        expect(await cols('buyers')).not.toContain('agreed_price_per_appointment');
        expect(await cols('package_balances')).not.toContain('lead_type');
        expect(await q2(`SELECT id, leads_used FROM buyer_packages ORDER BY id`)).toEqual(before);
        // The ledger still enforces its own rules after the rollback.
        await expect(q2(`UPDATE buyer_packages SET leads_used = 0 WHERE id = $1`, [s.enquiryPkg])).rejects.toThrow();
        const l2 = (await q2(`INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, property_type, service_requirement, status) VALUES ($1, 'H', '{}'::jsonb, 'MK1 1AA', 'House', 'x', 'NEW') RETURNING id`, [s.ind]))[0].id;
        await q2(`INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, status, package_id, homeowner_confirmation_id) VALUES ($1, $2, 'SHARED', 'PURCHASED', $3, $4)`, [l2, s.b, s.enquiryPkg, await s.conf(l2)]);
        expect((await q2(`SELECT credits_remaining FROM package_balances WHERE buyer_package_id = $1`, [s.enquiryPkg]))[0].credits_remaining).toBe(3);
        const check = (await q2(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'replacement_requests_reason_code_check'`))[0].def;
        expect(check).toContain('UNREACHABLE_DOCUMENTED');
        expect(check).not.toContain('HOMEOWNER_NO_SHOW');

        await p2.query(readFileSync(join(migrationsDir, APPTS), 'utf8'));
        expect((await q2(`SELECT DISTINCT lead_type FROM leads`)).map((r: { lead_type: string }) => r.lead_type)).toEqual(['VERIFIED_ENQUIRY']);
      });
    });

    it('after real use: refuses while appointments are live, then backs up everything, maps codes, re-applies', async () => {
      await freshDb('rb2', async (q2, p2) => {
        const s = await seed(q2);
        // A completed-in-future-time appointment can't be faked, so: one booked appointment (blocks),
        // then cancelled by the homeowner after delivery with a claim recorded; a used-up appointment package.
        const apptPkg = (await q2(`INSERT INTO buyer_packages (buyer_id, amount_paid, leads_included, transaction_reference, paid_at, verified_by, lead_type) VALUES ($1, 125, 1, $2, now(), 'x', 'BOOKED_APPOINTMENT') RETURNING id`, [s.b, uniq('RB')]))[0].id;
        const l = await s.lead('BOOKED_APPOINTMENT');
        const c = await p2.connect();
        let alloc: number, apId: number;
        try {
          await c.query('BEGIN');
          alloc = (await c.query(`INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, allocation_sequence, status, package_id, homeowner_confirmation_id) VALUES ($1, $2, 'EXCLUSIVE_WINDOW', 1, 'PURCHASED', $3, $4) RETURNING id`, [l, s.b, apptPkg, await s.conf(l)])).rows[0].id;
          apId = (await c.query(`INSERT INTO lead_appointments (lead_allocation_id, scheduled_at, appointment_kind, homeowner_confirmed_at, arranged_by, updated_by) VALUES ($1, now() + interval '2 days', 'IN_PERSON', now(), 'x', 'x') RETURNING id`, [alloc])).rows[0].id;
          await c.query('COMMIT');
        } finally {
          c.release();
        }
        const delivery = (await q2(`INSERT INTO deliveries (lead_allocation_id, delivered_at, status) VALUES ($1, now(), 'SENT') RETURNING id`, [alloc]))[0].id;

        // Refused while the appointment is still booked; nothing changed.
        await expect(p2.query(rollbackSql('BOOKED_APPOINTMENTS_ROLLBACK.md'))).rejects.toThrow(/still booked/);
        await p2.query('ROLLBACK').catch(() => undefined);
        expect((await q2(`SELECT to_regclass('lead_appointments') AS t`))[0].t).not.toBeNull();

        await q2(`UPDATE lead_appointments SET status = 'CANCELLED_BY_HOMEOWNER', updated_by = 'x', outcome_notes = 'moved house' WHERE id = $1`, [apId]);
        const rr = await recordReplacementRequest(p2, 'x', { leadAllocationId: alloc, reasonCode: 'APPOINTMENT_CANCELLED_BY_HOMEOWNER', reason: 'cancelled', reportedAt: new Date().toISOString() });
        void delivery;

        await p2.query(rollbackSql('BOOKED_APPOINTMENTS_ROLLBACK.md'));

        expect((await q2(`SELECT count(*)::int AS n FROM booked_appointments_backup_lead_appointments`))[0].n).toBe(1);
        expect((await q2(`SELECT count(*)::int AS n FROM booked_appointments_backup_lead_appointment_events`))[0].n).toBe(2);
        expect((await q2(`SELECT lead_type FROM booked_appointments_backup_leads WHERE id = $1`, [l]))[0].lead_type).toBe('BOOKED_APPOINTMENT');
        expect((await q2(`SELECT lead_type FROM booked_appointments_backup_buyer_packages WHERE id = $1`, [apptPkg]))[0].lead_type).toBe('BOOKED_APPOINTMENT');
        expect(Number((await q2(`SELECT agreed_price_per_appointment FROM booked_appointments_backup_buyers WHERE id = $1`, [s.b]))[0].agreed_price_per_appointment)).toBe(125);
        expect((await q2(`SELECT reason_code FROM booked_appointments_backup_replacement_requests WHERE id = $1`, [rr.id]))[0].reason_code).toBe('APPOINTMENT_CANCELLED_BY_HOMEOWNER');
        expect((await q2(`SELECT reason_code FROM replacement_requests WHERE id = $1`, [rr.id]))[0].reason_code).toBe('OTHER');
        // The request's guard is back on.
        await expect(q2(`UPDATE replacement_requests SET reason = 'edited' WHERE id = $1`, [rr.id])).rejects.toThrow(/cannot be changed/);
        // The used-up appointment package can't buy anything.
        expect((await q2(`SELECT credits_remaining FROM package_balances WHERE buyer_package_id = $1`, [apptPkg]))[0].credits_remaining).toBe(0);

        // Re-applies, and the credits ledger rollback still works after it (documented order).
        await p2.query(readFileSync(join(migrationsDir, APPTS), 'utf8'));
        await p2.query(rollbackSql('BOOKED_APPOINTMENTS_ROLLBACK.md').replace(/CREATE TABLE booked_appointments_backup_(\w+) AS/g, 'CREATE TABLE booked_appointments_backup2_$1 AS'));
        await p2.query(rollbackSql('CREDITS_LEDGER_ROLLBACK.md'));
        expect((await q2(`SELECT to_regclass('package_refunds') AS t`))[0].t).toBeNull();
        void LEDGER;
      });
    });
  });
});
