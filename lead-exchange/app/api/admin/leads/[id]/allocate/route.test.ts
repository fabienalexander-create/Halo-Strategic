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
      .mockResolvedValueOnce([{ id: 1, buyer_id: 42 }]) // James's existing live allocation
      .mockResolvedValueOnce([{ ...BUYER_ROW, exclusivity_arrangement: 'exclusive' }]); // Russell, contracted exclusive
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5, allocation_type: 'EXCLUSIVE_WINDOW' }), { params: { id: '55' } });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toMatch(/exclusively/);
  });

  it('defaults to SHARED when the buyer has no recorded exclusivity arrangement -- the new baseline', async () => {
    sqlMock
      .mockResolvedValueOnce([LEAD_ROW])
      .mockResolvedValueOnce([]) // no existing live allocations
      .mockResolvedValueOnce([{ ...BUYER_ROW, exclusivity_arrangement: null }])
      .mockResolvedValueOnce([CONFIRMATION_ROW])
      .mockResolvedValueOnce([{ id: 125 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 79 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: 'admin@halostrategic.com' }]);
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } }); // no allocation_type given
    expect(res.status).toBe(200);

    const insertCall = sqlMock.mock.calls.find((c) => JSON.stringify(c).includes('INSERT INTO lead_allocations'));
    expect(JSON.stringify(insertCall)).toContain('SHARED');
  });

  it('defaults to EXCLUSIVE_WINDOW when the buyer is contracted exclusive, and refuses it if the lead already has a live allocation', async () => {
    sqlMock
      .mockResolvedValueOnce([LEAD_ROW])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...BUYER_ROW, exclusivity_arrangement: 'exclusive' }])
      .mockResolvedValueOnce([CONFIRMATION_ROW])
      .mockResolvedValueOnce([{ id: 126 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 80 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: 'admin@halostrategic.com' }]);
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } }); // no allocation_type given
    expect(res.status).toBe(200);

    const insertCall = sqlMock.mock.calls.find((c) => JSON.stringify(c).includes('INSERT INTO lead_allocations'));
    expect(JSON.stringify(insertCall)).toContain('EXCLUSIVE_WINDOW');
  });

  it('refuses an explicit SHARED request for a buyer contracted exclusive', async () => {
    sqlMock
      .mockResolvedValueOnce([LEAD_ROW])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...BUYER_ROW, exclusivity_arrangement: 'exclusive' }]);
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5, allocation_type: 'SHARED' }), { params: { id: '55' } });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toMatch(/exclusive leads only/);
  });

  it('refuses an explicit EXCLUSIVE_WINDOW request for a buyer contracted shared', async () => {
    sqlMock
      .mockResolvedValueOnce([LEAD_ROW])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...BUYER_ROW, exclusivity_arrangement: 'shared' }]);
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5, allocation_type: 'EXCLUSIVE_WINDOW' }), { params: { id: '55' } });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toMatch(/shared leads only/);
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

describe('POST /api/admin/leads/[id]/allocate -- manual-review safeguard', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    sqlMock.mockReset();
    sendLeadDeliveryEmailMock.mockReset();
    requireAdminMock.mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    sendLeadDeliveryEmailMock.mockResolvedValue({ sent: true, skipped: false, blocked: false });
  });

  const FLAGGED_LEAD_ROW = {
    ...LEAD_ROW,
    qualification_answers: { needs_manual_review: true, review_reasons: ['renter', 'outside_service_area'] },
  };

  it('refuses to allocate a flagged lead without an explicit acknowledgement', async () => {
    sqlMock.mockResolvedValueOnce([FLAGGED_LEAD_ROW]);
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toMatch(/manual review/);
    expect(data.review_reasons).toEqual(['renter', 'outside_service_area']);
    // Never silently bypassed -- nothing past the lead lookup is even attempted.
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it('refuses an acknowledgement of false the same as no acknowledgement at all', async () => {
    sqlMock.mockResolvedValueOnce([FLAGGED_LEAD_ROW]);
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5, manual_review_acknowledged: false }), { params: { id: '55' } });

    expect(res.status).toBe(409);
  });

  it('allows allocation to proceed once explicitly acknowledged, and records the acknowledgement in the audit log', async () => {
    sqlMock
      .mockResolvedValueOnce([FLAGGED_LEAD_ROW])
      .mockResolvedValueOnce([]) // live allocations
      .mockResolvedValueOnce([BUYER_ROW])
      .mockResolvedValueOnce([CONFIRMATION_ROW])
      .mockResolvedValueOnce([{ id: 123 }]) // allocation insert
      .mockResolvedValueOnce([]) // leads status update
      .mockResolvedValueOnce([]) // audit_log
      .mockResolvedValueOnce([{ id: 77 }]) // payments insert
      .mockResolvedValueOnce([]) // payments reference update
      .mockResolvedValueOnce([{ email: 'admin@halostrategic.com' }]);
    const { POST } = await import('./route');

    const res = await POST(
      req({ buyer_id: 99, homeowner_confirmation_id: 5, manual_review_acknowledged: true, manual_review_acknowledgement_note: 'Called the homeowner back, confirmed she owns the property.' }),
      { params: { id: '55' } }
    );

    expect(res.status).toBe(200);

    const auditCall = sqlMock.mock.calls.find((c) => JSON.stringify(c).includes("'LEAD_ALLOCATED'"));
    expect(JSON.stringify(auditCall)).toContain('Called the homeowner back');
    expect(JSON.stringify(auditCall)).toContain('renter');
  });

  it('does not stop at the manual-review check for a lead that was never flagged', async () => {
    sqlMock.mockResolvedValueOnce([LEAD_ROW]).mockResolvedValueOnce([{ id: 1, buyer_id: 42 }]);
    const { POST } = await import('./route');

    await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5, allocation_type: 'SHARED' }), { params: { id: '55' } });

    // LEAD_ROW carries no qualification_answers at all -- proceeding past the lead lookup and
    // live-allocations check all the way to the (unmocked, deliberately) buyer lookup proves the
    // manual-review gate was never triggered for it.
    expect(sqlMock).toHaveBeenCalledTimes(3);
  });
});
