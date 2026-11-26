// Picks which ACTIVE buyers a lead should actually be offered to -- used by the admin allocate
// UI so that offering a lead to more than one buyer (now the default model, not an exception) is
// still a deliberate, matched decision, not a blind broadcast to every buyer in the system
// (Fabien, 2026-11-18: "don't automatically distribute every lead to every supplier. Match by
// location, service, capacity and the homeowner's permission.").
//
// This filters candidates; it never allocates anything itself, and the database triggers in
// netlify/database/migrations/20261117100000_shared_lead_allocation.sql and
// 20261118100000_multi_buyer_distribution_model.sql remain the real backstop against an
// incompatible allocation being written, whatever this function suggests.

export interface MatchableLead {
  industry_id: number;
  postcode: string | null;
}

export interface BuyerCandidate {
  id: number;
  company_name: string;
  application_status: string;
  industry_id: number;
  agreed_price_per_lead: number | null;
  agreed_price_per_appointment?: number | null;
  exclusivity_arrangement: 'exclusive' | 'shared' | null;
  coverage_type: string | null;
  counties_covered: string[];
  postcodes_covered: string[];
  weekly_lead_capacity: number | null;
}

export interface EligibleBuyer extends BuyerCandidate {
  live_allocations_last_7_days: number;
}

// Structural type so this module -- and its tests -- don't need the real database client.
// Deliberately a local copy of the same shape used across lib/leadDeliveryEmail.ts,
// lib/sheetsSync.ts and lib/email.ts, rather than a shared import.
interface SqlDb {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<Array<Record<string, unknown>>>;
}

// The outward part of a UK postcode (e.g. "SW2" from "SW2 4UR"), which is as fine-grained as
// postcodes_covered is expected to record coverage at.
function outwardCode(postcode: string): string {
  return postcode.trim().toUpperCase().split(/\s+/)[0] ?? '';
}

// Splits an outward code (or a stored coverage entry) into its postcode AREA (the letters, e.g.
// "PE", "CM") and its DISTRICT suffix (the digits plus an optional trailing letter, e.g. "19",
// "1A"). A string with no digits at all -- a bare area code like "CM", or legacy junk data like
// "Essex" -- falls back to treating the whole cleaned string as the area with no district, which
// is exactly the right shape for a bare area code, and leaves junk data matching nothing (same as
// before this function existed).
function splitOutward(code: string): { area: string; district: string } {
  const cleaned = code.trim().toUpperCase();
  const match = cleaned.match(/^([A-Z]{1,2})(\d{1,2}[A-Z]?)$/);
  if (!match) return { area: cleaned, district: '' };
  return { area: match[1], district: match[2] };
}

// True if a buyer's stored coverage entry covers a lead's outward code. A bare postcode AREA
// (letters only, e.g. "CM", "PE") covers every district in that area. A full district (area +
// digits, e.g. "PE19", "CM1") covers ONLY that exact district.
//
// This is deliberately NOT a string-prefix check (`outward.startsWith(p)`) -- that looks
// appealing but is wrong for any UK postcode area with more than 9 districts, which is most of
// them: a buyer scoped to "PE1" (Peterborough) would also match "PE19" (St Neots) and "PE10"
// through "PE18" (Spalding, Wisbech, March...) purely because "PE19".startsWith("PE1") is true.
// Worse, "PE3" (Peterborough) would also match "PE30"-"PE38" (King's Lynn, west Norfolk) the
// same way. Comparing the area and the FULL district suffix as discrete values, rather than one
// as a string prefix of the other, is what avoids that collision.
function outwardCoveredBy(outward: string, storedEntry: string): boolean {
  const lead = splitOutward(outward);
  const stored = splitOutward(storedEntry);
  if (lead.area !== stored.area) return false;
  return stored.district === '' || stored.district === lead.district;
}

// True if the buyer's declared coverage includes this postcode. A buyer with no coverage
// recorded at all (coverage_type unset and both lists empty) is treated as covering everywhere --
// most buyer records in this early-stage marketplace don't have detailed coverage filled in yet,
// and excluding them all by default would be a worse failure mode (a lead nobody is ever shown)
// than including a buyer who turns out not to cover the area, which the admin can still see and
// override.
//
// Takes only the three coverage fields, not a full BuyerCandidate, so callers that only have
// those (e.g. the Meta ingestion endpoint's outside-service-area check) don't need to fabricate
// the rest of the shape just to call this.
export function buyerCoversPostcode(buyer: Pick<BuyerCandidate, 'coverage_type' | 'counties_covered' | 'postcodes_covered'>, postcode: string | null): boolean {
  if (buyer.coverage_type === 'national') return true;
  const hasCoverageRecorded = buyer.counties_covered.length > 0 || buyer.postcodes_covered.length > 0;
  if (!hasCoverageRecorded) return true;
  if (!postcode) return false;
  const outward = outwardCode(postcode);
  return buyer.postcodes_covered.some((p) => outwardCoveredBy(outward, p));
}

// True if taking this lead would not put the buyer over their own declared weekly capacity. A
// buyer with no capacity recorded has no limit applied -- same reasoning as coverage above.
export function buyerHasCapacity(buyer: EligibleBuyer): boolean {
  if (buyer.weekly_lead_capacity === null) return true;
  return buyer.live_allocations_last_7_days < buyer.weekly_lead_capacity;
}

// True if offering this buyer an allocation on this lead wouldn't be refused outright by the
// lead_allocations_guard trigger: a buyer contracted 'exclusive' can't be offered a SHARED slot
// once there's any other live allocation on the lead that isn't theirs, because an exclusive
// buyer is only ever written as EXCLUSIVE_WINDOW, and EXCLUSIVE_WINDOW is refused the moment any
// other live allocation exists. A buyer contracted 'shared' (or with no arrangement recorded) has
// no such restriction.
export function buyerCanJoinLead(buyer: BuyerCandidate, leadHasOtherLiveAllocation: boolean): boolean {
  return buyer.exclusivity_arrangement !== 'exclusive' || !leadHasOtherLiveAllocation;
}

// Full eligibility: ACTIVE, same industry, not already live-allocated on this lead, covers the
// postcode, has capacity left this week, and (if the lead already has a live allocation to
// someone else) isn't an exclusive-only buyer.
export async function getEligibleBuyers(
  db: SqlDb,
  lead: MatchableLead,
  excludeBuyerIds: number[]
): Promise<EligibleBuyer[]> {
  const rows = await db.sql`
    SELECT b.id, b.company_name, b.application_status, b.industry_id, b.agreed_price_per_lead,
           b.agreed_price_per_appointment, b.exclusivity_arrangement, b.coverage_type, b.counties_covered, b.postcodes_covered,
           b.weekly_lead_capacity,
           (SELECT count(*) FROM lead_allocations a
            WHERE a.buyer_id = b.id AND a.status IN ('OFFERED', 'ACCEPTED', 'PURCHASED')
              AND a.created_at > now() - interval '7 days') AS live_allocations_last_7_days
    FROM buyers b
    WHERE b.application_status = 'ACTIVE' AND b.industry_id = ${lead.industry_id}
    ORDER BY b.company_name
  `;

  const leadHasOtherLiveAllocation = excludeBuyerIds.length > 0;

  return (rows as Record<string, unknown>[])
    .map((r) => ({
      id: r.id as number,
      company_name: r.company_name as string,
      application_status: r.application_status as string,
      industry_id: r.industry_id as number,
      agreed_price_per_lead: r.agreed_price_per_lead as number | null,
      agreed_price_per_appointment: (r.agreed_price_per_appointment as number | null | undefined) ?? null,
      exclusivity_arrangement: r.exclusivity_arrangement as 'exclusive' | 'shared' | null,
      coverage_type: r.coverage_type as string | null,
      counties_covered: (r.counties_covered as string[] | null) ?? [],
      postcodes_covered: (r.postcodes_covered as string[] | null) ?? [],
      weekly_lead_capacity: r.weekly_lead_capacity as number | null,
      live_allocations_last_7_days: Number(r.live_allocations_last_7_days),
    }))
    .filter((b) => !excludeBuyerIds.includes(b.id))
    .filter((b) => buyerCoversPostcode(b, lead.postcode))
    .filter((b) => buyerHasCapacity(b))
    .filter((b) => buyerCanJoinLead(b, leadHasOtherLiveAllocation));
}
