import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { secretMatches } from '../../../../lib/smsWebhookAuth';
import { isConfiguredIndustrySlug } from '../../../../lib/industries';

// Server-to-server ingestion for homeowner enquiries (e.g. the Spray Foam Roof Help Meta Instant
// Form), bridged via a Make scenario, NOT called directly by Meta or by any browser. Same
// fail-closed discipline as every other webhook in this codebase: 503 while unconfigured, 401 on
// a wrong secret, never a silent accept.
//
// Deliberately separate from app/api/integrations/meta-lead-ads (buyer-side installer
// applications, writing to buyer_prospects): this writes to `leads` -- real homeowners, not
// prospective buyers -- and uses its own dedicated secret, so the two integrations can be
// rotated, disabled or debugged independently and a compromised key on one side never affects
// the other.
//
// This endpoint ONLY creates a row in `leads`, status QUALIFICATION_PENDING -- it never touches
// lead_allocations, homeowner_confirmations, payments or any delivery/email table. There is no
// path from here to an offer being sent, a charge being made, or a homeowner's full details being
// released: all of that still requires an admin to record the lead-specific homeowner
// confirmation and allocate it by hand, via /admin/leads. Eliminating manual data entry must
// never also eliminate the commercial/consent checks that entry used to force a human through.
interface MetaHomeownerLeadPayload {
  meta_lead_id: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  form_id?: string;
  form_name?: string;
  created_time?: string;
  mapped: {
    industry_slug?: string;
    homeowner_name?: string;
    mobile?: string;
    email?: string;
    postcode?: string;
    property_type?: string;
    service_requirement?: string;
    owns_property?: boolean;
  };
}

const REQUIRED_MAPPED_FIELDS: (keyof MetaHomeownerLeadPayload['mapped'])[] = ['industry_slug', 'homeowner_name', 'postcode'];

export async function POST(req: NextRequest) {
  const secret = process.env.META_HOMEOWNER_LEADS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Meta homeowner lead integration is not configured.' }, { status: 503 });
  }
  const presented = req.headers.get('x-halo-integration-secret');
  if (!secretMatches(presented, secret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: MetaHomeownerLeadPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.meta_lead_id?.trim()) {
    return NextResponse.json({ error: 'Missing required field: meta_lead_id' }, { status: 400 });
  }
  if (!body.mapped) {
    return NextResponse.json({ error: 'Missing required field: mapped' }, { status: 400 });
  }
  const missing = REQUIRED_MAPPED_FIELDS.filter((f) => !body.mapped[f]);
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Missing required mapped field(s).', missing_fields: missing }, { status: 400 });
  }
  if (!body.mapped.mobile && !body.mapped.email) {
    return NextResponse.json({ error: 'At least one of mapped.mobile or mapped.email is required.' }, { status: 400 });
  }
  if (!isConfiguredIndustrySlug(body.mapped.industry_slug)) {
    return NextResponse.json({ error: 'Unknown or unsupported industry.' }, { status: 400 });
  }
  const industrySlug = body.mapped.industry_slug;

  try {
    const db = getDatabase();
    const industryRows = await db.sql`SELECT id, is_enabled FROM industries WHERE slug = ${industrySlug}`;
    if (industryRows.length === 0 || industryRows[0].is_enabled !== true) {
      return NextResponse.json({ error: 'This industry is not currently accepting enquiries.' }, { status: 400 });
    }
    const industryId = industryRows[0].id as number;

    const homeownerContact = JSON.stringify({ mobile: body.mapped.mobile ?? null, email: body.mapped.email ?? null });
    const qualificationAnswers = JSON.stringify({
      owns_property: body.mapped.owns_property ?? null,
      campaign_id: body.campaign_id ?? null,
      campaign_name: body.campaign_name ?? null,
      adset_id: body.adset_id ?? null,
      ad_id: body.ad_id ?? null,
      form_id: body.form_id ?? null,
      form_name: body.form_name ?? null,
      meta_created_time: body.created_time ?? null,
    });
    const source = 'meta_instant_form';

    // Idempotency boundary: retried deliveries of the same Meta lead must never create a second
    // row. ON CONFLICT DO NOTHING + a conditional follow-up SELECT, rather than an upsert, since
    // a duplicate delivery should never overwrite whatever an admin may already have started
    // doing with the first copy of this lead (recording a confirmation, allocating it).
    const inserted = await db.sql`
      INSERT INTO leads (
        industry_id, service_requirement, homeowner_name, homeowner_contact, property_type,
        postcode, qualification_answers, source, meta_lead_id, status
      ) VALUES (
        ${industryId}, ${body.mapped.service_requirement ?? null}, ${body.mapped.homeowner_name},
        ${homeownerContact}::jsonb, ${body.mapped.property_type ?? null}, ${body.mapped.postcode},
        ${qualificationAnswers}::jsonb, ${source}, ${body.meta_lead_id}, 'QUALIFICATION_PENDING'
      )
      ON CONFLICT (meta_lead_id) WHERE meta_lead_id IS NOT NULL DO NOTHING
      RETURNING id
    `;

    if (inserted.length > 0) {
      const leadId = inserted[0].id as number;
      await db.sql`
        INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
        VALUES (
          'system:meta_homeowner_leads_webhook', 'LEAD_INGESTED_FROM_META', 'lead', ${leadId},
          ${JSON.stringify({ industry_slug: industrySlug, postcode: body.mapped.postcode, meta_lead_id: body.meta_lead_id })}
        )
      `;
      return NextResponse.json(
        { lead_id: leadId, reference: `HLX-LEAD-${String(leadId).padStart(6, '0')}`, status: 'QUALIFICATION_PENDING', duplicate: false },
        { status: 201 }
      );
    }

    const existing = await db.sql`SELECT id, status FROM leads WHERE meta_lead_id = ${body.meta_lead_id}`;
    if (existing.length === 0) {
      // The INSERT hit the unique index but a matching row isn't visible to this read -- treat
      // as a genuine failure rather than guessing at a reference that may not exist.
      throw new Error(`Conflict on meta_lead_id ${body.meta_lead_id} but no existing row found.`);
    }
    return NextResponse.json(
      {
        lead_id: existing[0].id, reference: `HLX-LEAD-${String(existing[0].id).padStart(6, '0')}`,
        status: existing[0].status, duplicate: true,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Meta homeowner lead ingestion failed', err);
    return NextResponse.json({ error: 'Something went wrong saving this lead.' }, { status: 500 });
  }
}
