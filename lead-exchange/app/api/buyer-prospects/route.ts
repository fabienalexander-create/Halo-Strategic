import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { isConfiguredIndustrySlug } from '../../../lib/industries';
import { sendProspectNurtureEmail } from '../../../lib/buyerProspectEmail';
import { prospectWelcomeEmail } from '../../../lib/emailTemplates';
import { verifyTurnstileToken } from '../../../lib/turnstile';
import { buildAttributionQuery } from '../../../lib/attribution';
import { captureBuyerProspectTouch } from '../../../lib/buyerProspectCapture';

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
  fbclid?: string;
  referrer?: string;
  bot_field?: string;
  turnstile_token?: string;
}

const REQUIRED_FIELDS: (keyof BuyerProspectPayload)[] = [
  'company_name',
  'contact_name',
  'contact_email',
  'telephone',
];

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

  // Soft-disabled (always ok:true) until TURNSTILE_SECRET_KEY is configured -- see lib/turnstile.ts.
  const turnstile = await verifyTurnstileToken(body.turnstile_token);
  if (!turnstile.ok) {
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 });
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

    const { prospectId, prospectReference, isNewProspect } = await captureBuyerProspectTouch(db, {
      channel: 'website',
      industryId,
      industrySlug,
      companyName: body.company_name,
      contactName: body.contact_name,
      contactEmail: body.contact_email,
      telephone: body.telephone,
      postcodesCovered: body.postcodes_covered,
      approxMonthlyLeadRequirement: body.approx_monthly_lead_requirement,
      consentContact: body.consent_contact,
      marketingConsent: body.marketing_consent,
      utmSource: body.utm_source,
      utmMedium: body.utm_medium,
      utmCampaign: body.utm_campaign,
      fbclid: body.fbclid,
      referrer: body.referrer,
    });

    // Lookup used for the unsubscribe token needed below -- captureBuyerProspectTouch generates
    // and stores it on first creation, but a repeat touch doesn't get a new one (nor should it:
    // the same unsubscribe link must keep working for a prospect who touches twice).
    const tokenRows = await db.sql`SELECT unsubscribe_token FROM buyer_prospects WHERE id = ${prospectId}`;
    const unsubscribeToken = (tokenRows[0] as { unsubscribe_token: string }).unsubscribe_token;

    // Only the FIRST touch gets a welcome email -- a repeat touch (already-active prospect
    // registering again) must not restart or duplicate the nurture sequence.
    if (isNewProspect) {
      // The apply link carries the prospect's own reference and first-touch attribution forward,
      // so a prospect who applies via this email (same session or days later) can be linked back
      // deterministically in /api/buyer-applications, rather than relying on email-match alone.
      const attributionQuery = buildAttributionQuery(
        { utm_source: body.utm_source, utm_medium: body.utm_medium, utm_campaign: body.utm_campaign, fbclid: body.fbclid },
        { ref: prospectReference }
      );
      const applyUrl = `https://halostrategic.com/leads-exchange/become-a-buyer/apply${attributionQuery ? `?${attributionQuery}` : ''}`;
      const unsubscribeUrl = `https://halostrategic.com/leads-exchange/become-a-buyer/unsubscribe?token=${unsubscribeToken}`;
      await sendProspectNurtureEmail(db, {
        prospectId,
        nurtureStep: 1,
        to: body.contact_email,
        ...prospectWelcomeEmail({ contactName: body.contact_name, applyUrl, unsubscribeUrl }),
      });
      await db.sql`UPDATE buyer_prospects SET nurture_step = 1, last_nurture_sent_at = now() WHERE id = ${prospectId}`;
    }

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
