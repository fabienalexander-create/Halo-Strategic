import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createHmac, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  META_FOLLOW_UP_SEND_WINDOW_HOURS, SMS_NOTICE_VERSIONS, handleInboundReply, metaFollowUpSmsText, queueMetaFollowUp,
  queueVerification, recordDelivery, smsSegmentInfo, type SqlDb,
} from './smsVerification';
import { sendPendingVerifications } from './smsSender';
import { hashFollowUpToken } from './metaFollowUpToken';

// Real-Postgres tests for the Meta follow-up text (Fabien, 2026-11-19, stage 1). Skipped unless
// TEST_PG_ADMIN_URL is set; refuses any non-local host; uses a throwaway database. No network and
// no real messages: Make is always a mocked fetch.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pool: any;
const db: SqlDb = {
  sql: async (strings, ...values) => {
    let text = '';
    strings.forEach((s, i) => { text += s + (i < values.length ? `$${i + 1}` : ''); });
    return (await pool.query(text, values)).rows;
  },
};

const DAYTIME = new Date('2026-11-19T12:00:00Z'); // 12:00 GMT
const NIGHT = new Date('2026-11-19T03:00:00Z'); // 03:00 GMT
const SOLAR_CV = 'test-followup-solar-v1';
const LINK_KEY = randomBytes(32).toString('base64');
const covered = SMS_NOTICE_VERSIONS as Set<string>;

describe.skipIf(!adminUrl)('Meta follow-up SMS (real Postgres)', () => {
  const dbName = `lx_test_${Date.now()}_smsfu`;
  const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let sprayFoamId: number;
  let solarId: number;
  let phoneSeq = 0;
  const newPhone = () => `07700 8${String(10000 + ++phoneSeq).padStart(5, '0')}`;
  const e164 = (p: string) => '+44' + p.replace(/\s/g, '').slice(1);
  const q = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;

  async function newMetaLead(): Promise<number> {
    const rows = await q(
      `INSERT INTO leads (industry_id, homeowner_name, status, follow_up_token_hash, follow_up_token_expires_at)
       VALUES ($1, 'T', 'QUALIFICATION_PENDING', $2, now() + interval '30 days') RETURNING id`,
      [sprayFoamId, hashFollowUpToken(randomBytes(32).toString('base64url'))]
    );
    return rows[0].id;
  }
  async function queueFollowUp(mobile: string, leadId?: number, industrySlug = 'spray_foam_removal') {
    return queueMetaFollowUp(db, { leadId: leadId ?? (await newMetaLead()), mobile, industrySlug });
  }
  const row = async (id: number) => (await q(`SELECT * FROM lead_phone_verifications WHERE id=$1`, [id]))[0];
  const okMake = () => vi.fn().mockImplementation(async () => new Response(JSON.stringify({ message_id: `tm-${randomBytes(4).toString('hex')}` }), { status: 200 }));
  const TOKEN_RE = /https:\/\/halostrategic\.com\/leads-exchange\/spray-foam-removal\/complete\?token=([A-Za-z0-9_-]{43})/;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sentToken = (call: any[]) => TOKEN_RE.exec(JSON.parse(call[1].body).text)![1];
  // Exactly the condition app/api/homeowner-enquiries/complete/route.ts uses to accept a link.
  const linkWorks = async (rawToken: string) => (await q(
    `SELECT id FROM leads WHERE follow_up_token_hash = $1 AND follow_up_token_used_at IS NULL AND follow_up_token_expires_at > now()`,
    [hashFollowUpToken(rawToken)]
  )).length === 1;
  // A hand-off that reaches TextMagic (the homeowner gets the text) but whose reply never comes back.
  const deliveredThenTimedOut = () => vi.fn().mockImplementation(async () => {
    throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  });

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client, Pool } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    pool = new Pool({ connectionString: url.toString(), max: 4 });
    pool.on('error', () => { /* server-side termination at teardown is expected */ });
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) await pool.query(readFileSync(join(dir, f), 'utf8'));
    for (const [slug, name] of [['spray_foam_removal', 'Spray Foam Removal'], ['solar_battery', 'Solar']]) {
      await pool.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ($1,$2,true) ON CONFLICT (slug) DO NOTHING`, [slug, name]);
    }
    sprayFoamId = (await q(`SELECT id FROM industries WHERE slug='spray_foam_removal'`))[0].id;
    solarId = (await q(`SELECT id FROM industries WHERE slug='solar_battery'`))[0].id;
  });

  afterAll(async () => {
    covered.delete(SOLAR_CV);
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
    process.env.SMS_LINK_ENCRYPTION_KEY = LINK_KEY;
    delete process.env.SMS_HOURLY_LIMIT;
    covered.add(SOLAR_CV);
  });

  // ---- Queueing -------------------------------------------------------------------------------

  it('queues nothing unless both switches are on, and only for spray foam', async () => {
    delete process.env.META_FOLLOW_UP_SMS_ENABLED;
    expect(await queueFollowUp(newPhone())).toEqual({ queued: false, reason: 'NOT_ENABLED' });
    process.env.META_FOLLOW_UP_SMS_ENABLED = 'true';
    process.env.SMS_VERIFICATION_ENABLED = 'false';
    expect(await queueFollowUp(newPhone())).toEqual({ queued: false, reason: 'NOT_ENABLED' });
    process.env.SMS_VERIFICATION_ENABLED = 'true';
    expect(await queueFollowUp(newPhone(), undefined, 'solar_battery')).toEqual({ queued: false, reason: 'INDUSTRY_NOT_ELIGIBLE' });
    expect((await q(`SELECT count(*)::int n FROM lead_phone_verifications`))[0].n).toBe(0);
  });

  it('queues a META_FOLLOW_UP row that expires after the send window, with a reference-only audit entry', async () => {
    const phone = newPhone();
    const r = await queueFollowUp(phone);
    if (!r.queued) throw new Error('setup');
    const v = await row(r.verificationId);
    expect(v).toMatchObject({ purpose: 'META_FOLLOW_UP', status: 'PENDING_SEND', phone_e164: e164(phone), attempt_count: 0 });
    const hours = (new Date(v.expires_at).getTime() - new Date(v.created_at).getTime()) / 3_600_000;
    expect(hours).toBeCloseTo(META_FOLLOW_UP_SEND_WINDOW_HOURS, 1);
    const audit = await q(`SELECT new_state FROM audit_log WHERE action='SMS_META_FOLLOW_UP_QUEUED' AND entity_id=$1`, [r.verificationId]);
    expect(audit[0].new_state).toEqual({ reference: r.reference });
    expect(JSON.stringify(audit)).not.toContain(e164(phone).slice(3));
  });

  it('records an invalid number without queueing a text', async () => {
    const lead = await newMetaLead();
    expect(await queueFollowUp('020 7946 0958', lead)).toEqual({ queued: false, reason: 'INVALID_NUMBER' });
    const rows = await q(`SELECT status, purpose, phone_e164 FROM lead_phone_verifications WHERE lead_id=$1`, [lead]);
    expect(rows).toEqual([{ status: 'FAILED_INVALID_NUMBER', purpose: 'META_FOLLOW_UP', phone_e164: null }]);
  });

  it('allows one open text per lead, so a duplicate queue attempt is refused', async () => {
    const lead = await newMetaLead();
    expect((await queueFollowUp(newPhone(), lead)).queued).toBe(true);
    expect(await queueFollowUp(newPhone(), lead)).toEqual({ queued: false, reason: 'ALREADY_OPEN' });
  });

  it('shares the per-number daily cap with phone verification texts', async () => {
    const phone = newPhone();
    expect((await queueFollowUp(phone)).queued).toBe(true);
    const solarLead = (await q(`INSERT INTO leads (industry_id, homeowner_name) VALUES ($1,'S') RETURNING id`, [solarId]))[0].id;
    expect((await queueVerification(db, { leadId: solarLead, mobile: phone, noticeVersion: SOLAR_CV })).queued).toBe(true);
    expect(await queueFollowUp(phone)).toEqual({ queued: false, reason: 'NUMBER_CAPPED' });
  });

  it('respects the global hourly circuit breaker', async () => {
    expect((await queueFollowUp(newPhone())).queued).toBe(true);
    const n = (await q(`SELECT count(*)::int n FROM lead_phone_verifications WHERE created_at > now() - interval '1 hour'`))[0].n;
    process.env.SMS_HOURLY_LIMIT = String(n);
    expect(await queueFollowUp(newPhone())).toEqual({ queued: false, reason: 'CIRCUIT_BREAKER' });
  });

  // ---- Replies --------------------------------------------------------------------------------

  it('never queues for a number that replied STOP, and STOP closes an open follow-up', async () => {
    const phone = newPhone();
    const r = await queueFollowUp(phone);
    if (!r.queued) throw new Error('setup');
    await q(`UPDATE lead_phone_verifications SET status='SENT' WHERE id=$1`, [r.verificationId]);
    expect(await handleInboundReply(db, { from: e164(phone), text: 'STOP', messageId: `in-${r.reference}` })).toEqual({ outcome: 'STOPPED' });
    expect((await row(r.verificationId)).status).toBe('SUPPRESSED');
    expect(await queueFollowUp(phone)).toEqual({ queued: false, reason: 'SUPPRESSED' });
  });

  it('a YES reply can never verify a follow-up text, with or without its reference', async () => {
    const phone = newPhone();
    const r = await queueFollowUp(phone);
    if (!r.queued) throw new Error('setup');
    await q(`UPDATE lead_phone_verifications SET status='SENT' WHERE id=$1`, [r.verificationId]);
    expect((await handleInboundReply(db, { from: e164(phone), text: `YES ${r.reference}`, messageId: 'yes-ref' })).outcome).toBe('NO_MATCH');
    expect((await handleInboundReply(db, { from: e164(phone), text: 'yes', messageId: 'yes-bare' })).outcome).toBe('NO_MATCH');
    const v = await row(r.verificationId);
    expect(v.status).toBe('SENT');
    expect(v.verified_at).toBeNull();
  });

  it('an open follow-up does not make a bare YES to a real verification ambiguous', async () => {
    const phone = newPhone();
    const fu = await queueFollowUp(phone);
    const solarLead = (await q(`INSERT INTO leads (industry_id, homeowner_name) VALUES ($1,'S') RETURNING id`, [solarId]))[0].id;
    const ver = await queueVerification(db, { leadId: solarLead, mobile: phone, noticeVersion: SOLAR_CV });
    if (!fu.queued || !ver.queued) throw new Error('setup');
    await q(`UPDATE lead_phone_verifications SET status='SENT' WHERE id = ANY($1)`, [[fu.verificationId, ver.verificationId]]);
    expect(await handleInboundReply(db, { from: e164(phone), text: 'YES', messageId: 'yes-solar' })).toEqual({ outcome: 'VERIFIED', reference: ver.reference });
    expect((await row(fu.verificationId)).status).toBe('SENT');
  });

  // ---- Sending --------------------------------------------------------------------------------

  it('holds follow-ups during quiet hours and sends them in the daytime', async () => {
    const r = await queueFollowUp(newPhone());
    if (!r.queued) throw new Error('setup');
    const lead = (await row(r.verificationId)).lead_id;
    const make = okMake();
    const night = await sendPendingVerifications(db, { leadId: lead, fetchImpl: make, now: NIGHT });
    expect(night.claimed).toBe(0);
    expect(make).not.toHaveBeenCalled();
    expect((await row(r.verificationId)).status).toBe('PENDING_SEND');
    const day = await sendPendingVerifications(db, { leadId: lead, fetchImpl: make, now: DAYTIME });
    expect(day.sent).toBe(1);
    expect((await row(r.verificationId)).status).toBe('SENT');
  });

  it('sends the approved text with a freshly minted link that replaces the stored token, signed for Make', async () => {
    const phone = newPhone();
    const r = await queueFollowUp(phone);
    if (!r.queued) throw new Error('setup');
    const lead = (await row(r.verificationId)).lead_id;
    const oldHash = (await q(`SELECT follow_up_token_hash h FROM leads WHERE id=$1`, [lead]))[0].h;
    const make = okMake();
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: make, now: DAYTIME });
    expect(make).toHaveBeenCalledTimes(1);
    const [url, init] = make.mock.calls[0];
    expect(url).toBe('https://hook.invalid/sms-out');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ verification_ref: r.reference, to: e164(phone), purpose: 'META_FOLLOW_UP' });

    const link = /https:\/\/halostrategic\.com\/leads-exchange\/spray-foam-removal\/complete\?token=([A-Za-z0-9_-]{43})/.exec(body.text);
    expect(link).not.toBeNull();
    expect(body.text).toBe(metaFollowUpSmsText(link![0]));
    expect(smsSegmentInfo(body.text)).toMatchObject({ encoding: 'GSM-7', segments: 2 });

    const newHash = (await q(`SELECT follow_up_token_hash h FROM leads WHERE id=$1`, [lead]))[0].h;
    expect(newHash).toBe(hashFollowUpToken(link![1]));
    expect(newHash).not.toBe(oldHash);
    expect(await linkWorks(link![1])).toBe(true);
    // Once sent, the encrypted copy is wiped: nothing readable or decryptable is left behind.
    expect((await row(r.verificationId)).follow_up_token_enc).toBeNull();
    expect(JSON.stringify(await q(`SELECT * FROM lead_phone_verifications WHERE id=$1`, [r.verificationId]))).not.toContain(link![1]);

    const expected = createHmac('sha256', 'make-secret').update(`${init.headers['x-halo-timestamp']}.${init.body}`).digest('hex');
    expect(init.headers['x-halo-signature']).toBe(expected);
  });

  it('turning the follow-up switch off stops already-queued texts from sending', async () => {
    const r = await queueFollowUp(newPhone());
    if (!r.queued) throw new Error('setup');
    const lead = (await row(r.verificationId)).lead_id;
    delete process.env.META_FOLLOW_UP_SMS_ENABLED;
    const make = okMake();
    expect((await sendPendingVerifications(db, { leadId: lead, fetchImpl: make, now: DAYTIME })).claimed).toBe(0);
    expect(make).not.toHaveBeenCalled();
    expect((await row(r.verificationId)).status).toBe('PENDING_SEND');
  });

  it('closes the text as SUPERSEDED without sending when the link was already used or the lead moved on', async () => {
    const make = okMake();
    for (const change of [
      `UPDATE leads SET follow_up_token_used_at = now() WHERE id = $1`,
      `UPDATE leads SET status = 'QUALIFIED' WHERE id = $1`,
      `UPDATE leads SET follow_up_token_hash = NULL WHERE id = $1`,
    ]) {
      const r = await queueFollowUp(newPhone());
      if (!r.queued) throw new Error('setup');
      const lead = (await row(r.verificationId)).lead_id;
      await q(change, [lead]);
      const s = await sendPendingVerifications(db, { leadId: lead, fetchImpl: make, now: DAYTIME });
      expect(s).toMatchObject({ claimed: 1, superseded: 1, sent: 0 });
      expect((await row(r.verificationId)).status).toBe('SUPERSEDED');
    }
    expect(make).not.toHaveBeenCalled();
  });

  it('retries a failed hand-off with the SAME link every time, and marks it FAILED after three attempts', async () => {
    const r = await queueFollowUp(newPhone());
    if (!r.queued) throw new Error('setup');
    const lead = (await row(r.verificationId)).lead_id;
    const failing = vi.fn().mockResolvedValue(new Response('no', { status: 500 }));
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: failing, now: DAYTIME });
    expect((await row(r.verificationId))).toMatchObject({ status: 'PENDING_SEND', attempt_count: 1 });
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: failing, now: DAYTIME });
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: failing, now: DAYTIME });
    expect((await row(r.verificationId))).toMatchObject({ status: 'FAILED', attempt_count: 3, follow_up_token_enc: null });
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: failing, now: DAYTIME });
    expect(failing).toHaveBeenCalledTimes(3);
    const tokens = failing.mock.calls.map(sentToken);
    expect(new Set(tokens).size).toBe(1);
    expect(await linkWorks(tokens[0])).toBe(true);
  });

  it('a text delivered whose confirmation timed out keeps a working link: the retry resends the SAME link', async () => {
    const r = await queueFollowUp(newPhone());
    if (!r.queued) throw new Error('setup');
    const lead = (await row(r.verificationId)).lead_id;

    // Attempt 1: TextMagic delivers it, the homeowner has it, but HLX never hears back.
    const timedOut = deliveredThenTimedOut();
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: timedOut, now: DAYTIME });
    const tokenInHomeownersText = sentToken(timedOut.mock.calls[0]);
    const pending = await row(r.verificationId);
    expect(pending).toMatchObject({ status: 'PENDING_SEND', attempt_count: 1, error_message: 'TimeoutError' });
    expect(await linkWorks(tokenInHomeownersText)).toBe(true);

    // Held for the retry: encrypted, never the raw token or its hash.
    expect(pending.follow_up_token_enc).toMatch(/^v1\./);
    expect(pending.follow_up_token_enc).not.toContain(tokenInHomeownersText);
    expect(pending.follow_up_token_enc).not.toContain(hashFollowUpToken(tokenInHomeownersText));

    // Attempt 2 succeeds and carries the very same link.
    const make = okMake();
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: make, now: DAYTIME });
    expect(sentToken(make.mock.calls[0])).toBe(tokenInHomeownersText);
    expect(JSON.parse(make.mock.calls[0][1].body).text).toBe(JSON.parse(timedOut.mock.calls[0][1].body).text);

    // The link in the FIRST text still works, and the expiry was not pushed out by the retry.
    expect(await linkWorks(tokenInHomeownersText)).toBe(true);
    const after = await row(r.verificationId);
    expect(after).toMatchObject({ status: 'SENT', attempt_count: 2, follow_up_token_enc: null });
  });

  it('a retry never pushes the link expiry out: it stays as set on the first attempt', async () => {
    const r = await queueFollowUp(newPhone());
    if (!r.queued) throw new Error('setup');
    const lead = (await row(r.verificationId)).lead_id;
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: deliveredThenTimedOut(), now: DAYTIME });
    const firstExpiry = (await q(`SELECT follow_up_token_expires_at e FROM leads WHERE id=$1`, [lead]))[0].e;
    await new Promise((res) => setTimeout(res, 20));
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: okMake(), now: DAYTIME });
    expect((await q(`SELECT follow_up_token_expires_at e FROM leads WHERE id=$1`, [lead]))[0].e).toEqual(firstExpiry);
  });

  it('does not resend once the homeowner has used the link between attempts', async () => {
    const r = await queueFollowUp(newPhone());
    if (!r.queued) throw new Error('setup');
    const lead = (await row(r.verificationId)).lead_id;
    const timedOut = deliveredThenTimedOut();
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: timedOut, now: DAYTIME });
    // The homeowner taps the link from the text they did receive and completes the journey.
    await q(`UPDATE leads SET follow_up_token_used_at = now() WHERE follow_up_token_hash = $1`, [hashFollowUpToken(sentToken(timedOut.mock.calls[0]))]);
    const make = okMake();
    const s = await sendPendingVerifications(db, { leadId: lead, fetchImpl: make, now: DAYTIME });
    expect(s).toMatchObject({ superseded: 1, sent: 0 });
    expect(make).not.toHaveBeenCalled();
    expect(await row(r.verificationId)).toMatchObject({ status: 'SUPERSEDED', follow_up_token_enc: null });
  });

  it('fails closed on a stored link that cannot be decrypted: tampered, or copied from another text', async () => {
    const make = okMake();
    const holdForRetry = async () => {
      const r = await queueFollowUp(newPhone());
      if (!r.queued) throw new Error('setup');
      const lead = (await row(r.verificationId)).lead_id;
      await sendPendingVerifications(db, { leadId: lead, fetchImpl: deliveredThenTimedOut(), now: DAYTIME });
      return { id: r.verificationId, lead, enc: (await row(r.verificationId)).follow_up_token_enc as string };
    };
    const a = await holdForRetry();
    const b = await holdForRetry();

    const parts = a.enc.split('.');
    parts[3] = parts[3].slice(0, 5) + (parts[3][5] === 'A' ? 'B' : 'A') + parts[3].slice(6);
    const tampered = parts.join('.');
    expect(tampered).not.toBe(a.enc);
    await q(`UPDATE lead_phone_verifications SET follow_up_token_enc = $1 WHERE id = $2`, [tampered, a.id]);
    await q(`UPDATE lead_phone_verifications SET follow_up_token_enc = $1 WHERE id = $2`, [a.enc, b.id]); // a's value on b's row

    for (const t of [a, b]) {
      await sendPendingVerifications(db, { leadId: t.lead, fetchImpl: make, now: DAYTIME });
      expect(await row(t.id)).toMatchObject({ status: 'FAILED', error_message: 'LINK_UNREADABLE', follow_up_token_enc: null });
    }
    expect(make).not.toHaveBeenCalled();
  });

  it('holds follow-ups (does not fail them) while the link encryption key is missing or invalid', async () => {
    for (const bad of [undefined, 'too-short', Buffer.alloc(16).toString('base64')]) {
      const r = await queueFollowUp(newPhone());
      if (!r.queued) throw new Error('setup');
      const lead = (await row(r.verificationId)).lead_id;
      if (bad === undefined) delete process.env.SMS_LINK_ENCRYPTION_KEY; else process.env.SMS_LINK_ENCRYPTION_KEY = bad;
      const make = okMake();
      expect((await sendPendingVerifications(db, { leadId: lead, fetchImpl: make, now: DAYTIME })).claimed).toBe(0);
      expect(make).not.toHaveBeenCalled();
      expect((await row(r.verificationId)).status).toBe('PENDING_SEND');
      process.env.SMS_LINK_ENCRYPTION_KEY = LINK_KEY;
    }
  });

  it('STOP while a retry is pending closes the text and wipes the held link', async () => {
    const phone = newPhone();
    const r = await queueFollowUp(phone);
    if (!r.queued) throw new Error('setup');
    const lead = (await row(r.verificationId)).lead_id;
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: deliveredThenTimedOut(), now: DAYTIME });
    expect((await row(r.verificationId)).follow_up_token_enc).not.toBeNull();
    await handleInboundReply(db, { from: e164(phone), text: 'STOP', messageId: `stop-${r.reference}` });
    expect(await row(r.verificationId)).toMatchObject({ status: 'SUPPRESSED', follow_up_token_enc: null });
  });

  it('expires a follow-up that was not sent within its window instead of sending it late', async () => {
    const r = await queueFollowUp(newPhone());
    if (!r.queued) throw new Error('setup');
    const lead = (await row(r.verificationId)).lead_id;
    await q(`UPDATE lead_phone_verifications SET expires_at = now() - interval '1 minute' WHERE id=$1`, [r.verificationId]);
    const make = okMake();
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: make, now: DAYTIME });
    expect((await row(r.verificationId)).status).toBe('EXPIRED');
    expect(make).not.toHaveBeenCalled();
  });

  it('records delivery receipts for follow-up texts', async () => {
    const r = await queueFollowUp(newPhone());
    if (!r.queued) throw new Error('setup');
    const lead = (await row(r.verificationId)).lead_id;
    await sendPendingVerifications(db, { leadId: lead, fetchImpl: okMake(), now: DAYTIME });
    const pm = (await row(r.verificationId)).provider_message_id;
    expect(await recordDelivery(db, { providerMessageId: pm, delivered: true })).toBe(1);
    expect((await row(r.verificationId)).status).toBe('DELIVERED');
  });

  it('leaves Solar & Battery verification unchanged: it still sends at night, with no purpose filter applied', async () => {
    const solarLead = (await q(`INSERT INTO leads (industry_id, homeowner_name) VALUES ($1,'S') RETURNING id`, [solarId]))[0].id;
    const r = await queueVerification(db, { leadId: solarLead, mobile: newPhone(), noticeVersion: SOLAR_CV });
    if (!r.queued) throw new Error('setup');
    expect((await row(r.verificationId)).purpose).toBe('PHONE_VERIFICATION');
    delete process.env.META_FOLLOW_UP_SMS_ENABLED;
    const make = okMake();
    expect((await sendPendingVerifications(db, { leadId: solarLead, fetchImpl: make, now: NIGHT })).sent).toBe(1);
    expect(JSON.parse(make.mock.calls[0][1].body).text).toContain(`YES ${r.reference}`);
  });
});
