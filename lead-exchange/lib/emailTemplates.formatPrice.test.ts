import { describe, expect, it } from 'vitest';
import { formatPrice, leadOfferEmail } from './emailTemplates';

// Postgres NUMERIC arrives as a string from the driver (found 2026-11-19).
describe('formatPrice', () => {
  it('formats numbers and numeric strings the same way', () => {
    expect(formatPrice(65)).toBe('65.00');
    expect(formatPrice('65.00')).toBe('65.00');
    expect(formatPrice('80')).toBe('80.00');
  });
  it('returns empty for missing or non-numeric values rather than throwing', () => {
    expect(formatPrice(null)).toBe('');
    expect(formatPrice(undefined)).toBe('');
    expect(formatPrice('abc')).toBe('');
  });
  it('lets the offer email render a price straight from the database', () => {
    const email = leadOfferEmail({
      leadReference: 'HLX-LEAD-000055', industryLabel: 'Spray Foam Removal', postcode: 'MK15 9AA', propertyType: 'House',
      serviceRequirement: 'Removal', currency: 'GBP', price: '65.00', packageCovered: false, paymentReference: 'HLX-PAY-000077',
    } as Parameters<typeof leadOfferEmail>[0]);
    expect(email.text).toContain('GBP 65.00');
  });
});
