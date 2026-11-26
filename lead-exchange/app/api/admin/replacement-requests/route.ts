import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { LedgerError, recordReplacementRequest, ReplacementReasonCode } from '../../../../lib/creditsLedger';

interface Body {
  lead_allocation_id?: number;
  reason_code?: ReplacementReasonCode;
  reason?: string;
  reported_at?: string;
  documented_contact_attempts?: unknown[];
}

// The replacement queue. days_after_delivery is shown for the claim window; whether a late claim
// is accepted is an admin decision under the applicable policy.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;
  try {
    const db = getDatabase();
    const rows = await db.sql`
      SELECT r.id, r.status, r.reason_code, r.reason, r.reported_at, r.recorded_by, r.created_at,
             r.decided_by, r.decided_at, r.admin_decision_notes, r.resolution, r.resolved_by, r.resolved_at,
             r.replacement_allocation_id, r.refund_amount, r.refund_transaction_reference, r.refunded_at,
             d.lead_allocation_id, d.delivered_at,
             floor(extract(epoch FROM (r.reported_at - d.delivered_at)) / 86400)::int AS days_after_delivery,
             la.lead_id, la.package_id, la.agreed_price, b.company_name
      FROM replacement_requests r
      JOIN deliveries d ON d.id = r.delivery_id
      JOIN lead_allocations la ON la.id = d.lead_allocation_id
      JOIN buyers b ON b.id = r.requested_by_buyer_id
      ORDER BY (r.status = 'PENDING_ADMIN_REVIEW') DESC, (r.status = 'APPROVED' AND r.resolution IS NULL) DESC, r.created_at DESC`;
    return NextResponse.json({ requests: rows });
  } catch (err) {
    console.error('Listing replacement requests failed', err);
    return NextResponse.json({ error: 'Failed to list replacement requests.' }, { status: 500 });
  }
}

// Records a buyer's claim against a delivered lead.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body.lead_allocation_id) return NextResponse.json({ error: 'lead_allocation_id is required.' }, { status: 400 });
  try {
    const db = getDatabase();
    const result = await recordReplacementRequest(db.pool, auth.session.email, {
      leadAllocationId: body.lead_allocation_id,
      reasonCode: body.reason_code as ReplacementReasonCode,
      reason: body.reason ?? '',
      reportedAt: body.reported_at ?? '',
      documentedContactAttempts: body.documented_contact_attempts,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof LedgerError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Recording replacement request failed', err);
    return NextResponse.json({ error: 'Failed to record the replacement request.' }, { status: 500 });
  }
}
