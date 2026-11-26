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

// ---- Central category registry --------------------------------------------------------------
// The single list of service categories, used across intake, buyer forms, admin and emails. A
// category's `status` decides what it may do:
//   live      -- accepts homeowner enquiries and buyers (still also needs industries.is_enabled)
//   prepared  -- defined and seeded in the database, but no public form, no enquiries, no buyers,
//                no allocation. Becomes live only after Fabien approves its consent wording and
//                there is a buyer for it (see docs/CATEGORY_CONSENT_DRAFTS.md).
//   future    -- placeholder for planning; disabled everywhere.
// Every slug here must exist in the `industries` table and vice versa; lib/categoryConsistency.ts
// checks that (tests, and GET /api/admin/categories against the live database).

export type IndustrySlug = 'spray_foam_removal' | 'solar_battery' | 'roofing';
export type CategorySlug = IndustrySlug | 'windows_doors' | 'insulation' | 'heat_pumps' | 'kitchens' | 'bathrooms';
export type CategoryStatus = 'live' | 'prepared' | 'future';

export interface CategoryDefinition {
  slug: CategorySlug;
  label: string;
  // Stored on leads.service_requirement for website enquiries.
  serviceRequirementLabel: string;
  status: CategoryStatus;
  // What the category covers, where the boundary with another category matters.
  scope?: string;
  // Keys of the homeowner enquiry payload that belong to this category's qualification answers.
  // For prepared categories these are proposed only and are not used until the category is live.
  qualificationFields: readonly string[];
}

export const CATEGORIES: readonly CategoryDefinition[] = [
  {
    slug: 'spray_foam_removal', label: 'Spray Foam Removal', serviceRequirementLabel: 'Spray Foam Removal', status: 'live',
    scope: 'Removal of existing spray foam insulation. New insulation installation is the separate Insulation category.',
    qualificationFields: [
      'foam_location', 'foam_type', 'reason_for_removal', 'timeframe', 'roof_access', 'previous_quotes',
      'bedrooms', 'foam_extent', 'loft_size_estimate', 'house_number_or_name',
      'calculator_in_area', 'calculator_estimate_available', 'calculator_estimate_shown',
    ],
  },
  {
    slug: 'solar_battery', label: 'Solar & Battery', serviceRequirementLabel: 'Solar & Battery Installation', status: 'live',
    qualificationFields: ['interest_type', 'roof_type', 'existing_solar', 'timeframe'],
  },
  {
    slug: 'roofing', label: 'Roofing', serviceRequirementLabel: 'Roofing', status: 'live',
    qualificationFields: ['work_type', 'roof_type', 'urgency', 'issue_description', 'timeframe'],
  },
  {
    slug: 'windows_doors', label: 'Windows & Doors', serviceRequirementLabel: 'Windows & Doors', status: 'prepared',
    qualificationFields: ['work_type', 'number_of_units', 'frame_material', 'timeframe'],
  },
  {
    slug: 'insulation', label: 'Insulation', serviceRequirementLabel: 'Insulation Installation', status: 'prepared',
    scope: 'New insulation installation only: loft, cavity wall and external wall. Spray foam removal is a separate category.',
    qualificationFields: ['insulation_type', 'property_age', 'existing_insulation', 'timeframe'],
  },
  { slug: 'heat_pumps', label: 'Heat Pumps', serviceRequirementLabel: 'Heat Pump Installation', status: 'future', qualificationFields: [] },
  { slug: 'kitchens', label: 'Kitchens', serviceRequirementLabel: 'Kitchen Installation', status: 'future', qualificationFields: [] },
  { slug: 'bathrooms', label: 'Bathrooms', serviceRequirementLabel: 'Bathroom Installation', status: 'future', qualificationFields: [] },
];

export const LIVE_CATEGORIES: readonly CategoryDefinition[] = CATEGORIES.filter((c) => c.status === 'live');

export function getCategory(slug: unknown): CategoryDefinition | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

// Display label for any stored slug; falls back to the slug itself for anything unknown.
export function categoryLabel(slug: string | null | undefined): string {
  return getCategory(slug)?.label ?? slug ?? '';
}

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

// Transparency notice shown beside the mobile number field (not a tick box). Wording approved by
// Fabien. A one-off administrative SMS to confirm the number; no marketing content.
export const SMS_VERIFICATION_NOTICE = {
  heading: 'Phone number verification',
  paragraphs: [
    'We may send you a one-time SMS to verify your mobile number and confirm that we can contact you about your enquiry. This message is solely for verification and will not contain marketing material.',
    'Your phone number and verification status will be processed by Halo Strategic and our service providers for this purpose, in accordance with our Privacy Policy.',
    'Reply YES to confirm your number. You can reply STOP to prevent further verification messages.',
  ],
} as const;

// Multi-buyer distribution is the default commercial model as of 2026-11-18 -- a homeowner's
// enquiry may now be passed to more than one business, not just one. The previous wording below
// ("a suitable business", "one as a genuine fit") read as singular and no longer matches what
// actually happens, so every industry's consent wording is updated to disclose that explicitly,
// with a new consentVersion recorded against it (existing enquiries keep whatever consent_version
// they were actually given -- see homeowner_confirmations below for how distribution to a second
// business is gated regardless of this form-level wording). lib/smsVerification.ts's
// SMS_NOTICE_VERSIONS must be kept in step with solar_battery's consentVersion -- it reuses this
// same version string as the "was the phone-verification notice shown" gate.
export const HOMEOWNER_CONSENT_CONFIG: Record<IndustrySlug, HomeownerConsentConfig> = {
  spray_foam_removal: {
    consentVersion: '2026-11-18-v0.2',
    source: 'spray_foam_removal_homeowner_form',
    shareBuyerLabel: "I'm happy for my details to be shared with one or more suitable spray foam removal businesses, so they can contact me about this enquiry, if Halo Strategic identifies them as a genuine fit.",
    namedRecipientOrCategory: 'One or more approved Spray Foam Removal buyers (installers) in the Halo Lead Exchange, only those judged a genuine fit',
  },
  solar_battery: {
    consentVersion: '2026-11-18-v0.3',
    source: 'solar_battery_homeowner_form',
    shareBuyerLabel: "I'm happy for my details to be shared with one or more suitable Solar & Battery installers, so they can contact me about this enquiry, if Halo Strategic identifies them as a genuine fit.",
    namedRecipientOrCategory: 'One or more approved Solar & Battery installers in the Halo Lead Exchange, only those judged a genuine fit',
  },
  roofing: {
    consentVersion: '2026-11-18-v0.2',
    source: 'roofing_homeowner_form',
    shareBuyerLabel: "I'm happy for my details to be shared with one or more suitable roofing contractors, so they can contact me about this enquiry, if Halo Strategic identifies them as a genuine fit.",
    namedRecipientOrCategory: 'One or more approved Roofing buyers (contractors) in the Halo Lead Exchange, only those judged a genuine fit',
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
  solar_battery: { version: '2026-11-26-v1.1', hasPublishedPolicy: true, policyUrl: '/lead-replacement-policy' },
  roofing: { version: '2026-11-26-v1.1', hasPublishedPolicy: true, policyUrl: '/lead-replacement-policy' },
};

// True only for LIVE categories. Every intake and creation path (homeowner forms, Meta intake,
// buyer applications and prospects, admin lead and buyer creation) checks this, so a prepared or
// future category can never take an enquiry or a buyer, whatever the database flag says.
export function isConfiguredIndustrySlug(slug: unknown): slug is IndustrySlug {
  return getCategory(slug)?.status === 'live';
}

// Display labels for the live categories, matching industries.name in the database.
export const INDUSTRY_LABELS = Object.fromEntries(LIVE_CATEGORIES.map((c) => [c.slug, c.label])) as Record<IndustrySlug, string>;
