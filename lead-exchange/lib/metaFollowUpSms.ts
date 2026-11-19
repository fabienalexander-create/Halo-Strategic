import { createHmac, randomBytes } from 'crypto';
import { FOLLOW_UP_TOKEN_TTL_DAYS, buildFollowUpUrl, generateFollowUpToken, hashFollowUpToken } from './metaFollowUpToken';
import { normaliseUkMobile } from './smsPhone';
import { DEFAULT_HOURLY_LIMIT, MAX_SEND_ATTEMPTS, PER_NUMBER_CAP_24H, SqlDb, sqlFromClient } from './smsVerification';
import { postSmsToMake } from './smsMakeOut';

// Stage 1 of homeowner follow-up SMS: when a spray foam lead arrives from Meta missing its
// qualification answers, text the homeowner their website completion link.
//
// Gates, all independent of the solar verification texts (SMS_VERIFICATION_ENABLED):
//   META_FOLLOW_UP_SMS_ENABLED  unset/anything else = off, 'test' = test mode, 'true' = live
//   META_FOLLOW_UP_SMS_TEST_NUMBER  the only number test mode will ever queue or send to; must be
//                                   in Ofcom's reserved drama range (07700 900000-900999)
//   META_FOLLOW_UP_LINK_KEY     >= 32 chars; without it no link can be derived, so nothing queues
//   MAKE_SMS_OUT_WEBHOOK_URL / MAKE_SMS_OUT_SECRET  shared with the verification sender
//
// No working link is stored. The token is HMAC-SHA256(link key, nonce); the outbox keeps only the
// nonce, and only while the message is still sendable. At send time the token is re-derived and
// checked against the lead's current follow_up_token_hash, expiry and used flag, so a reissued,
// completed or expired link is cancelled rather than sent.

export type FollowUpSmsMode = 'off' | 'test' | 'live';
export const FOLLOW_UP_PURPOSE = 'META_FOLLOW_UP';
const RESERVED_TEST_NUMBER = /^\+447700900\d{3}$/;
const OPEN_STATUSES = ['PENDING_SEND', 'SENDING'];

export function getFollowUpSmsMode(): FollowUpSmsMode {
  const v = process.env.META_FOLLOW_UP_SMS_ENABLED;
  if (v === 'true') return 'live';
  if (v === 'test') return 'test';
  return 'off';
}

export function getFollowUpTestNumber(): string | null {
  const n = normaliseUkMobile(process.env.META_FOLLOW_UP_SMS_TEST_NUMBER);
  return n && RESERVED_TEST_NUMBER.test(n) ? n : null;
}

export function getFollowUpLinkKey(): string | null {
  const k = process.env.META_FOLLOW_UP_LINK_KEY;
  return k && k.length >= 32 ? k : null;
}

export function deriveFollowUpToken(key: string, nonce: string): string {
  return createHmac('sha256', key).update(`hlx-meta-follow-up:v1:${nonce}`).digest('base64url');
}

export interface IssuedFollowUpToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
  // Set only when the token is derivable (link key configured), i.e. when it can be sent by SMS.
  linkNonce: string | null;
}

export function issueFollowUpToken(now: Date = new Date()): IssuedFollowUpToken {
  const key = getFollowUpLinkKey();
  if (!key) return { ...generateFollowUpToken(now), linkNonce: null };
  const linkNonce = randomBytes(16).toString('base64url');
  const rawToken = deriveFollowUpToken(key, linkNonce);
  return {
    rawToken,
    tokenHash: hashFollowUpToken(rawToken),
    expiresAt: new Date(now.getTime() + FOLLOW_UP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    linkNonce,
  };
}

// Approved wording (Fabien, 2026-11-19, "Option C"). Do not edit without his sign-off.
export function followUpSmsText(url: string): string {
  return `Halo Strategic: thanks for your spray foam removal enquiry. Please complete your details here: ${url}\n\nIf an installer covers your area, they may contact you directly. Reply STOP to opt out.`;
}

function audit(db: SqlDb, action: string, leadId: number, state: Record<string, unknown>) {
  // Never a phone number, link or message text.
  return db.sql`
    INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
    VALUES ('system:sms', ${action}, 'lead', ${leadId}, ${JSON.stringify(state)}::jsonb)
  `;
}

export type FollowUpQueueResult =
  | { queued: true; messageId: number; messageRef: string }
  | { queued: false; reason: 'NOT_ENABLED' | 'NO_LINK_NONCE' | 'INVALID_NUMBER' | 'TEST_MODE_NUMBER_NOT_ALLOWED' | 'SUPPRESSED' | 'NUMBER_CAPPED' | 'CIRCUIT_BREAKER' | 'ALREADY_OPEN' };

/**
 * Queues one follow-up text. Never throws for business reasons. Intended to run inside the
 * transaction that issued the token (via sqlFromClient), wrapped in a savepoint.
 */
export async function queueFollowUpSms(
  db: SqlDb,
  params: { leadId: number; mobile: unknown; linkNonce: string | null; createdBy: string }
): Promise<FollowUpQueueResult> {
  const mode = getFollowUpSmsMode();
  if (mode === 'off') return { queued: false, reason: 'NOT_ENABLED' };
  if (!params.linkNonce) return { queued: false, reason: 'NO_LINK_NONCE' };

  const phone = normaliseUkMobile(params.mobile);
  if (!phone) return { queued: false, reason: 'INVALID_NUMBER' };
  // Test mode never creates a row for a real number, so switching to live later can't release a
  // backlog of texts queued during testing.
  if (mode === 'test' && phone !== getFollowUpTestNumber()) return { queued: false, reason: 'TEST_MODE_NUMBER_NOT_ALLOWED' };

  const suppressed = await db.sql`SELECT 1 FROM sms_suppressions WHERE phone_e164 = ${phone}`;
  if (suppressed.length > 0) return { queued: false, reason: 'SUPPRESSED' };

  // Cap counts texts across both outboxes, so one person never gets more than the cap from Halo.
  const perNumber = await db.sql`
    SELECT
      (SELECT count(*) FROM lead_phone_verifications WHERE phone_e164 = ${phone} AND created_at > now() - interval '24 hours')
      + (SELECT count(*) FROM lead_sms_messages WHERE phone_e164 = ${phone} AND created_at > now() - interval '24 hours'
           AND status IN ('PENDING_SEND','SENDING','SENT','DELIVERED','FAILED')) AS n
  `;
  if (Number(perNumber[0].n) >= PER_NUMBER_CAP_24H) return { queued: false, reason: 'NUMBER_CAPPED' };

  const hourlyLimit = Number(process.env.SMS_HOURLY_LIMIT) > 0 ? Number(process.env.SMS_HOURLY_LIMIT) : DEFAULT_HOURLY_LIMIT;
  const lastHour = await db.sql`SELECT count(*)::int AS n FROM lead_sms_messages WHERE created_at > now() - interval '1 hour'`;
  if ((lastHour[0].n as number) >= hourlyLimit) return { queued: false, reason: 'CIRCUIT_BREAKER' };

  const messageRef = `FU-${randomBytes(5).toString('hex').toUpperCase()}`;
  const rows = await db.sql`
    INSERT INTO lead_sms_messages (lead_id, purpose, message_ref, phone_e164, link_nonce, status, created_by)
    VALUES (${params.leadId}, ${FOLLOW_UP_PURPOSE}, ${messageRef}, ${phone}, ${params.linkNonce}, 'PENDING_SEND', ${params.createdBy})
    ON CONFLICT DO NOTHING RETURNING id
  `;
  if (!rows[0]) return { queued: false, reason: 'ALREADY_OPEN' };
  await audit(db, 'META_FOLLOW_UP_SMS_QUEUED', params.leadId, { message_ref: messageRef, mode });
  return { queued: true, messageId: rows[0].id as number, messageRef };
}

export interface FollowUpSendSummary {
  skipped?: 'NOT_ENABLED' | 'NOT_CONFIGURED';
  suppressed: number;
  cancelled: number;
  blocked: number;
  claimed: number;
  sent: number;
  failed: number;
}

/**
 * Sends pending follow-up texts via the Make "SMS out" webhook. Same claim/retry discipline as the
 * verification sender: one-statement claim, stuck SENDING reclaimable after 10 minutes, max 3
 * attempts. Never logs a phone number, link or text.
 */
export async function sendPendingFollowUpSms(
  db: SqlDb,
  opts: { limit?: number; leadId?: number; fetchImpl?: typeof fetch } = {}
): Promise<FollowUpSendSummary> {
  const summary: FollowUpSendSummary = { suppressed: 0, cancelled: 0, blocked: 0, claimed: 0, sent: 0, failed: 0 };
  const mode = getFollowUpSmsMode();
  if (mode === 'off') return { ...summary, skipped: 'NOT_ENABLED' };
  const url = process.env.MAKE_SMS_OUT_WEBHOOK_URL;
  const secret = process.env.MAKE_SMS_OUT_SECRET;
  const key = getFollowUpLinkKey();
  if (!url || !secret || !key) return { ...summary, skipped: 'NOT_CONFIGURED' };
  const testNumber = getFollowUpTestNumber();
  const doFetch = opts.fetchImpl ?? fetch;
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const leadFilter = opts.leadId ?? null;

  const suppressed = await db.sql`
    UPDATE lead_sms_messages m SET status = 'SUPPRESSED', link_nonce = NULL, updated_at = now()
    WHERE m.status IN ('PENDING_SEND','SENDING')
      AND EXISTS (SELECT 1 FROM sms_suppressions s WHERE s.phone_e164 = m.phone_e164)
    RETURNING m.id`;
  summary.suppressed = suppressed.length;

  // Out of attempts and stuck: give up rather than hold a nonce forever.
  await db.sql`
    UPDATE lead_sms_messages SET status = 'FAILED', link_nonce = NULL, error_message = COALESCE(error_message, 'stuck in SENDING'), updated_at = now()
    WHERE status = 'SENDING' AND updated_at < now() - interval '10 minutes' AND attempt_count >= ${MAX_SEND_ATTEMPTS}`;

  const claimed = await db.sql`
    UPDATE lead_sms_messages SET status = 'SENDING', attempt_count = attempt_count + 1, updated_at = now()
    WHERE id IN (
      SELECT m.id FROM lead_sms_messages m
      WHERE (m.status = 'PENDING_SEND' OR (m.status = 'SENDING' AND m.updated_at < now() - interval '10 minutes'))
        AND m.attempt_count < ${MAX_SEND_ATTEMPTS}
        AND (${leadFilter}::int IS NULL OR m.lead_id = ${leadFilter}::int)
        AND NOT EXISTS (SELECT 1 FROM sms_suppressions s WHERE s.phone_e164 = m.phone_e164)
      ORDER BY m.id LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    AND (status = 'PENDING_SEND' OR (status = 'SENDING' AND updated_at < now() - interval '10 minutes'))
    RETURNING id, lead_id, message_ref, phone_e164, link_nonce, attempt_count`;
  summary.claimed = claimed.length;

  for (const row of claimed) {
    const close = (status: 'CANCELLED' | 'BLOCKED_TEST_MODE', reason: string) => db.sql`
      UPDATE lead_sms_messages SET status = ${status}, link_nonce = NULL, error_message = ${reason}, updated_at = now()
      WHERE id = ${row.id} AND status = 'SENDING'`;

    if (mode === 'test' && row.phone_e164 !== testNumber) {
      await close('BLOCKED_TEST_MODE', 'test mode: number is not the reserved test number');
      summary.blocked++;
      continue;
    }

    const rawToken = deriveFollowUpToken(key, row.link_nonce as string);
    const leads = await db.sql`
      SELECT status, follow_up_token_hash, follow_up_token_used_at, follow_up_token_expires_at FROM leads WHERE id = ${row.lead_id}`;
    const lead = leads[0];
    const expires = lead?.follow_up_token_expires_at ? new Date(lead.follow_up_token_expires_at as string) : null;
    const stale =
      !lead ||
      lead.status !== 'QUALIFICATION_PENDING' ||
      lead.follow_up_token_hash !== hashFollowUpToken(rawToken) ||
      lead.follow_up_token_used_at !== null ||
      !expires || expires.getTime() <= Date.now();
    if (stale) {
      await close('CANCELLED', 'link no longer valid (reissued, completed, expired or key changed)');
      summary.cancelled++;
      continue;
    }

    const { providerId, error } = await postSmsToMake(url, secret, {
      reference: row.message_ref,
      purpose: FOLLOW_UP_PURPOSE,
      to: row.phone_e164,
      text: followUpSmsText(buildFollowUpUrl(rawToken)),
    }, doFetch);

    if (!error) {
      await db.sql`
        UPDATE lead_sms_messages SET status = 'SENT', link_nonce = NULL, sent_at = now(), provider_message_id = ${providerId},
          error_message = NULL, updated_at = now() WHERE id = ${row.id} AND status = 'SENDING'`;
      summary.sent++;
    } else {
      const final = (row.attempt_count as number) >= MAX_SEND_ATTEMPTS;
      if (final) {
        await db.sql`
          UPDATE lead_sms_messages SET status = 'FAILED', link_nonce = NULL, error_message = ${error}, updated_at = now()
          WHERE id = ${row.id} AND status = 'SENDING'`;
      } else {
        await db.sql`
          UPDATE lead_sms_messages SET status = 'PENDING_SEND', error_message = ${error}, updated_at = now()
          WHERE id = ${row.id} AND status = 'SENDING'`;
      }
      summary.failed++;
    }
  }
  return summary;
}

/** Delivery receipts. Moves SENT to DELIVERED or FAILED only. */
export async function recordFollowUpDelivery(db: SqlDb, params: { providerMessageId: unknown; delivered: boolean; detail?: unknown }): Promise<number> {
  if (typeof params.providerMessageId !== 'string' || !params.providerMessageId) return 0;
  const detail = typeof params.detail === 'string' ? params.detail.slice(0, 200) : null;
  const rows = params.delivered
    ? await db.sql`
        UPDATE lead_sms_messages SET status = 'DELIVERED', delivered_at = now(), updated_at = now()
        WHERE provider_message_id = ${params.providerMessageId} AND status = 'SENT' RETURNING id`
    : await db.sql`
        UPDATE lead_sms_messages SET status = 'FAILED', error_message = ${detail}, updated_at = now()
        WHERE provider_message_id = ${params.providerMessageId} AND status = 'SENT' RETURNING id`;
  return rows.length;
}

/** Called after an inbound STOP: closes any follow-up still waiting to go to that number. */
export async function suppressOpenFollowUps(db: SqlDb, from: unknown): Promise<number> {
  const phone = normaliseUkMobile(from);
  if (!phone) return 0;
  const rows = await db.sql`
    UPDATE lead_sms_messages SET status = 'SUPPRESSED', link_nonce = NULL, updated_at = now()
    WHERE phone_e164 = ${phone} AND status IN ('PENDING_SEND','SENDING') RETURNING id`;
  return rows.length;
}

// ---- Admin reissue ------------------------------------------------------------------------

interface PoolDb {
  pool: { connect(): Promise<{ query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>; release(): void }> };
}

export type ReissueResult =
  | { ok: true; followUpUrl: string; expiresAt: Date; cancelledMessages: number; sms: FollowUpQueueResult }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_AWAITING_QUALIFICATION' | 'UNSUPPORTED_INDUSTRY' };

/**
 * Issues a fresh follow-up link for a QUALIFICATION_PENDING spray foam lead. The previous link
 * stops working immediately (its hash is replaced) and any unsent text carrying it is cancelled.
 * Optionally queues a new text, subject to every normal gate. The raw URL is returned once, to the
 * admin who asked for it, and is not stored.
 */
export async function reissueFollowUpLink(
  db: PoolDb,
  params: { leadId: number; actor: string; queueSms: boolean }
): Promise<ReissueResult> {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT l.id, l.status, l.homeowner_contact, i.slug
       FROM leads l JOIN industries i ON i.id = l.industry_id
       WHERE l.id = $1 FOR UPDATE OF l`,
      [params.leadId]
    );
    const lead = found.rows[0];
    if (!lead) { await client.query('ROLLBACK'); return { ok: false, reason: 'NOT_FOUND' }; }
    if (lead.status !== 'QUALIFICATION_PENDING') { await client.query('ROLLBACK'); return { ok: false, reason: 'NOT_AWAITING_QUALIFICATION' }; }
    if (lead.slug !== 'spray_foam_removal') { await client.query('ROLLBACK'); return { ok: false, reason: 'UNSUPPORTED_INDUSTRY' }; }

    const token = issueFollowUpToken();
    await client.query(
      `UPDATE leads SET follow_up_token_hash = $1, follow_up_token_expires_at = $2, follow_up_token_used_at = NULL WHERE id = $3`,
      [token.tokenHash, token.expiresAt, params.leadId]
    );
    const cancelled = await client.query(
      `UPDATE lead_sms_messages SET status = 'CANCELLED', link_nonce = NULL, error_message = 'superseded by reissued link', updated_at = now()
       WHERE lead_id = $1 AND purpose = $2 AND status = ANY($3) RETURNING id`,
      [params.leadId, FOLLOW_UP_PURPOSE, OPEN_STATUSES]
    );

    const sql = sqlFromClient(client);
    let sms: FollowUpQueueResult = { queued: false, reason: 'NOT_ENABLED' };
    if (params.queueSms) {
      const contact = (lead.homeowner_contact ?? {}) as { mobile?: unknown };
      await client.query('SAVEPOINT reissue_sms');
      try {
        sms = await queueFollowUpSms(sql, { leadId: params.leadId, mobile: contact.mobile, linkNonce: token.linkNonce, createdBy: params.actor });
        await client.query('RELEASE SAVEPOINT reissue_sms');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT reissue_sms');
        console.error('Follow-up SMS queue failed on reissue', err instanceof Error ? err.message : 'unknown');
      }
    }

    await client.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state) VALUES ($1, 'META_FOLLOW_UP_LINK_REISSUED', 'lead', $2, $3::jsonb)`,
      [params.actor, params.leadId, JSON.stringify({
        cancelled_messages: cancelled.rows.length,
        sms_queued: sms.queued,
        sms_reason: sms.queued ? null : sms.reason,
        expires_at: token.expiresAt.toISOString(),
      })]
    );
    await client.query('COMMIT');
    return { ok: true, followUpUrl: buildFollowUpUrl(token.rawToken), expiresAt: token.expiresAt, cancelledMessages: cancelled.rows.length, sms };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
