import { describe, expect, it } from 'vitest';
import { buildQualificationSummary } from './leadQualificationSummary';

describe('buildQualificationSummary', () => {
  it('returns nothing for null/undefined/empty answers', () => {
    expect(buildQualificationSummary(null)).toEqual([]);
    expect(buildQualificationSummary(undefined)).toEqual([]);
    expect(buildQualificationSummary({})).toEqual([]);
  });

  it('reads Meta-sourced field names', () => {
    const lines = buildQualificationSummary({
      foam_location: 'Loft only', reason_for_enquiry: 'Selling the property', timeframe: 'Within 3 months',
      preferred_contact_method: 'Phone',
    });
    expect(lines).toEqual([
      { label: 'Foam location', value: 'Loft only' },
      { label: 'Reason for enquiry', value: 'Selling the property' },
      { label: 'Timeframe', value: 'Within 3 months' },
      { label: 'Preferred contact method', value: 'Phone' },
    ]);
  });

  it('reads website-sourced field names (different key, same question)', () => {
    const lines = buildQualificationSummary({ reason_for_removal: 'Mortgage or remortgage concerns', foam_extent: 'Throughout the whole loft' });
    expect(lines).toEqual([
      { label: 'Foam type', value: 'Throughout the whole loft' },
      { label: 'Reason for enquiry', value: 'Mortgage or remortgage concerns' },
    ]);
  });

  it('skips blank or whitespace-only answers', () => {
    expect(buildQualificationSummary({ foam_location: '   ', timeframe: 'ASAP' })).toEqual([{ label: 'Timeframe', value: 'ASAP' }]);
  });

  it('never includes consent flags, campaign metadata or the manual-review classification', () => {
    const lines = buildQualificationSummary({
      consent_contact: true, consent_share_buyer: true, campaign_id: 'c:1', needs_manual_review: true,
      review_reasons: ['renter'], lead_intent: 'active', timeframe: 'ASAP',
    });
    expect(lines).toEqual([{ label: 'Timeframe', value: 'ASAP' }]);
  });

  it('prefers the first matching key when both naming conventions are present', () => {
    const lines = buildQualificationSummary({ reason_for_enquiry: 'Meta answer', reason_for_removal: 'Website answer' });
    expect(lines).toEqual([{ label: 'Reason for enquiry', value: 'Meta answer' }]);
  });
});
