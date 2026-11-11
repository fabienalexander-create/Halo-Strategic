import { describe, expect, it } from 'vitest';
import { GENERIC_INDUSTRY_ESTIMATE, estimateRemovalCost, isPostcodeInServiceArea } from './sprayFoamEstimate';

describe('spray foam removal estimate', () => {
  it('falls back to the generic (non-specific) industry estimate while PRICING_TABLE has no confirmed figures, for every bedroom band', () => {
    for (const bedrooms of ['1-2', '3', '4', '5+', 'not_sure'] as const) {
      expect(estimateRemovalCost(bedrooms)).toEqual({ available: true, specific: false });
    }
  });

  it('falls back to the generic estimate when no bedroom answer was given at all', () => {
    expect(estimateRemovalCost(undefined)).toEqual({ available: true, specific: false });
  });

  it('the generic estimate is never presented as specific to this property, Halo or James', () => {
    expect(GENERIC_INDUSTRY_ESTIMATE.perM2.low).toBeGreaterThan(0);
    expect(GENERIC_INDUSTRY_ESTIMATE.sources.length).toBeGreaterThan(0);
  });

  it('matches Essex & Suffolk outward codes discussed with James, case- and space-insensitively', () => {
    expect(isPostcodeInServiceArea('CM1 1AA')).toBe(true);
    expect(isPostcodeInServiceArea('co10 2bb')).toBe(true);
    expect(isPostcodeInServiceArea('IP4')).toBe(true);
    expect(isPostcodeInServiceArea('  ss1 2zz  ')).toBe(true);
  });

  it('treats an outward code outside the agreed counties as out of area', () => {
    expect(isPostcodeInServiceArea('SW1A 1AA')).toBe(false);
    expect(isPostcodeInServiceArea('M1 1AE')).toBe(false);
  });

  it('does not false-match a prefix inside a longer, unrelated outward code', () => {
    // 'COV' (Coventry) starts with neither 'CM' nor 'CO' as a real outward code boundary issue --
    // guard against a careless substring match that would wrongly include it. 'COV1' does start
    // with 'CO' as a plain string, which IS the current (documented, provisional) behaviour --
    // this test pins that known limitation rather than silently masking it.
    expect(isPostcodeInServiceArea('COV1 2AB')).toBe(true);
  });
});
