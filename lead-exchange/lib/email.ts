import { Resend } from 'resend';

// Narrow structural type for the one thing we need from @netlify/database's getDatabase()
// return value (or a transaction client exposing the same .sql tag), so this module -- and its
// tests -- don't need the real database client.
export interface SqlDb {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<Array<Record<string, unknown>>>;
}

export type EmailType =
  | 'APPLICATION_RECEIVED'
  | 'APPLICATION_APPROVED_FOR_COMMERCIAL_REVIEW'
  | 'ADMIN_NEW_APPLICATION';
export type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'SUPERSEDED';

export interface OutboxRow {
  id: number;
  buyer_id: number;
  email_type: EmailType;
  recipient: string;
  status: OutboxStatus;
}

const DEFAULT_FROM_ADDRESS = 'Halo Strategic <hello@halostrategic.com>';

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new Resend(apiKey);
  return cachedClient;
}

// Exposed only so tests can reset the module-level cache between cases.
export function resetEmailClientCacheForTests(): void {
  cachedClient = null;
}

/**
 * Creates the outbox row for one buyer-application email event, or returns the existing one.
 * This IS the idempotency boundary: (buyer_id, email_type) is unique, so calling this twice for
 * the same event (e.g. a retried HTTP request) never creates a second row. Call this in the same
 * step/transaction as the business event it represents (the application insert, or the approval
 * update) -- not afterwards -- so the outbox entry can never be lost even if the process dies
 * before a send is ever attempted.
 */
export async function createOutboxEntry(
  db: SqlDb,
  params: { buyerId: number; emailType: EmailType; recipient: string }
): Promise<OutboxRow> {
  const inserted = await db.sql`
    INSERT INTO transactional_emails (buyer_id, email_type, recipient, status)
    VALUES (${params.buyerId}, ${params.emailType}, ${params.recipient}, 'PENDING')
    ON CONFLICT (buyer_id, email_type) DO NOTHING
    RETURNING id, buyer_id, email_type, recipient, status
  `;
  if (inserted.length > 0) {
    return inserted[0] as unknown as OutboxRow;
  }
  // Already exists -- fetch it rather than silently doing nothing, so the caller can still
  // decide whether a send attempt is worth making (e.g. it's still PENDING or FAILED).
  const existing = await db.sql`
    SELECT id, buyer_id, email_type, recipient, status FROM transactional_emails
    WHERE buyer_id = ${params.buyerId} AND email_type = ${params.emailType}
  `;
  return existing[0] as unknown as OutboxRow;
}

export interface AttemptSendResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
  // True when an earlier attempt may already have reached the recipient (see outcome_unknown).
  outcomeUnknown?: boolean;
}

export interface AttemptSendOptions {
  // An admin has checked and the recipient did not receive the earlier attempt. Only then is a
  // row whose outcome is unknown sent again.
  confirmedNotReceived?: boolean;
}

// Statuses that are final for sending purposes: the message went out, or it must never go.
const NOT_SENDABLE = new Set(['SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'SUPERSEDED']);

/**
 * Attempts to send the email for an existing outbox row. Safe to call any number of times, from
 * any number of requests at once (Fabien, 2026-11-19: retries must never duplicate a buyer
 * notification):
 *  - a row that already went out, bounced, or was superseded is never sent again;
 *  - the row is claimed atomically (send_claimed_at) before Resend is called, so only one request
 *    can be sending it at a time;
 *  - if Resend's answer is lost (network error), the row is marked outcome_unknown and is not
 *    resent until an admin confirms the recipient did not get it.
 * Never throws, so an email problem can never undo an already-committed business operation.
 */
export async function attemptSend(
  db: SqlDb,
  outboxId: number,
  content: { subject: string; html: string; text: string },
  options: AttemptSendOptions = {}
): Promise<AttemptSendResult> {
  const rows = await db.sql`SELECT id, buyer_id, email_type, recipient, status, outcome_unknown FROM transactional_emails WHERE id = ${outboxId}`;
  if (rows.length === 0) {
    return { sent: false, skipped: false, error: 'Outbox entry not found' };
  }
  const row = rows[0] as unknown as OutboxRow & { outcome_unknown?: boolean };
  if (NOT_SENDABLE.has(row.status)) {
    return { sent: false, skipped: true };
  }
  if (row.outcome_unknown && !options.confirmedNotReceived) {
    return {
      sent: false, skipped: false, outcomeUnknown: true,
      error: 'An earlier attempt may already have been delivered. Check with the recipient, then retry with confirmation.',
    };
  }

  const confirmed = options.confirmedNotReceived === true;
  const claimed = await db.sql`
    UPDATE transactional_emails
    SET send_claimed_at = now(), updated_at = now()
    WHERE id = ${outboxId}
      AND status IN ('PENDING', 'FAILED')
      AND (
        (send_claimed_at IS NULL AND outcome_unknown = false)
        OR (${confirmed} AND (send_claimed_at IS NULL OR send_claimed_at < now() - interval '10 minutes'))
      )
    RETURNING id
  `;
  if (claimed.length === 0) {
    // Another request holds the claim (sending right now), or the row changed underneath us.
    return { sent: false, skipped: true };
  }

  const resend = getClient();
  if (!resend) {
    const message = 'RESEND_API_KEY is not configured';
    console.error(`Email not sent (${message}): ${row.email_type} for buyer ${row.buyer_id} (outbox #${outboxId})`);
    await markOutcome(db, outboxId, { status: 'FAILED', errorMessage: message });
    return { sent: false, skipped: false, error: message };
  }

  try {
    // recipient is normally a single address; internal/admin copies may hold a comma-separated
    // list, since Resend's `to` accepts an array.
    const to = row.recipient.includes(',')
      ? row.recipient.split(',').map((address) => address.trim())
      : row.recipient;

    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM_ADDRESS,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    if (error) {
      // Resend answered and refused: definitely not sent, safe to retry.
      const message = error.message ?? String(error);
      console.error(`Email send failed: ${row.email_type} for buyer ${row.buyer_id} (outbox #${outboxId})`, error);
      await markOutcome(db, outboxId, { status: 'FAILED', errorMessage: message });
      return { sent: false, skipped: false, error: message };
    }
    await markOutcome(db, outboxId, { status: 'SENT', providerMessageId: data?.id });
    return { sent: true, skipped: false };
  } catch (err) {
    // No answer from Resend: the message may or may not have gone out.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Email send threw: ${row.email_type} for buyer ${row.buyer_id} (outbox #${outboxId})`, err);
    await markOutcome(db, outboxId, { status: 'FAILED', errorMessage: `Outcome unknown: ${message}`, outcomeUnknown: true });
    return { sent: false, skipped: false, error: message, outcomeUnknown: true };
  }
}

async function markOutcome(
  db: SqlDb,
  outboxId: number,
  outcome: { status: 'SENT' | 'FAILED'; providerMessageId?: string; errorMessage?: string; outcomeUnknown?: boolean }
): Promise<void> {
  try {
    if (outcome.status === 'SENT') {
      await db.sql`
        UPDATE transactional_emails
        SET status = 'SENT', provider_message_id = ${outcome.providerMessageId ?? null}, error_message = NULL,
            attempt_count = attempt_count + 1, sent_at = now(), updated_at = now(),
            send_claimed_at = NULL, outcome_unknown = false
        WHERE id = ${outboxId}
      `;
    } else {
      await db.sql`
        UPDATE transactional_emails
        SET status = 'FAILED', error_message = ${outcome.errorMessage ?? null},
            attempt_count = attempt_count + 1, updated_at = now(),
            send_claimed_at = NULL, outcome_unknown = ${outcome.outcomeUnknown === true}
        WHERE id = ${outboxId}
      `;
    }
  } catch (err) {
    // Recording the outcome is best-effort -- never let it surface as a send failure. If it
    // fails, send_claimed_at stays set, so the row is treated as outcome unknown, never resent
    // automatically.
    console.error(`Failed to record outcome for transactional_emails #${outboxId}`, err);
  }
}

/**
 * Convenience wrapper for the two call sites: create (or find) the outbox entry, then attempt to
 * send against it. Safe to call on every request -- the outbox creation is idempotent, and
 * attemptSend skips a row that's already SENT/DELIVERED, so a retried request never double-sends.
 */
export async function sendBuyerEmail(
  db: SqlDb,
  params: { buyerId: number; emailType: EmailType; to: string; subject: string; html: string; text: string }
): Promise<AttemptSendResult> {
  const outbox = await createOutboxEntry(db, { buyerId: params.buyerId, emailType: params.emailType, recipient: params.to });
  return attemptSend(db, outbox.id, { subject: params.subject, html: params.html, text: params.text });
}

/**
 * Marks an outbox row DELIVERED once the provider's webhook confirms delivery (where the
 * provider supports delivery webhooks) -- distinct from SENT, which only means the provider
 * accepted the message. Looked up by provider_message_id since that's all a delivery webhook
 * carries. A row not found or not currently SENT is left alone (e.g. a replayed webhook, or one
 * for a message this table never logged).
 */
export async function markDelivered(db: SqlDb, providerMessageId: string): Promise<void> {
  await db.sql`
    UPDATE transactional_emails
    SET status = 'DELIVERED', delivered_at = now(), updated_at = now()
    WHERE provider_message_id = ${providerMessageId} AND status = 'SENT'
  `;
}
