// Spray Foam Removal cost-estimate configuration, used by the homeowner-facing calculator at
// /spray-foam-removal/request-a-quote. Deliberately separated from the calculator's presentation
// layer (components/SprayFoamCalculator.tsx) so pricing can be filled in later without touching
// any UI code.
//
// IMPORTANT: no genuine removal pricing exists yet. James (We Fix Roofs, the only approved buyer
// for this industry so far) hasn't given Halo a cost-per-m2 or a min/max price by property size --
// the only figures discussed with him so far are what HE pays Halo for leads (the £200 trial /
// £80-per-lead arrangement), not what a homeowner pays for removal. Until PRICING_TABLE below is
// filled in with real figures, estimateRemovalCost always returns `{ available: false }`, and the
// calculator shows the generic "we'll review it" message instead of a number -- never an
// invented price or formula.

export type Bedrooms = '1-2' | '3' | '4' | '5+' | 'not_sure';

export interface PriceRange {
  low: number;
  high: number;
  currency: string;
}

// Fill this in once James (or a later buyer in this industry) has confirmed real removal
// pricing -- e.g. a cost per m2, or a genuine min/max per bedroom band. Leave a band `null` if no
// figure exists yet for it specifically: the calculator then falls back to the generic message
// for that answer rather than guessing from a neighbouring band.
const PRICING_TABLE: Record<Bedrooms, PriceRange | null> = {
  '1-2': null,
  '3': null,
  '4': null,
  '5+': null,
  not_sure: null,
};

export type EstimateResult = { available: false } | { available: true; range: PriceRange };

export function estimateRemovalCost(bedrooms: Bedrooms | undefined): EstimateResult {
  if (!bedrooms) return { available: false };
  const range = PRICING_TABLE[bedrooms];
  if (!range) return { available: false };
  return { available: true, range };
}

// A simple outward-postcode allowlist -- NOT real geocoding or radius matching. James's agreed
// coverage (per his buyer application) is a 100-mile radius from his business postcode, but no
// geocoding is wired up anywhere in this codebase yet, so this approximates it against the two
// counties actually discussed with him (Essex & Suffolk). Treat this list as provisional: update
// it, not the matching logic, once his exact coverage is confirmed, and once a second buyer in
// this industry exists this will need to become per-buyer rather than one shared list.
const SERVICE_AREA_OUTWARD_PREFIXES = ['CM', 'CO', 'IP', 'SS'];

export function isPostcodeInServiceArea(rawPostcode: string): boolean {
  const outward = rawPostcode.trim().toUpperCase().split(/\s+/)[0] ?? '';
  return SERVICE_AREA_OUTWARD_PREFIXES.some((prefix) => outward.startsWith(prefix));
}
