import { deriveSource } from './attribution';
import { generateUnsubscribeToken } from './buyerProspectEmail';

export type CaptureChannel = 'website' | 'meta_instant_form';

export interface CaptureBuyerProspectParams {
  channel: CaptureChannel;
  industryId: number;
  industrySlug: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  telephone: string;
  postcodesCovered?: string | null;
  approxMonthlyLeadRequirement?: string | null;
  consentContact: boolean;
  marketingConsent?: boolean;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  fbclid?: string | null;
  referrer?: string | null;
  metaLeadId?: string | null;
  metaCampaignId?: string | null;
  metaCampaignName?: string | null;
  metaAdsetId?: string | null;
  metaAdsetName?: string | null;
  metaAdId?: string | null;
  metaAdName?: string | null;
  metaFormId?: string | null;
  metaFormName?: string | null;
  metaSubmittedAt?: Date | null;
  // Deliberately NOT a generic "whatever Meta sent" blob -- see meta-lead-ads/route.ts. This is
  // only ever the specific consent question/answer pair (plus the wording version), never the
  // full set of Instant Form answers, so storage here stays limited to what buyer_prospects
  // actually needs to justify a contact-consent claim later.
  consentWordingVersion?: string | null;
  consentEvidence?: unknown;
}

export interface CaptureBuyerProspectResult {
  prospectId: number;
  prospectReference: string;
  isNewProspect: boolean;
  isDuplicateMetaLead: boolean;
}

// Netlify's db.pool is a plain pg Pool -- same escape hatch already used by
// app/api/buyer-applications/route.ts for multi-statement transactional work.
interface NetlifyDb {
  pool: { connect(): Promise<PgClient> };
}
interface PgClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
}

// Comparisons only -- never rewrites what's actually stored in contact_email, so a prospect's
// record keeps their email exactly as they typed it (for display, and for sending to it), while
// "is this the same person" is judged the way email addresses actually work: case-insensitive,
// no leading/trailing whitespace from a copy-paste or a sloppy Make mapping.
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The single write path for a qualifying buyer-prospect submission, used by both the website
 * register-interest route and the Meta Instant Form ingestion route, so the two channels can
 * never apply different dedup/first-touch/last-touch rules.
 *
 * - A Meta lead_id already seen before (retried webhook, re-run Make scenario) is a true no-op:
 *   no new prospect, no new touch row, same reference returned. This check happens BEFORE the
 *   row lock below, so a retry never even waits on it.
 * - Otherwise, this looks for an existing ACTIVE (unconverted) prospect for the same normalised
 *   email + industry, row-locked (FOR UPDATE) for the rest of the transaction. Found -> only
 *   last-touch fields are updated; first-touch, consent evidence, and profile fields
 *   (company/contact/phone) from the original submission are never overwritten by a repeat
 *   touch, however sloppy. Not found -> a new prospect is created, which becomes both its own
 *   first-touch and last-touch.
 * - KNOWN LIMITATION, accepted deliberately rather than silently: there is currently no database
 *   constraint enforcing "one active prospect per email+industry" (see
 *   docs/BUYER_PROSPECT_ATTRIBUTION_ROLLBACK.md for why that's being held back until a read-only
 *   duplicate report against real production data has been reviewed). Two truly concurrent first
 *   submissions for the same brand-new email+industry could each find no existing row and both
 *   insert -- there is nothing yet to lock before either row exists. This is a real, if narrow,
 *   race window; closing it is exactly what adding the partial unique index (a later, separate
 *   migration) will do, after which this function's SELECT-then-branch logic should be replaced
 *   with the atomic INSERT ... ON CONFLICT upsert this previously used.
 * - Every call that isn't a deduped Meta retry writes exactly one row to buyer_prospect_touches,
 *   first or repeat, so the full per-touch history (and every Meta lead_id ever received) is
 *   always recoverable regardless of what the summary row currently shows. This insert, the
 *   prospect insert/update, and the audit_log entry are all one transaction -- the prospect can
 *   never change without its touch and audit record being written too.
 */
export async function captureBuyerProspectTouch(
  db: NetlifyDb,
  p: CaptureBuyerProspectParams
): Promise<CaptureBuyerProspectResult> {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    if (p.metaLeadId) {
      const existing = await client.query(
        `SELECT t.prospect_id, bp.prospect_reference FROM buyer_prospect_touches t
         JOIN buyer_prospects bp ON bp.id = t.prospect_id
         WHERE t.meta_lead_id = $1`,
        [p.metaLeadId]
      );
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return {
          prospectId: existing.rows[0].prospect_id as number,
          prospectReference: existing.rows[0].prospect_reference as string,
          isNewProspect: false,
          isDuplicateMetaLead: true,
        };
      }
    }

    const source = deriveSource({ utmSource: p.utmSource ?? undefined, fbclid: p.fbclid ?? undefined, referrer: p.referrer ?? undefined });
    const normalisedEmail = normaliseEmail(p.contactEmail);

    const existingActive = await client.query(
      `SELECT id, prospect_reference FROM buyer_prospects
       WHERE lower(trim(contact_email)) = $1 AND industry_id = $2 AND converted_buyer_id IS NULL
       FOR UPDATE`,
      [normalisedEmail, p.industryId]
    );

    let prospectId: number;
    let prospectReference: string;
    let isNewProspect: boolean;

    if (existingActive.rows.length > 0) {
      // Repeat touch: only last-touch attribution and the Meta-specific "latest touch" summary
      // columns move. Profile fields, first-touch, and consent evidence are untouched.
      prospectId = existingActive.rows[0].id as number;
      prospectReference = existingActive.rows[0].prospect_reference as string;
      isNewProspect = false;
      await client.query(
        `UPDATE buyer_prospects SET
          source = $1,
          last_touch_channel = $2, last_touch_utm_source = $3, last_touch_utm_medium = $4,
          last_touch_utm_campaign = $5, last_touch_fbclid = $6, last_touch_at = now(),
          meta_lead_id = $7, meta_campaign_id = $8, meta_campaign_name = $9, meta_adset_id = $10,
          meta_adset_name = $11, meta_ad_id = $12, meta_ad_name = $13, meta_form_id = $14,
          meta_form_name = $15, meta_submitted_at = $16
        WHERE id = $17`,
        [
          source,
          p.channel, p.utmSource ?? null, p.utmMedium ?? null, p.utmCampaign ?? null, p.fbclid ?? null,
          p.metaLeadId ?? null, p.metaCampaignId ?? null, p.metaCampaignName ?? null, p.metaAdsetId ?? null,
          p.metaAdsetName ?? null, p.metaAdId ?? null, p.metaAdName ?? null, p.metaFormId ?? null,
          p.metaFormName ?? null, p.metaSubmittedAt ?? null,
          prospectId,
        ]
      );
    } else {
      const unsubscribeToken = generateUnsubscribeToken();
      const tempReference = `PENDING-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const inserted = await client.query(
        `INSERT INTO buyer_prospects (
          prospect_reference, industry_id, company_name, contact_name, contact_email, telephone,
          postcodes_covered, approx_monthly_lead_requirement,
          source, utm_source, utm_medium, utm_campaign, fbclid,
          capture_channel, last_touch_channel, last_touch_utm_source, last_touch_utm_medium,
          last_touch_utm_campaign, last_touch_fbclid, last_touch_at,
          meta_lead_id, meta_campaign_id, meta_campaign_name, meta_adset_id, meta_adset_name,
          meta_ad_id, meta_ad_name, meta_form_id, meta_form_name, meta_submitted_at,
          consent_wording_version, raw_form_answers,
          consent_contact, marketing_consent, unsubscribe_token
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,
          $9,$10,$11,$12,$13,
          $14,$14,$10,$11,
          $12,$13,now(),
          $15,$16,$17,$18,$19,
          $20,$21,$22,$23,$24,
          $25,$26,
          $27,$28,$29
        )
        RETURNING id`,
        [
          tempReference, p.industryId, p.companyName, p.contactName, p.contactEmail, p.telephone,
          p.postcodesCovered ?? null, p.approxMonthlyLeadRequirement ?? null,
          source, p.utmSource ?? null, p.utmMedium ?? null, p.utmCampaign ?? null, p.fbclid ?? null,
          p.channel,
          p.metaLeadId ?? null, p.metaCampaignId ?? null, p.metaCampaignName ?? null, p.metaAdsetId ?? null, p.metaAdsetName ?? null,
          p.metaAdId ?? null, p.metaAdName ?? null, p.metaFormId ?? null, p.metaFormName ?? null, p.metaSubmittedAt ?? null,
          p.consentWordingVersion ?? null, p.consentEvidence !== undefined ? JSON.stringify(p.consentEvidence) : null,
          p.consentContact, p.marketingConsent ?? false, unsubscribeToken,
        ]
      );
      prospectId = inserted.rows[0].id as number;
      prospectReference = `HLX-PROSPECT-${String(prospectId).padStart(6, '0')}`;
      isNewProspect = true;
      await client.query(`UPDATE buyer_prospects SET prospect_reference = $1 WHERE id = $2`, [prospectReference, prospectId]);
    }

    await client.query(
      `INSERT INTO buyer_prospect_touches (
        prospect_id, channel, utm_source, utm_medium, utm_campaign, fbclid,
        meta_lead_id, meta_campaign_id, meta_campaign_name, meta_adset_id, meta_adset_name,
        meta_ad_id, meta_ad_name, meta_form_id, meta_form_name, meta_submitted_at,
        consent_wording_version, raw_form_answers
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        prospectId, p.channel, p.utmSource ?? null, p.utmMedium ?? null, p.utmCampaign ?? null, p.fbclid ?? null,
        p.metaLeadId ?? null, p.metaCampaignId ?? null, p.metaCampaignName ?? null, p.metaAdsetId ?? null, p.metaAdsetName ?? null,
        p.metaAdId ?? null, p.metaAdName ?? null, p.metaFormId ?? null, p.metaFormName ?? null, p.metaSubmittedAt ?? null,
        p.consentWordingVersion ?? null, p.consentEvidence !== undefined ? JSON.stringify(p.consentEvidence) : null,
      ]
    );

    await client.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
       VALUES ($1, $2, 'buyer_prospect', $3, $4)`,
      [
        prospectReference,
        isNewProspect ? 'BUYER_PROSPECT_REGISTERED' : 'BUYER_PROSPECT_REPEAT_TOUCH',
        prospectId,
        JSON.stringify({ channel: p.channel, industry: p.industrySlug, source }),
      ]
    );

    await client.query('COMMIT');
    return { prospectId, prospectReference, isNewProspect, isDuplicateMetaLead: false };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
