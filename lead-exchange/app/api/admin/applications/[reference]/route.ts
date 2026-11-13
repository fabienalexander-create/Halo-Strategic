import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';

// Full application detail: the complete submitted questionnaire, consent records, commercial
// configuration state, and review notes history. Admin-only -- this is the one place the
// internal_suitability_score and internal_suitability_notes are actually meant to be seen.
export async function GET(req: NextRequest, { params }: { params: { reference: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  try {
    const db = getDatabase();
    const rows = await db.sql`
      SELECT b.*, i.name AS industry_name, i.slug AS industry_slug
      FROM buyers b
      JOIN industries i ON i.id = b.industry_id
      WHERE b.application_reference = ${params.reference}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No matching application found.' }, { status: 404 });
    }
    const buyer = rows[0];

    const notes = await db.sql`
      SELECT id, admin_email, note, created_at FROM buyer_review_notes
      WHERE buyer_id = ${buyer.id} ORDER BY created_at DESC
    `;

    const auditTrail = await db.sql`
      SELECT id, actor, action, previous_state, new_state, created_at FROM audit_log
      WHERE entity_type = 'buyer' AND entity_id = ${buyer.id} ORDER BY created_at DESC
    `;

    return NextResponse.json({ buyer, notes, audit_trail: auditTrail });
  } catch (err) {
    console.error('Application detail lookup failed', err);
    return NextResponse.json({ error: 'Failed to load application.' }, { status: 500 });
  }
}
