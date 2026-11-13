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
  consentWordingVersion?: string | null;
  rawFormAnswers?: unknown;
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

/**
 * The single write path for a qualifying buyer-prospect submission, used by both the website
 * register-interest route and the Meta Instant Form ingestion route, so the two channels can
 * never apply different dedup/first-touch/last-touch rules.
 *
 * - A Meta lead_id already seen before (retried webhook, re-run Make scenario) is a true no-op:
 *   no new prospect, no new touch row, same reference returned.
 * - Otherwise, one ACTIVE (unconverted) prospect per (contact_email, industry) is enforced at the
 *   database level (uq_buyer_prospects_active_email_industry). The first qualifying submission
 *   creates the row and becomes BOTH first-touch and last-touch. A later qualifying submission
 *   for the same email+industry, from either channel, updates ONLY last-touch fields -- it never
 *   rewrites first-touch, and never touches the profile fields (company/contact/phone) captured
 *   on the original submission, so a sloppier repeat submission can't clobber good data.
 * - Every call that isn't a deduped Meta retry writes exactly one row to buyer_prospect_touches,
 *   first or repeat, so the full per-touch history (and every Meta lead_id ever received) is
 *   always recoverable regardless of what the summary row currently shows.
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
    const tempReference = `PENDING-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const unsubscribeToken = generateUnsubscribeToken();

    const upsert = await client.query(
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
        $1, $2, $3, $4, $5, $6,
        $7, $8,
        $9, $10, $11, $12, $13,
        $14, $14, $10, $11,
        $12, $13, now(),
        $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24,
        $25, $26,
        $27, $28, $29
      )
      ON CONFLICT (contact_email, industry_id) WHERE converted_buyer_id IS NULL
      DO UPDATE SET
        source = EXCLUDED.source,
        last_touch_channel = EXCLUDED.capture_channel,
        last_touch_utm_source = EXCLUDED.utm_source,
        last_touch_utm_medium = EXCLUDED.utm_medium,
        last_touch_utm_campaign = EXCLUDED.utm_campaign,
        last_touch_fbclid = EXCLUDED.fbclid,
        last_touch_at = now(),
        meta_lead_id = EXCLUDED.meta_lead_id,
        meta_campaign_id = EXCLUDED.meta_campaign_id,
        meta_campaign_name = EXCLUDED.meta_campaign_name,
        meta_adset_id = EXCLUDED.meta_adset_id,
        meta_adset_name = EXCLUDED.meta_adset_name,
        meta_ad_id = EXCLUDED.meta_ad_id,
        meta_ad_name = EXCLUDED.meta_ad_name,
        meta_form_id = EXCLUDED.meta_form_id,
        meta_form_name = EXCLUDED.meta_form_name,
        meta_submitted_at = EXCLUDED.meta_submitted_at
      RETURNING id, prospect_reference, (xmax = 0) AS inserted`,
      [
        tempReference, p.industryId, p.companyName, p.contactName, p.contactEmail, p.telephone,
        p.postcodesCovered ?? null, p.approxMonthlyLeadRequirement ?? null,
        source, p.utmSource ?? null, p.utmMedium ?? null, p.utmCampaign ?? null, p.fbclid ?? null,
        p.channel,
        p.metaLeadId ?? null, p.metaCampaignId ?? null, p.metaCampaignName ?? null, p.metaAdsetId ?? null, p.metaAdsetName ?? null,
        p.metaAdId ?? null, p.metaAdName ?? null, p.metaFormId ?? null, p.metaFormName ?? null, p.metaSubmittedAt ?? null,
        p.consentWordingVersion ?? null, p.rawFormAnswers !== undefined ? JSON.stringify(p.rawFormAnswers) : null,
        p.consentContact, p.marketingConsent ?? false, unsubscribeToken,
      ]
    );

    const prospectId = upsert.rows[0].id as number;
    const isNewProspect = upsert.rows[0].inserted as boolean;
    let prospectReference = upsert.rows[0].prospect_reference as string;

    if (isNewProspect) {
      prospectReference = `HLX-PROSPECT-${String(prospectId).padStart(6, '0')}`;
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
        p.consentWordingVersion ?? null, p.rawFormAnswers !== undefined ? JSON.stringify(p.rawFormAnswers) : null,
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
