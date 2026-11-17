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

// True if the buyer's declared coverage includes this postcode. A buyer with no coverage
// recorded at all (coverage_type unset and both lists empty) is treated as covering everywhere --
// most buyer records in this early-stage marketplace don't have detailed coverage filled in yet,
// and excluding them all by default would be a worse failure mode (a lead nobody is ever shown)
// than including a buyer who turns out not to cover the area, which the admin can still see and
// override.
export function buyerCoversPostcode(buyer: BuyerCandidate, postcode: string | null): boolean {
  if (buyer.coverage_type === 'national') return true;
  const hasCoverageRecorded = buyer.counties_covered.length > 0 || buyer.postcodes_covered.length > 0;
  if (!hasCoverageRecorded) return true;
  if (!postcode) return false;
  const outward = outwardCode(postcode);
  return buyer.postcodes_covered.some((p) => outward.startsWith(p.trim().toUpperCase()) || p.trim().toUpperCase().startsWith(outward));
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
           b.exclusivity_arrangement, b.coverage_type, b.counties_covered, b.postcodes_covered,
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
