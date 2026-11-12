import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { attemptSend } from '../../../../../../lib/email';
import { applicationReceivedEmail, applicationApprovedForCommercialReviewEmail } from '../../../../../../lib/emailTemplates';

// Retries a FAILED (or still-PENDING) outbox entry WITHOUT repeating the original application or
// approval action -- that's the whole point of the outbox. Idempotent: calling this on an entry
// that's already SENT/DELIVERED is a safe no-op (attemptSend skips it), so retrying twice, or
// retrying something that actually succeeded just before this request landed, never double-sends.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const outboxId = Number(params.id);
  if (!Number.isInteger(outboxId)) {
    return NextResponse.json({ error: 'Invalid outbox id.' }, { status: 400 });
  }

  const db = getDatabase();
  const rows = await db.sql`
    SELECT e.id, e.email_type, e.status, b.contact_name
    FROM transactional_emails e
    JOIN buyers b ON b.id = e.buyer_id
    WHERE e.id = ${outboxId}
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No matching outbox entry found.' }, { status: 404 });
  }

  const row = rows[0] as { id: number; email_type: string; status: string; contact_name: string };
  const content =
    row.email_type === 'APPLICATION_RECEIVED'
      ? applicationReceivedEmail(row.contact_name)
      : applicationApprovedForCommercialReviewEmail(row.contact_name);

  const result = await attemptSend(db, outboxId, content);
  return NextResponse.json(result);
}
