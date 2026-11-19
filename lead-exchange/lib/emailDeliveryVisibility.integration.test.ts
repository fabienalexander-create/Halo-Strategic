import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Fabien, 2026-11-19: failed-email visibility. Proves against a real, fully migrated Postgres:
// webhook events land on both buyer outboxes; retries can never duplicate a buyer notification
// (concurrent retries, unknown outcomes, already-sent rows); SUPERSEDED rows can never be sent;
// and the migration marks exactly the five historic failures superseded, nothing else.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const migrationsDir = join(__dirname, '..', 'netlify', 'database', 'migrations');
const VISIBILITY_MIGRATION = '20261119120000_email_delivery_visibility.sql';

const sendMock = vi.hoisted(() => vi.fn());
vi.mock('resend', () => ({ Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })) }));

describe.skipIf(!adminUrl)('email delivery visibility and duplicate protection (real Postgres)', () => {
  const dbName = `lx_test_${Date.now()}_emails`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, pool: any, db: any;
  let buyerId: number, allocationId: number;

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client, Pool } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    pool = new Pool({ connectionString: url.toString(), max: 8 });
    db = {
      sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
        return (await pool.query(text, values)).rows;
      },
    };

    const files = readdirSync(migrationsDir).filter((n) => n.endsWith('.sql')).sort();
    for (const f of files.filter((f) => f < VISIBILITY_MIGRATION)) await pool.query(readFileSync(join(migrationsDir, f), 'utf8'));

    // Reproduce production as it stands before this migration: rows 1-6, where 4 was retried and
    // sent once the API key existed, and 1, 2, 3, 5, 6 still FAILED from before it existed.
    await pool.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('spray_foam_removal','Spray Foam Removal',true) ON CONFLICT (slug) DO NOTHING`);
    const industryId = (await pool.query(`SELECT id FROM industries WHERE slug = 'spray_foam_removal'`)).rows[0].id;
    buyerId = (await pool.query(`
      INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status,
        agreed_price_per_lead, exclusivity_arrangement, onboarding_call_completed_at, onboarding_call_conducted_by, application_reference)
      VALUES ('Shared Buyer', 'Shared Buyer', 'buyer@example.test', '07700900000', $1, 'ACTIVE', 65, 'shared', now(), 'admin@halostrategic.com', 'HLX-BYR-TEST-1')
      RETURNING id`, [industryId])).rows[0].id;
    const types = ['APPLICATION_RECEIVED', 'ADMIN_NEW_APPLICATION', 'APPLICATION_APPROVED_FOR_COMMERCIAL_REVIEW'];
    for (let i = 1; i <= 6; i++) {
      // (buyer_id, email_type) is unique, so each historic row gets its own buyer.
      const b = i <= 3 ? buyerId : (await pool.query(`
        INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status, application_reference)
        VALUES ('Applicant ' || $2::text, 'Applicant', 'applicant' || $2::text || '@example.test', '07700900000', $1, 'PENDING_REVIEW', 'HLX-BYR-TEST-H' || $2::text)
        RETURNING id`, [industryId, i])).rows[0].id;
      const sent = i === 4;
      await pool.query(`
        INSERT INTO transactional_emails (id, buyer_id, email_type, recipient, status, error_message, attempt_count, provider_message_id)
        VALUES ($1, $2, $3, 'applicant@example.test', $4, $5, 1, $6)`,
        [i, b, types[(i - 1) % 3], sent ? 'SENT' : 'FAILED', sent ? null : 'RESEND_API_KEY is not configured', sent ? 'msg-historic-4' : null]);
    }
    await pool.query(`SELECT setval('transactional_emails_id_seq', 6)`);
    // A later failure for a different reason that must NOT be swept up by the migration.
    await pool.query(`
      INSERT INTO transactional_emails (buyer_id, email_type, recipient, status, error_message, attempt_count)
      SELECT buyer_id, 'APPLICATION_RECEIVED', 'applicant@example.test', 'FAILED', 'Invalid recipient', 1
      FROM transactional_emails WHERE id = 5`);

    const lead = (await pool.query(`
      INSERT INTO leads (industry_id, homeowner_name, homeowner_contact, postcode, status)
      VALUES ($1, 'Test Homeowner', '{"mobile":"+447700900123"}'::jsonb, 'MK15 9AA', 'NEW') RETURNING id`, [industryId])).rows[0].id;
    const conf = (await pool.query(`
      INSERT INTO homeowner_confirmations (lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response, method, confirmed_at, recorded_by, notes)
      VALUES ($1, $2, 'Shared Buyer', 'to discuss removal', 'Asked', 'Yes', 'ADMIN_AFTER_CALL', now(), 'admin@halostrategic.com', 'n') RETURNING id`, [lead, buyerId])).rows[0].id;
    allocationId = (await pool.query(`
      INSERT INTO lead_allocations (lead_id, buyer_id, allocation_type, status, agreed_price, homeowner_confirmation_id)
      VALUES ($1, $2, 'SHARED', 'PURCHASED', 65, $3) RETURNING id`, [lead, buyerId, conf])).rows[0].id;

    for (const f of files.filter((f) => f >= VISIBILITY_MIGRATION)) await pool.query(readFileSync(join(migrationsDir, f), 'utf8'));
  });

  afterAll(async () => {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  beforeEach(async () => {
    sendMock.mockReset();
    process.env.RESEND_API_KEY = 'test-key';
    (await import('./email')).resetEmailClientCacheForTests();
    (await import('./leadDeliveryEmail')).resetLeadDeliveryEmailClientCacheForTests();
  });

  const content = { subject: 'Your lead', html: '<p>x</p>', text: 'x' };
  let offerSeq = 0;
  async function offerRow(status = 'PENDING', extra = '') {
    // UNIQUE (lead_allocation_id, email_type): reuse the allocation, vary the type.
    const type = ['LEAD_OFFER', 'INTERNAL_OFFER_COPY'][offerSeq++ % 2];
    await pool.query(`DELETE FROM lead_delivery_emails WHERE lead_allocation_id = $1 AND email_type = $2`, [allocationId, type]);
    return (await pool.query(`
      INSERT INTO lead_delivery_emails (lead_allocation_id, email_type, recipient, status${extra ? ', ' + extra.split('=')[0] : ''})
      VALUES ($1, $2, 'buyer@example.test', $3${extra ? ', ' + extra.split('=')[1] : ''}) RETURNING id`, [allocationId, type, status])).rows[0].id as number;
  }
  const row = async (table: string, id: number) => (await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id])).rows[0];

  describe('migration', () => {
    it('marks exactly the five historic failures superseded, and leaves the sent one alone', async () => {
      const r = (await pool.query(`SELECT id, status, superseded_reason FROM transactional_emails WHERE id <= 7 ORDER BY id`)).rows;
      expect(r.map((x: { status: string }) => x.status)).toEqual(['SUPERSEDED', 'SUPERSEDED', 'SUPERSEDED', 'SENT', 'SUPERSEDED', 'SUPERSEDED', 'FAILED']);
      expect(r[0].superseded_reason).toMatch(/not resent/);
    });

    it('refuses to move a superseded email back to sendable, at the database level', async () => {
      await expect(pool.query(`UPDATE transactional_emails SET status = 'FAILED' WHERE id = 1`)).rejects.toThrow(/superseded and can never be sent/);
      await expect(pool.query(`UPDATE transactional_emails SET status = 'SENT' WHERE id = 2`)).rejects.toThrow(/superseded/);
    });

    it('refuses to mark an email that already went out as superseded', async () => {
      await expect(pool.query(`UPDATE transactional_emails SET status = 'SUPERSEDED' WHERE id = 4`)).rejects.toThrow(/already went out/);
    });
  });

  describe('retries never duplicate a buyer notification', () => {
    it('a superseded email is never sent, even if a send is attempted directly', async () => {
      const { attemptSend } = await import('./email');
      const result = await attemptSend(db, 3, content);
      expect(result).toMatchObject({ sent: false, skipped: true });
      expect(sendMock).not.toHaveBeenCalled();
      expect((await row('transactional_emails', 3)).status).toBe('SUPERSEDED');
    });

    it('five simultaneous retries of one failed lead offer send it exactly once', async () => {
      const id = await offerRow('FAILED');
      sendMock.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 30));
        return { data: { id: `msg-${id}` }, error: null };
      });
      const { attemptSendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
      const results = await Promise.all(Array.from({ length: 5 }, () => attemptSendLeadDeliveryEmail(db, id, content)));

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(results.filter((r) => r.sent)).toHaveLength(1);
      expect(results.filter((r) => r.skipped)).toHaveLength(4);
      const r = await row('lead_delivery_emails', id);
      expect(r).toMatchObject({ status: 'SENT', provider_message_id: `msg-${id}`, send_claimed_at: null, outcome_unknown: false });
    });

    it('a send whose outcome is lost is not retried without confirmation, then is sent once confirmed', async () => {
      const id = await offerRow('PENDING');
      sendMock.mockRejectedValueOnce(new Error('socket hang up'));
      const { attemptSendLeadDeliveryEmail } = await import('./leadDeliveryEmail');

      const first = await attemptSendLeadDeliveryEmail(db, id, content);
      expect(first).toMatchObject({ sent: false, outcomeUnknown: true });
      expect(await row('lead_delivery_emails', id)).toMatchObject({ status: 'FAILED', outcome_unknown: true });

      const unconfirmed = await attemptSendLeadDeliveryEmail(db, id, content);
      expect(unconfirmed).toMatchObject({ sent: false, outcomeUnknown: true });
      expect(sendMock).toHaveBeenCalledTimes(1);

      sendMock.mockResolvedValueOnce({ data: { id: `msg-confirmed-${id}` }, error: null });
      const confirmed = await attemptSendLeadDeliveryEmail(db, id, content, { confirmedNotReceived: true });
      expect(confirmed.sent).toBe(true);
      expect(await row('lead_delivery_emails', id)).toMatchObject({ status: 'SENT', outcome_unknown: false });
    });

    it('a claim left behind by a crashed send blocks automatic retries (outcome unknown)', async () => {
      const id = await offerRow('FAILED', "send_claimed_at=now() - interval '1 hour'");
      const { attemptSendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
      expect(await attemptSendLeadDeliveryEmail(db, id, content)).toMatchObject({ sent: false, skipped: true });
      expect(sendMock).not.toHaveBeenCalled();

      sendMock.mockResolvedValueOnce({ data: { id: `msg-stale-${id}` }, error: null });
      expect((await attemptSendLeadDeliveryEmail(db, id, content, { confirmedNotReceived: true })).sent).toBe(true);
    });

    it('an explicit refusal from Resend stays safely retryable', async () => {
      const id = await offerRow('PENDING');
      sendMock.mockResolvedValueOnce({ data: null, error: { message: 'Invalid recipient' } });
      const { attemptSendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
      await attemptSendLeadDeliveryEmail(db, id, content);
      expect(await row('lead_delivery_emails', id)).toMatchObject({ status: 'FAILED', outcome_unknown: false, error_message: 'Invalid recipient' });

      sendMock.mockResolvedValueOnce({ data: { id: `msg-retry-${id}` }, error: null });
      expect((await attemptSendLeadDeliveryEmail(db, id, content)).sent).toBe(true);
    });
  });

  describe('webhook events', () => {
    it('delivered, then a replay, then a late bounce: ends BOUNCED with the reason, replays harmless', async () => {
      const id = await offerRow('SENT', "provider_message_id='msg-wh-1'");
      const { applyResendEventToOutboxes } = await import('./emailEvents');

      expect(await applyResendEventToOutboxes(db, 'email.delivered', 'msg-wh-1')).toBe(1);
      await applyResendEventToOutboxes(db, 'email.delivered', 'msg-wh-1');
      expect(await row('lead_delivery_emails', id)).toMatchObject({ status: 'DELIVERED', last_event: 'email.delivered' });

      await applyResendEventToOutboxes(db, 'email.bounced', 'msg-wh-1', { reason: 'Mailbox does not exist' });
      const r = await row('lead_delivery_emails', id);
      expect(r).toMatchObject({ status: 'BOUNCED', error_message: 'Mailbox does not exist' });
      expect(r.bounced_at).not.toBeNull();
    });

    it('a bounced email is not retried', async () => {
      const id = await offerRow('BOUNCED');
      const { attemptSendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
      expect(await attemptSendLeadDeliveryEmail(db, id, content)).toMatchObject({ sent: false, skipped: true });
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('updates application emails too, and a delayed event is only recorded', async () => {
      const { applyResendEventToOutboxes } = await import('./emailEvents');
      await applyResendEventToOutboxes(db, 'email.delivery_delayed', 'msg-historic-4');
      expect(await row('transactional_emails', 4)).toMatchObject({ status: 'SENT', last_event: 'email.delivery_delayed' });
      await applyResendEventToOutboxes(db, 'email.delivered', 'msg-historic-4');
      expect((await row('transactional_emails', 4)).status).toBe('DELIVERED');
    });

    it('email.failed from Resend makes a SENT row retryable', async () => {
      const id = await offerRow('SENT', "provider_message_id='msg-wh-failed'");
      const { applyResendEventToOutboxes } = await import('./emailEvents');
      await applyResendEventToOutboxes(db, 'email.failed', 'msg-wh-failed', { reason: 'Rejected by provider' });
      expect(await row('lead_delivery_emails', id)).toMatchObject({ status: 'FAILED', error_message: 'Rejected by provider', outcome_unknown: false });
    });

    it('an event for an unknown message matches nothing and changes nothing', async () => {
      const { applyResendEventToOutboxes } = await import('./emailEvents');
      expect(await applyResendEventToOutboxes(db, 'email.bounced', 'msg-not-ours')).toBe(0);
    });
  });
});
