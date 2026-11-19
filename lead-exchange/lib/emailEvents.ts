import type { SqlDb } from './email';

// Applies one signed Resend webhook event to the two buyer-facing outboxes (transactional_emails
// for applications, lead_delivery_emails for lead offers and unlocks). Rows are matched by
// provider_message_id, the only identifier the webhook carries. Every update is guarded on the
// current status, so a replayed or out-of-order event is a harmless no-op:
//   email.delivered        SENT -> DELIVERED
//   email.bounced          SENT/DELIVERED -> BOUNCED (not retried: the address needs fixing)
//   email.complained       SENT/DELIVERED -> COMPLAINED
//   email.failed           SENT -> FAILED (Resend could not send it; safe to retry)
//   anything else          recorded as last_event only (e.g. email.delivery_delayed)
// A SUPERSEDED row is never touched. Returns how many outbox rows the event matched.
export type ResendEventDetail = { reason?: string | null };

export async function applyResendEventToOutboxes(
  db: SqlDb,
  eventType: string,
  providerMessageId: string,
  detail: ResendEventDetail = {}
): Promise<number> {
  const reason = detail.reason ? String(detail.reason).slice(0, 500) : null;
  let matched = 0;
  for (const table of ['transactional_emails', 'lead_delivery_emails'] as const) {
    const rows = table === 'transactional_emails'
      ? await applyTransactional(db, eventType, providerMessageId, reason)
      : await applyLeadDelivery(db, eventType, providerMessageId, reason);
    matched += rows.length;
  }
  return matched;
}

// Table names cannot be parameters in a tagged template, so the two tables get the same SQL
// written out twice. Keep them identical.
async function applyTransactional(db: SqlDb, eventType: string, id: string, reason: string | null) {
  await db.sql`
    UPDATE transactional_emails SET last_event = ${eventType}, last_event_at = now(), updated_at = now()
    WHERE provider_message_id = ${id} AND status <> 'SUPERSEDED'
  `;
  if (eventType === 'email.delivered') {
    await db.sql`UPDATE transactional_emails SET status = 'DELIVERED', delivered_at = now() WHERE provider_message_id = ${id} AND status = 'SENT'`;
  } else if (eventType === 'email.bounced') {
    await db.sql`UPDATE transactional_emails SET status = 'BOUNCED', bounced_at = now(), error_message = ${reason ?? 'Bounced'} WHERE provider_message_id = ${id} AND status IN ('SENT', 'DELIVERED')`;
  } else if (eventType === 'email.complained') {
    await db.sql`UPDATE transactional_emails SET status = 'COMPLAINED', bounced_at = now(), error_message = 'Recipient marked as spam' WHERE provider_message_id = ${id} AND status IN ('SENT', 'DELIVERED')`;
  } else if (eventType === 'email.failed') {
    await db.sql`UPDATE transactional_emails SET status = 'FAILED', error_message = ${reason ?? 'Resend could not send this email'}, outcome_unknown = false WHERE provider_message_id = ${id} AND status = 'SENT'`;
  }
  return db.sql`SELECT id FROM transactional_emails WHERE provider_message_id = ${id}`;
}

async function applyLeadDelivery(db: SqlDb, eventType: string, id: string, reason: string | null) {
  await db.sql`
    UPDATE lead_delivery_emails SET last_event = ${eventType}, last_event_at = now(), updated_at = now()
    WHERE provider_message_id = ${id} AND status <> 'SUPERSEDED'
  `;
  if (eventType === 'email.delivered') {
    await db.sql`UPDATE lead_delivery_emails SET status = 'DELIVERED', delivered_at = now() WHERE provider_message_id = ${id} AND status = 'SENT'`;
  } else if (eventType === 'email.bounced') {
    await db.sql`UPDATE lead_delivery_emails SET status = 'BOUNCED', bounced_at = now(), error_message = ${reason ?? 'Bounced'} WHERE provider_message_id = ${id} AND status IN ('SENT', 'DELIVERED')`;
  } else if (eventType === 'email.complained') {
    await db.sql`UPDATE lead_delivery_emails SET status = 'COMPLAINED', bounced_at = now(), error_message = 'Recipient marked as spam' WHERE provider_message_id = ${id} AND status IN ('SENT', 'DELIVERED')`;
  } else if (eventType === 'email.failed') {
    await db.sql`UPDATE lead_delivery_emails SET status = 'FAILED', error_message = ${reason ?? 'Resend could not send this email'}, outcome_unknown = false WHERE provider_message_id = ${id} AND status = 'SENT'`;
  }
  return db.sql`SELECT id FROM lead_delivery_emails WHERE provider_message_id = ${id}`;
}
