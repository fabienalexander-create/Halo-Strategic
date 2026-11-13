import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { SMS_COVERED_CONSENT_VERSIONS, handleInboundReply, queueVerification, recordDelivery, type SqlDb } from './smsVerification';
import { sendPendingVerifications } from './smsSender';

// Real-Postgres tests for homeowner SMS verification. Skipped unless TEST_PG_ADMIN_URL is set;
// refuses any non-local host; uses a throwaway database. No network, no real messages.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const holder: { db: any } = ((globalThis as any).__smsHolder = (globalThis as any).__smsHolder ?? { db: null });

vi.mock('@netlify/database', () => ({
  getDatabase: () => ({
    sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      let text = '';
      strings.forEach((s, i) => { text += s + (i < values.length ? `$${i + 1}` : ''); });
      return (await holder.db.query(text, values)).rows;
    },
  }),
}));

const db: SqlDb = {
  sql: async (strings, ...values) => {
    let text = '';
    strings.forEach((s, i) => { text += s + (i < values.length ? `$${i + 1}` : ''); });
    return (await holder.db.query(text, values)).rows;
  },
};
const covered = SMS_COVERED_CONSENT_VERSIONS as Set<string>;
const CV = 'test-sms-v1';

describe.skipIf(!adminUrl)('sms verification (real Postgres)', () => {
  const dbName = `lx_test_${Date.now()}_sms`;
  const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let industryId: number;
  let phoneSeq = 0;
  const newPhone = () => `07700 9${String(10000 + ++phoneSeq).padStart(5, '0')}`;
  const e164 = (p: string) => '+44' + p.replace(/\s/g, '').slice(1);

  async function newLead(): Promise<number> {
    return (await holder.db.query(`INSERT INTO leads (industry_id, homeowner_name) VALUES ($1,'T') RETURNING id`, [industryId])).rows[0].id;
  }
  async function queue(mobile: string, leadId?: number) {
    return queueVerification(db, { leadId: leadId ?? (await newLead()), mobile, consentVersion: CV });
  }
  const status = async (id: number) => (await holder.db.query(`SELECT status FROM lead_phone_verifications WHERE id=$1`, [id])).rows[0].status;
  const markSent = (id: number) => holder.db.query(`UPDATE lead_phone_verifications SET status='SENT', sent_at=now() WHERE id=$1`, [id]);

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    // A pool, so the "simultaneous" tests really run on separate connections.
    const { Pool } = require('pg');
    holder.db = new Pool({ connectionString: url.toString(), max: 8 });
    holder.db.on('error', () => { /* server-side termination at teardown is expected */ });
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) await holder.db.query(readFileSync(join(dir, f), 'utf8'));
    await holder.db.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('solar_battery','Solar',true) ON CONFLICT (slug) DO NOTHING`);
    industryId = (await holder.db.query(`SELECT id FROM industries WHERE slug='solar_battery'`)).rows[0].id;
  });

  afterAll(async () => {
    covered.delete(CV);
    if (holder.db) await holder.db.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  beforeEach(() => {
    process.env.SMS_VERIFICATION_ENABLED = 'true';
    delete process.env.SMS_HOURLY_LIMIT;
    covered.add(CV);
  });

  it('queues nothing unless enabled AND the consent version covers SMS', async () => {
    const lead = await newLead();
    process.env.SMS_VERIFICATION_ENABLED = 'false';
    expect(await queueVerification(db, { leadId: lead, mobile: newPhone(), consentVersion: CV })).toEqual({ queued: false, reason: 'NOT_ENABLED' });
    process.env.SMS_VERIFICATION_ENABLED = 'true';
    expect(await queueVerification(db, { leadId: lead, mobile: newPhone(), consentVersion: '2026-11-06-v0.1' })).toEqual({ queued: false, reason: 'CONSENT_NOT_COVERED' });
    expect((await holder.db.query(`SELECT count(*)::int n FROM lead_phone_verifications WHERE lead_id=$1`, [lead])).rows[0].n).toBe(0);
    // The shipped default covers no version at all.
    covered.delete(CV);
    expect(await queueVerification(db, { leadId: lead, mobile: newPhone(), consentVersion: CV })).toEqual({ queued: false, reason: 'CONSENT_NOT_COVERED' });
  });

  it('queues a request with a 6 character reference, 48h expiry, and an audit entry with no personal data', async () => {
    const phone = newPhone();
    const r = await queue(phone);
    expect(r.queued).toBe(true);
    if (!r.queued) return;
    expect(r.reference).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const row = (await holder.db.query(`SELECT phone_e164, status, expires_at > now() + interval '47 hours' AS ok FROM lead_phone_verifications WHERE id=$1`, [r.verificationId])).rows[0];
    expect(row).toMatchObject({ phone_e164: e164(phone), status: 'PENDING_SEND', ok: true });
    const audit = (await holder.db.query(`SELECT new_state::text s FROM audit_log WHERE entity_type='lead_phone_verification' AND entity_id=$1`, [r.verificationId])).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].s).toContain(r.reference);
    expect(audit[0].s).not.toMatch(/\+44|07700/);
  });

  it('records invalid numbers without texting, and never queues suppressed numbers', async () => {
    expect(await queue('020 7946 0958')).toEqual({ queued: false, reason: 'INVALID_NUMBER' });
    expect((await holder.db.query(`SELECT count(*)::int n FROM lead_phone_verifications WHERE status='FAILED_INVALID_NUMBER' AND phone_e164 IS NULL`)).rows[0].n).toBeGreaterThan(0);
    const phone = newPhone();
    await holder.db.query(`INSERT INTO sms_suppressions (phone_e164, reason) VALUES ($1,'MANUAL')`, [e164(phone)]);
    expect(await queue(phone)).toEqual({ queued: false, reason: 'SUPPRESSED' });
  });

  it('allows one open request per lead, and caps a number at 2 requests per 24 hours', async () => {
    const lead = await newLead();
    const phone = newPhone();
    expect((await queue(phone, lead)).queued).toBe(true);
    expect(await queue(phone, lead)).toEqual({ queued: false, reason: 'ALREADY_OPEN' });
    expect((await queue(phone)).queued).toBe(true);
    expect(await queue(phone)).toEqual({ queued: false, reason: 'NUMBER_CAPPED' });
  });

  it('trips the global hourly circuit breaker', async () => {
    const { rows } = await holder.db.query(`SELECT count(*)::int n FROM lead_phone_verifications WHERE created_at > now() - interval '1 hour'`);
    process.env.SMS_HOURLY_LIMIT = String(rows[0].n);
    expect(await queue(newPhone())).toEqual({ queued: false, reason: 'CIRCUIT_BREAKER' });
  });

  it('a reply with the reference verifies exactly that request; wrong number or unknown reference does not', async () => {
    const a = await queue(newPhone());
    const b = await queue(newPhone());
    if (!a.queued || !b.queued) throw new Error('setup');
    await markSent(a.verificationId); await markSent(b.verificationId);
    const phoneA = (await holder.db.query(`SELECT phone_e164 p FROM lead_phone_verifications WHERE id=$1`, [a.verificationId])).rows[0].p;
    const phoneB = (await holder.db.query(`SELECT phone_e164 p FROM lead_phone_verifications WHERE id=$1`, [b.verificationId])).rows[0].p;

    expect((await handleInboundReply(db, { from: phoneB, text: `YES ${a.reference}`, messageId: 'm1' })).outcome).toBe('NO_MATCH');
    expect((await handleInboundReply(db, { from: phoneA, text: 'YES ZZZZZ2', messageId: 'm2' })).outcome).toBe('NO_MATCH');
    expect(await status(a.verificationId)).toBe('SENT');

    expect((await handleInboundReply(db, { from: phoneA, text: `yes ${a.reference.toLowerCase()}`, messageId: 'm3' })).outcome).toBe('VERIFIED');
    expect(await status(a.verificationId)).toBe('VERIFIED');
    expect(await status(b.verificationId)).toBe('SENT');
    // Replay of the same provider message is a no-op, and a later repeat does not re-verify.
    expect((await handleInboundReply(db, { from: phoneA, text: `YES ${a.reference}`, messageId: 'm3' })).outcome).toBe('DUPLICATE');
    expect((await handleInboundReply(db, { from: phoneA, text: `YES ${a.reference}`, messageId: 'm4' })).outcome).toBe('NO_MATCH');
    expect((await holder.db.query(`SELECT count(*)::int n FROM audit_log WHERE action='SMS_VERIFICATION_VERIFIED' AND entity_id=$1`, [a.verificationId])).rows[0].n).toBe(1);
  });

  it('a bare YES verifies only when exactly one request is open for the number', async () => {
    const phone = newPhone();
    const first = await queue(phone);
    const second = await queue(phone);
    if (!first.queued || !second.queued) throw new Error('setup');
    await markSent(first.verificationId); await markSent(second.verificationId);
    expect((await handleInboundReply(db, { from: phone, text: 'YES', messageId: 'b1' })).outcome).toBe('AMBIGUOUS');
    expect(await status(first.verificationId)).toBe('SENT');
    expect(await status(second.verificationId)).toBe('SENT');
    // Disambiguating with the reference works; the other stays open.
    expect((await handleInboundReply(db, { from: phone, text: `YES ${second.reference}`, messageId: 'b2' })).outcome).toBe('VERIFIED');
    expect(await status(first.verificationId)).toBe('SENT');
    // Now exactly one is open, so a bare YES is accepted for it.
    expect((await handleInboundReply(db, { from: phone, text: 'Yes', messageId: 'b3' })).outcome).toBe('VERIFIED');
    expect(await status(first.verificationId)).toBe('VERIFIED');
  });

  it('rejects expired requests, and requests not yet sent', async () => {
    const phone = newPhone();
    const r = await queue(phone);
    if (!r.queued) throw new Error('setup');
    expect((await handleInboundReply(db, { from: phone, text: `YES ${r.reference}`, messageId: 'e0' })).outcome).toBe('NO_MATCH'); // still PENDING_SEND
    await markSent(r.verificationId);
    await holder.db.query(`UPDATE lead_phone_verifications SET expires_at = now() - interval '1 minute' WHERE id=$1`, [r.verificationId]);
    expect((await handleInboundReply(db, { from: phone, text: `YES ${r.reference}`, messageId: 'e1' })).outcome).toBe('NO_MATCH');
    expect(await status(r.verificationId)).toBe('SENT');
  });

  it('simultaneous replies verify a request exactly once', async () => {
    const phone = newPhone();
    const r = await queue(phone);
    if (!r.queued) throw new Error('setup');
    await markSent(r.verificationId);
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, (_, i) => handleInboundReply(db, { from: phone, text: i % 2 ? 'YES' : `YES ${r.reference}`, messageId: `c${i}` }))
    );
    expect(outcomes.filter((o) => o.outcome === 'VERIFIED')).toHaveLength(1);
    expect((await holder.db.query(`SELECT count(*)::int n FROM audit_log WHERE action='SMS_VERIFICATION_VERIFIED' AND entity_id=$1`, [r.verificationId])).rows[0].n).toBe(1);
  });

  it('delivery receipts never verify; they only record DELIVERED or FAILED, and not over a later state', async () => {
    const a = await queue(newPhone()); const b = await queue(newPhone());
    if (!a.queued || !b.queued) throw new Error('setup');
    await holder.db.query(`UPDATE lead_phone_verifications SET status='SENT', provider_message_id='pm-a' WHERE id=$1`, [a.verificationId]);
    await holder.db.query(`UPDATE lead_phone_verifications SET status='SENT', provider_message_id='pm-b' WHERE id=$1`, [b.verificationId]);
    expect(await recordDelivery(db, { providerMessageId: 'pm-a', delivered: true })).toBe(1);
    expect(await status(a.verificationId)).toBe('DELIVERED');
    expect(await recordDelivery(db, { providerMessageId: 'pm-b', delivered: false, detail: 'handset off' })).toBe(1);
    expect(await status(b.verificationId)).toBe('FAILED');
    await holder.db.query(`UPDATE lead_phone_verifications SET status='VERIFIED' WHERE id=$1`, [a.verificationId]);
    expect(await recordDelivery(db, { providerMessageId: 'pm-a', delivered: true })).toBe(0);
    expect(await status(a.verificationId)).toBe('VERIFIED');
  });

  it('STOP suppresses the number, closes its open requests, and blocks any later queue or send', async () => {
    const phone = newPhone();
    const r = await queue(phone);
    if (!r.queued) throw new Error('setup');
    await markSent(r.verificationId);
    expect((await handleInboundReply(db, { from: e164(phone).slice(1), text: 'Stop', messageId: 's1' })).outcome).toBe('STOPPED');
    expect(await status(r.verificationId)).toBe('SUPPRESSED');
    expect((await handleInboundReply(db, { from: phone, text: 'STOP', messageId: 's2' })).outcome).toBe('STOPPED'); // idempotent
    expect(await queue(phone)).toEqual({ queued: false, reason: 'SUPPRESSED' });

    // A row that was queued before the STOP arrived is closed by the sender, not sent.
    const p2 = newPhone();
    const r2 = await queue(p2);
    if (!r2.queued) throw new Error('setup');
    await holder.db.query(`INSERT INTO sms_suppressions (phone_e164, reason) VALUES ($1,'STOP')`, [e164(p2)]);
    process.env.MAKE_SMS_OUT_WEBHOOK_URL = 'https://hook.invalid/x';
    process.env.MAKE_SMS_OUT_SECRET = 'secret';
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const summary = await sendPendingVerifications(db, { limit: 50, fetchImpl });
    expect(summary.suppressed).toBeGreaterThanOrEqual(1);
    expect(await status(r2.verificationId)).toBe('SUPPRESSED');
    for (const call of fetchImpl.mock.calls) expect(JSON.parse(call[1].body).to).not.toBe(e164(p2));
  });

  it('sender: signs the hand-off, records SENT and the provider id, never double sends under concurrency', async () => {
    await holder.db.query(`UPDATE lead_phone_verifications SET status='FAILED' WHERE status='PENDING_SEND'`);
    const r = await queue(newPhone());
    if (!r.queued) throw new Error('setup');
    process.env.MAKE_SMS_OUT_WEBHOOK_URL = 'https://hook.invalid/x';
    process.env.MAKE_SMS_OUT_SECRET = 'secret';
    const fetchImpl = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ message_id: 'tm-123' }), { status: 200 }));
    const results = await Promise.all([1, 2, 3].map(() => sendPendingVerifications(db, { fetchImpl })));
    expect(results.reduce((n, s) => n + s.sent, 0)).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.verification_ref).toBe(r.reference);
    expect(body.text).toContain(`YES ${r.reference}`);
    expect(body.text).toContain('Reply STOP');
    const expected = createHmac('sha256', 'secret').update(`${init.headers['x-halo-timestamp']}.${init.body}`).digest('hex');
    expect(init.headers['x-halo-signature']).toBe(expected);
    const row = (await holder.db.query(`SELECT status, provider_message_id, attempt_count FROM lead_phone_verifications WHERE id=$1`, [r.verificationId])).rows[0];
    expect(row).toEqual({ status: 'SENT', provider_message_id: 'tm-123', attempt_count: 1 });
  });

  it('sender: retries then marks FAILED after 3 attempts; does nothing when disabled or unconfigured', async () => {
    await holder.db.query(`UPDATE lead_phone_verifications SET status='FAILED' WHERE status='PENDING_SEND'`);
    const r = await queue(newPhone());
    if (!r.queued) throw new Error('setup');
    process.env.MAKE_SMS_OUT_WEBHOOK_URL = 'https://hook.invalid/x';
    process.env.MAKE_SMS_OUT_SECRET = 'secret';
    const failing = vi.fn().mockResolvedValue(new Response('no', { status: 500 }));
    await sendPendingVerifications(db, { fetchImpl: failing });
    expect(await status(r.verificationId)).toBe('PENDING_SEND');
    await sendPendingVerifications(db, { fetchImpl: failing });
    await sendPendingVerifications(db, { fetchImpl: failing });
    expect(await status(r.verificationId)).toBe('FAILED');
    await sendPendingVerifications(db, { fetchImpl: failing });
    expect(failing).toHaveBeenCalledTimes(3);

    delete process.env.MAKE_SMS_OUT_SECRET;
    expect((await sendPendingVerifications(db, { fetchImpl: failing })).skipped).toBe('NOT_CONFIGURED');
    process.env.SMS_VERIFICATION_ENABLED = 'false';
    expect((await sendPendingVerifications(db, { fetchImpl: failing })).skipped).toBe('NOT_ENABLED');
  });

  it('routes fail closed and apply the shared secret', async () => {
    const inbound = await import('../app/api/webhooks/sms/inbound/route');
    const delivery = await import('../app/api/webhooks/sms/delivery/route');
    const sender = await import('../app/api/sms/send-pending/route');
    const mk = (path: string, body: unknown, secret?: string) =>
      new NextRequest(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body), headers: secret ? { 'x-halo-sms-secret': secret } : {} });

    delete process.env.SMS_INBOUND_SECRET; delete process.env.SMS_SENDER_SECRET;
    expect((await inbound.POST(mk('/i', {}, 'x'))).status).toBe(503);
    expect((await delivery.POST(mk('/d', {}, 'x'))).status).toBe(503);
    expect((await sender.POST(mk('/s', {}, 'x'))).status).toBe(503);

    process.env.SMS_INBOUND_SECRET = 'in-secret'; process.env.SMS_SENDER_SECRET = 'send-secret';
    expect((await inbound.POST(mk('/i', {}))).status).toBe(401);
    expect((await inbound.POST(mk('/i', {}, 'wrong'))).status).toBe(401);
    expect((await delivery.POST(mk('/d', {}, 'send-secret'))).status).toBe(401);
    expect((await sender.POST(mk('/s', {}, 'in-secret'))).status).toBe(401);

    const phone = newPhone();
    const r = await queue(phone);
    if (!r.queued) throw new Error('setup');
    await holder.db.query(`UPDATE lead_phone_verifications SET status='SENT', provider_message_id='pm-route' WHERE id=$1`, [r.verificationId]);
    const d = await delivery.POST(mk('/d', { message_id: 'pm-route', status: 'delivered' }, 'in-secret'));
    expect(await d.json()).toEqual({ updated: 1 });
    expect(await status(r.verificationId)).toBe('DELIVERED');
    const res = await inbound.POST(mk('/i', { from: e164(phone).slice(1), text: `YES ${r.reference}`, message_id: 'route-1' }, 'in-secret'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: 'VERIFIED' });
    expect((await inbound.POST(new NextRequest('http://localhost/i', { method: 'POST', body: 'not json', headers: { 'x-halo-sms-secret': 'in-secret' } }))).status).toBe(400);
  });
});
