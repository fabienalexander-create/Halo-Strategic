import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { secretMatches } from '../../../../lib/smsWebhookAuth';
import { HOMEOWNER_CONSENT_CONFIG, isConfiguredIndustrySlug } from '../../../../lib/industries';
import { buyerCoversPostcode } from '../../../../lib/buyerMatching';
import { attemptSync, buildLeadRowValues } from '../../../../lib/sheetsSync';

const INDUSTRY_LABELS: Record<string, string> = {
  spray_foam_removal: 'Spray Foam Removal',
  solar_battery: 'Solar & Battery',
  roofing: 'Roofing',
};

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
//
// Fabien, 2026-11-18 (Phase 1 of the Meta/TextMagic integration audit): "make the
// Meta-to-Lead-Exchange intake reliable and complete" -- this is that phase only. Phase 2
// (TextMagic acknowledgement, triggered only after this endpoint's own transaction has
// committed) and Phase 3 (appointment coordination) are deliberately not touched here.
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
    // Deliberately a real tri-state question, not a plain truthy/falsy field: `false` ("I rent
    // this property") is a meaningful, valid answer that must never be treated the same as
    // "not answered" -- see the explicit typeof check below, not the generic missing-field loop.
    owns_property?: boolean;
    // Spray Foam Removal qualification fields (Fabien's audit, 2026-11-18) -- stored in
    // qualification_answers, same JSONB column the website form already uses for its own
    // industry-specific questions. No migration: that column already takes arbitrary answers.
    foam_location?: string;
    foam_type?: string;
    reason_for_enquiry?: string;
    timeframe?: string;
    previous_inspection?: string;
    preferred_contact_method?: string;
    appointment_availability?: string;
    // A single Instant Form question covering both "contact me" and "introduce me to a suitable
    // specialist" -- Meta Instant Forms don't support the website's two-separate-checkbox layout,
    // so this one explicit, required answer is intentionally used for both consent_contact and
    // consent_share_buyer below, rather than inferring sharing consent from contact consent.
    consent_contact?: boolean;
    marketing_consent?: boolean;
  };
}

// String-valued required fields, checked with a plain falsy test (fine here: none of these are
// ever meaningfully `false` or `0`). owns_property and consent_contact are booleans and are
// checked separately below, since `!false` would wrongly treat a valid "no" answer as missing.
const REQUIRED_MAPPED_STRING_FIELDS: (keyof MetaHomeownerLeadPayload['mapped'])[] = [
  'industry_slug', 'homeowner_name', 'postcode', 'mobile',
  'reason_for_enquiry', 'timeframe', 'preferred_contact_method',
];

// A reason-for-enquiry answer containing any of these marks the enquiry as research-stage rather
// than an active, sellable lead (Fabien's audit: "classify separately"). Matched case-insensitively
// against whatever the Instant Form's own answer option text actually is -- adjust this list once
// the live form's exact wording is known; it is deliberately a substring match, not a fixed enum,
// since Meta's own option text isn't controlled by this codebase.
const RESEARCHING_MARKERS = ['research', 'just looking', 'just curious', 'not sure yet'];

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
  const missing = REQUIRED_MAPPED_STRING_FIELDS.filter((f) => !body.mapped[f]);
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Missing required mapped field(s).', missing_fields: missing }, { status: 400 });
  }
  if (typeof body.mapped.owns_property !== 'boolean') {
    return NextResponse.json({ error: 'Missing required mapped field(s).', missing_fields: ['owns_property'] }, { status: 400 });
  }
  if (typeof body.mapped.consent_contact !== 'boolean') {
    return NextResponse.json({ error: 'Missing required mapped field(s).', missing_fields: ['consent_contact'] }, { status: 400 });
  }
  if (body.mapped.consent_contact !== true) {
    return NextResponse.json({ error: 'Consent to be contacted and introduced to a suitable specialist is required.' }, { status: 400 });
  }
  if (!isConfiguredIndustrySlug(body.mapped.industry_slug)) {
    return NextResponse.json({ error: 'Unknown or unsupported industry.' }, { status: 400 });
  }
  const industrySlug = body.mapped.industry_slug;
  const consentConfig = HOMEOWNER_CONSENT_CONFIG[industrySlug];

  try {
    const db = getDatabase();
    const industryRows = await db.sql`SELECT id, is_enabled FROM industries WHERE slug = ${industrySlug}`;
    if (industryRows.length === 0 || industryRows[0].is_enabled !== true) {
      return NextResponse.json({ error: 'This industry is not currently accepting enquiries.' }, { status: 400 });
    }
    const industryId = industryRows[0].id as number;

    // Manual-review classification -- never blocks ingestion, never silently discards an
    // enquiry. Computed before the transaction (read-only), stored alongside the lead's other
    // qualification answers.
    const reviewReasons: string[] = [];
    if (body.mapped.owns_property === false) reviewReasons.push('renter');

    const activeBuyers = await db.sql`
      SELECT coverage_type, counties_covered, postcodes_covered
      FROM buyers WHERE application_status = 'ACTIVE' AND industry_id = ${industryId}
    `;
    const coveredByAnyBuyer = (activeBuyers as { coverage_type: string | null; counties_covered: string[] | null; postcodes_covered: string[] | null }[])
      .some((b) => buyerCoversPostcode(
        { coverage_type: b.coverage_type, counties_covered: b.counties_covered ?? [], postcodes_covered: b.postcodes_covered ?? [] },
        body.mapped.postcode ?? null
      ));
    if (!coveredByAnyBuyer) reviewReasons.push('outside_service_area');

    const reasonLower = (body.mapped.reason_for_enquiry ?? '').toLowerCase();
    const leadIntent = RESEARCHING_MARKERS.some((m) => reasonLower.includes(m)) ? 'researching' : 'active';

    const homeownerContact = JSON.stringify({ mobile: body.mapped.mobile ?? null, email: body.mapped.email ?? null });
    const qualificationAnswers = JSON.stringify({
      owns_property: body.mapped.owns_property,
      foam_location: body.mapped.foam_location ?? null,
      foam_type: body.mapped.foam_type ?? null,
      reason_for_enquiry: body.mapped.reason_for_enquiry,
      timeframe: body.mapped.timeframe,
      previous_inspection: body.mapped.previous_inspection ?? null,
      preferred_contact_method: body.mapped.preferred_contact_method,
      appointment_availability: body.mapped.appointment_availability ?? null,
      consent_contact: body.mapped.consent_contact,
      consent_share_buyer: body.mapped.consent_contact,
      marketing_consent: body.mapped.marketing_consent ?? false,
      consent_version: consentConfig.consentVersion,
      campaign_id: body.campaign_id ?? null,
      campaign_name: body.campaign_name ?? null,
      adset_id: body.adset_id ?? null,
      ad_id: body.ad_id ?? null,
      form_id: body.form_id ?? null,
      form_name: body.form_name ?? null,
      meta_created_time: body.created_time ?? null,
      needs_manual_review: reviewReasons.length > 0,
      review_reasons: reviewReasons,
      lead_intent: leadIntent,
    });
    const source = 'meta_instant_form';

    const client = await db.pool.connect();
    let leadId: number | null = null;
    let leadReference = '';
    let syncId: number | null = null;
    try {
      await client.query('BEGIN');

      const consentResult = await client.query(
        `INSERT INTO consent_records (wording_version, source, purpose, named_recipient_or_category)
         VALUES ($1, $2, 'Contact about enquiry and share with one or more suitable specialists', $3)
         RETURNING id`,
        [consentConfig.consentVersion, source, consentConfig.namedRecipientOrCategory]
      );
      const consentRecordId = consentResult.rows[0].id;

      // Idempotency boundary: retried deliveries of the same Meta lead must never create a second
      // row. ON CONFLICT DO NOTHING + a conditional follow-up SELECT, rather than an upsert, since
      // a duplicate delivery should never overwrite whatever an admin may already have started
      // doing with the first copy of this lead (recording a confirmation, allocating it). The
      // consent_records row inserted above is rolled back along with everything else on a
      // conflict, so a retried delivery never leaves an orphaned consent record behind either.
      const inserted = await client.query(
        `INSERT INTO leads (
          industry_id, service_requirement, homeowner_name, homeowner_contact, property_type,
          postcode, qualification_answers, consent_record_id, source, meta_lead_id, status
        ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9, $10, 'QUALIFICATION_PENDING')
        ON CONFLICT (meta_lead_id) WHERE meta_lead_id IS NOT NULL DO NOTHING
        RETURNING id`,
        [
          industryId, body.mapped.service_requirement ?? null, body.mapped.homeowner_name,
          homeownerContact, body.mapped.property_type ?? null, body.mapped.postcode,
          qualificationAnswers, consentRecordId, source, body.meta_lead_id,
        ]
      );

      if (inserted.rows.length === 0) {
        await client.query('ROLLBACK');

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
      }

      leadId = inserted.rows[0].id as number;
      leadReference = `HLX-LEAD-${String(leadId).padStart(6, '0')}`;

      await client.query(`UPDATE consent_records SET lead_id = $1 WHERE id = $2`, [leadId, consentRecordId]);

      await client.query(
        `INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
         VALUES ('system:meta_homeowner_leads_webhook', 'LEAD_INGESTED_FROM_META', 'lead', $1, $2)`,
        [leadId, JSON.stringify({
          industry_slug: industrySlug, postcode: body.mapped.postcode, meta_lead_id: body.meta_lead_id,
          needs_manual_review: reviewReasons.length > 0, review_reasons: reviewReasons,
        })]
      );

      // Sheet-sync outbox row created in the SAME transaction as the lead itself, same pattern as
      // the website homeowner-enquiries route -- "the lead saved but the sync was never recorded"
      // can't happen. lead_id is UNIQUE, so a retried request can never create a second row.
      const syncInsert = await client.query(
        `INSERT INTO lead_sheet_syncs (lead_id, status) VALUES ($1, 'PENDING')
         ON CONFLICT (lead_id) DO NOTHING
         RETURNING id`,
        [leadId]
      );
      syncId = syncInsert.rows.length > 0 ? (syncInsert.rows[0].id as number) : null;

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Sent after commit, and never allowed to throw -- a failed sync must never undo an
    // already-saved enquiry. attemptSync logs the outcome itself and only returns.
    if (syncId !== null) {
      const rowValues = buildLeadRowValues({
        leadReference,
        industryLabel: INDUSTRY_LABELS[industrySlug] ?? industrySlug,
        campaignOrSource: body.campaign_name ?? body.campaign_id ?? 'Meta Instant Form',
        receivedAt: body.created_time ?? new Date().toISOString(),
        fullName: body.mapped.homeowner_name ?? '',
        phone: body.mapped.mobile ?? '',
        email: body.mapped.email ?? '',
        postcode: body.mapped.postcode ?? '',
        consentSummary: `${consentConfig.consentVersion} via ${source}`,
      });
      await attemptSync(db, syncId, leadReference, rowValues);
    }

    return NextResponse.json(
      { lead_id: leadId, reference: leadReference, status: 'QUALIFICATION_PENDING', duplicate: false },
      { status: 201 }
    );
  } catch (err) {
    console.error('Meta homeowner lead ingestion failed', err);
    return NextResponse.json({ error: 'Something went wrong saving this lead.' }, { status: 500 });
  }
}
