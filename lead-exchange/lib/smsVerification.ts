import { randomInt } from 'crypto';
import { normaliseUkMobile } from './smsPhone';

// Narrow structural type for the sql tag (same pattern as lib/email.ts and lib/sheetsSync.ts).
export interface SqlDb {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<Array<Record<string, unknown>>>;
}

// Adapts a pg client (used inside the enquiry transaction) to the sql tag.
export function sqlFromClient(client: { query: (text: string, values: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }): SqlDb {
  return {
    sql: async (strings, ...values) => {
      let text = '';
      strings.forEach((s, i) => { text += s + (i < values.length ? `$${i + 1}` : ''); });
      return (await client.query(text, values)).rows;
    },
  };
}

// Consent wording versions that explicitly cover a one-off verification text message. EMPTY on
// purpose: the current wording does not mention SMS. A version is added here only after the new
// wording is signed off by Fabien's legal review and shipped on the form. Until then nothing is
// ever queued, even with SMS_VERIFICATION_ENABLED set.
export const SMS_COVERED_CONSENT_VERSIONS: ReadonlySet<string> = new Set<string>();

export const VERIFICATION_EXPIRY_HOURS = 48;
export const PER_NUMBER_CAP_24H = 2;
export const DEFAULT_HOURLY_LIMIT = 100;
export const MAX_SEND_ATTEMPTS = 3;
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
const REF_LENGTH = 6;

export function generateVerificationRef(): string {
  // Always contains at least one digit, so an ordinary word ("please", "thanks") can never be
  // read as a reference.
  for (;;) {
    let out = '';
    for (let i = 0; i < REF_LENGTH; i++) out += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
    if (/[2-9]/.test(out)) return out;
  }
}

export function verificationSmsText(ref: string): string {
  return `Halo Strategic: please confirm your solar enquiry. Reply YES ${ref} to confirm. Reply STOP to opt out.`;
}

function audit(db: SqlDb, action: string, verificationId: number, reference: string, extra: Record<string, unknown> = {}) {
  // Reference only. Never a phone number or message text.
  return db.sql`
    INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
    VALUES ('system:sms', ${action}, 'lead_phone_verification', ${verificationId}, ${JSON.stringify({ reference, ...extra })}::jsonb)
  `;
}

export type QueueResult =
  | { queued: true; verificationId: number; reference: string }
  | { queued: false; reason: 'NOT_ENABLED' | 'CONSENT_NOT_COVERED' | 'INVALID_NUMBER' | 'SUPPRESSED' | 'NUMBER_CAPPED' | 'CIRCUIT_BREAKER' | 'ALREADY_OPEN' };

/**
 * Queues one verification request for a lead. Never throws for business reasons; returns why
 * nothing was queued. Intended to run inside the enquiry transaction (via sqlFromClient) so a
 * request can never be lost, and to be wrapped in a savepoint so it can never break the enquiry.
 */
export async function queueVerification(
  db: SqlDb,
  params: { leadId: number; mobile: unknown; consentVersion: string }
): Promise<QueueResult> {
  if (process.env.SMS_VERIFICATION_ENABLED !== 'true') return { queued: false, reason: 'NOT_ENABLED' };
  if (!SMS_COVERED_CONSENT_VERSIONS.has(params.consentVersion)) return { queued: false, reason: 'CONSENT_NOT_COVERED' };

  const phone = normaliseUkMobile(params.mobile);
  if (!phone) {
    const ref = `X${generateVerificationRef()}`;
    const rows = await db.sql`
      INSERT INTO lead_phone_verifications (lead_id, verification_ref, phone_e164, status, expires_at)
      VALUES (${params.leadId}, ${ref}, NULL, 'FAILED_INVALID_NUMBER', now())
      ON CONFLICT DO NOTHING RETURNING id
    `;
    if (rows[0]) await audit(db, 'SMS_VERIFICATION_INVALID_NUMBER', rows[0].id as number, ref);
    return { queued: false, reason: 'INVALID_NUMBER' };
  }

  const suppressed = await db.sql`SELECT 1 FROM sms_suppressions WHERE phone_e164 = ${phone}`;
  if (suppressed.length > 0) return { queued: false, reason: 'SUPPRESSED' };

  const perNumber = await db.sql`
    SELECT count(*)::int AS n FROM lead_phone_verifications
    WHERE phone_e164 = ${phone} AND created_at > now() - interval '24 hours'
  `;
  if ((perNumber[0].n as number) >= PER_NUMBER_CAP_24H) return { queued: false, reason: 'NUMBER_CAPPED' };

  const hourlyLimit = Number(process.env.SMS_HOURLY_LIMIT) > 0 ? Number(process.env.SMS_HOURLY_LIMIT) : DEFAULT_HOURLY_LIMIT;
  const lastHour = await db.sql`
    SELECT count(*)::int AS n FROM lead_phone_verifications WHERE created_at > now() - interval '1 hour'
  `;
  if ((lastHour[0].n as number) >= hourlyLimit) return { queued: false, reason: 'CIRCUIT_BREAKER' };

  // ON CONFLICT DO NOTHING covers both a reference collision (retry with a new ref) and the
  // one-open-request-per-lead index (checked afterwards), without raising inside a transaction.
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = generateVerificationRef();
    const rows = await db.sql`
      INSERT INTO lead_phone_verifications (lead_id, verification_ref, phone_e164, status, expires_at)
      VALUES (${params.leadId}, ${ref}, ${phone}, 'PENDING_SEND', now() + make_interval(hours => ${VERIFICATION_EXPIRY_HOURS}))
      ON CONFLICT DO NOTHING RETURNING id
    `;
    if (rows[0]) {
      await audit(db, 'SMS_VERIFICATION_QUEUED', rows[0].id as number, ref);
      return { queued: true, verificationId: rows[0].id as number, reference: ref };
    }
    const open = await db.sql`
      SELECT 1 FROM lead_phone_verifications
      WHERE lead_id = ${params.leadId} AND status IN ('PENDING_SEND','SENDING','SENT','DELIVERED')
    `;
    if (open.length > 0) return { queued: false, reason: 'ALREADY_OPEN' };
  }
  throw new Error('Could not allocate a unique verification reference');
}

// ---- Inbound replies ----------------------------------------------------------------------

export type ParsedReply =
  | { kind: 'STOP' }
  | { kind: 'YES'; ref: string | null }
  | { kind: 'OTHER' };

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT']);

export function parseReply(text: unknown): ParsedReply {
  if (typeof text !== 'string') return { kind: 'OTHER' };
  const t = text.trim().toUpperCase().replace(/[.!]+$/, '');
  if (STOP_WORDS.has(t)) return { kind: 'STOP' };
  const m = /^(?:YES|Y)(?:[\s:.\-]+([A-HJ-NP-Z2-9]{6}))?$/.exec(t);
  if (m && (m[1] === undefined || /[2-9]/.test(m[1]))) return { kind: 'YES', ref: m[1] ?? null };
  return { kind: 'OTHER' };
}

export type InboundOutcome = 'VERIFIED' | 'NO_MATCH' | 'AMBIGUOUS' | 'STOPPED' | 'DUPLICATE' | 'IGNORED';


/**
 * Applies one inbound reply. Matching and the state change are a single UPDATE, so two
 * simultaneous replies change a request exactly once. A bare YES counts only when exactly one
 * request is open for that number.
 */
export async function handleInboundReply(
  db: SqlDb,
  params: { from: unknown; text: unknown; messageId: unknown }
): Promise<{ outcome: InboundOutcome; reference?: string }> {
  const phone = normaliseUkMobile(params.from);
  const messageId = typeof params.messageId === 'string' && params.messageId.length > 0 && params.messageId.length <= 200 ? params.messageId : null;
  if (!phone) return { outcome: 'IGNORED' };

  const reply = parseReply(params.text);

  if (reply.kind === 'STOP') {
    await db.sql`
      INSERT INTO sms_suppressions (phone_e164, reason, source) VALUES (${phone}, 'STOP', 'inbound_reply')
      ON CONFLICT (phone_e164) DO NOTHING
    `;
    const closed = await db.sql`
      UPDATE lead_phone_verifications SET status = 'SUPPRESSED', updated_at = now()
      WHERE phone_e164 = ${phone} AND status IN ('PENDING_SEND','SENDING','SENT','DELIVERED')
      RETURNING id, verification_ref
    `;
    for (const r of closed) await audit(db, 'SMS_VERIFICATION_STOPPED', r.id as number, r.verification_ref as string);
    return { outcome: 'STOPPED' };
  }

  if (reply.kind !== 'YES') return { outcome: 'IGNORED' };

  if (messageId) {
    const seen = await db.sql`SELECT 1 FROM lead_phone_verifications WHERE inbound_message_id = ${messageId}`;
    if (seen.length > 0) return { outcome: 'DUPLICATE' };
  }

  let rows: Array<Record<string, unknown>>;
  try {
    if (reply.ref) {
      rows = await db.sql`
        UPDATE lead_phone_verifications
        SET status = 'VERIFIED', verified_at = now(), inbound_message_id = ${messageId}, updated_at = now()
        WHERE verification_ref = ${reply.ref} AND phone_e164 = ${phone}
          AND status IN ('SENDING','SENT','DELIVERED') AND expires_at > now()
        RETURNING id, verification_ref
      `;
    } else {
      rows = await db.sql`
        UPDATE lead_phone_verifications v
        SET status = 'VERIFIED', verified_at = now(), inbound_message_id = ${messageId}, updated_at = now()
        WHERE v.phone_e164 = ${phone} AND v.status IN ('SENDING','SENT','DELIVERED') AND v.expires_at > now()
          AND (
            SELECT count(*) FROM lead_phone_verifications o
            WHERE o.phone_e164 = ${phone} AND o.status IN ('SENDING','SENT','DELIVERED') AND o.expires_at > now()
          ) = 1
        RETURNING v.id, v.verification_ref
      `;
    }
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return { outcome: 'DUPLICATE' };
    throw err;
  }

  if (rows[0]) {
    await audit(db, 'SMS_VERIFICATION_VERIFIED', rows[0].id as number, rows[0].verification_ref as string);
    return { outcome: 'VERIFIED', reference: rows[0].verification_ref as string };
  }

  if (!reply.ref) {
    const open = await db.sql`
      SELECT count(*)::int AS n FROM lead_phone_verifications
      WHERE phone_e164 = ${phone} AND status IN ('SENDING','SENT','DELIVERED') AND expires_at > now()
    `;
    if ((open[0].n as number) > 1) return { outcome: 'AMBIGUOUS' };
  }
  return { outcome: 'NO_MATCH' };
}

// ---- Delivery receipts --------------------------------------------------------------------

// A delivery receipt records DELIVERED or FAILED only, and never touches a request that has
// already moved on. It can never produce VERIFIED.
export async function recordDelivery(db: SqlDb, params: { providerMessageId: unknown; delivered: boolean; detail?: unknown }): Promise<number> {
  if (typeof params.providerMessageId !== 'string' || !params.providerMessageId) return 0;
  const detail = typeof params.detail === 'string' ? params.detail.slice(0, 200) : null;
  const rows = params.delivered
    ? await db.sql`
        UPDATE lead_phone_verifications SET status = 'DELIVERED', delivered_at = now(), updated_at = now()
        WHERE provider_message_id = ${params.providerMessageId} AND status IN ('SENDING','SENT') RETURNING id`
    : await db.sql`
        UPDATE lead_phone_verifications SET status = 'FAILED', error_message = ${detail}, updated_at = now()
        WHERE provider_message_id = ${params.providerMessageId} AND status IN ('SENDING','SENT') RETURNING id`;
  return rows.length;
}
