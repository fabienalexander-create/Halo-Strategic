import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { isConfiguredIndustrySlug } from '../../../lib/industries';
import { sendProspectNurtureEmail } from '../../../lib/buyerProspectEmail';
import { prospectWelcomeEmail } from '../../../lib/emailTemplates';

// Minimal in-memory rate limiting per Netlify Function instance -- same floor as every other
// public form in this app (/api/contact, /api/admin/login, /api/homeowner-enquiries).
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

interface BuyerProspectPayload {
  industry_slug?: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  telephone: string;
  postcodes_covered?: string;
  approx_monthly_lead_requirement?: string;
  consent_contact: boolean;
  marketing_consent?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  bot_field?: string;
}

const REQUIRED_FIELDS: (keyof BuyerProspectPayload)[] = [
  'company_name',
  'contact_name',
  'contact_email',
  'telephone',
];

// Best-effort source attribution from UTM parameters and referrer -- never presented as more
// precise than it actually is (see migration comment). Meta and Instantly links are expected to
// carry a recognisable utm_source; anything else with no referrer is organic, anything with an
// external referrer but no recognised utm_source is a direct referral.
function deriveSource(params: { utmSource?: string; referrer?: string }): string {
  const utm = params.utmSource?.toLowerCase() ?? '';
  if (utm.includes('facebook') || utm.includes('meta') || utm.includes('instagram')) return 'meta';
  if (utm.includes('instantly')) return 'instantly';
  if (params.referrer && !params.referrer.includes('halostrategic.com')) return 'direct_referral';
  return 'organic_website';
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 });
  }

  let body: BuyerProspectPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (body.bot_field) {
    return NextResponse.json({ error: 'Submission rejected.' }, { status: 400 });
  }

  if (!isConfiguredIndustrySlug(body.industry_slug)) {
    return NextResponse.json({ error: 'Unknown or unsupported industry.' }, { status: 400 });
  }
  const industrySlug = body.industry_slug;

  for (const field of REQUIRED_FIELDS) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  // A single consent to being contacted -- required. Marketing is a separate, optional consent,
  // never bundled into it, same discipline as every other form in this app.
  if (body.consent_contact !== true) {
    return NextResponse.json({ error: 'Consent to be contacted is required.' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const industryRows = await db.sql`SELECT id, is_enabled FROM industries WHERE slug = ${industrySlug}`;
    if (industryRows.length === 0 || industryRows[0].is_enabled !== true) {
      return NextResponse.json({ error: 'This industry is not currently accepting registrations.' }, { status: 400 });
    }
    const industryId = industryRows[0].id as number;

    const source = deriveSource({ utmSource: body.utm_source, referrer: body.referrer });

    const inserted = await db.sql`
      INSERT INTO buyer_prospects (
        prospect_reference, industry_id, company_name, contact_name, contact_email, telephone,
        postcodes_covered, approx_monthly_lead_requirement,
        source, utm_source, utm_medium, utm_campaign,
        consent_contact, marketing_consent
      ) VALUES (
        ${`PENDING-${Date.now()}-${Math.random().toString(36).slice(2)}`}, ${industryId}, ${body.company_name}, ${body.contact_name}, ${body.contact_email}, ${body.telephone},
        ${body.postcodes_covered ?? null}, ${body.approx_monthly_lead_requirement ?? null},
        ${source}, ${body.utm_source ?? null}, ${body.utm_medium ?? null}, ${body.utm_campaign ?? null},
        ${body.consent_contact}, ${body.marketing_consent ?? false}
      )
      RETURNING id
    `;
    const prospectId = inserted[0].id as number;
    const prospectReference = `HLX-PROSPECT-${String(prospectId).padStart(6, '0')}`;
    await db.sql`UPDATE buyer_prospects SET prospect_reference = ${prospectReference} WHERE id = ${prospectId}`;

    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
      VALUES (
        ${prospectReference}, 'BUYER_PROSPECT_REGISTERED', 'buyer_prospect', ${prospectId},
        ${JSON.stringify({ industry: industrySlug, source, company_name: body.company_name })}
      )
    `;

    // The first nurture email is sent after commit, and never allowed to throw -- a failed send
    // must never undo an already-recorded prospect. The scheduled function (not yet built) picks
    // up steps 2-5 on its own cadence; this just sends step 1 immediately so there's no needless
    // delay on the welcome email specifically.
    const applyUrl = 'https://halostrategic.com/leads-exchange/become-a-buyer/apply';
    await sendProspectNurtureEmail(db, {
      prospectId,
      nurtureStep: 1,
      to: body.contact_email,
      ...prospectWelcomeEmail({ contactName: body.contact_name, applyUrl }),
    });
    await db.sql`UPDATE buyer_prospects SET nurture_step = 1, last_nurture_sent_at = now() WHERE id = ${prospectId}`;

    return NextResponse.json(
      {
        reference: prospectReference,
        message: "Thanks — we've received your details and will be in touch with more information shortly.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Buyer prospect registration failed', err);
    return NextResponse.json({ error: 'Something went wrong saving your registration. Please try again.' }, { status: 500 });
  }
}
