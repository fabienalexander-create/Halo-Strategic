import { describe, expect, it } from 'vitest';
import { leadOfferEmail, leadUnlockedEmail } from './emailTemplates';

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
});

describe('branded lead email layout', () => {
  it('offer email is a full branded HTML document with a pay button and no homeowner contact detail', () => {
    const link = 'https://pay.tide.co/products/russell-lead-000055';
    const content = leadOfferEmail({ ...BASE_PARAMS, paymentLink: link });

    expect(content.html).toMatch(/^<!doctype html>/);
    expect(content.html).toContain('Halo Lead Exchange');
    expect(content.html).toContain('Pay &amp; unlock this lead');
    expect(content.html).toContain('<strong>HLX-PAY-000012</strong>');
    expect(content.html).toContain('<strong>GBP 65.00</strong>');
    // Area is the outward postcode only; the full postcode is homeowner contact detail.
    expect(content.html).toContain('SW2');
    expect(content.html).not.toContain('SW2 4UR');
  });

  it('package-covered offer shows no pay button and no reference', () => {
    const content = leadOfferEmail({ ...BASE_PARAMS, packageCovered: true, price: null, paymentReference: null, paymentLink: 'https://should-be-ignored.example' });

    expect(content.html).toContain('Covered by your package');
    expect(content.html).not.toContain('Pay &amp; unlock');
    expect(content.html).not.toContain('should-be-ignored');
  });

  it('escapes lead fields in the HTML', () => {
    const content = leadOfferEmail({ ...BASE_PARAMS, serviceRequirement: '<script>alert(1)</script>', paymentLink: null });

    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&lt;script&gt;');
  });

  it('unlocked email links phone and email and points to the replacement policy', () => {
    const content = leadUnlockedEmail({
      leadReference: 'HLX-LEAD-000055', industryLabel: 'Roofing', homeownerName: 'Jane Smith', phone: '07700 900123',
      email: 'jane@example.com', postcode: 'IP4 1AA', propertyType: 'Semi-detached', serviceRequirement: 'Full replacement',
    });

    expect(content.html).toMatch(/^<!doctype html>/);
    expect(content.html).toContain('href="tel:07700900123"');
    expect(content.html).toContain('href="mailto:jane@example.com"');
    expect(content.html).toContain('https://halostrategic.com/leads-exchange/lead-replacement-policy');
    expect(content.text).toContain('Phone: 07700 900123');
  });
});
