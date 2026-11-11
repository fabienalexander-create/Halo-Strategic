// Spray Foam Removal cost-estimate configuration, used by the homeowner-facing calculator at
// /spray-foam-removal/request-a-quote. Deliberately separated from the calculator's presentation
// layer (components/SprayFoamCalculator.tsx) so pricing can be filled in later without touching
// any UI code.
//
// IMPORTANT: no genuine Halo/James-specific removal pricing exists yet. James (We Fix Roofs, the
// only approved buyer for this industry so far) hasn't given Halo a cost-per-m2 or a min/max
// price by property size -- the only figures discussed with him so far are what HE pays Halo for
// leads (the £200 trial / £80-per-lead arrangement), not what a homeowner pays for removal. Until
// PRICING_TABLE below is filled in with real, specialist-confirmed figures, estimateRemovalCost
// always returns `{ available: false }`, and the calculator shows GENERIC_INDUSTRY_ESTIMATE
// instead -- a flat, published UK industry range, clearly labelled as general guidance and NOT
// computed from the homeowner's own answers via any formula (that would just be a different way
// of inventing a figure). Never used as a stand-in for a real quote from the removal specialist.

export type Bedrooms = '1-2' | '3' | '4' | '5+' | 'not_sure';

export interface PriceRange {
  low: number;
  high: number;
  currency: string;
}

// Fill this in once James (or a later buyer in this industry) has confirmed real removal
// pricing -- e.g. a cost per m2, or a genuine min/max per bedroom band. Leave a band `null` if no
// figure exists yet for it specifically: the calculator then falls back to GENERIC_INDUSTRY_ESTIMATE
// for that answer rather than guessing from a neighbouring band.
const PRICING_TABLE: Record<Bedrooms, PriceRange | null> = {
  '1-2': null,
  '3': null,
  '4': null,
  '5+': null,
  not_sure: null,
};

// A flat, published UK-wide industry range -- not specific to Halo, James, or this property,
// and not derived from any per-m2 x size calculation (that would need an assumed loft area per
// bedroom count, which is exactly the kind of invented figure this file exists to avoid).
// Sourced from independent consumer/trade cost guides (not a removal company's own marketing),
// checked 9 Nov 2026:
//   - MyJobQuote (average based on real UK tradesperson quotes): ~£40/m2
//   - Screwfix cost guide: £40-£80/m2
//   - Checkatrade cost guide: ~£40/m2, ~£175/day labour
//   - BestBuilders cost guide: most full loft removals £2,000-£6,000 total
// Update perM2 / totalJob and `asOf` together if this is ever refreshed against newer sources.
export const GENERIC_INDUSTRY_ESTIMATE = {
  perM2: { low: 40, high: 80, currency: 'GBP' } satisfies PriceRange,
  totalJob: { low: 2000, high: 6000, currency: 'GBP' } satisfies PriceRange,
  asOf: '2026-11-09',
  sources: [
    { name: 'MyJobQuote', url: 'https://www.myjobquote.co.uk/costs/spray-foam-removal' },
    { name: 'Screwfix', url: 'https://www.screwfix.com/guides/building-doors/insulation-ventilation/spray-foam-insulation-removal-cost' },
    { name: 'Checkatrade', url: 'https://www.checkatrade.com/blog/cost-guides/cost-removing-roof-foam-insulation' },
    { name: 'BestBuilders', url: 'https://www.bestbuilders.co.uk/guides/costs/spray-foam-insulation-removal-cost' },
  ],
};

export type EstimateResult =
  | { available: true; specific: true; range: PriceRange }
  | { available: true; specific: false }; // generic industry estimate -- see GENERIC_INDUSTRY_ESTIMATE

export function estimateRemovalCost(bedrooms: Bedrooms | undefined): EstimateResult {
  const range = bedrooms ? PRICING_TABLE[bedrooms] : null;
  if (range) return { available: true, specific: true, range };
  return { available: true, specific: false };
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
