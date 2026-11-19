import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminMock = vi.fn();
vi.mock('../../../../../../lib/requireAdmin', () => ({ requireAdmin: requireAdminMock }));

const sendLeadDeliveryEmailMock = vi.fn();
vi.mock('../../../../../../lib/leadDeliveryEmail', () => ({ sendLeadDeliveryEmail: sendLeadDeliveryEmailMock }));

const sqlMock = vi.fn();
// Writes happen inside one transaction on a pooled client (2026-11-19). The client answers by
// statement, not by call order, so each test only states what's different about its scenario.
const clientQueryMock = vi.fn();
const releaseMock = vi.fn();
vi.mock('@netlify/database', () => ({
  getDatabase: vi.fn(() => ({ sql: sqlMock, pool: { connect: vi.fn(async () => ({ query: clientQueryMock, release: releaseMock })) } })),
}));

function mockTx(opts: { lockStatus?: string; liveBuyerIds?: number[]; allocationId?: number; paymentId?: number } = {}) {
  clientQueryMock.mockImplementation(async (text: string) => {
    if (/FOR UPDATE/.test(text)) return { rows: [{ status: opts.lockStatus ?? 'QUALIFIED' }] };
    if (/^SELECT buyer_id FROM lead_allocations/.test(text.trim())) return { rows: (opts.liveBuyerIds ?? []).map((b) => ({ buyer_id: b })) };
    if (/INSERT INTO lead_allocations/.test(text)) return { rows: [{ id: opts.allocationId ?? 123 }] };
    if (/INSERT INTO payments/.test(text)) return { rows: [{ id: opts.paymentId ?? 77 }] };
    return { rows: [] };
  });
}
const txCall = (pattern: string) => clientQueryMock.mock.calls.find((c) => String(c[0]).includes(pattern));
const txTexts = () => clientQueryMock.mock.calls.map((c) => String(c[0]).trim().split(/\s+/).slice(0, 3).join(' '));

function req(body: unknown): NextRequest {
  return new NextRequest('https://example.com/api/admin/leads/55/allocate', { method: 'POST', body: JSON.stringify(body) });
}

const LEAD_ROW = {
  id: 55, status: 'QUALIFIED', homeowner_name: 'Nkechiyeuinm Onwuegbute', homeowner_contact: { mobile: '+447438810642', email: 'x@example.com' },
  property_type: 'Flat', postcode: 'SW2 4UR', service_requirement: 'Removal', industry_slug: 'spray_foam_removal', industry_id: 3,
};
const BUYER_ROW = { id: 99, industry_id: 3, application_status: 'ACTIVE', company_name: 'Russell Griffiths (business name pending)', contact_email: 'russellgriffiths@yahoo.com', agreed_price_per_lead: 65 };
const CONFIRMATION_ROW = { id: 5, lead_id: 55, buyer_id: 99, withdrawn_at: null };

// Reads before the transaction (lead, live allocations, buyer, confirmation), then the admin
// lookup after commit. Every write goes through the transaction client (mockTx).
function mockHappyPath() {
  sqlMock
    .mockResolvedValueOnce([LEAD_ROW])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([BUYER_ROW])
    .mockResolvedValueOnce([CONFIRMATION_ROW])
    .mockResolvedValueOnce([{ email: 'admin@halostrategic.com' }]); // admin_users, after commit
  mockTx();
}

describe('POST /api/admin/leads/[id]/allocate -- payment link passthrough', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    sqlMock.mockReset();
    clientQueryMock.mockReset();
    releaseMock.mockReset();
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

    const paymentsInsertCall = txCall('INSERT INTO payments');
    expect(JSON.stringify(paymentsInsertCall)).toContain('https://pay.tide.co/products/russell-lead-055');

    const offerCall = sendLeadDeliveryEmailMock.mock.calls.find((c) => c[1].emailType === 'LEAD_OFFER');
    expect(offerCall?.[1].text).toContain('https://pay.tide.co/products/russell-lead-055');
    expect(offerCall?.[1].text).not.toContain('bank transfer');
    // The link may be shared across a buyer's leads, so the unique reference always goes with it.
    expect(offerCall?.[1].text).toContain('Please quote payment reference HLX-PAY-000077');
    expect(offerCall?.[1].html).toContain('<strong>HLX-PAY-000077</strong>');
  });

  it('falls back to the bank-transfer instruction when no payment_link is given', async () => {
    mockHappyPath();
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });
    expect(res.status).toBe(200);

    const paymentsInsertCall = txCall('INSERT INTO payments');
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
    clientQueryMock.mockReset();
    releaseMock.mockReset();
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
      .mockResolvedValueOnce([{ email: 'admin@halostrategic.com' }]);
    mockTx({ allocationId: 125, paymentId: 79 });
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } }); // no allocation_type given
    expect(res.status).toBe(200);

    const insertCall = txCall('INSERT INTO lead_allocations');
    expect(JSON.stringify(insertCall)).toContain('SHARED');
  });

  it('defaults to EXCLUSIVE_WINDOW when the buyer is contracted exclusive, and refuses it if the lead already has a live allocation', async () => {
    sqlMock
      .mockResolvedValueOnce([LEAD_ROW])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...BUYER_ROW, exclusivity_arrangement: 'exclusive' }])
      .mockResolvedValueOnce([CONFIRMATION_ROW])
      .mockResolvedValueOnce([{ email: 'admin@halostrategic.com' }]);
    mockTx({ allocationId: 126, paymentId: 80 });
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } }); // no allocation_type given
    expect(res.status).toBe(200);

    const insertCall = txCall('INSERT INTO lead_allocations');
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
      .mockResolvedValueOnce([{ email: 'admin@halostrategic.com' }]);
    mockTx({ allocationId: 124, paymentId: 78, liveBuyerIds: [42] });
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5, allocation_type: 'SHARED' }), { params: { id: '55' } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.allocation_id).toBe(124);

    const insertCall = txCall('INSERT INTO lead_allocations');
    expect(JSON.stringify(insertCall)).toContain('SHARED');
    // allocation_sequence is null for SHARED, not 1
    expect(JSON.stringify(insertCall)).not.toMatch(/"SHARED".*,1,/);

    const auditCall = txCall("'LEAD_ALLOCATED'");
    expect(JSON.stringify(auditCall)).toContain('42'); // records James's buyer_id as an "other live buyer" for traceability
  });

  it('rejects allocating a lead that is still QUALIFICATION_PENDING (incomplete Meta intake)', async () => {
    sqlMock.mockResolvedValueOnce([{ ...LEAD_ROW, status: 'QUALIFICATION_PENDING' }]); // lead lookup only -- nothing after it should run
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toMatch(/awaiting qualification/);
    expect(sqlMock).toHaveBeenCalledTimes(1); // stops immediately after the lead lookup
  });

  it('still allows allocating a NEW-status lead (e.g. a Meta lead that completed the website follow-up)', async () => {
    sqlMock
      .mockResolvedValueOnce([{ ...LEAD_ROW, status: 'NEW' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([BUYER_ROW])
      .mockResolvedValueOnce([CONFIRMATION_ROW])
      .mockResolvedValueOnce([{ email: 'admin@halostrategic.com' }]);
    mockTx({ allocationId: 130, paymentId: 81 });
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });

    expect(res.status).toBe(200);
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

// Fabien, 2026-11-19: one allocation is one business transaction.
describe('POST /api/admin/leads/[id]/allocate -- all-or-nothing', () => {
  const READS = () => sqlMock
    .mockResolvedValueOnce([LEAD_ROW])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([BUYER_ROW])
    .mockResolvedValueOnce([CONFIRMATION_ROW])
    .mockResolvedValueOnce([{ email: 'admin@halostrategic.com' }]);

  beforeEach(() => {
    requireAdminMock.mockReset();
    sqlMock.mockReset();
    clientQueryMock.mockReset();
    releaseMock.mockReset();
    sendLeadDeliveryEmailMock.mockReset();
    requireAdminMock.mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    sendLeadDeliveryEmailMock.mockResolvedValue({ sent: true, skipped: false, blocked: false });
  });

  it('writes allocation, lead status, audit and payment inside one transaction, locking the lead first', async () => {
    READS();
    mockTx();
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });

    expect(res.status).toBe(200);
    expect(txTexts()).toEqual([
      'BEGIN', 'SELECT status FROM', 'SELECT buyer_id FROM', 'INSERT INTO lead_allocations', "UPDATE leads SET",
      'INSERT INTO audit_log', 'INSERT INTO payments', 'UPDATE payments SET', 'COMMIT',
    ]);
    expect(String(clientQueryMock.mock.calls[1][0])).toContain('FOR UPDATE');
    // No write goes around the transaction.
    expect(sqlMock.mock.calls.some((c) => /INSERT|UPDATE/.test(JSON.stringify(c[0])))).toBe(false);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('rolls everything back if the payment insert fails: no half-recorded sale, no offer email', async () => {
    READS();
    clientQueryMock.mockImplementation(async (text: string) => {
      if (/FOR UPDATE/.test(text)) return { rows: [{ status: 'QUALIFIED' }] };
      if (/INSERT INTO lead_allocations/.test(text)) return { rows: [{ id: 200 }] };
      if (/INSERT INTO payments/.test(text)) throw new Error('connection lost');
      return { rows: [] };
    });
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });

    expect(res.status).toBe(500);
    expect(txTexts()).toContain('ROLLBACK');
    expect(txTexts()).not.toContain('COMMIT');
    expect(sendLeadDeliveryEmailMock).not.toHaveBeenCalled();
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a duplicate that only appears under the lock (two admins at once)', async () => {
    READS(); // the earlier read saw no live allocation...
    mockTx({ liveBuyerIds: [99] }); // ...but by the time the lock is held, this buyer has one
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already has a live allocation/);
    expect(txCall('INSERT INTO lead_allocations')).toBeUndefined();
    expect(txTexts()).toContain('ROLLBACK');
    expect(sendLeadDeliveryEmailMock).not.toHaveBeenCalled();
  });

  it('refuses an exclusive claim when another buyer took the lead between the read and the lock', async () => {
    sqlMock
      .mockResolvedValueOnce([LEAD_ROW])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...BUYER_ROW, exclusivity_arrangement: 'exclusive' }])
      .mockResolvedValueOnce([CONFIRMATION_ROW]);
    mockTx({ liveBuyerIds: [42] });
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });

    expect(res.status).toBe(409);
    expect(txCall('INSERT INTO lead_allocations')).toBeUndefined();
  });

  it('refuses if the lead went back to awaiting qualification before the lock', async () => {
    READS();
    mockTx({ lockStatus: 'QUALIFICATION_PENDING' });
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });

    expect(res.status).toBe(409);
    expect(txCall('INSERT INTO lead_allocations')).toBeUndefined();
  });

  it('turns a database guard refusal into a 409, with nothing recorded and no email sent', async () => {
    READS();
    clientQueryMock.mockImplementation(async (text: string) => {
      if (/FOR UPDATE/.test(text)) return { rows: [{ status: 'QUALIFIED' }] };
      if (/INSERT INTO lead_allocations/.test(text)) throw Object.assign(new Error('homeowner confirmation 5 has been withdrawn'), { code: 'P0001' });
      return { rows: [] };
    });
    const { POST } = await import('./route');

    const res = await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });

    expect(res.status).toBe(409);
    expect(txTexts()).toContain('ROLLBACK');
    expect(sendLeadDeliveryEmailMock).not.toHaveBeenCalled();
  });

  it('sends the offer email only after commit, never the unlock email before payment', async () => {
    READS();
    mockTx();
    const { POST } = await import('./route');

    await POST(req({ buyer_id: 99, homeowner_confirmation_id: 5 }), { params: { id: '55' } });

    const types = sendLeadDeliveryEmailMock.mock.calls.map((c) => c[1].emailType);
    expect(types).toEqual(['LEAD_OFFER', 'INTERNAL_OFFER_COPY']);
    expect(types).not.toContain('LEAD_UNLOCKED');
  });
});
