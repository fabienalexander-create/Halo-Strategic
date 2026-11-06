// Shared industry configuration for the two API routes that need to behave differently per
// industry: homeowner-enquiries (consent wording/version, which qualification fields are
// expected) and buyer-applications (what version of the Replacement Policy, if any, a buyer in
// this industry is actually acknowledging). This is the one place both routes read from, so
// adding a fourth industry later means adding one entry here, not touching route logic.
//
// Only industries actually ready to take live homeowner/buyer traffic belong in this map. The
// `industries` database table can hold a row (e.g. 'roofing') before it's ready -- that row's
// is_enabled flag, checked against the database at request time, is the real gate. This map is
// the second, independent gate: an industry must be BOTH enabled in the database AND configured
// here before either route will accept a submission for it.

export type IndustrySlug = 'spray_foam_removal' | 'solar_battery' | 'roofing';

export interface HomeownerConsentConfig {
  consentVersion: string;
  source: string;
  shareBuyerLabel: string; // the consent_share_buyer checkbox label, industry-specific
  namedRecipientOrCategory: string;
}

export interface BuyerReplacementPolicyConfig {
  // The exact version string recorded against acknowledged_replacement_policy_version. A value
  // other than a real version string (see 'NOT_YET_PUBLISHED' below) must never be presented to
  // the applicant as if it were an approved policy.
  version: string;
  // When false, the applicant is shown honest "terms agreed individually, no published policy
  // yet" wording instead of a reference to a published policy page.
  hasPublishedPolicy: boolean;
  // Which published policy page this industry's acknowledgement refers to. Only meaningful when
  // hasPublishedPolicy is true -- Spray Foam Removal and Solar & Battery/Roofing deliberately
  // point at two different pages, since they are two different approved policies, not one shared
  // document silently reused across industries.
  policyUrl?: string;
}

export const HOMEOWNER_CONSENT_CONFIG: Record<IndustrySlug, HomeownerConsentConfig> = {
  spray_foam_removal: {
    consentVersion: '2026-11-04-v0.1',
    source: 'spray_foam_removal_homeowner_form',
    shareBuyerLabel: "I'm happy for my details to be shared with a suitable spray foam removal business, so they can contact me about this enquiry, if Halo Strategic identifies one as a genuine fit.",
    namedRecipientOrCategory: 'An approved Spray Foam Removal buyer (installer) in the Halo Lead Exchange, only if judged a genuine fit',
  },
  solar_battery: {
    consentVersion: '2026-11-06-v0.1',
    source: 'solar_battery_homeowner_form',
    shareBuyerLabel: "I'm happy for my details to be shared with a suitable Solar & Battery installer, so they can contact me about this enquiry, if Halo Strategic identifies one as a genuine fit.",
    namedRecipientOrCategory: 'An approved Solar & Battery installer in the Halo Lead Exchange, only if judged a genuine fit',
  },
  roofing: {
    consentVersion: '2026-11-07-v0.1',
    source: 'roofing_homeowner_form',
    shareBuyerLabel: "I'm happy for my details to be shared with a suitable roofing contractor, so they can contact me about this enquiry, if Halo Strategic identifies one as a genuine fit.",
    namedRecipientOrCategory: 'An approved Roofing buyer (contractor) in the Halo Lead Exchange, only if judged a genuine fit',
  },
};

// Per Fabien's explicit instruction: do not reuse the Spray Foam Removal Refund & Replacement
// Policy's version string for any other industry. That policy's own §4 scopes it to Spray Foam
// Removal only. Until an industry's own policy is drafted and approved, a buyer application in
// that industry records this literal marker instead of a real version.
export const NOT_YET_PUBLISHED_REPLACEMENT_POLICY = 'NOT_YET_PUBLISHED';

// Solar & Battery and Roofing moved onto the standard Lead Replacement Policy (solicitor-approved,
// effective 1 January 2027) -- a separate, dedicated page from Spray Foam Removal's own Refund &
// Replacement Policy, not a reuse of its version string or content. Spray Foam Removal keeps its
// existing, separately approved policy unchanged: adopting the standard policy for Spray Foam too
// is a deliberate future decision, not something this change makes silently.
export const BUYER_REPLACEMENT_POLICY_CONFIG: Record<IndustrySlug, BuyerReplacementPolicyConfig> = {
  spray_foam_removal: { version: '2026-11-04-v0.1', hasPublishedPolicy: true, policyUrl: '/refund-policy' },
  solar_battery: { version: '2027-01-01-v1.0', hasPublishedPolicy: true, policyUrl: '/lead-replacement-policy' },
  roofing: { version: '2027-01-01-v1.0', hasPublishedPolicy: true, policyUrl: '/lead-replacement-policy' },
};

export function isConfiguredIndustrySlug(slug: unknown): slug is IndustrySlug {
  return slug === 'spray_foam_removal' || slug === 'solar_battery' || slug === 'roofing';
}
