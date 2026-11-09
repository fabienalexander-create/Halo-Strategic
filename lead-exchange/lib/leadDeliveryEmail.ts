import { Resend } from 'resend';

// Structural type so this module -- and its tests -- don't need the real database client.
// Deliberately a local copy of the same shape as lib/email.ts's SqlDb, matching that module's
// own convention (lib/sheetsSync.ts also keeps its own copy) rather than a shared import.
export interface SqlDb {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<Array<Record<string, unknown>>>;
}

export type LeadDeliveryEmailType = 'LEAD_OFFER' | 'LEAD_UNLOCKED' | 'INTERNAL_OFFER_COPY' | 'INTERNAL_RELEASE_COPY';
export type LeadDeliveryEmailStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED';

export interface LeadDeliveryEmailRow {
  id: number;
  lead_allocation_id: number;
  email_type: LeadDeliveryEmailType;
  recipient: string;
  status: LeadDeliveryEmailStatus;
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
export function resetLeadDeliveryEmailClientCacheForTests(): void {
  cachedClient = null;
}

export interface CreateEntryResult {
  row: LeadDeliveryEmailRow | null;
  // True when LEAD_UNLOCKED/INTERNAL_RELEASE_COPY was refused by the database's release gate
  // (trg_lead_delivery_emails_release_guard -> allocation_release_check) -- e.g. payment not yet
  // verified, or consent withdrawn. Not an error to log and swallow like a send failure: it means
  // this allocation genuinely isn't releasable yet, and the caller (the payment-verification
  // route) needs to know that rather than assume the unlock email is on its way.
  blocked: boolean;
  blockedReason?: string;
}

/**
 * Creates the outbox row for one lead-allocation email event, or returns the existing one.
 * (lead_allocation_id, email_type) is the idempotency boundary here -- distinct from
 * transactional_emails' (buyer_id, email_type), since one buyer can receive the same email_type
 * (e.g. LEAD_OFFER) for many different allocations. Call this in the same step as the business
 * event it represents, same discipline as lib/email.ts's createOutboxEntry.
 */
export async function createLeadDeliveryEmailEntry(
  db: SqlDb,
  params: { leadAllocationId: number; emailType: LeadDeliveryEmailType; recipient: string }
): Promise<CreateEntryResult> {
  try {
    const inserted = await db.sql`
      INSERT INTO lead_delivery_emails (lead_allocation_id, email_type, recipient, status)
      VALUES (${params.leadAllocationId}, ${params.emailType}, ${params.recipient}, 'PENDING')
      ON CONFLICT (lead_allocation_id, email_type) DO NOTHING
      RETURNING id, lead_allocation_id, email_type, recipient, status
    `;
    if (inserted.length > 0) {
      return { row: inserted[0] as unknown as LeadDeliveryEmailRow, blocked: false };
    }
    const existing = await db.sql`
      SELECT id, lead_allocation_id, email_type, recipient, status FROM lead_delivery_emails
      WHERE lead_allocation_id = ${params.leadAllocationId} AND email_type = ${params.emailType}
    `;
    return { row: (existing[0] as unknown as LeadDeliveryEmailRow) ?? null, blocked: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { row: null, blocked: true, blockedReason: message };
  }
}

export interface AttemptSendResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
}

/**
 * Attempts to send the email for an existing lead_delivery_emails row, identified by its id.
 * Idempotent: a row already SENT or DELIVERED is skipped without contacting the provider again,
 * so this is safe to call from the admin retry endpoint as many times as needed. Never throws --
 * same reason as lib/email.ts's attemptSend: a failed email must never undo an already-committed
 * payment verification or delivery record.
 */
export async function attemptSendLeadDeliveryEmail(
  db: SqlDb,
  id: number,
  content: { subject: string; html: string; text: string }
): Promise<AttemptSendResult> {
  const rows = await db.sql`SELECT id, lead_allocation_id, email_type, recipient, status FROM lead_delivery_emails WHERE id = ${id}`;
  if (rows.length === 0) {
    return { sent: false, skipped: false, error: 'Outbox entry not found' };
  }
  const row = rows[0] as unknown as LeadDeliveryEmailRow;
  if (row.status === 'SENT' || row.status === 'DELIVERED') {
    return { sent: false, skipped: true };
  }

  const resend = getClient();
  if (!resend) {
    const message = 'RESEND_API_KEY is not configured';
    console.error(`Lead delivery email not sent (${message}): ${row.email_type} for allocation ${row.lead_allocation_id} (outbox #${id})`);
    await markOutcome(db, id, { status: 'FAILED', errorMessage: message });
    return { sent: false, skipped: false, error: message };
  }

  try {
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
      console.error(`Lead delivery email send failed: ${row.email_type} for allocation ${row.lead_allocation_id} (outbox #${id})`, error);
      await markOutcome(db, id, { status: 'FAILED', errorMessage: message });
      return { sent: false, skipped: false, error: message };
    }
    await markOutcome(db, id, { status: 'SENT', providerMessageId: data?.id });
    return { sent: true, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Lead delivery email send threw: ${row.email_type} for allocation ${row.lead_allocation_id} (outbox #${id})`, err);
    await markOutcome(db, id, { status: 'FAILED', errorMessage: message });
    return { sent: false, skipped: false, error: message };
  }
}

async function markOutcome(
  db: SqlDb,
  id: number,
  outcome: { status: 'SENT' | 'FAILED'; providerMessageId?: string; errorMessage?: string }
): Promise<void> {
  try {
    if (outcome.status === 'SENT') {
      await db.sql`
        UPDATE lead_delivery_emails
        SET status = 'SENT', provider_message_id = ${outcome.providerMessageId ?? null}, error_message = NULL,
            attempt_count = attempt_count + 1, sent_at = now(), updated_at = now()
        WHERE id = ${id}
      `;
    } else {
      await db.sql`
        UPDATE lead_delivery_emails
        SET status = 'FAILED', error_message = ${outcome.errorMessage ?? null},
            attempt_count = attempt_count + 1, updated_at = now()
        WHERE id = ${id}
      `;
    }
  } catch (err) {
    console.error(`Failed to record outcome for lead delivery email outbox #${id}`, err);
  }
}

export interface SendLeadDeliveryEmailResult extends AttemptSendResult {
  blocked: boolean;
  blockedReason?: string;
}

/**
 * Convenience wrapper: create (or find) the outbox entry, then attempt to send against it. Safe
 * to call every time the triggering event happens (an allocation offered, a payment verified) --
 * creation is idempotent, and a blocked LEAD_UNLOCKED/INTERNAL_RELEASE_COPY entry (release gate
 * not yet satisfied) is reported back rather than thrown, so the caller can decide what to do
 * (e.g. leave the allocation PAID but not yet released, for a human to look at).
 */
export async function sendLeadDeliveryEmail(
  db: SqlDb,
  params: { leadAllocationId: number; emailType: LeadDeliveryEmailType; to: string; subject: string; html: string; text: string }
): Promise<SendLeadDeliveryEmailResult> {
  const created = await createLeadDeliveryEmailEntry(db, {
    leadAllocationId: params.leadAllocationId,
    emailType: params.emailType,
    recipient: params.to,
  });
  if (created.blocked || !created.row) {
    return { sent: false, skipped: false, blocked: created.blocked, blockedReason: created.blockedReason };
  }
  const result = await attemptSendLeadDeliveryEmail(db, created.row.id, {
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
  return { ...result, blocked: false };
}
