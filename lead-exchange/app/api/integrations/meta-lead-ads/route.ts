import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { secretMatches } from '../../../../lib/smsWebhookAuth';
import { isConfiguredIndustrySlug } from '../../../../lib/industries';
import { captureBuyerProspectTouch } from '../../../../lib/buyerProspectCapture';

// Server-to-server ingestion for the Meta Lead Ads Instant Form, bridged via a Make scenario
// (Facebook Lead Ads trigger -> Make's own field mapping -> this endpoint), NOT called directly
// by Meta or by any browser. Fail-closed like every other webhook in this codebase: 503 while
// unconfigured, 401 on a wrong secret, never a silent accept.
//
// `mapped` is deliberately the only part of the payload this endpoint tries to interpret as
// structured data -- Make's own visual field-mapper is where Meta's arbitrary Instant Form
// question labels get turned into Halo's fixed fields, not here.
//
// Consent is NOT assumed just because a lead arrived: `consent_contact` must be explicitly true,
// AND it must be backed by `consent_evidence` -- the actual question/disclaimer text shown on the
// form and the actual answer given, not a boolean Make invented because "a lead came through".
// Deliberately NOT a generic "whole form's raw answers" passthrough -- only the consent question
// and answer are stored, not whatever else the Instant Form happened to ask, so this stays
// limited to what buyer_prospects actually needs to justify a contact-consent claim later.
//
// Writes to buyer_prospects only, via the same captureBuyerProspectTouch helper the website route
// uses -- never homeowner_enquiries or any homeowner-side table. These are prospective buyers
// (installers), not homeowners, and must never be conflated with the homeowner lead pipeline.
interface ConsentEvidence {
  question: string;
  answer: string;
  presented_at?: string;
}

interface MetaLeadAdsPayload {
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
    company_name?: string;
    contact_name?: string;
    contact_email?: string;
    telephone?: string;
    consent_contact?: boolean;
    consent_wording_version?: string;
    consent_evidence?: ConsentEvidence;
    marketing_consent?: boolean;
    postcodes_covered?: string;
    approx_monthly_lead_requirement?: string;
  };
}

const REQUIRED_MAPPED_FIELDS: (keyof MetaLeadAdsPayload['mapped'])[] = [
  'industry_slug', 'company_name', 'contact_name', 'contact_email', 'telephone', 'consent_wording_version',
];

export async function POST(req: NextRequest) {
  const secret = process.env.META_LEAD_ADS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Meta Lead Ads integration is not configured.' }, { status: 503 });
  }
  const presented = req.headers.get('x-halo-integration-secret');
  if (!secretMatches(presented, secret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: MetaLeadAdsPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.meta_lead_id) {
    return NextResponse.json({ error: 'Missing required field: meta_lead_id' }, { status: 400 });
  }
  if (!body.mapped) {
    return NextResponse.json({ error: 'Missing required field: mapped' }, { status: 400 });
  }
  for (const field of REQUIRED_MAPPED_FIELDS) {
    if (!body.mapped[field]) {
      return NextResponse.json({ error: `Missing required mapped field: ${field}` }, { status: 400 });
    }
  }
  if (!isConfiguredIndustrySlug(body.mapped.industry_slug)) {
    return NextResponse.json({ error: 'Unknown or unsupported industry.' }, { status: 400 });
  }
  // No silent assumption of consent -- an Instant Form submission with no recorded consent to
  // contact is rejected, same discipline as the website route's consent_contact check.
  if (body.mapped.consent_contact !== true) {
    return NextResponse.json({ error: 'Consent to be contacted is required.' }, { status: 400 });
  }
  // AND that consent must be backed by the actual question/answer shown to the installer, not a
  // value Make set on the assumption that submitting the form implies consent. See the module
  // comment above -- this is the single most important check in this endpoint.
  const evidence = body.mapped.consent_evidence;
  if (!evidence || !evidence.question || !evidence.answer) {
    return NextResponse.json(
      { error: 'consent_evidence (the actual question and answer shown on the form) is required alongside consent_contact.' },
      { status: 400 }
    );
  }

  const industrySlug = body.mapped.industry_slug;

  try {
    const db = getDatabase();
    const industryRows = await db.sql`SELECT id, is_enabled FROM industries WHERE slug = ${industrySlug}`;
    if (industryRows.length === 0 || industryRows[0].is_enabled !== true) {
      return NextResponse.json({ error: 'This industry is not currently accepting registrations.' }, { status: 400 });
    }
    const industryId = industryRows[0].id as number;

    const { prospectReference, isNewProspect, isDuplicateMetaLead } = await captureBuyerProspectTouch(db, {
      channel: 'meta_instant_form',
      industryId,
      industrySlug,
      companyName: body.mapped.company_name!,
      contactName: body.mapped.contact_name!,
      contactEmail: body.mapped.contact_email!,
      telephone: body.mapped.telephone!,
      postcodesCovered: body.mapped.postcodes_covered,
      approxMonthlyLeadRequirement: body.mapped.approx_monthly_lead_requirement,
      consentContact: body.mapped.consent_contact,
      marketingConsent: body.mapped.marketing_consent,
      metaLeadId: body.meta_lead_id,
      metaCampaignId: body.campaign_id,
      metaCampaignName: body.campaign_name,
      metaAdsetId: body.adset_id,
      metaAdsetName: body.adset_name,
      metaAdId: body.ad_id,
      metaAdName: body.ad_name,
      metaFormId: body.form_id,
      metaFormName: body.form_name,
      metaSubmittedAt: body.created_time ? new Date(body.created_time) : undefined,
      consentWordingVersion: body.mapped.consent_wording_version,
      consentEvidence: evidence,
    });

    return NextResponse.json(
      {
        reference: prospectReference,
        duplicate: isDuplicateMetaLead,
        message: isDuplicateMetaLead
          ? 'This Meta lead was already recorded; no new prospect created.'
          : isNewProspect
            ? 'Prospect created from Meta Instant Form submission.'
            : 'Existing active prospect updated with this touch.',
      },
      { status: isDuplicateMetaLead ? 200 : 201 }
    );
  } catch (err) {
    console.error('Meta Lead Ads ingestion failed', err);
    return NextResponse.json({ error: 'Something went wrong saving this lead.' }, { status: 500 });
  }
}
