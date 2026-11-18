import { describe, expect, it, vi } from 'vitest';
import { buyerCanJoinLead, buyerCoversPostcode, buyerHasCapacity, getEligibleBuyers, type BuyerCandidate, type EligibleBuyer } from './buyerMatching';

function candidate(overrides: Partial<BuyerCandidate> = {}): BuyerCandidate {
  return {
    id: 1, company_name: 'Test Buyer', application_status: 'ACTIVE', industry_id: 3,
    agreed_price_per_lead: 65, exclusivity_arrangement: null, coverage_type: null,
    counties_covered: [], postcodes_covered: [], weekly_lead_capacity: null,
    ...overrides,
  };
}

describe('buyerCoversPostcode', () => {
  it('covers everywhere when coverage_type is national', () => {
    expect(buyerCoversPostcode(candidate({ coverage_type: 'national' }), 'SW2 4UR')).toBe(true);
  });

  it('covers everywhere when no coverage is recorded at all (data gap, not exclusion)', () => {
    expect(buyerCoversPostcode(candidate(), 'SW2 4UR')).toBe(true);
  });

  it('matches a recorded postcode prefix (outward code)', () => {
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['SW2'] }), 'SW2 4UR')).toBe(true);
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['SW'] }), 'SW2 4UR')).toBe(true);
  });

  it('excludes a postcode outside the recorded coverage', () => {
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['OX19'] }), 'SW2 4UR')).toBe(false);
  });

  it('excludes when coverage is recorded but the lead has no postcode', () => {
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['OX19'] }), null)).toBe(false);
  });

  // A UK postcode area with more than 9 districts has districts like "PE1" and "PE19" that
  // share a leading digit but are unrelated places (Peterborough vs St Neots). A naive
  // string-prefix comparison ("PE19".startsWith("PE1")) would wrongly treat a buyer scoped to
  // "PE1" as covering "PE19" too -- and, worse, a buyer scoped to "PE3" (Peterborough) as
  // covering "PE30"-"PE38" (King's Lynn, 60+ miles away in a different county). These guard
  // against that regressing.
  it('does not let a single-digit district match an unrelated double-digit district in the same area', () => {
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['PE1'] }), 'PE19 1AB')).toBe(false);
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['PE1'] }), 'PE10 1AB')).toBe(false);
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['PE3'] }), 'PE30 1AB')).toBe(false);
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['HP1'] }), 'HP19 1AB')).toBe(false);
  });

  it('still matches the exact district it was scoped to', () => {
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['PE1'] }), 'PE1 1AB')).toBe(true);
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['PE19'] }), 'PE19 1AB')).toBe(true);
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['PE19'] }), 'PE1 1AB')).toBe(false);
  });

  it('a bare area code still covers every district in that area, single- or double-digit', () => {
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['PE'] }), 'PE1 1AB')).toBe(true);
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['PE'] }), 'PE19 1AB')).toBe(true);
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['PE'] }), 'PE38 1AB')).toBe(true);
  });

  it('does not match a different area that merely shares a letter prefix', () => {
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['E'] }), 'EN1 1AB')).toBe(false);
    expect(buyerCoversPostcode(candidate({ postcodes_covered: ['N'] }), 'NN1 1AB')).toBe(false);
  });
});

describe('buyerHasCapacity', () => {
  function eligible(overrides: Partial<EligibleBuyer> = {}): EligibleBuyer {
    return { ...candidate(), live_allocations_last_7_days: 0, ...overrides };
  }

  it('has no limit when weekly_lead_capacity is unset', () => {
    expect(buyerHasCapacity(eligible({ weekly_lead_capacity: null, live_allocations_last_7_days: 50 }))).toBe(true);
  });

  it('has capacity left when under the weekly limit', () => {
    expect(buyerHasCapacity(eligible({ weekly_lead_capacity: 5, live_allocations_last_7_days: 4 }))).toBe(true);
  });

  it('is at capacity once the weekly limit is reached', () => {
    expect(buyerHasCapacity(eligible({ weekly_lead_capacity: 5, live_allocations_last_7_days: 5 }))).toBe(false);
  });
});

describe('buyerCanJoinLead', () => {
  it('an exclusive-only buyer cannot join a lead that already has another live allocation', () => {
    expect(buyerCanJoinLead(candidate({ exclusivity_arrangement: 'exclusive' }), true)).toBe(false);
  });

  it('an exclusive-only buyer can still be offered a lead with no other live allocation', () => {
    expect(buyerCanJoinLead(candidate({ exclusivity_arrangement: 'exclusive' }), false)).toBe(true);
  });

  it('a shared-contracted buyer, or one with no arrangement recorded, can always join', () => {
    expect(buyerCanJoinLead(candidate({ exclusivity_arrangement: 'shared' }), true)).toBe(true);
    expect(buyerCanJoinLead(candidate({ exclusivity_arrangement: null }), true)).toBe(true);
  });
});

describe('getEligibleBuyers', () => {
  function buyerRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 1, company_name: 'Test Buyer', application_status: 'ACTIVE', industry_id: 3,
      agreed_price_per_lead: 65, exclusivity_arrangement: null, coverage_type: 'national',
      counties_covered: [], postcodes_covered: [], weekly_lead_capacity: null,
      live_allocations_last_7_days: '0', // Postgres count(*) comes back as a string
      ...overrides,
    };
  }

  it('excludes a buyer who already has a live allocation on this lead', async () => {
    const sql = vi.fn().mockResolvedValue([buyerRow({ id: 1 }), buyerRow({ id: 2 })]);
    const result = await getEligibleBuyers({ sql }, { industry_id: 3, postcode: 'SW2 4UR' }, [1]);
    expect(result.map((b) => b.id)).toEqual([2]);
  });

  it('excludes a buyer whose coverage does not include the lead postcode', async () => {
    const sql = vi.fn().mockResolvedValue([buyerRow({ id: 1, coverage_type: null, postcodes_covered: ['OX19'] })]);
    const result = await getEligibleBuyers({ sql }, { industry_id: 3, postcode: 'SW2 4UR' }, []);
    expect(result).toEqual([]);
  });

  it('excludes a buyer who is at their weekly capacity', async () => {
    const sql = vi.fn().mockResolvedValue([buyerRow({ id: 1, weekly_lead_capacity: 2, live_allocations_last_7_days: '2' })]);
    const result = await getEligibleBuyers({ sql }, { industry_id: 3, postcode: 'SW2 4UR' }, []);
    expect(result).toEqual([]);
  });

  it('excludes an exclusive-only buyer once the lead already has another live allocation', async () => {
    const sql = vi.fn().mockResolvedValue([buyerRow({ id: 2, exclusivity_arrangement: 'exclusive' })]);
    const result = await getEligibleBuyers({ sql }, { industry_id: 3, postcode: 'SW2 4UR' }, [1]);
    expect(result).toEqual([]);
  });

  it('includes a matching, capacity-available, correctly-arranged buyer', async () => {
    const sql = vi.fn().mockResolvedValue([buyerRow({ id: 3, weekly_lead_capacity: 10, live_allocations_last_7_days: '1' })]);
    const result = await getEligibleBuyers({ sql }, { industry_id: 3, postcode: 'SW2 4UR' }, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
    expect(result[0].live_allocations_last_7_days).toBe(1);
  });
});
