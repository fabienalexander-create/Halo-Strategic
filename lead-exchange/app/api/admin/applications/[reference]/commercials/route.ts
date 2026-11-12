import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';

interface CommercialsPayload {
  agreed_price_per_lead?: number;
  agreed_currency?: string;
  exclusivity_arrangement?: 'exclusive' | 'shared';
  agreed_weekly_capacity?: number;
  payment_arrangement_notes?: string;
  agreed_pricing_notes?: string;
}

// Only valid while PENDING_COMMERCIALS -- configuring terms is not itself approval to go live;
// that's the separate ../activate step, which checks these fields are actually set before firing.
export async function POST(req: NextRequest, { params }: { params: { reference: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  let body: CommercialsPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const buyers = await db.sql`SELECT id, application_status FROM buyers WHERE application_reference = ${params.reference}`;
    if (buyers.length === 0) {
      return NextResponse.json({ error: 'No matching application found.' }, { status: 404 });
    }

    const buyer = buyers[0];
    if (buyer.application_status !== 'PENDING_COMMERCIALS') {
      return NextResponse.json(
        {
          error: `Commercials can only be configured while PENDING_COMMERCIALS. Current status: ${buyer.application_status}.`,
          current_status: buyer.application_status,
        },
        { status: 409 }
      );
    }

    if (body.exclusivity_arrangement && !['exclusive', 'shared'].includes(body.exclusivity_arrangement)) {
      return NextResponse.json({ error: 'exclusivity_arrangement must be "exclusive" or "shared".' }, { status: 400 });
    }

    await db.sql`
      UPDATE buyers SET
        agreed_price_per_lead = COALESCE(${body.agreed_price_per_lead ?? null}, agreed_price_per_lead),
        agreed_currency = COALESCE(${body.agreed_currency ?? null}, agreed_currency),
        exclusivity_arrangement = COALESCE(${body.exclusivity_arrangement ?? null}, exclusivity_arrangement),
        agreed_weekly_capacity = COALESCE(${body.agreed_weekly_capacity ?? null}, agreed_weekly_capacity),
        payment_arrangement_notes = COALESCE(${body.payment_arrangement_notes ?? null}, payment_arrangement_notes),
        agreed_pricing_notes = COALESCE(${body.agreed_pricing_notes ?? null}, agreed_pricing_notes),
        commercials_configured_by = ${auth.session.email},
        commercials_configured_at = now(),
        updated_at = now()
      WHERE id = ${buyer.id}
    `;

    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
      VALUES (${auth.session.email}, 'BUYER_COMMERCIALS_CONFIGURED', 'buyer', ${buyer.id}, ${JSON.stringify(body)})
    `;

    return NextResponse.json({ configured: true });
  } catch (err) {
    console.error('Configuring commercials failed', err);
    return NextResponse.json({ error: 'Failed to configure commercials.' }, { status: 500 });
  }
}
