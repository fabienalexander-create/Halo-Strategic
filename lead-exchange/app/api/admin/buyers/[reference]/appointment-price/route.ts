import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '../../../../../../lib/requireAdmin';

// Sets (or clears) an existing buyer's agreed price per booked appointment (2026-11-26). Owner
// only: it is a commercial term. Existing allocations keep the price snapshotted when they were
// made; this changes future pay-per-appointment allocations only.
export async function POST(req: NextRequest, { params }: { params: { reference: string } }) {
  const auth = await requireOwner(req);
  if ('response' in auth) return auth.response;

  let body: { agreed_price_per_appointment?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const price = body.agreed_price_per_appointment;
  if (price !== null && (typeof price !== 'number' || !(price > 0) || Math.round(price * 100) !== price * 100)) {
    return NextResponse.json({ error: 'agreed_price_per_appointment must be a positive amount in pounds and pence, or null to clear it.' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const buyers = await db.sql`SELECT id, agreed_price_per_appointment FROM buyers WHERE application_reference = ${params.reference}`;
    if (buyers.length === 0) return NextResponse.json({ error: 'No matching buyer found.' }, { status: 404 });
    const buyer = buyers[0] as { id: number; agreed_price_per_appointment: string | number | null };

    await db.sql`UPDATE buyers SET agreed_price_per_appointment = ${price}, updated_at = now() WHERE id = ${buyer.id}`;
    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
      VALUES (${auth.session.email}, 'BUYER_APPOINTMENT_PRICE_SET', 'buyer', ${buyer.id},
              ${JSON.stringify({ agreed_price_per_appointment: buyer.agreed_price_per_appointment })},
              ${JSON.stringify({ agreed_price_per_appointment: price })})
    `;
    return NextResponse.json({ agreed_price_per_appointment: price });
  } catch (err) {
    console.error('Setting appointment price failed', err);
    return NextResponse.json({ error: 'Failed to set the appointment price.' }, { status: 500 });
  }
}
