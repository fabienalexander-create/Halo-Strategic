import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

// Lists buyers, newest first, optionally filtered by status -- used by the leads admin page's
// "allocate to" dropdown (?status=ACTIVE) and by a general buyers overview.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const statusFilter = req.nextUrl.searchParams.get('status');

  try {
    const db = getDatabase();
    const rows = statusFilter
      ? await db.sql`
          SELECT b.id, b.company_name, b.contact_name, b.contact_email, b.application_status,
                 b.application_reference, b.agreed_price_per_lead, b.agreed_price_per_appointment, b.exclusivity_arrangement,
                 i.slug AS industry_slug, i.name AS industry_name
          FROM buyers b JOIN industries i ON i.id = b.industry_id
          WHERE b.application_status = ${statusFilter}
          ORDER BY b.created_at DESC LIMIT 200
        `
      : await db.sql`
          SELECT b.id, b.company_name, b.contact_name, b.contact_email, b.application_status,
                 b.application_reference, b.agreed_price_per_lead, b.agreed_price_per_appointment, b.exclusivity_arrangement,
                 i.slug AS industry_slug, i.name AS industry_name
          FROM buyers b JOIN industries i ON i.id = b.industry_id
          ORDER BY b.created_at DESC LIMIT 200
        `;
    return NextResponse.json({ buyers: rows });
  } catch (err) {
    console.error('Listing buyers failed', err);
    return NextResponse.json({ error: 'Failed to list buyers.' }, { status: 500 });
  }
}

/**
 * Admin-only buyer record deletion, by application_reference. This is deliberately minimal --
 * not the real application-review queue (Priority 2, not built yet) -- it exists to clean up
 * test/verification records (e.g. HLX-BYR-000001) before real buyer data exists, under real
 * admin authentication rather than the one-time setup token.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
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
    // buyer_review_notes.buyer_id has a foreign key with no cascade -- added in the Priority 2
    // migration after this route was first written, so it must be cleared explicitly or the
    // buyers delete below fails with a foreign key violation the moment a test application has
    // any notes on it (exactly what Fabien's test sequence is about to do).
    await db.sql`DELETE FROM buyer_review_notes WHERE buyer_id = ${buyerId}`;
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
