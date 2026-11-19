import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { sqlFromClient } from './smsVerification';
import { hashFollowUpToken } from './metaFollowUpToken';
import { queueFollowUpSms, reissueFollowUpLink, sendPendingFollowUpSms, suppressOpenFollowUps, recordFollowUpDelivery } from './metaFollowUpSms';

// Proves the follow-up SMS outbox against a real local Postgres: the intake queues in the same
// transaction, test mode never touches a real number, a reissued or completed link is cancelled
// rather than sent, retries keep working, the nonce never outlives a sendable message, and the
// approved wording carries a link that actually matches the lead's stored hash. fetch is always
// stubbed: nothing here can reach Make or TextMagic.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');

const TEST_NUMBER = '+447700900123';
const REAL_NUMBER = '+447749000111';

describe.skipIf(!adminUrl)('Meta follow-up SMS (real Postgres)', () => {
  const dbName = `lx_test_${Date.now()}_followupsms`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, pgClient: any;
  let industryId: number;
  let db: { sql: ReturnType<typeof sqlFromClient>['sql']; pool: { connect: () => Promise<{ query: (t: string, v?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>; release: () => void }> } };
  let fetchMock: ReturnType<typeof vi.fn>;
  let providerSeq = 0;

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
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
      await pgClient.query(readFileSync(join(dir, f), 'utf8'));
    }
    await pgClient.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('spray_foam_removal','Spray Foam Removal',true) ON CONFLICT (slug) DO NOTHING`);
    industryId = (await pgClient.query(`SELECT id FROM industries WHERE slug = 'spray_foam_removal'`)).rows[0].id;
    db = {
      sql: sqlFromClient(pgClient).sql,
      pool: { connect: async () => ({ query: (t: string, v?: unknown[]) => pgClient.query(t, v), release: () => {} }) },
    };
  });

  afterAll(async () => {
    await pgClient?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  beforeEach(async () => {
    await pgClient.query('DELETE FROM lead_sms_messages');
    await pgClient.query('DELETE FROM sms_suppressions');
    Object.assign(process.env, {
      META_HOMEOWNER_LEADS_WEBHOOK_SECRET: 'test-secret',
      META_FOLLOW_UP_SMS_ENABLED: 'test',
      META_FOLLOW_UP_SMS_TEST_NUMBER: '07700 900123',
      META_FOLLOW_UP_LINK_KEY: 'k'.repeat(40),
      MAKE_SMS_OUT_WEBHOOK_URL: 'https://make.invalid/hook',
      MAKE_SMS_OUT_SECRET: 'make-secret',
    });
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message_id: `tm-${++providerSeq}` }) }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of ['META_FOLLOW_UP_SMS_ENABLED', 'META_FOLLOW_UP_SMS_TEST_NUMBER', 'META_FOLLOW_UP_LINK_KEY', 'MAKE_SMS_OUT_WEBHOOK_URL', 'MAKE_SMS_OUT_SECRET']) delete process.env[k];
  });

  async function ingest(metaLeadId: string, mobile: string) {
    vi.resetModules();
    vi.doMock('@netlify/database', () => ({ getDatabase: () => db }));
    const { POST } = await import('./../app/api/integrations/meta-homeowner-leads/route');
    const req = new NextRequest('https://example.com/api/integrations/meta-homeowner-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-halo-integration-secret': 'test-secret' },
      // The live five-question form: no qualification answers, no consent, so it awaits qualification.
      body: JSON.stringify({ meta_lead_id: metaLeadId, mapped: { industry_slug: 'spray_foam_removal', homeowner_name: 'Test Homeowner', mobile, postcode: 'MK15 8PR', owns_property: true } }),
    });
    const res = await POST(req);
    return { status: res.status, body: await res.json() };
  }

  const messages = async (leadId: number) =>
    (await pgClient.query(`SELECT * FROM lead_sms_messages WHERE lead_id = $1 ORDER BY id`, [leadId])).rows;

  async function insertPendingLead(mobile: string): Promise<number> {
    const { rows } = await pgClient.query(
      `INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, source, status)
       VALUES ($1, 'Direct Insert', $2::jsonb, 'MK15 8PR', 'meta_instant_form', 'QUALIFICATION_PENDING') RETURNING id`,
      [industryId, JSON.stringify({ mobile })]
    );
    return rows[0].id;
  }

  it('test mode: queues and sends the approved text to the reserved number, with a link matching the stored hash', async () => {
    const { status, body } = await ingest('l:fu-test-number', TEST_NUMBER);
    expect(status).toBe(201);
    expect(body.follow_up_url).toMatch(/\/spray-foam-removal\/complete\?token=/);

    const [msg] = await messages(body.lead_id);
    expect(msg.status).toBe('SENT');
    expect(msg.link_nonce).toBeNull();
    expect(msg.provider_message_id).toMatch(/^tm-/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const payload = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(payload.to).toBe(TEST_NUMBER);
    expect(payload.purpose).toBe('META_FOLLOW_UP');
    expect(payload.text).toBe(
      `Halo Strategic: thanks for your spray foam removal enquiry. Please complete your details here: ${body.follow_up_url}\n\n` +
      'If an installer covers your area, they may contact you directly. Reply STOP to opt out.'
    );
    const token = new URL(body.follow_up_url).searchParams.get('token')!;
    const lead = (await pgClient.query(`SELECT follow_up_token_hash FROM leads WHERE id = $1`, [body.lead_id])).rows[0];
    expect(lead.follow_up_token_hash).toBe(hashFollowUpToken(token));
  });

  it('test mode: a real homeowner number is never queued, and the lead is still saved', async () => {
    const { status, body } = await ingest('l:fu-real-number', REAL_NUMBER);
    expect(status).toBe(201);
    expect(await messages(body.lead_id)).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('switched off: nothing is queued or sent', async () => {
    delete process.env.META_FOLLOW_UP_SMS_ENABLED;
    const { body } = await ingest('l:fu-off', TEST_NUMBER);
    expect(await messages(body.lead_id)).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a retried Meta delivery never queues a second text', async () => {
    const first = await ingest('l:fu-retry', TEST_NUMBER);
    const retry = await ingest('l:fu-retry', TEST_NUMBER);
    expect(retry.body.duplicate).toBe(true);
    expect(await messages(first.body.lead_id)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('send-time test-mode check blocks a row for a real number even if one somehow exists', async () => {
    const leadId = await insertPendingLead(REAL_NUMBER);
    await pgClient.query(
      `INSERT INTO lead_sms_messages (lead_id, purpose, message_ref, phone_e164, link_nonce, created_by) VALUES ($1, 'META_FOLLOW_UP', 'FU-BLOCK', $2, 'n', 't')`,
      [leadId, REAL_NUMBER]
    );
    const summary = await sendPendingFollowUpSms(db, { leadId });
    expect(summary.blocked).toBe(1);
    const [msg] = await messages(leadId);
    expect(msg.status).toBe('BLOCKED_TEST_MODE');
    expect(msg.link_nonce).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reissue: old link stops working, its unsent text is cancelled, a new one is queued', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 502, json: async () => ({}) }));
    const { body } = await ingest('l:fu-reissue', TEST_NUMBER);
    const [first] = await messages(body.lead_id);
    expect(first.status).toBe('PENDING_SEND'); // first attempt failed, still retryable
    expect(first.link_nonce).not.toBeNull();

    const result = await reissueFollowUpLink(db, { leadId: body.lead_id, actor: 'admin@halostrategic.com', queueSms: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cancelledMessages).toBe(1);
    expect(result.sms.queued).toBe(true);

    const lead = (await pgClient.query(`SELECT follow_up_token_hash FROM leads WHERE id = $1`, [body.lead_id])).rows[0];
    const oldToken = new URL(body.follow_up_url).searchParams.get('token')!;
    const newToken = new URL(result.followUpUrl).searchParams.get('token')!;
    expect(lead.follow_up_token_hash).toBe(hashFollowUpToken(newToken));
    expect(lead.follow_up_token_hash).not.toBe(hashFollowUpToken(oldToken));

    const rows = await messages(body.lead_id);
    expect(rows.map((r: { status: string }) => r.status)).toEqual(['CANCELLED', 'PENDING_SEND']);
    expect(rows[0].link_nonce).toBeNull();

    const audit = (await pgClient.query(`SELECT actor, new_state FROM audit_log WHERE action = 'META_FOLLOW_UP_LINK_REISSUED' AND entity_id = $1`, [body.lead_id])).rows[0];
    expect(audit.actor).toBe('admin@halostrategic.com');
    expect(JSON.stringify(audit.new_state)).not.toContain(newToken);
  });

  it('reissue refuses a lead that is no longer awaiting qualification', async () => {
    const leadId = await insertPendingLead(TEST_NUMBER);
    await pgClient.query(`UPDATE leads SET status = 'NEW' WHERE id = $1`, [leadId]);
    await expect(reissueFollowUpLink(db, { leadId, actor: 'a', queueSms: true })).resolves.toEqual({ ok: false, reason: 'NOT_AWAITING_QUALIFICATION' });
  });

  it('a link already used (homeowner completed) is cancelled, never sent', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 502, json: async () => ({}) }));
    const { body } = await ingest('l:fu-completed', TEST_NUMBER);
    await pgClient.query(`UPDATE leads SET follow_up_token_used_at = now() WHERE id = $1`, [body.lead_id]);
    fetchMock.mockClear();
    const summary = await sendPendingFollowUpSms(db, { leadId: body.lead_id });
    expect(summary.cancelled).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await messages(body.lead_id))[0].status).toBe('CANCELLED');
  });

  it('retries up to 3 attempts, then fails for good and wipes the nonce', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const { body } = await ingest('l:fu-fail', TEST_NUMBER);
    await sendPendingFollowUpSms(db, { leadId: body.lead_id });
    await sendPendingFollowUpSms(db, { leadId: body.lead_id });
    const [msg] = await messages(body.lead_id);
    expect(msg.attempt_count).toBe(3);
    expect(msg.status).toBe('FAILED');
    expect(msg.link_nonce).toBeNull();
    await sendPendingFollowUpSms(db, { leadId: body.lead_id });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('STOP: suppressed numbers are never queued, and waiting texts are closed', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 502, json: async () => ({}) }));
    const { body } = await ingest('l:fu-stop', TEST_NUMBER);
    await pgClient.query(`INSERT INTO sms_suppressions (phone_e164, reason, source) VALUES ($1, 'STOP', 'inbound_reply')`, [TEST_NUMBER]);
    expect(await suppressOpenFollowUps(db, '07700 900123')).toBe(1);
    const [msg] = await messages(body.lead_id);
    expect(msg.status).toBe('SUPPRESSED');
    expect(msg.link_nonce).toBeNull();

    const leadId = await insertPendingLead(TEST_NUMBER);
    await expect(queueFollowUpSms(sqlFromClient(pgClient), { leadId, mobile: TEST_NUMBER, linkNonce: 'n', createdBy: 't' }))
      .resolves.toEqual({ queued: false, reason: 'SUPPRESSED' });
  });

  it('caps texts per number at 2 in 24 hours', async () => {
    const sql = sqlFromClient(pgClient);
    const results = [];
    for (let i = 0; i < 3; i++) {
      const leadId = await insertPendingLead(TEST_NUMBER);
      results.push(await queueFollowUpSms(sql, { leadId, mobile: TEST_NUMBER, linkNonce: `n${i}`, createdBy: 't' }));
    }
    expect(results.map((r) => r.queued)).toEqual([true, true, false]);
    expect(results[2]).toEqual({ queued: false, reason: 'NUMBER_CAPPED' });
  });

  it('delivery receipts move SENT to DELIVERED only', async () => {
    const { body } = await ingest('l:fu-delivery', TEST_NUMBER);
    const [msg] = await messages(body.lead_id);
    expect(await recordFollowUpDelivery(db, { providerMessageId: msg.provider_message_id, delivered: true })).toBe(1);
    expect(await recordFollowUpDelivery(db, { providerMessageId: msg.provider_message_id, delivered: false })).toBe(0);
    expect((await messages(body.lead_id))[0].status).toBe('DELIVERED');
  });

  it('the database itself refuses a nonce outside a sendable state, and a second open text per lead', async () => {
    const leadId = await insertPendingLead(TEST_NUMBER);
    await expect(pgClient.query(
      `INSERT INTO lead_sms_messages (lead_id, purpose, message_ref, phone_e164, link_nonce, status, created_by) VALUES ($1, 'META_FOLLOW_UP', 'FU-C1', $2, 'n', 'SENT', 't')`,
      [leadId, TEST_NUMBER]
    )).rejects.toThrow(/check constraint/);
    await expect(pgClient.query(
      `INSERT INTO lead_sms_messages (lead_id, purpose, message_ref, phone_e164, link_nonce, status, created_by) VALUES ($1, 'META_FOLLOW_UP', 'FU-C2', $2, NULL, 'PENDING_SEND', 't')`,
      [leadId, TEST_NUMBER]
    )).rejects.toThrow(/check constraint/);
    await pgClient.query(
      `INSERT INTO lead_sms_messages (lead_id, purpose, message_ref, phone_e164, link_nonce, created_by) VALUES ($1, 'META_FOLLOW_UP', 'FU-C3', $2, 'n', 't')`,
      [leadId, TEST_NUMBER]
    );
    await expect(pgClient.query(
      `INSERT INTO lead_sms_messages (lead_id, purpose, message_ref, phone_e164, link_nonce, created_by) VALUES ($1, 'META_FOLLOW_UP', 'FU-C4', $2, 'n2', 't')`,
      [leadId, TEST_NUMBER]
    )).rejects.toThrow(/uq_lead_sms_messages_open/);
  });
});
