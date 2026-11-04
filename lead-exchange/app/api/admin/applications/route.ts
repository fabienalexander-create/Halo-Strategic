import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

// Queue listing -- newest applications first. Deliberately returns only what's needed for a
// queue row, not the full questionnaire (that's the detail view). internal_suitability_score IS
// shown here, unlike the buyer-facing lookup endpoint -- it's "internal" meaning not shown to the
// applicant, not meaning hidden from the admin it exists to help.
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  try {
    const db = getDatabase();
    const rows = await db.sql`
      SELECT
        b.application_reference,
        b.company_name,
        b.contact_name,
        b.application_status,
        b.internal_suitability_score,
        b.weekly_lead_capacity,
        b.has_bought_leads_before,
        i.name AS industry_name,
        b.created_at
      FROM buyers b
      JOIN industries i ON i.id = b.industry_id
      ORDER BY b.created_at DESC
    `;
    return NextResponse.json({ applications: rows });
  } catch (err) {
    console.error('Application queue listing failed', err);
    return NextResponse.json({ error: 'Failed to load applications.' }, { status: 500 });
  }
}
