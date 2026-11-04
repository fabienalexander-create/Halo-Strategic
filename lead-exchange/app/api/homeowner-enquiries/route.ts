import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';

// The consent wording version shown to homeowners on the spray foam removal enquiry form.
// Bump this string whenever the consent copy on the form changes, so historical consent
// records stay tied to the wording actually shown at the time (matches the Privacy Policy's
// "consent version" column in its homeowner data table).
const CONSENT_VERSION = '2026-11-04-v0.1';
const CURRENT_INDUSTRY_SLUG = 'spray_foam_removal';

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
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  preferred_contact_method?: string;
  postcode: string;
  ownership_status: string;
  property_type: string;
  foam_location?: string;
  foam_type?: string;
  reason_for_removal?: string;
  timeframe?: string;
  roof_access?: string;
  previous_quotes?: string;
  consent_contact: boolean;
  consent_share_buyer: boolean;
  privacy_consent: boolean;
  marketing_consent?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  bot_field?: string;
}

const REQUIRED_FIELDS: (keyof HomeownerEnquiryPayload)[] = [
  'first_name',
  'last_name',
  'email',
  'mobile',
  'postcode',
  'ownership_status',
  'property_type',
];

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

  const db = getDatabase();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const consentResult = await client.query(
      `INSERT INTO consent_records (wording_version, source, purpose, named_recipient_or_category)
       VALUES ($1, 'spray_foam_removal_homeowner_form', 'Contact about enquiry and share with one suitable buyer', $2)
       RETURNING id`,
      [
        CONSENT_VERSION,
        'An approved Spray Foam Removal buyer (installer) in the Halo Lead Exchange, only if judged a genuine fit',
      ]
    );
    const consentRecordId = consentResult.rows[0].id;

    const leadResult = await client.query(
      `INSERT INTO leads (
        industry_id, service_requirement, homeowner_name, homeowner_contact,
        property_type, postcode, qualification_answers, consent_record_id,
        source, acquisition_campaign, status
      ) VALUES (
        (SELECT id FROM industries WHERE slug = $1),
        'Spray Foam Removal', $2, $3,
        $4, $5, $6, $7,
        'spray_foam_removal_homeowner_form', $8, 'NEW'
      )
      RETURNING id`,
      [
        CURRENT_INDUSTRY_SLUG,
        `${body.first_name} ${body.last_name}`,
        JSON.stringify({ email: body.email, mobile: body.mobile, preferred_contact_method: body.preferred_contact_method ?? null }),
        body.property_type,
        body.postcode,
        JSON.stringify({
          ownership_status: body.ownership_status,
          foam_location: body.foam_location ?? null,
          foam_type: body.foam_type ?? null,
          reason_for_removal: body.reason_for_removal ?? null,
          timeframe: body.timeframe ?? null,
          roof_access: body.roof_access ?? null,
          previous_quotes: body.previous_quotes ?? null,
          consent_contact: body.consent_contact,
          consent_share_buyer: body.consent_share_buyer,
          privacy_consent: body.privacy_consent,
          marketing_consent: body.marketing_consent ?? false,
          consent_version: CONSENT_VERSION,
          utm_source: body.utm_source ?? null,
          utm_medium: body.utm_medium ?? null,
          utm_campaign: body.utm_campaign ?? null,
        }),
        consentRecordId,
        body.utm_campaign ?? null,
      ]
    );
    const leadId = leadResult.rows[0].id;
    const leadReference = `HLX-LEAD-${String(leadId).padStart(6, '0')}`;

    await client.query(`UPDATE consent_records SET lead_id = $1 WHERE id = $2`, [leadId, consentRecordId]);

    await client.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
       VALUES ($1, 'HOMEOWNER_LEAD_SUBMITTED', 'lead', $2, $3)`,
      [leadReference, leadId, JSON.stringify({ status: 'NEW', postcode: body.postcode, consent_version: CONSENT_VERSION })]
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
