import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { isConfiguredIndustrySlug } from '../../../../lib/industries';

interface Body {
  industry_slug?: string;
  homeowner_name?: string;
  mobile?: string;
  email?: string;
  property_type?: string;
  postcode?: string;
  service_requirement?: string;
  source?: string;
  meta_lead_id?: string;
}

const REQUIRED_FIELDS: (keyof Body)[] = ['industry_slug', 'homeowner_name', 'postcode'];

// Admin-only manual lead entry: there is no automatic ingestion from Meta Lead Centre / the
// Google Sheets tracker into this table yet (that's a separate piece of work), so for now an
// admin who has already looked at the enquiry pastes it in here. Created directly as QUALIFIED,
// since by definition the admin has already checked it before typing it in (Fabien's own step
// 2, "Halo verifies the lead", happens before this call, not inside it).
//
// meta_lead_id is also kept in qualification_answers for convenience alongside source, but the
// real column (added for the automatic Meta ingestion endpoint, app/api/integrations/
// meta-homeowner-leads) is what actually enforces uniqueness -- so pasting the same Meta lead in
// here twice by hand is refused the same way a retried webhook delivery is.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const missing = REQUIRED_FIELDS.filter((f) => !body[f]);
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Missing required field(s).', missing_fields: missing }, { status: 400 });
  }
  if (!body.mobile && !body.email) {
    return NextResponse.json({ error: 'At least one of mobile or email is required.' }, { status: 400 });
  }
  if (!isConfiguredIndustrySlug(body.industry_slug)) {
    return NextResponse.json({ error: 'Unknown or unsupported industry.' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const industryRows = await db.sql`SELECT id FROM industries WHERE slug = ${body.industry_slug}`;
    if (industryRows.length === 0) {
      return NextResponse.json({ error: 'Unknown industry.' }, { status: 400 });
    }
    const industryId = industryRows[0].id as number;

    const homeownerContact = JSON.stringify({ mobile: body.mobile ?? null, email: body.email ?? null });
    const qualificationAnswers = JSON.stringify({
      source: body.source ?? null,
      meta_lead_id: body.meta_lead_id ?? null,
      entered_by: auth.session.email,
    });

    const inserted = await db.sql`
      INSERT INTO leads (
        industry_id, service_requirement, homeowner_name, homeowner_contact, property_type,
        postcode, qualification_answers, source, meta_lead_id, status
      ) VALUES (
        ${industryId}, ${body.service_requirement ?? null}, ${body.homeowner_name},
        ${homeownerContact}::jsonb, ${body.property_type ?? null}, ${body.postcode},
        ${qualificationAnswers}::jsonb, ${body.source ?? null}, ${body.meta_lead_id ?? null}, 'QUALIFIED'
      )
      RETURNING id
    `;
    const leadId = inserted[0].id;

    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
      VALUES (
        ${auth.session.email}, 'LEAD_ENTERED_MANUALLY', 'lead', ${leadId},
        ${JSON.stringify({ industry_slug: body.industry_slug, postcode: body.postcode, source: body.source ?? null, meta_lead_id: body.meta_lead_id ?? null })}
      )
    `;

    return NextResponse.json({ lead_id: leadId, reference: `HLX-LEAD-${String(leadId).padStart(6, '0')}`, status: 'QUALIFIED' }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('uq_leads_meta_lead_id')) {
      return NextResponse.json({ error: 'A lead with this Meta lead ID already exists.' }, { status: 409 });
    }
    console.error('Manual lead entry failed', err);
    return NextResponse.json({ error: 'Failed to create lead.' }, { status: 500 });
  }
}

// Lists leads, newest first, optionally filtered by status. Used by the admin leads dashboard --
// shows enough to decide the next action (record confirmation, allocate) without yet exposing
// homeowner_contact for anything not already DELIVERED (the UI itself also redacts; this is a
// convenience list, not the release boundary -- allocation_release_check in the database remains
// the real gate).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const statusFilter = req.nextUrl.searchParams.get('status');

  try {
    const db = getDatabase();
    const rows = statusFilter
      ? await db.sql`
          SELECT l.id, l.status, l.homeowner_name, l.property_type, l.postcode, l.service_requirement,
                 l.source, l.qualification_answers, l.created_at, i.slug AS industry_slug, i.name AS industry_name,
                 (SELECT a.id FROM lead_allocations a WHERE a.lead_id = l.id AND a.status IN ('OFFERED','ACCEPTED','PURCHASED') LIMIT 1) AS live_allocation_id,
                 (SELECT b.company_name FROM lead_allocations a JOIN buyers b ON b.id = a.buyer_id WHERE a.lead_id = l.id AND a.status IN ('OFFERED','ACCEPTED','PURCHASED') LIMIT 1) AS allocated_buyer
          FROM leads l JOIN industries i ON i.id = l.industry_id
          WHERE l.status = ${statusFilter}
          ORDER BY l.created_at DESC LIMIT 200
        `
      : await db.sql`
          SELECT l.id, l.status, l.homeowner_name, l.property_type, l.postcode, l.service_requirement,
                 l.source, l.qualification_answers, l.created_at, i.slug AS industry_slug, i.name AS industry_name,
                 (SELECT a.id FROM lead_allocations a WHERE a.lead_id = l.id AND a.status IN ('OFFERED','ACCEPTED','PURCHASED') LIMIT 1) AS live_allocation_id,
                 (SELECT b.company_name FROM lead_allocations a JOIN buyers b ON b.id = a.buyer_id WHERE a.lead_id = l.id AND a.status IN ('OFFERED','ACCEPTED','PURCHASED') LIMIT 1) AS allocated_buyer
          FROM leads l JOIN industries i ON i.id = l.industry_id
          ORDER BY l.created_at DESC LIMIT 200
        `;

    return NextResponse.json({ leads: rows });
  } catch (err) {
    console.error('Listing leads failed', err);
    return NextResponse.json({ error: 'Failed to list leads.' }, { status: 500 });
  }
}
