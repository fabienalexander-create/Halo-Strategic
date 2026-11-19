import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleInboundReply, queueMetaFollowUp, recordDelivery, type SqlDb } from './smsVerification';
import { hashFollowUpToken } from './metaFollowUpToken';

// Homeowner SMS stage 2 (Fabien, 2026-11-19), end to end through the real scheduled function
// (netlify/functions/sms-send-pending.mts, body in lib/smsScheduledSend.ts) on a real, fully migrated Postgres. One overnight Meta
// lead: held at night, sent at 08:00, a hand-off that timed out retried with the SAME link,
// delivered, then STOP. Switches are turned on inside this test process only. No real SMS: Make
// is a stubbed fetch and the webhook URL is .invalid.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@netlify/database', () => ({ getDatabase: () => holder.db }));

const TOKEN_RE = /complete\?token=([A-Za-z0-9_-]{43})/;
const LONDON = (iso: string) => new Date(iso); // November: London is UTC+0

describe.skipIf(!adminUrl)('SMS stage 2: scheduled sender, end to end (real Postgres)', () => {
  const dbName = `lx_test_${Date.now()}_sms2`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, pool: any;
  let sprayFoamId: number;
  const q = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
  const make = vi.fn();

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client, Pool } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    pool = new Pool({ connectionString: url.toString(), max: 4 });
    pool.on('error', () => undefined);
    const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) await pool.query(readFileSync(join(dir, f), 'utf8'));
    await pool.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('spray_foam_removal','Spray Foam Removal',true) ON CONFLICT (slug) DO NOTHING`);
    sprayFoamId = (await q(`SELECT id FROM industries WHERE slug='spray_foam_removal'`))[0].id;
    const db: SqlDb = {
      sql: async (strings, ...values) => {
        let text = '';
        strings.forEach((s, i) => { text += s + (i < values.length ? `$${i + 1}` : ''); });
        return (await pool.query(text, values)).rows;
      },
    };
    holder.db = db;
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  beforeEach(() => {
    process.env.SMS_VERIFICATION_ENABLED = 'true';
    process.env.META_FOLLOW_UP_SMS_ENABLED = 'true';
    process.env.MAKE_SMS_OUT_WEBHOOK_URL = 'https://hook.invalid/sms-out';
    process.env.MAKE_SMS_OUT_SECRET = 'make-secret';
    process.env.SMS_LINK_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    make.mockReset();
    vi.stubGlobal('fetch', make);
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    for (const k of ['SMS_VERIFICATION_ENABLED', 'META_FOLLOW_UP_SMS_ENABLED', 'MAKE_SMS_OUT_WEBHOOK_URL', 'MAKE_SMS_OUT_SECRET', 'SMS_LINK_ENCRYPTION_KEY']) delete process.env[k];
  });

  async function runSchedulerAt(iso: string) {
    vi.setSystemTime(LONDON(iso));
    const { runScheduledSmsSend: handler } = await import('./smsScheduledSend');
    return (await handler()).json();
  }
  async function newMetaLead(mobile: string) {
    const lead = (await q(
      `INSERT INTO leads (industry_id, homeowner_name, status, follow_up_token_hash, follow_up_token_expires_at)
       VALUES ($1, 'T', 'QUALIFICATION_PENDING', $2, now() + interval '30 days') RETURNING id`,
      [sprayFoamId, hashFollowUpToken(randomBytes(32).toString('base64url'))]
    ))[0].id as number;
    const queued = await queueMetaFollowUp(holder.db as SqlDb, { leadId: lead, mobile, industrySlug: 'spray_foam_removal' });
    return { lead, queued };
  }
  const text = async (id: number) => (await q(`SELECT * FROM lead_phone_verifications WHERE id=$1`, [id]))[0];

  it('an overnight lead: held at night, sent once from 08:00, retried with the same link, delivered, then STOP', async () => {
    const mobile = '07700 811111';
    const { lead, queued } = await newMetaLead(mobile);
    if (!queued.queued) throw new Error(`setup: ${queued.reason}`);
    const id = queued.verificationId;

    // 21:30 to 07:45: quiet hours. The scheduler runs, but nothing is handed to Make.
    for (const t of ['2026-11-19T21:30:00Z', '2026-11-20T03:00:00Z', '2026-11-20T07:45:00Z']) {
      const summary = await runSchedulerAt(t);
      expect(summary.claimed).toBe(0);
    }
    expect(make).not.toHaveBeenCalled();
    expect((await text(id)).status).toBe('PENDING_SEND');

    // 08:00: first attempt. Make received it but the reply was lost.
    make.mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
    await runSchedulerAt('2026-11-20T08:00:00Z');
    expect(make).toHaveBeenCalledTimes(1);
    const firstLink = TOKEN_RE.exec(JSON.parse(make.mock.calls[0][1].body).text)![1];

    expect((await text(id))).toMatchObject({ status: 'PENDING_SEND', attempt_count: 1 });

    // 08:15: the next run retries.
    make.mockResolvedValueOnce(new Response(JSON.stringify({ message_id: 'tm-ok-1' }), { status: 200 }));
    await runSchedulerAt('2026-11-20T08:15:00Z');
    expect(make).toHaveBeenCalledTimes(2);
    const secondLink = TOKEN_RE.exec(JSON.parse(make.mock.calls[1][1].body).text)![1];
    expect(secondLink).toBe(firstLink); // one stable link per text
    expect((await text(id))).toMatchObject({ status: 'SENT', follow_up_token_enc: null });
    expect((await q(`SELECT follow_up_token_hash h FROM leads WHERE id=$1`, [lead]))[0].h).toBe(hashFollowUpToken(firstLink));

    // Later runs never resend a sent text.
    await runSchedulerAt('2026-11-20T09:00:00Z');
    expect(make).toHaveBeenCalledTimes(2);

    // Delivery receipt, then the homeowner replies STOP.
    expect(await recordDelivery(holder.db as SqlDb, { providerMessageId: 'tm-ok-1', delivered: true })).toBe(1);
    expect((await text(id)).status).toBe('DELIVERED');
    const stop = await handleInboundReply(holder.db as SqlDb, { from: '+447700811111', text: 'STOP', messageId: 'in-1' });
    expect(stop.outcome).toMatch(/STOP/);
    expect((await q(`SELECT count(*)::int n FROM sms_suppressions WHERE phone_e164='+447700811111'`))[0].n).toBe(1);

    // A new Meta lead from the same number is never texted.
    const again = await newMetaLead(mobile);
    expect(again.queued.queued).toBe(false);
    await runSchedulerAt('2026-11-21T10:00:00Z');
    expect(make).toHaveBeenCalledTimes(2);
  });

  it('with the master switch off, the scheduler sends nothing even with texts queued and daylight', async () => {
    const { queued } = await newMetaLead('07700 822222');
    if (!queued.queued) throw new Error('setup');
    delete process.env.SMS_VERIFICATION_ENABLED;

    expect(await runSchedulerAt('2026-11-20T12:00:00Z')).toEqual({ skipped: 'NOT_ENABLED' });
    expect(make).not.toHaveBeenCalled();
    expect((await text(queued.verificationId)).status).toBe('PENDING_SEND');
  });

  it('with only the follow-up switch off, queued follow-ups stay held', async () => {
    const { queued } = await newMetaLead('07700 833333');
    if (!queued.queued) throw new Error('setup');
    delete process.env.META_FOLLOW_UP_SMS_ENABLED;

    await runSchedulerAt('2026-11-20T12:00:00Z');
    expect(make).not.toHaveBeenCalled();
    expect((await text(queued.verificationId)).status).toBe('PENDING_SEND');
  });

  it('two overlapping scheduler runs hand a text to Make exactly once', async () => {
    const { queued } = await newMetaLead('07700 855555');
    if (!queued.queued) throw new Error('setup');
    make.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return new Response(JSON.stringify({ message_id: `tm-${randomBytes(4).toString('hex')}` }), { status: 200 });
    });
    vi.setSystemTime(LONDON('2026-11-20T12:00:00Z'));
    const { runScheduledSmsSend: handler } = await import('./smsScheduledSend');

    await Promise.all([handler(), handler(), handler()]);

    const toThisNumber = make.mock.calls.filter((c) => JSON.parse(c[1].body).to === '+447700855555');
    expect(toThisNumber).toHaveLength(1);
    expect((await text(queued.verificationId)).status).toBe('SENT');
  });

  it('enforces the per-number cap across scheduled runs: a third text in 24 hours is never queued', async () => {
    const mobile = '07700 844444';
    expect((await newMetaLead(mobile)).queued.queued).toBe(true);
    expect((await newMetaLead(mobile)).queued.queued).toBe(true);
    const third = await newMetaLead(mobile);
    expect(third.queued).toMatchObject({ queued: false });
  });
});
