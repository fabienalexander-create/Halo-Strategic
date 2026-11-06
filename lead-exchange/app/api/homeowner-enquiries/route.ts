import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { HOMEOWNER_CONSENT_CONFIG, isConfiguredIndustrySlug } from '../../../lib/industries';

// Minimal in-memory rate limiting per Netlify Function instance — same floor as /api/contact
// and /api/admin/login, not a replacement for a real rate-limiter.
const submissions = new Map<string, { count: number; firstAttemptAt: number }>();
const MAX_SUBMISSIONS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = submissions.get(key);
  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    submissions.set(key, { count: 1, firstAttemptAt: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_SUBMISSIONS;
}

interface HomeownerEnquiryPayload {
  industry_slug?: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  preferred_contact_method?: string;
  postcode: string;
  ownership_status: string;
  property_type: string;
  // Spray Foam Removal fields
  foam_location?: string;
  foam_type?: string;
  reason_for_removal?: string;
  timeframe?: string;
  roof_access?: string;
  previous_quotes?: string;
  // Solar & Battery fields
  interest_type?: string;
  roof_type?: string;
  existing_solar?: string;
  consent_contact: boolean;
  consent_share_buyer: boolean;
  privacy_consent: boolean;
  marketing_consent?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  bot_field?: string;
}

// Universal required fields -- the same across every industry (brief §5: "reuse shared
// components... contact information, postcode, consent handling"). Industry-specific questions
// (foam_location, interest_type, etc.) are all optional, same as Spray Foam Removal's always were.
const REQUIRED_FIELDS: (keyof HomeownerEnquiryPayload)[] = [
  'first_name',
  'last_name',
  'email',
  'mobile',
  'postcode',
  'ownership_status',
  'property_type',
];

// Which body keys become this industry's qualification_answers, beyond the universal fields
// above (which get their own dedicated columns/handling). Keeping this list explicit, rather than
// spreading the whole body into qualification_answers, means a field submitted for the wrong
// industry is simply dropped, not silently stored against the wrong vertical's lead.
const QUALIFICATION_FIELDS: Record<string, (keyof HomeownerEnquiryPayload)[]> = {
  spray_foam_removal: ['foam_location', 'foam_type', 'reason_for_removal', 'timeframe', 'roof_access', 'previous_quotes'],
  solar_battery: ['interest_type', 'roof_type', 'existing_solar', 'timeframe'],
};

const SERVICE_REQUIREMENT_LABEL: Record<string, string> = {
  spray_foam_removal: 'Spray Foam Removal',
  solar_battery: 'Solar & Battery Installation',
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 });
  }

  let body: HomeownerEnquiryPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Simple honeypot: a real visitor never fills this field in.
  if (body.bot_field) {
    return NextResponse.json({ error: 'Submission rejected.' }, { status: 400 });
  }

  // The server is authoritative on which industries exist and are open to submissions -- never
  // trust the frontend's own routing to have picked a valid, live industry. This first check is
  // the cheap, no-database one: the slug must be one this route actually has consent/
  // qualification config for. The second, database-backed check (industries.is_enabled) runs
  // below, after the equally cheap field/consent checks -- so a malformed or incomplete request
  // is rejected without a database round-trip at all, same ordering as /api/buyer-applications.
  if (!isConfiguredIndustrySlug(body.industry_slug)) {
    return NextResponse.json({ error: 'Unknown or unsupported industry.' }, { status: 400 });
  }
  const industrySlug = body.industry_slug;

  for (const field of REQUIRED_FIELDS) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  // Three separate, required consents -- never bundled into one checkbox (Privacy Policy §3:
  // "Your separate, specific consent to sharing. Not bundled with anything else").
  if (body.consent_contact !== true) {
    return NextResponse.json({ error: 'Consent to be contacted about this enquiry is required.' }, { status: 400 });
  }
  if (body.consent_share_buyer !== true) {
    return NextResponse.json(
      { error: 'Consent to share your details with a suitable buyer is required.' },
      { status: 400 }
    );
  }
  if (body.privacy_consent !== true) {
    return NextResponse.json({ error: 'You must confirm you have read the Privacy Policy.' }, { status: 400 });
  }

  // Second, database-backed gate: the industry must currently be enabled (so a
  // configured-but-not-yet-launched industry, or one later paused, is still rejected regardless
  // of what the frontend offered).
  const db = getDatabase();
  const industryRows = await db.sql`SELECT id, is_enabled FROM industries WHERE slug = ${industrySlug}`;
  if (industryRows.length === 0 || industryRows[0].is_enabled !== true) {
    return NextResponse.json({ error: 'This industry is not currently accepting enquiries.' }, { status: 400 });
  }
  const industryId = industryRows[0].id as number;

  const consentConfig = HOMEOWNER_CONSENT_CONFIG[industrySlug];
  const qualificationFields = QUALIFICATION_FIELDS[industrySlug];
  const qualificationAnswers: Record<string, unknown> = { ownership_status: body.ownership_status };
  for (const field of qualificationFields) {
    qualificationAnswers[field] = body[field] ?? null;
  }
  qualificationAnswers.consent_contact = body.consent_contact;
  qualificationAnswers.consent_share_buyer = body.consent_share_buyer;
  qualificationAnswers.privacy_consent = body.privacy_consent;
  qualificationAnswers.marketing_consent = body.marketing_consent ?? false;
  qualificationAnswers.consent_version = consentConfig.consentVersion;
  qualificationAnswers.utm_source = body.utm_source ?? null;
  qualificationAnswers.utm_medium = body.utm_medium ?? null;
  qualificationAnswers.utm_campaign = body.utm_campaign ?? null;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const consentResult = await client.query(
      `INSERT INTO consent_records (wording_version, source, purpose, named_recipient_or_category)
       VALUES ($1, $2, 'Contact about enquiry and share with one suitable buyer', $3)
       RETURNING id`,
      [consentConfig.consentVersion, consentConfig.source, consentConfig.namedRecipientOrCategory]
    );
    const consentRecordId = consentResult.rows[0].id;

    const leadResult = await client.query(
      `INSERT INTO leads (
        industry_id, service_requirement, homeowner_name, homeowner_contact,
        property_type, postcode, qualification_answers, consent_record_id,
        source, acquisition_campaign, status
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, 'NEW'
      )
      RETURNING id`,
      [
        industryId,
        SERVICE_REQUIREMENT_LABEL[industrySlug],
        `${body.first_name} ${body.last_name}`,
        JSON.stringify({ email: body.email, mobile: body.mobile, preferred_contact_method: body.preferred_contact_method ?? null }),
        body.property_type,
        body.postcode,
        JSON.stringify(qualificationAnswers),
        consentRecordId,
        consentConfig.source,
        body.utm_campaign ?? null,
      ]
    );
    const leadId = leadResult.rows[0].id;
    const leadReference = `HLX-LEAD-${String(leadId).padStart(6, '0')}`;

    await client.query(`UPDATE consent_records SET lead_id = $1 WHERE id = $2`, [leadId, consentRecordId]);

    await client.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
       VALUES ($1, 'HOMEOWNER_LEAD_SUBMITTED', 'lead', $2, $3)`,
      [
        leadReference,
        leadId,
        JSON.stringify({ status: 'NEW', industry: industrySlug, postcode: body.postcode, consent_version: consentConfig.consentVersion }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json(
      {
        reference: leadReference,
        message:
          "Thanks — we've received your enquiry. If your details are shared with a suitable business, we'll let you know.",
      },
      { status: 201 }
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Homeowner enquiry insert failed', err);
    return NextResponse.json({ error: 'Something went wrong saving your enquiry. Please try again.' }, { status: 500 });
  } finally {
    client.release();
  }
}
