import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '../../../../../../lib/requireAdmin';

// Explicit, separate go-live step. OWNER ONLY: reviewers can assess applications but only the owner authorises revenue-generating accounts. Refuses to fire unless the mandatory onboarding call has been
// recorded and the key commercial fields are actually set -- this is the enforcement point for "approval must not automatically make the buyer
// ACTIVE" (Fabien's brief). Configuring commercials and activating are deliberately two different
// admin actions, each independently audit-logged.
const REQUIRED_FIELDS = ['agreed_price_per_lead', 'exclusivity_arrangement', 'agreed_weekly_capacity', 'payment_arrangement_notes'] as const;

export async function POST(req: NextRequest, { params }: { params: { reference: string } }) {
  const auth = await requireOwner(req);
  if ('response' in auth) return auth.response;

  try {
    const db = getDatabase();
    const buyers = await db.sql`SELECT * FROM buyers WHERE application_reference = ${params.reference}`;
    if (buyers.length === 0) {
      return NextResponse.json({ error: 'No matching application found.' }, { status: 404 });
    }

    const buyer = buyers[0];
    if (buyer.application_status !== 'PENDING_COMMERCIALS') {
      return NextResponse.json(
        {
          error: `Can only activate from PENDING_COMMERCIALS. Current status: ${buyer.application_status}.`,
          current_status: buyer.application_status,
        },
        { status: 409 }
      );
    }

    // The mandatory onboarding call must be recorded before activation. A database trigger
    // enforces the same rule as a backstop; this check gives a clear error first.
    if (!buyer.onboarding_call_completed_at) {
      return NextResponse.json(
        {
          error: 'Cannot activate: the mandatory onboarding call has not been recorded.',
          missing_requirements: ['onboarding_call'],
        },
        { status: 422 }
      );
    }

    const missing = REQUIRED_FIELDS.filter((f) => buyer[f] === null || buyer[f] === undefined);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Cannot activate: commercial terms are incomplete.', missing_fields: missing },
        { status: 422 }
      );
    }

    await db.sql`
      UPDATE buyers SET application_status = 'ACTIVE', went_active_by = ${auth.session.email},
        went_active_at = now(), updated_at = now()
      WHERE id = ${buyer.id}
    `;

    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
      VALUES (
        ${auth.session.email}, 'BUYER_ACTIVATED', 'buyer', ${buyer.id},
        ${JSON.stringify({ application_status: 'PENDING_COMMERCIALS' })},
        ${JSON.stringify({ application_status: 'ACTIVE' })}
      )
    `;

    return NextResponse.json({ application_status: 'ACTIVE' });
  } catch (err) {
    console.error('Activation failed', err);
    return NextResponse.json({ error: 'Failed to activate buyer.' }, { status: 500 });
  }
}
