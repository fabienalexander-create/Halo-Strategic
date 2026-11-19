import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

// Read-only view of every buyer-facing email (Fabien, 2026-11-19: "an admin view showing sent,
// delivered, bounced and failed emails"): application emails (transactional_emails) and lead
// offer/unlock emails with their internal copies (lead_delivery_emails), newest first.
// ?status=FAILED etc. filters both. Prospect nurture emails keep their own page.
const STATUSES = ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'COMPLAINED', 'SUPERSEDED'];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const status = req.nextUrl.searchParams.get('status');
  if (status && !STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Unknown status filter.' }, { status: 400 });
  }
  const filter = status ?? null;

  const db = getDatabase();
  const rows = await db.sql`
    SELECT * FROM (
      SELECT 'application' AS kind, e.id, e.email_type, e.recipient, e.status, e.error_message, e.attempt_count,
             e.sent_at, e.delivered_at, e.bounced_at, e.last_event, e.last_event_at, e.outcome_unknown,
             e.send_claimed_at, e.superseded_reason, e.created_at,
             b.application_reference AS reference, b.company_name
      FROM transactional_emails e JOIN buyers b ON b.id = e.buyer_id
      UNION ALL
      SELECT 'lead' AS kind, e.id, e.email_type, e.recipient, e.status, e.error_message, e.attempt_count,
             e.sent_at, e.delivered_at, e.bounced_at, e.last_event, e.last_event_at, e.outcome_unknown,
             e.send_claimed_at, e.superseded_reason, e.created_at,
             'HLX-LEAD-' || lpad(a.lead_id::text, 6, '0') AS reference, b.company_name
      FROM lead_delivery_emails e
      JOIN lead_allocations a ON a.id = e.lead_allocation_id
      JOIN buyers b ON b.id = a.buyer_id
    ) all_emails
    WHERE ${filter}::text IS NULL OR status = ${filter}
    ORDER BY created_at DESC, id DESC
    LIMIT 300
  `;
  const counts = await db.sql`
    SELECT status, count(*)::int AS n FROM (
      SELECT status FROM transactional_emails UNION ALL SELECT status FROM lead_delivery_emails
    ) s GROUP BY status
  `;
  return NextResponse.json({
    emails: rows,
    counts: Object.fromEntries(counts.map((c) => [c.status as string, c.n as number])),
    webhook_configured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
  });
}
