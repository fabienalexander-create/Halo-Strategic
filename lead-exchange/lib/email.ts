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
export type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED';

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
}

/**
 * Attempts to send the email for an existing outbox row, identified by its id -- this is the
 * event's unique identifier, and sending against it is idempotent: a row already SENT or
 * DELIVERED is skipped without contacting the provider again, so this is safe to call from a
 * manual retry as many times as needed. Never throws -- callers (API routes, the retry endpoint)
 * rely on that so an email failure can never undo an already-committed business operation.
 */
export async function attemptSend(
  db: SqlDb,
  outboxId: number,
  content: { subject: string; html: string; text: string }
): Promise<AttemptSendResult> {
  const rows = await db.sql`SELECT id, buyer_id, email_type, recipient, status FROM transactional_emails WHERE id = ${outboxId}`;
  if (rows.length === 0) {
    return { sent: false, skipped: false, error: 'Outbox entry not found' };
  }
  const row = rows[0] as unknown as OutboxRow;
  if (row.status === 'SENT' || row.status === 'DELIVERED') {
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
    // recipient is normally a single address; ADMIN_NEW_APPLICATION may store several
    // admin_users addresses as a comma-separated list, since Resend's `to` accepts an array.
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
      const message = error.message ?? String(error);
      console.error(`Email send failed: ${row.email_type} for buyer ${row.buyer_id} (outbox #${outboxId})`, error);
      await markOutcome(db, outboxId, { status: 'FAILED', errorMessage: message });
      return { sent: false, skipped: false, error: message };
    }
    await markOutcome(db, outboxId, { status: 'SENT', providerMessageId: data?.id });
    return { sent: true, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Email send threw: ${row.email_type} for buyer ${row.buyer_id} (outbox #${outboxId})`, err);
    await markOutcome(db, outboxId, { status: 'FAILED', errorMessage: message });
    return { sent: false, skipped: false, error: message };
  }
}

async function markOutcome(
  db: SqlDb,
  outboxId: number,
  outcome: { status: 'SENT' | 'FAILED'; providerMessageId?: string; errorMessage?: string }
): Promise<void> {
  try {
    if (outcome.status === 'SENT') {
      await db.sql`
        UPDATE transactional_emails
        SET status = 'SENT', provider_message_id = ${outcome.providerMessageId ?? null}, error_message = NULL,
            attempt_count = attempt_count + 1, sent_at = now(), updated_at = now()
        WHERE id = ${outboxId}
      `;
    } else {
      await db.sql`
        UPDATE transactional_emails
        SET status = 'FAILED', error_message = ${outcome.errorMessage ?? null},
            attempt_count = attempt_count + 1, updated_at = now()
        WHERE id = ${outboxId}
      `;
    }
  } catch (err) {
    // Recording the outcome is best-effort -- never let it surface as a send failure, and never
    // let it affect the caller's already-committed business transaction.
    console.error(`Failed to record outcome for outbox #${outboxId}`, err);
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
