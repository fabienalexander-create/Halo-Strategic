import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';

type Action = 'approve' | 'reject' | 'request_info';

// Which statuses a given action is allowed to fire from, and what it transitions to.
// Approving NEVER produces ACTIVE directly -- it produces PENDING_COMMERCIALS, which requires a
// separate, explicit commercials-configuration + activation step (see ../commercials and
// ../activate). This is the duplicate/repeated-action guard: an action attempted from a status
// not in its allowed set is refused with 409, not silently re-applied.
const TRANSITIONS: Record<Action, { from: string[]; to: string; auditAction: string }> = {
  approve: { from: ['PENDING_REVIEW', 'NEEDS_MORE_INFO'], to: 'PENDING_COMMERCIALS', auditAction: 'BUYER_APPLICATION_APPROVED' },
  reject: { from: ['PENDING_REVIEW', 'NEEDS_MORE_INFO'], to: 'REJECTED', auditAction: 'BUYER_APPLICATION_REJECTED' },
  request_info: { from: ['PENDING_REVIEW', 'NEEDS_MORE_INFO'], to: 'NEEDS_MORE_INFO', auditAction: 'BUYER_APPLICATION_MORE_INFO_REQUESTED' },
};

export async function POST(req: NextRequest, { params }: { params: { reference: string } }) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  let body: { action?: Action; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.action || !(body.action in TRANSITIONS)) {
    return NextResponse.json({ error: 'action must be one of: approve, reject, request_info.' }, { status: 400 });
  }
  if ((body.action === 'reject' || body.action === 'request_info') && !body.reason?.trim()) {
    return NextResponse.json({ error: 'A reason is required for reject and request_info.' }, { status: 400 });
  }

  const transition = TRANSITIONS[body.action];

  try {
    const db = getDatabase();
    const buyers = await db.sql`SELECT id, application_status FROM buyers WHERE application_reference = ${params.reference}`;
    if (buyers.length === 0) {
      return NextResponse.json({ error: 'No matching application found.' }, { status: 404 });
    }

    const buyer = buyers[0];
    if (!transition.from.includes(buyer.application_status)) {
      return NextResponse.json(
        {
          error: `Cannot ${body.action} an application currently in status ${buyer.application_status}.`,
          current_status: buyer.application_status,
        },
        { status: 409 }
      );
    }

    await db.sql`
      UPDATE buyers SET application_status = ${transition.to}, reviewed_by = ${auth.session.email},
        reviewed_at = now(), review_notes = ${body.reason ?? null}, updated_at = now()
      WHERE id = ${buyer.id}
    `;

    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
      VALUES (
        ${auth.session.email}, ${transition.auditAction}, 'buyer', ${buyer.id},
        ${JSON.stringify({ application_status: buyer.application_status })},
        ${JSON.stringify({ application_status: transition.to, reason: body.reason ?? null })}
      )
    `;

    return NextResponse.json({ application_status: transition.to });
  } catch (err) {
    console.error('Application decision failed', err);
    return NextResponse.json({ error: 'Failed to record decision.' }, { status: 500 });
  }
}
