import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

const VALID_STATUSES = new Set(['PENDING', 'SENT', 'FAILED', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'SUPPRESSED']);

// Read-only visibility into the prospect nurture outbox -- the gap that let
// HLX-PROSPECT-000003's failed welcome email go unnoticed except by reading raw Netlify function
// logs by hand. No send/retry action here, deliberately -- this view exists to make a failure or
// suppression visible, not to let anyone resend from the admin UI yet.
//
// Fields are limited to what's needed to triage a delivery problem: recipient (needed to identify
// who), status/error/timestamps, and the prospect's current nurture_status (so a SUPPRESSED row's
// cause -- unsubscribed, paused, bounced, complained -- is visible without a second lookup). This
// deliberately leaves out consent_evidence/raw_form_answers and any other prospect field not
// needed for this purpose.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const statusParam = req.nextUrl.searchParams.get('status');
  const statuses = statusParam
    ? statusParam.split(',').map((s) => s.trim().toUpperCase()).filter((s) => VALID_STATUSES.has(s))
    : null;
  if (statusParam && (!statuses || statuses.length === 0)) {
    return NextResponse.json({ error: 'No recognised status values in the status filter.' }, { status: 400 });
  }

  const db = getDatabase();
  const rows = statuses
    ? await db.sql`
        SELECT e.id, e.prospect_id, p.prospect_reference, p.company_name, p.contact_name,
               e.nurture_step, e.recipient, e.status, e.error_message, e.attempt_count,
               e.sent_at, e.delivered_at, e.created_at,
               p.nurture_status AS prospect_nurture_status,
               p.email_bounced_at AS prospect_email_bounced_at,
               p.email_complained_at AS prospect_email_complained_at
        FROM buyer_prospect_emails e
        JOIN buyer_prospects p ON p.id = e.prospect_id
        WHERE e.status = ANY(${statuses})
        ORDER BY e.created_at DESC
        LIMIT 200
      `
    : await db.sql`
        SELECT e.id, e.prospect_id, p.prospect_reference, p.company_name, p.contact_name,
               e.nurture_step, e.recipient, e.status, e.error_message, e.attempt_count,
               e.sent_at, e.delivered_at, e.created_at,
               p.nurture_status AS prospect_nurture_status,
               p.email_bounced_at AS prospect_email_bounced_at,
               p.email_complained_at AS prospect_email_complained_at
        FROM buyer_prospect_emails e
        JOIN buyer_prospects p ON p.id = e.prospect_id
        ORDER BY e.created_at DESC
        LIMIT 200
      `;
  return NextResponse.json({ emails: rows });
}
