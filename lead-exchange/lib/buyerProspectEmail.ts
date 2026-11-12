import { randomBytes } from 'node:crypto';
import { Resend } from 'resend';

/**
 * A cryptographically random, unguessable unsubscribe token. 32 bytes (256 bits) of entropy,
 * hex-encoded so it's safe to put directly in a URL query string with no further escaping. Carries
 * no embedded structure -- it cannot be decoded to reveal a prospect id or email address, only
 * looked up against the database.
 */
export function generateUnsubscribeToken(): string {
  return randomBytes(32).toString('hex');
}

// Structural type so this module -- and its tests -- don't need the real database client. Same
// local-copy convention as every other outbox lib in this codebase (lib/email.ts, lib/sheetsSync.ts,
// lib/leadDeliveryEmail.ts).
export interface SqlDb {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<Array<Record<string, unknown>>>;
}

export type NurtureStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'SUPPRESSED';

export interface ProspectEmailRow {
  id: number;
  prospect_id: number;
  nurture_step: number;
  recipient: string;
  status: NurtureStatus;
}

interface ProspectEmailRowWithSuppression extends ProspectEmailRow {
  prospect_nurture_status: string;
  prospect_email_bounced_at: string | null;
  prospect_email_complained_at: string | null;
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
 *
 * Suppression is checked here, immediately before contacting the provider, not only when the send
 * was scheduled or created -- this is the only way to be safe against an unsubscribe (or a bounce
 * or complaint) that happened after the outbox row was created but before this attempt runs. The
 * database trigger (trg_buyer_prospect_emails_guard_suppression) is the authoritative backstop
 * behind this check: even if this check were skipped by a bug, the database itself refuses to let
 * the row reach SENT. Marketing-only unsubscribe is deliberately NOT a suppression reason here --
 * opting out of ongoing marketing must never stop the bounded introductory sequence.
 */
export async function attemptSendProspectEmail(
  db: SqlDb,
  id: number,
  content: { subject: string; html: string; text: string; headers?: Record<string, string> }
): Promise<AttemptSendResult> {
  const rows = await db.sql`
    SELECT e.id, e.prospect_id, e.nurture_step, e.recipient, e.status,
           p.nurture_status AS prospect_nurture_status,
           p.email_bounced_at AS prospect_email_bounced_at,
           p.email_complained_at AS prospect_email_complained_at
    FROM buyer_prospect_emails e
    JOIN buyer_prospects p ON p.id = e.prospect_id
    WHERE e.id = ${id}
  `;
  if (rows.length === 0) {
    return { sent: false, skipped: false, error: 'Outbox entry not found' };
  }
  const row = rows[0] as unknown as ProspectEmailRowWithSuppression;
  if (row.status === 'SENT' || row.status === 'DELIVERED') {
    return { sent: false, skipped: true };
  }

  if (
    row.prospect_nurture_status === 'UNSUBSCRIBED' ||
    row.prospect_email_bounced_at !== null ||
    row.prospect_email_complained_at !== null
  ) {
    const reason =
      row.prospect_nurture_status === 'UNSUBSCRIBED'
        ? 'prospect unsubscribed from the introductory sequence'
        : row.prospect_email_bounced_at !== null
          ? 'recipient previously bounced'
          : 'recipient previously complained';
    console.error(`Prospect nurture email suppressed (${reason}): step ${row.nurture_step} for prospect ${row.prospect_id} (outbox #${id})`);
    await markOutcome(db, id, { status: 'SUPPRESSED', errorMessage: reason });
    return { sent: false, skipped: true, error: reason };
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
      ...(content.headers ? { headers: content.headers } : {}),
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
  outcome: { status: 'SENT' | 'FAILED' | 'SUPPRESSED'; providerMessageId?: string; errorMessage?: string }
): Promise<void> {
  try {
    if (outcome.status === 'SENT') {
      await db.sql`
        UPDATE buyer_prospect_emails
        SET status = 'SENT', provider_message_id = ${outcome.providerMessageId ?? null}, error_message = NULL,
            attempt_count = attempt_count + 1, sent_at = now(), updated_at = now()
        WHERE id = ${id}
      `;
    } else if (outcome.status === 'SUPPRESSED') {
      // Not an attempt_count increment -- this was never actually attempted against the provider,
      // it was refused before that point. Kept as its own branch so FAILED (a real provider-level
      // failure, worth retrying) is never confused with a deliberate suppression (never retry).
      await db.sql`
        UPDATE buyer_prospect_emails
        SET status = 'SUPPRESSED', error_message = ${outcome.errorMessage ?? null}, updated_at = now()
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
 * Marks a prospect nurture outbox row DELIVERED, by provider message id -- called from the Resend
 * webhook (app/api/webhooks/resend/route.ts). Guarded to only move a row out of SENT, same
 * discipline as lib/email.ts's markDelivered for transactional_emails, so a duplicate or
 * out-of-order webhook delivery is a harmless no-op.
 */
export async function markProspectEmailDelivered(db: SqlDb, providerMessageId: string): Promise<void> {
  await db.sql`
    UPDATE buyer_prospect_emails
    SET status = 'DELIVERED', delivered_at = now(), updated_at = now()
    WHERE provider_message_id = ${providerMessageId} AND status = 'SENT'
  `;
}

/**
 * Marks the specific outbox row BOUNCED and, separately, suppresses the prospect's address going
 * forward (email_bounced_at) -- a hard bounce means the address itself doesn't work, so this blocks
 * every future send to that prospect via lib/buyerProspectEmail.ts's suppression check and the
 * database guard trigger, not just this one outbox row. Idempotent: COALESCE means a repeated
 * bounce webhook for the same address never overwrites the original bounce time.
 */
export async function markProspectEmailBounced(db: SqlDb, providerMessageId: string): Promise<void> {
  const rows = await db.sql`
    UPDATE buyer_prospect_emails SET status = 'BOUNCED', updated_at = now()
    WHERE provider_message_id = ${providerMessageId} AND status IN ('SENT', 'PENDING')
    RETURNING prospect_id
  `;
  if (rows.length === 0) return;
  const prospectId = (rows[0] as { prospect_id: number }).prospect_id;
  await db.sql`
    UPDATE buyer_prospects SET email_bounced_at = COALESCE(email_bounced_at, now()) WHERE id = ${prospectId}
  `;
}

/**
 * Same as markProspectEmailBounced, for a spam complaint. A complaint is a stronger signal than a
 * bounce (the recipient actively marked this as spam) but is handled identically: suppress the
 * prospect's address for every future send, keep the original audit trail on the outbox row.
 */
export async function markProspectEmailComplained(db: SqlDb, providerMessageId: string): Promise<void> {
  const rows = await db.sql`
    UPDATE buyer_prospect_emails SET status = 'COMPLAINED', updated_at = now()
    WHERE provider_message_id = ${providerMessageId} AND status IN ('SENT', 'PENDING')
    RETURNING prospect_id
  `;
  if (rows.length === 0) return;
  const prospectId = (rows[0] as { prospect_id: number }).prospect_id;
  await db.sql`
    UPDATE buyer_prospects SET email_complained_at = COALESCE(email_complained_at, now()) WHERE id = ${prospectId}
  `;
}

/**
 * Convenience wrapper: create (or find) the outbox entry for this prospect+step, then attempt to
 * send. Safe to call repeatedly from the scheduled function -- creation is idempotent, and a
 * step already SENT is skipped, so a function invocation that overlaps the previous one never
 * double-sends.
 */
export async function sendProspectNurtureEmail(
  db: SqlDb,
  params: { prospectId: number; nurtureStep: number; to: string; subject: string; html: string; text: string; headers?: Record<string, string> }
): Promise<AttemptSendResult> {
  const outbox = await createProspectEmailEntry(db, { prospectId: params.prospectId, nurtureStep: params.nurtureStep, recipient: params.to });
  return attemptSendProspectEmail(db, outbox.id, { subject: params.subject, html: params.html, text: params.text, headers: params.headers });
}
