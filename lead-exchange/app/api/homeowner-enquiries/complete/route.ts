import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { HOMEOWNER_CONSENT_CONFIG } from '../../../../lib/industries';
import { hashFollowUpToken } from '../../../../lib/metaFollowUpToken';

// Completes a Meta-sourced lead that was saved incomplete (app/api/integrations/
// meta-homeowner-leads/route.ts) because the live Instant Form doesn't ask the qualification
// questions or for consent. This is the ONLY place that turns such a lead's follow-up token into
// real, explicit consent and a finished qualification -- never inferred, never pre-ticked.
//
// Deliberately mirrors app/api/homeowner-enquiries/route.ts's own three-separate-consent pattern
// (Privacy Policy §3: "Your separate, specific consent to sharing. Not bundled with anything
// else") rather than the Meta Instant Form's single combined checkbox: this page is a normal web
// form with none of Instant Form's UI constraints, so there's no reason to settle for the
// compromise that channel needed. Wording below is reused verbatim from that route, not
// reworded, so the two paths never drift into saying different things about the same consents.
//
// Updates the SAME lead row -- never inserts a new one. Leaves the lead at status 'NEW' (the same
// status a fresh website submission already gets), not 'QUALIFIED': normal admin review and the
// lead-specific homeowner confirmation (required before any allocation regardless, see
// app/api/admin/leads/[id]/allocate/route.ts) still have to happen afterwards, exactly as they
// would for any other lead. This route never touches lead_allocations, homeowner_confirmations,
// payments or any delivery/email table, same discipline as the Meta ingestion route.

// Same floor as /api/contact, /api/admin/login and /api/homeowner-enquiries -- not a replacement
// for a real rate-limiter, just enough friction that guessing tokens by brute force costs more
// than it's worth on top of the 256-bit token space itself.
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

interface CompletePayload {
  token?: string;
  foam_location?: string;
  foam_type?: string;
  reason_for_enquiry?: string;
  timeframe?: string;
  preferred_contact_method?: string;
  previous_inspection?: string;
  appointment_availability?: string;
  consent_contact?: boolean;
  consent_share_buyer?: boolean;
  privacy_consent?: boolean;
  marketing_consent?: boolean;
  bot_field?: string;
}

// Exactly the three fields the Meta route marks missing when they're absent -- nothing more is
// demanded here than what sent the homeowner to this page in the first place. foam_location/
// foam_type/previous_inspection/appointment_availability stay optional, same as at Meta ingestion.
const REQUIRED_COMPLETION_FIELDS: (keyof CompletePayload)[] = ['reason_for_enquiry', 'timeframe', 'preferred_contact_method'];

const INDUSTRY_SLUG = 'spray_foam_removal' as const; // the only industry this journey exists for today

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 });
  }

  let body: CompletePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Simple honeypot, same convention as /api/homeowner-enquiries.
  if (body.bot_field) {
    return NextResponse.json({ error: 'Submission rejected.' }, { status: 400 });
  }

  if (!body.token || typeof body.token !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid token.' }, { status: 400 });
  }

  for (const field of REQUIRED_COMPLETION_FIELDS) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  // Three separate, required consents -- never bundled into one checkbox (Privacy Policy §3:
  // "Your separate, specific consent to sharing. Not bundled with anything else"). Wording
  // reused verbatim from app/api/homeowner-enquiries/route.ts.
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

  const consentConfig = HOMEOWNER_CONSENT_CONFIG[INDUSTRY_SLUG];
  const tokenHash = hashFollowUpToken(body.token);

  const db = getDatabase();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Atomic claim: only a request that finds the token unused and unexpired, right now, can set
    // follow_up_token_used_at and get a row back. A second, concurrent request for the same
    // token either waits on this row's lock and then finds used_at already set (0 rows), or -- if
    // it arrives after this transaction commits -- simply finds 0 rows matching IS NULL. Either
    // way, only one submission can ever win a given token.
    const claimed = await client.query(
      `UPDATE leads SET follow_up_token_used_at = now()
       WHERE follow_up_token_hash = $1 AND follow_up_token_used_at IS NULL AND follow_up_token_expires_at > now()
       RETURNING id, qualification_answers, consent_record_id`,
      [tokenHash]
    );

    if (claimed.rows.length === 0) {
      await client.query('ROLLBACK');
      // Deliberately one uniform response for "no such token", "already used" and "expired" --
      // nothing here helps an enumeration attempt distinguish those cases, and a genuine
      // homeowner only ever needs to know the link no longer works.
      return NextResponse.json(
        { error: 'This link is no longer valid. It may have expired or already been used.' },
        { status: 410 }
      );
    }

    const leadId = claimed.rows[0].id as number;
    const existingAnswers = (claimed.rows[0].qualification_answers ?? {}) as Record<string, unknown>;
    const existingConsentRecordId = claimed.rows[0].consent_record_id as number | null;

    // consent_record_id should always be NULL at this point (the Meta route never creates one
    // for an incomplete lead), but this is still checked rather than assumed -- a non-null value
    // here would mean consent was already recorded some other way, and this route must never
    // overwrite or duplicate that rather than silently replacing it.
    if (existingConsentRecordId !== null) {
      await client.query('ROLLBACK');
      console.error(`Lead ${leadId} already has consent_record_id ${existingConsentRecordId}; refusing to complete again.`);
      return NextResponse.json({ error: 'This enquiry already has consent recorded.' }, { status: 409 });
    }

    const consentResult = await client.query(
      `INSERT INTO consent_records (wording_version, source, purpose, named_recipient_or_category, lead_id)
       VALUES ($1, $2, 'Contact about enquiry and share with one or more suitable buyers', $3, $4)
       RETURNING id`,
      [consentConfig.consentVersion, 'spray_foam_removal_homeowner_followup', consentConfig.namedRecipientOrCategory, leadId]
    );
    const consentRecordId = consentResult.rows[0].id as number;

    // Only 'awaiting_qualification' is removed from any existing review_reasons -- anything else
    // already flagged (e.g. 'renter', 'outside_service_area') is unrelated to qualification/
    // consent completeness and must survive untouched.
    const existingReviewReasons = Array.isArray(existingAnswers.review_reasons)
      ? (existingAnswers.review_reasons as string[]).filter((r) => r !== 'awaiting_qualification')
      : [];

    const mergedAnswers = {
      ...existingAnswers,
      foam_location: body.foam_location ?? existingAnswers.foam_location ?? null,
      foam_type: body.foam_type ?? existingAnswers.foam_type ?? null,
      // Kept under the same key the Meta route already used on this row (reason_for_enquiry),
      // not the website form's own 'reason_for_removal' name, so one lead never ends up with two
      // differently-named answers to the same question. The two ingestion routes' field naming
      // is otherwise unrelated to this change and is left as-is.
      reason_for_enquiry: body.reason_for_enquiry,
      timeframe: body.timeframe,
      preferred_contact_method: body.preferred_contact_method,
      previous_inspection: body.previous_inspection ?? existingAnswers.previous_inspection ?? null,
      appointment_availability: body.appointment_availability ?? existingAnswers.appointment_availability ?? null,
      consent_contact: true,
      consent_share_buyer: true,
      privacy_consent: true,
      marketing_consent: body.marketing_consent ?? false,
      consent_version: consentConfig.consentVersion,
      needs_manual_review: existingReviewReasons.length > 0,
      review_reasons: existingReviewReasons,
      awaiting_qualification: false,
      missing_qualification_fields: [],
      qualification_completed_via: 'website_followup',
      qualification_completed_at: new Date().toISOString(),
    };

    await client.query(
      `UPDATE leads SET qualification_answers = $1::jsonb, consent_record_id = $2, status = 'NEW' WHERE id = $3`,
      [JSON.stringify(mergedAnswers), consentRecordId, leadId]
    );

    await client.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
       VALUES ('system:homeowner_enquiry_followup', 'LEAD_QUALIFICATION_COMPLETED', 'lead', $1, $2)`,
      [leadId, JSON.stringify({ status: 'NEW', consent_version: consentConfig.consentVersion })]
    );

    await client.query('COMMIT');

    return NextResponse.json(
      { lead_id: leadId, reference: `HLX-LEAD-${String(leadId).padStart(6, '0')}`, status: 'NEW' },
      { status: 200 }
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Completing a homeowner enquiry failed', err);
    return NextResponse.json({ error: 'Something went wrong saving this enquiry.' }, { status: 500 });
  } finally {
    client.release();
  }
}
