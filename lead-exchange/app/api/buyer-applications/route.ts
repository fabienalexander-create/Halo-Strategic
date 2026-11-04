import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// Current versions of the documents a buyer agrees to during self-service application.
// Bump these strings whenever the underlying policy/terms content changes, so historical
// agreements stay tied to the version actually shown at the time (Phase 1 §10/§7).
const BUYER_TERMS_VERSION = '2026-11-04-v0.1';
// Per Fabien's separate confirmation that solicitor review of the Replacement Policy is
// complete too (alongside Buyer Terms and Privacy Policy), this now matches that approved version.
const REPLACEMENT_POLICY_VERSION = '2026-11-04-v0.1';

const CURRENT_INDUSTRY_SLUG = 'spray_foam_removal';

interface BuyerApplicationPayload {
  company_name: string;
  website?: string;
  contact_name: string;
  contact_email: string;
  telephone: string;
  company_registration_number?: string;
  years_operating?: string;
  business_location?: string;

  services_offered?: string[];
  does_own_fulfilment?: boolean;
  has_required_insurance_and_quals?: boolean;

  counties_covered?: string[];
  postcodes_covered?: string[];
  coverage_type?: string;
  excluded_areas?: string;
  max_travel_distance_miles?: number;

  weekly_lead_capacity?: number;
  preferred_monthly_volume?: number;
  volume_preference?: string;
  accepts_long_term_prospects?: boolean;
  property_types_accepted?: string[];
  min_project_value?: number;
  max_project_value?: number;
  exclusivity_preference?: string;
  preferred_price_range_low?: number;
  preferred_price_range_high?: number;
  purchase_model_preference?: string;

  has_bought_leads_before?: boolean;
  previous_lead_providers?: string;
  previous_leads_exclusive_or_shared?: string;
  previous_price_paid_per_lead?: number;
  previous_leads_worthwhile_pct?: number;
  previous_supplier_problems?: string;
  reliability_criteria?: string;

  who_handles_enquiries?: string;
  has_dedicated_sales_team?: boolean;
  can_contact_during_business_hours?: boolean;
  typical_first_response_time?: string;
  surveys_per_week_capacity?: number;
  typical_qualified_to_job_conversion_pct?: number;
  avg_revenue_per_completed_job?: number;

  confirmed_info_accurate: boolean;
  confirmed_can_deliver_services: boolean;
  agreed_buyer_terms: boolean;
  acknowledged_replacement_policy: boolean;
  confirmed_payment_before_release_understanding: boolean;
  agreed_pii_handling: boolean;
  agreed_account_notifications: boolean;
  marketing_consent?: boolean;
}

const REQUIRED_FIELDS: (keyof BuyerApplicationPayload)[] = [
  'company_name',
  'contact_name',
  'contact_email',
  'telephone',
  'confirmed_info_accurate',
  'confirmed_can_deliver_services',
  'agreed_buyer_terms',
  'acknowledged_replacement_policy',
  'confirmed_payment_before_release_understanding',
  'agreed_pii_handling',
  'agreed_account_notifications',
];

/**
 * Internal buyer suitability score (0-100). ADVISORY ONLY — assists admin review,
 * never auto-approves or auto-rejects a buyer (Phase 1 brief: "should assist your
 * review, not automatically reject businesses based on an arbitrary score"). Never
 * returned to the applicant.
 */
function computeSuitabilityScore(p: BuyerApplicationPayload): { score: number; notes: string[] } {
  let score = 0;
  const notes: string[] = [];

  // Business legitimacy (0-20)
  if (p.company_registration_number) {
    score += 10;
  } else {
    notes.push('No company registration number provided.');
  }
  if (p.confirmed_info_accurate && p.confirmed_can_deliver_services) score += 10;

  // Service capability (0-20)
  if (p.has_required_insurance_and_quals) {
    score += 12;
  } else {
    notes.push('Has not confirmed required insurance/qualifications.');
  }
  if (p.does_own_fulfilment) score += 8;

  // Response speed / sales process (0-25) — brief flags this as commercially critical
  if (p.can_contact_during_business_hours) score += 8;
  if (p.has_dedicated_sales_team) score += 7;
  if (
    p.typical_first_response_time &&
    /same.?day|within.?(1|2).?hour|immediate/i.test(p.typical_first_response_time)
  ) {
    score += 10;
  } else if (!p.typical_first_response_time) {
    notes.push('No typical first-response time provided.');
  }

  // Commercial readiness (0-15)
  if (p.confirmed_payment_before_release_understanding) score += 8;
  if (p.exclusivity_preference) score += 7;

  // Previous lead-buying experience (0-20) — brief calls these "some of the most
  // valuable questions in the entire application"
  if (p.has_bought_leads_before) {
    score += 8;
    if (typeof p.previous_leads_worthwhile_pct === 'number') {
      if (p.previous_leads_worthwhile_pct >= 50) score += 12;
      else notes.push(`Reported only ${p.previous_leads_worthwhile_pct}% of previous leads were worthwhile.`);
    }
  } else {
    notes.push('No previous lead-buying experience — unknown how they will handle the commercial model.');
  }

  return { score: Math.min(100, score), notes };
}

export async function POST(req: NextRequest) {
  let body: BuyerApplicationPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  for (const field of REQUIRED_FIELDS) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }
  if (body.agreed_buyer_terms !== true || body.acknowledged_replacement_policy !== true) {
    return NextResponse.json(
      { error: 'Buyer Terms agreement and Replacement Policy acknowledgement are both required.' },
      { status: 400 }
    );
  }

  const db = getDatabase();

  // Prevent duplicate applications from the same business email for the same industry
  // (brief §3: "Prevent duplicate applications and duplicate accounts.")
  const existing = await db.sql`
    SELECT id, application_reference, application_status FROM buyers
    WHERE contact_email = ${body.contact_email}
      AND industry_id = (SELECT id FROM industries WHERE slug = ${CURRENT_INDUSTRY_SLUG})
  `;
  if (existing.length > 0) {
    return NextResponse.json(
      {
        error: 'An application already exists for this email address.',
        application_reference: existing[0].application_reference,
        application_status: existing[0].application_status,
      },
      { status: 409 }
    );
  }

  const { score, notes } = computeSuitabilityScore(body);
  const now = new Date().toISOString();

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO buyers (
        company_name, website, contact_name, contact_email, telephone,
        company_registration_number, years_operating, business_location,
        industry_id, services_offered, does_own_fulfilment, has_required_insurance_and_quals,
        counties_covered, postcodes_covered, coverage_type, excluded_areas, max_travel_distance_miles,
        weekly_lead_capacity, preferred_monthly_volume, volume_preference, accepts_long_term_prospects,
        property_types_accepted, min_project_value, max_project_value, exclusivity_preference,
        preferred_price_range_low, preferred_price_range_high, purchase_model_preference,
        has_bought_leads_before, previous_lead_providers, previous_leads_exclusive_or_shared,
        previous_price_paid_per_lead, previous_leads_worthwhile_pct, previous_supplier_problems,
        reliability_criteria, who_handles_enquiries, has_dedicated_sales_team,
        can_contact_during_business_hours, typical_first_response_time, surveys_per_week_capacity,
        typical_qualified_to_job_conversion_pct, avg_revenue_per_completed_job,
        confirmed_info_accurate, confirmed_can_deliver_services,
        agreed_buyer_terms_at, agreed_buyer_terms_version,
        acknowledged_replacement_policy_at, acknowledged_replacement_policy_version,
        confirmed_payment_before_release_understanding, agreed_pii_handling,
        agreed_account_notifications, marketing_consent,
        application_status, application_reference, internal_suitability_score, internal_suitability_notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        (SELECT id FROM industries WHERE slug = $9),
        $10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,$25,
        $26,$27,$28,$29,$30,$31,$32,$33,$34,
        $35,$36,$37,$38,$39,$40,$41,$42,
        $43,$44,$45,$46,$47,$48,$49,$50,$51,
        $52, 'PENDING_REVIEW', $53, $54, $55
      )
      RETURNING id`,
      [
        body.company_name, body.website ?? null, body.contact_name, body.contact_email, body.telephone,
        body.company_registration_number ?? null, body.years_operating ?? null, body.business_location ?? null,
        CURRENT_INDUSTRY_SLUG,
        JSON.stringify(body.services_offered ?? []), body.does_own_fulfilment ?? null, body.has_required_insurance_and_quals ?? null,
        JSON.stringify(body.counties_covered ?? []), JSON.stringify(body.postcodes_covered ?? []), body.coverage_type ?? null, body.excluded_areas ?? null, body.max_travel_distance_miles ?? null,
        body.weekly_lead_capacity ?? null, body.preferred_monthly_volume ?? null, body.volume_preference ?? null, body.accepts_long_term_prospects ?? null,
        JSON.stringify(body.property_types_accepted ?? []), body.min_project_value ?? null, body.max_project_value ?? null, body.exclusivity_preference ?? null,
        body.preferred_price_range_low ?? null, body.preferred_price_range_high ?? null, body.purchase_model_preference ?? null,
        body.has_bought_leads_before ?? null, body.previous_lead_providers ?? null, body.previous_leads_exclusive_or_shared ?? null,
        body.previous_price_paid_per_lead ?? null, body.previous_leads_worthwhile_pct ?? null, body.previous_supplier_problems ?? null,
        body.reliability_criteria ?? null, body.who_handles_enquiries ?? null, body.has_dedicated_sales_team ?? null,
        body.can_contact_during_business_hours ?? null, body.typical_first_response_time ?? null, body.surveys_per_week_capacity ?? null,
        body.typical_qualified_to_job_conversion_pct ?? null, body.avg_revenue_per_completed_job ?? null,
        body.confirmed_info_accurate, body.confirmed_can_deliver_services,
        now, BUYER_TERMS_VERSION,
        now, REPLACEMENT_POLICY_VERSION,
        body.confirmed_payment_before_release_understanding, body.agreed_pii_handling,
        body.agreed_account_notifications,
        body.marketing_consent ?? false,
        // Temporary unique placeholder for application_reference (NOT NULL UNIQUE) until the
        // real HLX-BYR-xxxxxx reference is computed from the serial id below. A fixed literal
        // here (the original bug) would collide under the UNIQUE constraint on a second
        // concurrent application.
        `PENDING-${randomUUID()}`,
        score,
        notes.join(' '),
      ]
    );

    const buyerId = insertResult.rows[0].id;
    const applicationReference = `HLX-BYR-${String(buyerId).padStart(6, '0')}`;

    await client.query(`UPDATE buyers SET application_reference = $1 WHERE id = $2`, [applicationReference, buyerId]);

    await client.query(
      `INSERT INTO buyer_notification_preferences (buyer_id) VALUES ($1)`,
      [buyerId]
    );

    await client.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
       VALUES ($1, 'BUYER_APPLICATION_SUBMITTED', 'buyer', $2, $3)`,
      [applicationReference, buyerId, JSON.stringify({ application_status: 'PENDING_REVIEW', suitability_score: score })]
    );

    await client.query('COMMIT');

    return NextResponse.json(
      {
        application_reference: applicationReference,
        application_status: 'PENDING_REVIEW',
        message:
          "Thanks — we've received your application. It's under review; this does not grant access to lead inventory or homeowner details yet. We'll be in touch.",
      },
      { status: 201 }
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Buyer application insert failed', err);
    return NextResponse.json({ error: 'Something went wrong saving your application. Please try again.' }, { status: 500 });
  } finally {
    client.release();
  }
}
