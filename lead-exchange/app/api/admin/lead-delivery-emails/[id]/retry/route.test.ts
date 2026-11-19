import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminMock = vi.fn();
vi.mock('../../../../../../lib/requireAdmin', () => ({ requireAdmin: requireAdminMock }));
const attemptSendMock = vi.fn();
vi.mock('../../../../../../lib/leadDeliveryEmail', () => ({ attemptSendLeadDeliveryEmail: attemptSendMock }));
const sqlMock = vi.fn();
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn(() => ({ sql: sqlMock })) }));

const OFFER_ROW = {
  email_id: 12, email_type: 'LEAD_OFFER', recipient: 'buyer@example.test', email_status: 'FAILED', allocation_id: 3,
  agreed_price: '65', package_id: null, lead_id: 55, homeowner_name: 'Test Homeowner',
  homeowner_contact: { mobile: '+447700900123' }, postcode: 'MK15 9AA', property_type: 'House', service_requirement: 'Removal',
  industry_slug: 'spray_foam_removal', company_name: 'Shared Buyer', payment_reference: 'HLX-PAY-000009',
  payment_link: 'https://pay.tide.co/example-65',
};

function req(): NextRequest {
  return new NextRequest('https://example.com/api/admin/lead-delivery-emails/12/retry', { method: 'POST' });
}

describe('POST /api/admin/lead-delivery-emails/[id]/retry', () => {
  beforeEach(() => {
    requireAdminMock.mockReset().mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    attemptSendMock.mockReset().mockResolvedValue({ sent: true, skipped: false });
    sqlMock.mockReset();
  });

  it('a retried offer keeps the Tide link and the payment reference, with the price formatted', async () => {
    sqlMock.mockResolvedValueOnce([OFFER_ROW]);
    const { POST } = await import('./route');

    const res = await POST(req(), { params: { id: '12' } });

    expect(res.status).toBe(200);
    const content = attemptSendMock.mock.calls[0][2];
    expect(content.text).toContain('https://pay.tide.co/example-65');
    expect(content.text).toContain('Please quote payment reference HLX-PAY-000009');
    expect(content.text).toContain('GBP 65.00');
    expect(content.text).not.toContain('bank transfer');
    expect(content.text).not.toContain('Test Homeowner'); // no homeowner details before payment
    expect(content.text).not.toContain('+447700900123');
  });

  it('a retried offer without a link still gives the bank-transfer reference', async () => {
    sqlMock.mockResolvedValueOnce([{ ...OFFER_ROW, payment_link: null }]);
    const { POST } = await import('./route');

    await POST(req(), { params: { id: '12' } });

    expect(attemptSendMock.mock.calls[0][2].text).toContain('quote reference HLX-PAY-000009');
  });

  it('refuses a superseded or bounced email', async () => {
    const { POST } = await import('./route');
    for (const status of ['SUPERSEDED', 'BOUNCED']) {
      sqlMock.mockResolvedValueOnce([{ ...OFFER_ROW, email_status: status }]);
      expect((await POST(req(), { params: { id: '12' } })).status).toBe(409);
    }
    expect(attemptSendMock).not.toHaveBeenCalled();
  });
});
