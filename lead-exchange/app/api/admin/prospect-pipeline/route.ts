import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

const VALID_STAGES = new Set(['NEW', 'CONTACT_AUTHORISED', 'CONTACTED', 'RESPONDED', 'QUALIFIED', 'CALL_COMPLETED', 'PACKAGE_AGREED']);

// The buyer acquisition dashboard's list view -- the missing middle of the journey between a
// registration (buyer_prospects) and a formal application (buyers). Joins through
// converted_buyer_id (already built) to show linked application status where one exists, and
// through agreed_package_definition_id to show what was verbally agreed (never confused with
// buyer_packages, which only holds VERIFIED PAID packages).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const stageParam = req.nextUrl.searchParams.get('stage');
  const stages = stageParam
    ? stageParam.split(',').map((s) => s.trim().toUpperCase()).filter((s) => VALID_STAGES.has(s))
    : null;
  if (stageParam && (!stages || stages.length === 0)) {
    return NextResponse.json({ error: 'No recognised stage values in the stage filter.' }, { status: 400 });
  }
  const dueBeforeParam = req.nextUrl.searchParams.get('follow_up_due_before');
  const dueBefore = dueBeforeParam ? new Date(dueBeforeParam) : null;
  if (dueBeforeParam && (!dueBefore || Number.isNaN(dueBefore.getTime()))) {
    return NextResponse.json({ error: 'follow_up_due_before must be a valid date.' }, { status: 400 });
  }

  const db = getDatabase();
  try {
    const rows = stages && dueBefore
      ? await db.sql`
          SELECT p.id, p.prospect_reference, p.company_name, p.contact_name, p.contact_email, p.telephone,
                 p.postcodes_covered, p.sales_stage, p.personal_contact_authorised_at, p.next_follow_up_at,
                 p.agreed_package_definition_id, pd.name AS agreed_package_name, pd.price AS agreed_package_price,
                 p.converted_buyer_id, b.application_status, b.application_reference,
                 i.name AS industry_name, i.slug AS industry_slug, p.created_at
          FROM buyer_prospects p
          JOIN industries i ON i.id = p.industry_id
          LEFT JOIN package_definitions pd ON pd.id = p.agreed_package_definition_id
          LEFT JOIN buyers b ON b.id = p.converted_buyer_id
          WHERE p.sales_stage = ANY(${stages}) AND p.next_follow_up_at <= ${dueBefore}
          ORDER BY p.next_follow_up_at ASC LIMIT 200
        `
      : stages
      ? await db.sql`
          SELECT p.id, p.prospect_reference, p.company_name, p.contact_name, p.contact_email, p.telephone,
                 p.postcodes_covered, p.sales_stage, p.personal_contact_authorised_at, p.next_follow_up_at,
                 p.agreed_package_definition_id, pd.name AS agreed_package_name, pd.price AS agreed_package_price,
                 p.converted_buyer_id, b.application_status, b.application_reference,
                 i.name AS industry_name, i.slug AS industry_slug, p.created_at
          FROM buyer_prospects p
          JOIN industries i ON i.id = p.industry_id
          LEFT JOIN package_definitions pd ON pd.id = p.agreed_package_definition_id
          LEFT JOIN buyers b ON b.id = p.converted_buyer_id
          WHERE p.sales_stage = ANY(${stages})
          ORDER BY p.created_at DESC LIMIT 200
        `
      : dueBefore
      ? await db.sql`
          SELECT p.id, p.prospect_reference, p.company_name, p.contact_name, p.contact_email, p.telephone,
                 p.postcodes_covered, p.sales_stage, p.personal_contact_authorised_at, p.next_follow_up_at,
                 p.agreed_package_definition_id, pd.name AS agreed_package_name, pd.price AS agreed_package_price,
                 p.converted_buyer_id, b.application_status, b.application_reference,
                 i.name AS industry_name, i.slug AS industry_slug, p.created_at
          FROM buyer_prospects p
          JOIN industries i ON i.id = p.industry_id
          LEFT JOIN package_definitions pd ON pd.id = p.agreed_package_definition_id
          LEFT JOIN buyers b ON b.id = p.converted_buyer_id
          WHERE p.next_follow_up_at <= ${dueBefore}
          ORDER BY p.next_follow_up_at ASC LIMIT 200
        `
      : await db.sql`
          SELECT p.id, p.prospect_reference, p.company_name, p.contact_name, p.contact_email, p.telephone,
                 p.postcodes_covered, p.sales_stage, p.personal_contact_authorised_at, p.next_follow_up_at,
                 p.agreed_package_definition_id, pd.name AS agreed_package_name, pd.price AS agreed_package_price,
                 p.converted_buyer_id, b.application_status, b.application_reference,
                 i.name AS industry_name, i.slug AS industry_slug, p.created_at
          FROM buyer_prospects p
          JOIN industries i ON i.id = p.industry_id
          LEFT JOIN package_definitions pd ON pd.id = p.agreed_package_definition_id
          LEFT JOIN buyers b ON b.id = p.converted_buyer_id
          ORDER BY p.created_at DESC LIMIT 200
        `;

    return NextResponse.json({ prospects: rows });
  } catch (err) {
    console.error('Prospect pipeline list failed', err);
    return NextResponse.json({ error: 'Failed to load prospect pipeline.' }, { status: 500 });
  }
}
