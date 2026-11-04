import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

// Read-only visibility into the email outbox -- "you can see exactly which applicants received
// notifications" (Fabien's brief). No send/retry action here; see [id]/retry for that.
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const db = getDatabase();
  const rows = await db.sql`
    SELECT e.id, e.buyer_id, b.application_reference, e.email_type, e.recipient, e.status,
           e.error_message, e.attempt_count, e.sent_at, e.delivered_at, e.created_at
    FROM transactional_emails e
    JOIN buyers b ON b.id = e.buyer_id
    ORDER BY e.created_at DESC
    LIMIT 200
  `;
  return NextResponse.json({ emails: rows });
}
