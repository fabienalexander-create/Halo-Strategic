import { describe, expect, it } from 'vitest';
import { leadOfferEmail } from './emailTemplates';

const BASE_PARAMS = {
  leadReference: 'HLX-LEAD-000055',
  industryLabel: 'Spray Foam Removal',
  postcode: 'SW2 4UR',
  propertyType: 'Detached',
  serviceRequirement: 'Closed-cell removal',
  currency: 'GBP',
  price: 65,
  packageCovered: false,
  paymentReference: 'HLX-PAY-000012',
};

describe('leadOfferEmail', () => {
  it('falls back to bank-transfer-and-reference when no payment link is given', () => {
    const content = leadOfferEmail({ ...BASE_PARAMS, paymentLink: null });

    expect(content.text).toContain('pay by bank transfer and quote reference HLX-PAY-000012');
    expect(content.html).toContain('quote reference <strong>HLX-PAY-000012</strong>');
    expect(content.text).not.toContain('http');
  });

  it('renders a clickable payment link when one is given, instead of the bank-transfer instruction', () => {
    const link = 'https://pay.tide.co/products/russell-lead-000055';
    const content = leadOfferEmail({ ...BASE_PARAMS, paymentLink: link });

    expect(content.text).toContain(link);
    expect(content.text).not.toContain('bank transfer');
    expect(content.html).toContain(`href="${link}"`);
    expect(content.html).not.toContain('bank transfer');
  });

  it('a package-covered lead mentions neither a link nor a reference', () => {
    const content = leadOfferEmail({ ...BASE_PARAMS, packageCovered: true, price: null, paymentReference: null, paymentLink: 'https://should-be-ignored.example' });

    expect(content.text).toContain('covered by your package');
    expect(content.text).not.toContain('should-be-ignored');
  });

  it('includes qualification highlights when given, never homeowner contact detail', () => {
    const content = leadOfferEmail({
      ...BASE_PARAMS, paymentLink: null,
      qualificationHighlights: [{ label: 'Timeframe', value: 'Within 3 months' }, { label: 'Preferred contact method', value: 'Phone' }],
    });

    expect(content.text).toContain('Timeframe: Within 3 months');
    expect(content.text).toContain('Preferred contact method: Phone');
    expect(content.html).toContain('Timeframe: Within 3 months');
  });

  it('omits the highlights block entirely when none are given', () => {
    const content = leadOfferEmail({ ...BASE_PARAMS, paymentLink: null });

    expect(content.text).not.toContain('Timeframe');
    expect(content.html).not.toMatch(/<br>\s*<\/p>/);
  });
});
