// Shared attribution constants used across the website registration flow (landing page, register
// interest form, nurture email, apply page) and the Meta Instant Form ingestion endpoint.
//
// Never trusted as more precise than it is: these are whatever a client or Make scenario claims,
// not independently verified against Meta's own systems. Good enough for campaign-level reporting,
// not for anything security-sensitive -- nothing here grants access or bypasses approval.

export const ATTRIBUTION_PARAM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid'] as const;
export type AttributionParamKey = (typeof ATTRIBUTION_PARAM_KEYS)[number];
export type AttributionParams = Partial<Record<AttributionParamKey, string>>;

export type CaptureChannel = 'website' | 'meta_instant_form';

// Extracts only the recognised attribution keys from an arbitrary search-params-like object,
// dropping anything else and any empty string.
export function pickAttributionParams(source: URLSearchParams | Record<string, string | string[] | undefined>): AttributionParams {
  const get = (key: string): string | undefined => {
    if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
    const v = source[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const result: AttributionParams = {};
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const v = get(key);
    if (v) result[key] = v;
  }
  return result;
}

// Builds a query string (no leading '?') from whichever attribution params are present, for
// forwarding onto a link or appending to an email URL. Returns '' if there's nothing to carry.
export function buildAttributionQuery(params: AttributionParams, extra?: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const v = params[key];
    if (v) search.set(key, v);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) search.set(k, v);
    }
  }
  const s = search.toString();
  return s;
}

// The advisory-lock key shared between lib/buyerProspectCapture.ts and
// app/api/buyer-applications/route.ts -- both must derive the identical string from the
// identical (industrySlug, normalisedEmail) pair, or the two code paths won't actually serialise
// against each other and the whole point of the lock is lost. hashtextextended() (called by
// whoever uses this key) is Postgres's own hash, not reproduced here -- this function only
// builds the string that gets hashed, so there's exactly one place that composition can drift.
export function advisoryLockKey(industrySlug: string, normalisedEmail: string): string {
  return `buyer_prospect:${industrySlug}:${normalisedEmail}`;
}

// Best-effort channel/source label from UTM + fbclid + referrer. Never presented as more precise
// than it is -- see migration comments for the same caveat applied to the database columns.
export function deriveSource(params: { utmSource?: string; fbclid?: string; referrer?: string }): string {
  const utm = params.utmSource?.toLowerCase() ?? '';
  if (utm.includes('facebook') || utm.includes('meta') || utm.includes('instagram') || params.fbclid) return 'meta';
  if (utm.includes('instantly')) return 'instantly';
  if (params.referrer && !params.referrer.includes('halostrategic.com')) return 'direct_referral';
  return 'organic_website';
}
