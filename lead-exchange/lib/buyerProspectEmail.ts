import { Resend } from 'resend';

// Structural type so this module -- and its tests -- don't need the real database client. Same
// local-copy convention as every other outbox lib in this codebase (lib/email.ts, lib/sheetsSync.ts,
// lib/leadDeliveryEmail.ts).
export interface SqlDb {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<Array<Record<string, unknown>>>;
}

export type NurtureStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED';

export interface ProspectEmailRow {
  id: number;
  prospect_id: number;
  nurture_step: number;
  recipient: string;
  status: NurtureStatus;
}

const DEFAULT_FROM_ADDRESS = 'Halo Strategic <hello@halostrategic.com>';

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new Resend(apiKey);
  return cachedClient;
}

export function resetBuyerProspectEmailClientCacheForTests(): void {
  cachedClient = null;
}

/**
 * Creates the outbox row for one (prospect, nurture step) -- the idempotency boundary. Calling
 * this twice for the same prospect and step (e.g. the scheduled function running twice before the
 * first run's row is visible) never creates a second row, so a step can never be sent twice or
 * skipped.
 */
export async function createProspectEmailEntry(
  db: SqlDb,
  params: { prospectId: number; nurtureStep: number; recipient: string }
): Promise<ProspectEmailRow> {
  const inserted = await db.sql`
    INSERT INTO buyer_prospect_emails (prospect_id, nurture_step, recipient, status)
    VALUES (${params.prospectId}, ${params.nurtureStep}, ${params.recipient}, 'PENDING')
    ON CONFLICT (prospect_id, nurture_step) DO NOTHING
    RETURNING id, prospect_id, nurture_step, recipient, status
  `;
  if (inserted.length > 0) {
    return inserted[0] as unknown as ProspectEmailRow;
  }
  const existing = await db.sql`
    SELECT id, prospect_id, nurture_step, recipient, status FROM buyer_prospect_emails
    WHERE prospect_id = ${params.prospectId} AND nurture_step = ${params.nurtureStep}
  `;
  return existing[0] as unknown as ProspectEmailRow;
}

export interface AttemptSendResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
}

/**
 * Attempts to send one nurture email, identified by its outbox id. Idempotent: a row already
 * SENT or DELIVERED is skipped without contacting the provider again. Never throws -- a failed
 * nurture send must never block the scheduled function from moving on to the next prospect.
 */
export async function attemptSendProspectEmail(
  db: SqlDb,
  id: number,
  content: { subject: string; html: string; text: string }
): Promise<AttemptSendResult> {
  const rows = await db.sql`SELECT id, prospect_id, nurture_step, recipient, status FROM buyer_prospect_emails WHERE id = ${id}`;
  if (rows.length === 0) {
    return { sent: false, skipped: false, error: 'Outbox entry not found' };
  }
  const row = rows[0] as unknown as ProspectEmailRow;
  if (row.status === 'SENT' || row.status === 'DELIVERED') {
    return { sent: false, skipped: true };
  }

  const resend = getClient();
  if (!resend) {
    const message = 'RESEND_API_KEY is not configured';
    console.error(`Prospect nurture email not sent (${message}): step ${row.nurture_step} for prospect ${row.prospect_id} (outbox #${id})`);
    await markOutcome(db, id, { status: 'FAILED', errorMessage: message });
    return { sent: false, skipped: false, error: message };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM_ADDRESS,
      to: row.recipient,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    if (error) {
      const message = error.message ?? String(error);
      console.error(`Prospect nurture email send failed: step ${row.nurture_step} for prospect ${row.prospect_id} (outbox #${id})`, error);
      await markOutcome(db, id, { status: 'FAILED', errorMessage: message });
      return { sent: false, skipped: false, error: message };
    }
    await markOutcome(db, id, { status: 'SENT', providerMessageId: data?.id });
    return { sent: true, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Prospect nurture email send threw: step ${row.nurture_step} for prospect ${row.prospect_id} (outbox #${id})`, err);
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
        UPDATE buyer_prospect_emails
        SET status = 'SENT', provider_message_id = ${outcome.providerMessageId ?? null}, error_message = NULL,
            attempt_count = attempt_count + 1, sent_at = now(), updated_at = now()
        WHERE id = ${id}
      `;
    } else {
      await db.sql`
        UPDATE buyer_prospect_emails
        SET status = 'FAILED', error_message = ${outcome.errorMessage ?? null},
            attempt_count = attempt_count + 1, updated_at = now()
        WHERE id = ${id}
      `;
    }
  } catch (err) {
    console.error(`Failed to record outcome for prospect nurture outbox #${id}`, err);
  }
}

/**
 * Convenience wrapper: create (or find) the outbox entry for this prospect+step, then attempt to
 * send. Safe to call repeatedly from the scheduled function -- creation is idempotent, and a
 * step already SENT is skipped, so a function invocation that overlaps the previous one never
 * double-sends.
 */
export async function sendProspectNurtureEmail(
  db: SqlDb,
  params: { prospectId: number; nurtureStep: number; to: string; subject: string; html: string; text: string }
): Promise<AttemptSendResult> {
  const outbox = await createProspectEmailEntry(db, { prospectId: params.prospectId, nurtureStep: params.nurtureStep, recipient: params.to });
  return attemptSendProspectEmail(db, outbox.id, { subject: params.subject, html: params.html, text: params.text });
}
