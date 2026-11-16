import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';

// Full prospect detail: current stage, authorisation state, agreed package (verbal, not paid),
// linked application if one exists, and the full append-only activity history.
export async function GET(req: NextRequest, { params }: { params: { reference: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  try {
    const db = getDatabase();
    const rows = await db.sql`
      SELECT p.*, pd.name AS agreed_package_name, pd.price AS agreed_package_price,
             b.application_status, b.application_reference,
             i.name AS industry_name, i.slug AS industry_slug
      FROM buyer_prospects p
      JOIN industries i ON i.id = p.industry_id
      LEFT JOIN package_definitions pd ON pd.id = p.agreed_package_definition_id
      LEFT JOIN buyers b ON b.id = p.converted_buyer_id
      WHERE p.prospect_reference = ${params.reference}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No matching prospect found.' }, { status: 404 });
    }
    const prospect = rows[0];

    const activity = await db.sql`
      SELECT id, activity_type, previous_stage, new_stage, note, recorded_by, occurred_at, created_at
      FROM buyer_prospect_sales_activity
      WHERE prospect_id = ${prospect.id} ORDER BY occurred_at DESC
    `;

    const packages = await db.sql`
      SELECT id, name, price, leads_included FROM package_definitions WHERE active = true ORDER BY price ASC
    `;

    return NextResponse.json({ prospect, activity, available_packages: packages });
  } catch (err) {
    console.error('Prospect pipeline detail lookup failed', err);
    return NextResponse.json({ error: 'Failed to load prospect.' }, { status: 500 });
  }
}
