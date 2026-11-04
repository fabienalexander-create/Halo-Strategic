import { Resend } from 'resend';

// Narrow structural type for the one thing we need from @netlify/database's getDatabase()
// return value, so this module (and its tests) don't need the real database client.
export interface SqlDb {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<Array<Record<string, unknown>>>;
}

export type EmailType = 'APPLICATION_RECEIVED' | 'APPLICATION_APPROVED_FOR_COMMERCIAL_REVIEW';

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

export interface SendBuyerEmailParams {
  buyerId: number;
  emailType: EmailType;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendBuyerEmailResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
}

/**
 * Sends one of the two automated buyer-application emails and logs the attempt. Never throws --
 * callers (API routes) call this after their own database transaction has already committed, so
 * an email failure here must never be able to roll back a buyer application or admin decision.
 */
export async function sendBuyerEmail(db: SqlDb, params: SendBuyerEmailParams): Promise<SendBuyerEmailResult> {
  const { buyerId, emailType, to, subject, html, text } = params;

  try {
    const alreadySent = await db.sql`
      SELECT id FROM transactional_emails WHERE buyer_id = ${buyerId} AND email_type = ${emailType} AND status = 'SENT'
    `;
    if (alreadySent.length > 0) {
      return { sent: false, skipped: true };
    }
  } catch (err) {
    console.error('Email dedup check failed, proceeding without it', err);
  }

  const resend = getClient();
  if (!resend) {
    const message = 'RESEND_API_KEY is not configured';
    console.error(`Email not sent (${message}): ${emailType} for buyer ${buyerId}`);
    await logAttempt(db, { buyerId, emailType, to, status: 'FAILED', errorMessage: message });
    return { sent: false, skipped: false, error: message };
  }

  try {
    const { data, error } = await resend.emails.send({ from: DEFAULT_FROM_ADDRESS, to, subject, html, text });
    if (error) {
      const message = error.message ?? String(error);
      console.error(`Email send failed: ${emailType} for buyer ${buyerId}`, error);
      await logAttempt(db, { buyerId, emailType, to, status: 'FAILED', errorMessage: message });
      return { sent: false, skipped: false, error: message };
    }
    await logAttempt(db, { buyerId, emailType, to, status: 'SENT', providerMessageId: data?.id });
    return { sent: true, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Email send threw: ${emailType} for buyer ${buyerId}`, err);
    await logAttempt(db, { buyerId, emailType, to, status: 'FAILED', errorMessage: message });
    return { sent: false, skipped: false, error: message };
  }
}

async function logAttempt(
  db: SqlDb,
  entry: {
    buyerId: number;
    emailType: EmailType;
    to: string;
    status: 'SENT' | 'FAILED';
    providerMessageId?: string;
    errorMessage?: string;
  }
): Promise<void> {
  try {
    await db.sql`
      INSERT INTO transactional_emails (buyer_id, email_type, recipient, status, provider_message_id, error_message)
      VALUES (${entry.buyerId}, ${entry.emailType}, ${entry.to}, ${entry.status}, ${entry.providerMessageId ?? null}, ${entry.errorMessage ?? null})
    `;
  } catch (err) {
    // Logging the attempt is best-effort -- never let a logging failure surface as an email
    // failure, and never let it affect the caller's already-committed database transaction.
    console.error('Failed to log transactional email attempt', err);
  }
}
