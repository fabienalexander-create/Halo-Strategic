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

// Form wording versions that show the approved phone verification notice (SMS_VERIFICATION_NOTICE
// in lib/industries.ts). Only leads captured under one of these can ever be queued. Spray foam,
// roofing and earlier solar leads are never texted. Even then nothing is sent unless
// SMS_VERIFICATION_ENABLED=true, which stays unset until Fabien activates it.
//
// '2026-11-18-v0.3' is solar_battery's current consentVersion (lib/industries.ts), updated
// 2026-11-18 to disclose multi-buyer distribution -- kept in step with that value, additively, so
// a new solar lead keeps getting the SMS verification notice it always did. The superseded
// '2026-11-13-v0.2' stays listed rather than being removed: no lead is ever created with it again
// after the bump, so it does nothing going forward, but removing it would misrepresent history.
export const SMS_NOTICE_VERSIONS: ReadonlySet<string> = new Set<string>(['2026-11-13-v0.2', '2026-11-18-v0.3']);

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

// ---- Meta follow-up (one-way link text) -----------------------------------------------------
//
// A Meta Instant Form homeowner arrives without the qualification questions or consent the website
// form asks for (see app/api/integrations/meta-homeowner-leads/route.ts). This text sends them
// their single-use link to finish the enquiry on the website. It is not a verification: a YES reply
// to it never verifies anything (handleInboundReply only matches PHONE_VERIFICATION rows), while
// STOP still opts the number out of every Halo text.
//
// Fabien, 2026-11-19: approved wording Option C; reply-capable UK number (so STOP replies work);
// quiet hours 08:00-20:00 Europe/London; no first name; plain GSM-7 characters only; max two SMS
// segments with a real 118-character link (enforced by lib/smsMetaFollowUp.test.ts).

export type SmsPurpose = 'PHONE_VERIFICATION' | 'META_FOLLOW_UP';

// Industries whose Meta homeowner leads may be sent the follow-up text. The approved wording names
// spray foam removal explicitly, so any other industry needs its own approved wording first.
export const META_FOLLOW_UP_INDUSTRIES: ReadonlySet<string> = new Set<string>(['spray_foam_removal']);

// A queued follow-up that hasn't gone out within this window is expired rather than sent late.
// Long enough to span one night of quiet hours plus a few retries; short enough that a homeowner is
// never texted days after their enquiry.
export const META_FOLLOW_UP_SEND_WINDOW_HOURS = 24;

export const SENDING_HOURS = { startHour: 8, endHour: 20, timeZone: 'Europe/London' } as const;

// Both switches are required: the existing master switch (which also governs Solar & Battery
// verification) and a follow-up specific one, so either kind can be turned on or off on its own.
export function metaFollowUpSmsEnabled(): boolean {
  return process.env.SMS_VERIFICATION_ENABLED === 'true' && process.env.META_FOLLOW_UP_SMS_ENABLED === 'true';
}

export function metaFollowUpSmsText(followUpUrl: string): string {
  return `Halo Strategic: thanks for your spray foam removal enquiry. Please complete your details here: ${followUpUrl}\nIf an installer covers your area, they may contact you directly. Reply STOP to opt out.`;
}

// True between 08:00 (inclusive) and 20:00 (exclusive) UK local time, BST or GMT as applicable.
export function isWithinSendingHours(now: Date = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: SENDING_HOURS.timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now));
  return hour >= SENDING_HOURS.startHour && hour < SENDING_HOURS.endHour;
}

// GSM 03.38 basic character set and its extension table (extension characters cost two units).
// Anything outside both forces UCS-2 encoding, which cuts a segment from 153 to 67 characters --
// a single curly apostrophe can more than double the cost of a message.
const GSM7_BASIC = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const GSM7_EXTENSION = new Set(Array.from('^{}\\[~]|€\f'));

export function smsSegmentInfo(text: string): { encoding: 'GSM-7' | 'UCS-2'; units: number; segments: number } {
  const chars = Array.from(text);
  if (chars.every((c) => GSM7_BASIC.has(c) || GSM7_EXTENSION.has(c))) {
    const units = chars.reduce((n, c) => n + (GSM7_EXTENSION.has(c) ? 2 : 1), 0);
    return { encoding: 'GSM-7', units, segments: units <= 160 ? 1 : Math.ceil(units / 153) };
  }
  const units = text.length; // UTF-16 code units, which is what UCS-2 segments count
  return { encoding: 'UCS-2', units, segments: units <= 70 ? 1 : Math.ceil(units / 67) };
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
  | { queued: false; reason: 'NOT_ENABLED' | 'NOTICE_NOT_SHOWN' | 'INDUSTRY_NOT_ELIGIBLE' | 'INVALID_NUMBER' | 'SUPPRESSED' | 'NUMBER_CAPPED' | 'CIRCUIT_BREAKER' | 'ALREADY_OPEN' };

// Suppression list, per-number cap and global hourly circuit breaker, in that order. Shared by
// every kind of homeowner text: the caps count requests of all purposes together, so a homeowner
// can never receive more than PER_NUMBER_CAP_24H Halo texts a day in total.
async function capacityCheck(db: SqlDb, phone: string): Promise<'SUPPRESSED' | 'NUMBER_CAPPED' | 'CIRCUIT_BREAKER' | null> {
  const suppressed = await db.sql`SELECT 1 FROM sms_suppressions WHERE phone_e164 = ${phone}`;
  if (suppressed.length > 0) return 'SUPPRESSED';

  const perNumber = await db.sql`
    SELECT count(*)::int AS n FROM lead_phone_verifications
    WHERE phone_e164 = ${phone} AND created_at > now() - interval '24 hours'
  `;
  if ((perNumber[0].n as number) >= PER_NUMBER_CAP_24H) return 'NUMBER_CAPPED';

  const hourlyLimit = Number(process.env.SMS_HOURLY_LIMIT) > 0 ? Number(process.env.SMS_HOURLY_LIMIT) : DEFAULT_HOURLY_LIMIT;
  const lastHour = await db.sql`
    SELECT count(*)::int AS n FROM lead_phone_verifications WHERE created_at > now() - interval '1 hour'
  `;
  if ((lastHour[0].n as number) >= hourlyLimit) return 'CIRCUIT_BREAKER';
  return null;
}

/**
 * Queues one verification request for a lead. Never throws for business reasons; returns why
 * nothing was queued. Intended to run inside the enquiry transaction (via sqlFromClient) so a
 * request can never be lost, and to be wrapped in a savepoint so it can never break the enquiry.
 */
export async function queueVerification(
  db: SqlDb,
  params: { leadId: number; mobile: unknown; noticeVersion: string }
): Promise<QueueResult> {
  if (process.env.SMS_VERIFICATION_ENABLED !== 'true') return { queued: false, reason: 'NOT_ENABLED' };
  if (!SMS_NOTICE_VERSIONS.has(params.noticeVersion)) return { queued: false, reason: 'NOTICE_NOT_SHOWN' };

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

  const blocked = await capacityCheck(db, phone);
  if (blocked) return { queued: false, reason: blocked };

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

/**
 * Queues one Meta follow-up text for a lead. Same contract as queueVerification: never throws for
 * business reasons, intended to run inside the intake transaction within a savepoint so it can
 * never break or lose the lead.
 *
 * No link is created here. On the text's first send attempt the sender mints its token, stores it
 * on this row encrypted (lib/smsLinkCrypto.ts) and reuses it for every retry, so the homeowner never
 * holds a dead link because a confirmation timed out (lib/smsSender.ts).
 */
export async function queueMetaFollowUp(
  db: SqlDb,
  params: { leadId: number; mobile: unknown; industrySlug: string }
): Promise<QueueResult> {
  if (!metaFollowUpSmsEnabled()) return { queued: false, reason: 'NOT_ENABLED' };
  if (!META_FOLLOW_UP_INDUSTRIES.has(params.industrySlug)) return { queued: false, reason: 'INDUSTRY_NOT_ELIGIBLE' };

  const phone = normaliseUkMobile(params.mobile);
  if (!phone) {
    const ref = `X${generateVerificationRef()}`;
    const rows = await db.sql`
      INSERT INTO lead_phone_verifications (lead_id, verification_ref, phone_e164, status, expires_at, purpose)
      VALUES (${params.leadId}, ${ref}, NULL, 'FAILED_INVALID_NUMBER', now(), 'META_FOLLOW_UP')
      ON CONFLICT DO NOTHING RETURNING id
    `;
    if (rows[0]) await audit(db, 'SMS_META_FOLLOW_UP_INVALID_NUMBER', rows[0].id as number, ref);
    return { queued: false, reason: 'INVALID_NUMBER' };
  }

  const blocked = await capacityCheck(db, phone);
  if (blocked) return { queued: false, reason: blocked };

  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = generateVerificationRef();
    const rows = await db.sql`
      INSERT INTO lead_phone_verifications (lead_id, verification_ref, phone_e164, status, expires_at, purpose)
      VALUES (${params.leadId}, ${ref}, ${phone}, 'PENDING_SEND', now() + make_interval(hours => ${META_FOLLOW_UP_SEND_WINDOW_HOURS}), 'META_FOLLOW_UP')
      ON CONFLICT DO NOTHING RETURNING id
    `;
    if (rows[0]) {
      await audit(db, 'SMS_META_FOLLOW_UP_QUEUED', rows[0].id as number, ref);
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
      UPDATE lead_phone_verifications SET status = 'SUPPRESSED', follow_up_token_enc = NULL, updated_at = now()
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

  // Only PHONE_VERIFICATION requests can ever be verified. A homeowner replying "yes" to a Meta
  // follow-up text must not be marked phone-verified (they were never asked to verify), and an open
  // follow-up must not make a bare YES to a real verification look ambiguous.
  let rows: Array<Record<string, unknown>>;
  try {
    if (reply.ref) {
      rows = await db.sql`
        UPDATE lead_phone_verifications
        SET status = 'VERIFIED', verified_at = now(), inbound_message_id = ${messageId}, updated_at = now()
        WHERE verification_ref = ${reply.ref} AND phone_e164 = ${phone} AND purpose = 'PHONE_VERIFICATION'
          AND status IN ('SENDING','SENT','DELIVERED') AND expires_at > now()
        RETURNING id, verification_ref
      `;
    } else {
      rows = await db.sql`
        UPDATE lead_phone_verifications v
        SET status = 'VERIFIED', verified_at = now(), inbound_message_id = ${messageId}, updated_at = now()
        WHERE v.phone_e164 = ${phone} AND v.purpose = 'PHONE_VERIFICATION'
          AND v.status IN ('SENDING','SENT','DELIVERED') AND v.expires_at > now()
          AND (
            SELECT count(*) FROM lead_phone_verifications o
            WHERE o.phone_e164 = ${phone} AND o.purpose = 'PHONE_VERIFICATION'
              AND o.status IN ('SENDING','SENT','DELIVERED') AND o.expires_at > now()
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
      WHERE phone_e164 = ${phone} AND purpose = 'PHONE_VERIFICATION'
        AND status IN ('SENDING','SENT','DELIVERED') AND expires_at > now()
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
