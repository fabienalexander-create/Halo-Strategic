import { describe, expect, it } from 'vitest';
import { daysAfterDelivery, unusedCreditRefundAmount, REPLACEMENT_REASON_CODES } from './creditsLedger';

describe('credits ledger helpers', () => {
  it('prices unused credits at the package price per credit', () => {
    expect(unusedCreditRefundAmount(625, 5, 3)).toBe(375);
    expect(unusedCreditRefundAmount('425.00', 5, 1)).toBe(85);
    expect(unusedCreditRefundAmount(200, 3, 1)).toBe(66.67);
  });

  it('counts whole days between delivery and report', () => {
    expect(daysAfterDelivery('2026-11-20T10:00:00Z', '2026-11-25T09:00:00Z')).toBe(4);
    expect(daysAfterDelivery('2026-11-20T10:00:00Z', '2026-11-25T10:00:00Z')).toBe(5);
  });

  it('matches the reason codes the database accepts', () => {
    expect([...REPLACEMENT_REASON_CODES].sort()).toEqual([
      'APPOINTMENT_CANCELLED_BY_HOMEOWNER', 'DUPLICATE', 'HOMEOWNER_NO_SHOW', 'INACCURATE_DETAILS', 'INCORRECT_INDIVIDUAL',
      'INCORRECT_SERVICE', 'INVALID_CONTACT', 'NO_GENUINE_INTEREST', 'OTHER', 'UNREACHABLE_DOCUMENTED',
    ]);
  });
});
