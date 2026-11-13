import { createHmac } from 'crypto';
import { MAX_SEND_ATTEMPTS, SqlDb, verificationSmsText } from './smsVerification';

export interface SendSummary {
  skipped?: 'NOT_CONFIGURED' | 'NOT_ENABLED';
  expired: number;
  suppressed: number;
  claimed: number;
  sent: number;
  failed: number;
}

/**
 * Hands pending verification requests to the Make "SMS out" webhook, signed with an HMAC.
 * Halo stays the source of truth: Make only moves the message to TextMagic and returns an id.
 *
 * - Suppressed numbers are closed before anything is claimed (STOP enforced here, not in Make).
 * - A row is claimed (PENDING_SEND to SENDING) in one statement, so two senders can never both
 *   take it. A row stuck in SENDING is reclaimable after 10 minutes. Max 3 attempts.
 * - Never logs the phone number or the text.
 */
export async function sendPendingVerifications(
  db: SqlDb,
  opts: { limit?: number; leadId?: number; fetchImpl?: typeof fetch } = {}
): Promise<SendSummary> {
  const summary: SendSummary = { expired: 0, suppressed: 0, claimed: 0, sent: 0, failed: 0 };
  if (process.env.SMS_VERIFICATION_ENABLED !== 'true') return { ...summary, skipped: 'NOT_ENABLED' };
  const url = process.env.MAKE_SMS_OUT_WEBHOOK_URL;
  const secret = process.env.MAKE_SMS_OUT_SECRET;
  if (!url || !secret) return { ...summary, skipped: 'NOT_CONFIGURED' };
  const doFetch = opts.fetchImpl ?? fetch;
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const leadFilter = opts.leadId ?? null;

  const expired = await db.sql`
    UPDATE lead_phone_verifications SET status = 'EXPIRED', updated_at = now()
    WHERE status IN ('PENDING_SEND','SENDING','SENT','DELIVERED') AND expires_at <= now() RETURNING id`;
  summary.expired = expired.length;

  const suppressed = await db.sql`
    UPDATE lead_phone_verifications v SET status = 'SUPPRESSED', updated_at = now()
    WHERE v.status IN ('PENDING_SEND','SENDING')
      AND EXISTS (SELECT 1 FROM sms_suppressions s WHERE s.phone_e164 = v.phone_e164)
    RETURNING v.id`;
  summary.suppressed = suppressed.length;

  const claimed = await db.sql`
    UPDATE lead_phone_verifications SET status = 'SENDING', attempt_count = attempt_count + 1, updated_at = now()
    WHERE id IN (
      SELECT v.id FROM lead_phone_verifications v
      WHERE (v.status = 'PENDING_SEND' OR (v.status = 'SENDING' AND v.updated_at < now() - interval '10 minutes'))
        AND v.attempt_count < ${MAX_SEND_ATTEMPTS} AND v.expires_at > now()
        AND (${leadFilter}::int IS NULL OR v.lead_id = ${leadFilter}::int)
        AND NOT EXISTS (SELECT 1 FROM sms_suppressions s WHERE s.phone_e164 = v.phone_e164)
      ORDER BY v.id LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    AND (status = 'PENDING_SEND' OR (status = 'SENDING' AND updated_at < now() - interval '10 minutes'))
    RETURNING id, verification_ref, phone_e164, attempt_count`;
  summary.claimed = claimed.length;

  for (const row of claimed) {
    const body = JSON.stringify({
      verification_ref: row.verification_ref,
      to: row.phone_e164,
      text: verificationSmsText(row.verification_ref as string),
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    let providerId: string | null = null;
    let error: string | null = null;
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-halo-timestamp': timestamp, 'x-halo-signature': signature },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        error = `Make returned ${res.status}`;
      } else {
        try {
          const json = (await res.json()) as { message_id?: unknown };
          if (typeof json.message_id === 'string' || typeof json.message_id === 'number') providerId = String(json.message_id).slice(0, 200);
        } catch { /* a body without JSON is fine; the delivery route can still match by reference later */ }
      }
    } catch (err) {
      error = err instanceof Error ? err.name : 'send failed';
    }

    if (!error) {
      await db.sql`
        UPDATE lead_phone_verifications SET status = 'SENT', sent_at = now(), provider_message_id = ${providerId},
          error_message = NULL, updated_at = now() WHERE id = ${row.id} AND status = 'SENDING'`;
      summary.sent++;
    } else {
      const final = (row.attempt_count as number) >= MAX_SEND_ATTEMPTS;
      await db.sql`
        UPDATE lead_phone_verifications SET status = ${final ? 'FAILED' : 'PENDING_SEND'}, error_message = ${error}, updated_at = now()
        WHERE id = ${row.id} AND status = 'SENDING'`;
      summary.failed++;
    }
  }
  return summary;
}
