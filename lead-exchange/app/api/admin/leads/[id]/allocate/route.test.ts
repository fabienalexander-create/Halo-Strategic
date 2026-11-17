import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminMock = vi.fn();
vi.mock('../../../../../../lib/requireAdmin', () => ({ requireAdmin: requireAdminMock }));

const sendLeadDeliveryEmailMock = vi.fn();
vi.mock('../../../../../../lib/leadDeliveryEmail', () => ({ sendLeadDeliveryEmail: sendLeadDeliveryEmailMock }));

const sqlMock = vi.fn();
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn(() => ({ sql: sqlMock })) }));

function req(body: unknown): NextRequest {
  return new NextRequest('https://example.com/api/admin/leads/55/allocate', { method: 'POST', body: JSON.stringify(body) });
}

const LEAD_ROW = {
  id: 55, status: 'QUALIFIED', homeowner_name: 'Nkechiyeuinm Onwuegbute', homeowner_contact: { mobile: '+447438810642', email: 'x@example.com' },
  property_type: 'Flat', postcode: 'SW2 4UR', service_requirement: 'Removal', industry_slug: 'spray_foam_removal', industry_id: 3,
};
const BUYER_ROW = { id: 99, industry_id: 3, application_status: 'ACTIVE', company_name: 'Russell Griffiths (business name pending)', contact_email: 'russellgriffiths@yahoo.com', agreed_price_per_lead: 65 };
const CONFIRMATION_ROW = { id: 5, lead_id: 55, buyer_id: 99, withdrawn_at: null };

// Mocks the full non-package sequence of db.sql calls the route makes in order: lead lookup,
// live-allocation check, buyer lookup, confirmation lookup, allocation insert, leads status
// update, audit_log insert, admin_users lookup, payments insert, payments reference update.
function mockHappyPath() {
  sqlMock
    .mockResolvedValueOnce([LEAD_ROW])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([BUYER_ROW])
    .mockResolvedValueOnce([CONFIRMATION_ROW])
    .mockResolvedValueOnce([{ id: 123 }]) // allocation insert
    .mockResolvedValueOnce([]) // leads status update
    .mockResolvedValueOnce([]) // audit_log
    .mockResolvedValueOnce([{ id: 77 }]) // payments insert
    .mockResolvedValueOnce([]) // payments reference update
    .mockResolvedValueOnce([{ email: 'admin@halostrategic.com' }]); // admin_users
}

describe('POST /api/admin/leads/[id]/allocate -- payment link passthrough', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    sqlMock.mockReset();
    sendLeadDeliveryEmailMock.mockReset();
    requireAdminMock.mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    sendLeadDeliveryEmailMock.mockResolvedValue({ sent: true, skipped: false, blocked: false });
  });

  it('stores the given payment_link on the payment row and includes it in the offer email', async () => {
    mockHappyPath();
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5, payment_link: 'https://pay.tide.co/products/russell-lead-055' }), { params: { id: '55' } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.payment_reference).toBe('HLX-PAY-000077');

    const paymentsInsertCall = sqlMock.mock.calls.find((c) => JSON.stringify(c).includes('INSERT INTO payments'));
    expect(JSON.stringify(paymentsInsertCall)).toContain('https://pay.tide.co/products/russell-lead-055');

    const offerCall = sendLeadDeliveryEmailMock.mock.calls.find((c) => c[1].emailType === 'LEAD_OFFER');
    expect(offerCall?.[1].text).toContain('https://pay.tide.co/products/russell-lead-055');
    expect(offerCall?.[1].text).not.toContain('bank transfer');
  });

  it('falls back to the bank-transfer instruction when no payment_link is given', async () => {
    mockHappyPath();
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });
    expect(res.status).toBe(200);

    const paymentsInsertCall = sqlMock.mock.calls.find((c) => JSON.stringify(c).includes('INSERT INTO payments'));
    // null, not a stray link, when none was given
    expect(JSON.stringify(paymentsInsertCall).includes('"https')).toBe(false);

    const offerCall = sendLeadDeliveryEmailMock.mock.calls.find((c) => c[1].emailType === 'LEAD_OFFER');
    expect(offerCall?.[1].text).toContain('bank transfer');
  });
});

describe('POST /api/admin/leads/[id]/allocate -- shared vs exclusive allocation', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    sqlMock.mockReset();
    sendLeadDeliveryEmailMock.mockReset();
    requireAdminMock.mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    sendLeadDeliveryEmailMock.mockResolvedValue({ sent: true, skipped: false, blocked: false });
  });

  it('rejects an unrecognised allocation_type before touching the database', async () => {
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5, allocation_type: 'NOT_A_REAL_TYPE' }), { params: { id: '55' } });

    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('rejects an EXCLUSIVE_WINDOW request when the lead already has any live allocation (e.g. to James)', async () => {
    sqlMock
      .mockResolvedValueOnce([LEAD_ROW]) // lead lookup
      .mockResolvedValueOnce([{ id: 1, buyer_id: 42 }]); // James's existing live allocation
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } }); // default EXCLUSIVE_WINDOW
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toMatch(/exclusively/);
  });

  it('allows a SHARED allocation to a second buyer even though the lead already has a live (exclusive) allocation to another buyer', async () => {
    sqlMock
      .mockResolvedValueOnce([LEAD_ROW])
      .mockResolvedValueOnce([{ id: 1, buyer_id: 42 }]) // James's existing EXCLUSIVE_WINDOW allocation
      .mockResolvedValueOnce([BUYER_ROW]) // Russell
      .mockResolvedValueOnce([CONFIRMATION_ROW])
      .mockResolvedValueOnce([{ id: 124 }]) // allocation insert (Russell, SHARED)
      .mockResolvedValueOnce([]) // leads status update
      .mockResolvedValueOnce([]) // audit_log
      .mockResolvedValueOnce([{ id: 78 }]) // payments insert
      .mockResolvedValueOnce([]) // payments reference update
      .mockResolvedValueOnce([{ email: 'admin@halostrategic.com' }]);
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5, allocation_type: 'SHARED' }), { params: { id: '55' } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.allocation_id).toBe(124);

    const insertCall = sqlMock.mock.calls.find((c) => JSON.stringify(c).includes('INSERT INTO lead_allocations'));
    expect(JSON.stringify(insertCall)).toContain('SHARED');
    // allocation_sequence is null for SHARED, not 1
    expect(JSON.stringify(insertCall)).not.toMatch(/"SHARED".*,1,/);

    const auditCall = sqlMock.mock.calls.find((c) => JSON.stringify(c).includes("'LEAD_ALLOCATED'"));
    expect(JSON.stringify(auditCall)).toContain('42'); // records James's buyer_id as an "other live buyer" for traceability
  });

  it('rejects allocating the same buyer twice for the same lead, even as SHARED', async () => {
    sqlMock
      .mockResolvedValueOnce([LEAD_ROW])
      .mockResolvedValueOnce([{ id: 1, buyer_id: 99 }]); // buyer 99 already has a live allocation
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5, allocation_type: 'SHARED' }), { params: { id: '55' } });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toMatch(/already has a live allocation/);
  });
});
