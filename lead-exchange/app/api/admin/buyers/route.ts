import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

/**
 * Admin-only buyer record deletion, by application_reference. This is deliberately minimal --
 * not the real application-review queue (Priority 2, not built yet) -- it exists to clean up
 * test/verification records (e.g. HLX-BYR-000001) before real buyer data exists, under real
 * admin authentication rather than the one-time setup token.
 */
export async function DELETE(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const reference = req.nextUrl.searchParams.get('reference');
  if (!reference) {
    return NextResponse.json({ error: 'A reference query param is required.' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const existing = await db.sql`SELECT id, company_name FROM buyers WHERE application_reference = ${reference}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'No matching buyer found.' }, { status: 404 });
    }

    const buyerId = existing[0].id;
    await db.sql`DELETE FROM buyer_notification_preferences WHERE buyer_id = ${buyerId}`;
    await db.sql`DELETE FROM buyers WHERE id = ${buyerId}`;
    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state)
      VALUES (${auth.session.email}, 'BUYER_RECORD_DELETED', 'buyer', ${buyerId}, ${JSON.stringify({ application_reference: reference, company_name: existing[0].company_name })})
    `;

    return NextResponse.json({ deleted: true, application_reference: reference });
  } catch (err) {
    console.error('Buyer delete failed', err);
    return NextResponse.json({ error: 'Delete failed. Please try again.' }, { status: 500 });
  }
}
