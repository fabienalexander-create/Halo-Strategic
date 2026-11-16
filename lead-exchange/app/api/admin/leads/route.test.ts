import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminMock = vi.fn();
vi.mock('../../../../lib/requireAdmin', () => ({ requireAdmin: requireAdminMock }));

const isConfiguredIndustrySlugMock = vi.fn();
vi.mock('../../../../lib/industries', () => ({ isConfiguredIndustrySlug: isConfiguredIndustrySlugMock }));

const sqlMock = vi.fn();
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn(() => ({ sql: sqlMock })) }));

function postReq(body: unknown): NextRequest {
  return new NextRequest('https://example.com/api/admin/leads', { method: 'POST', body: JSON.stringify(body) });
}
function getReq(query = ''): NextRequest {
  return new NextRequest(`https://example.com/api/admin/leads${query}`);
}

const VALID_BODY = {
  industry_slug: 'spray_foam_removal',
  homeowner_name: 'Russell Test Homeowner',
  mobile: '+447700900111',
  postcode: 'SW2 4UR',
  service_requirement: 'Closed-cell removal',
  source: 'Meta Lead Centre',
  meta_lead_id: 'l:1234567890',
};

describe('POST /api/admin/leads', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    isConfiguredIndustrySlugMock.mockReset();
    sqlMock.mockReset();
    requireAdminMock.mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    isConfiguredIndustrySlugMock.mockReturnValue(true);
  });

  it('requires admin auth', async () => {
    requireAdminMock.mockResolvedValue({ response: new Response(JSON.stringify({ error: 'Not authenticated.' }), { status: 401 }) });
    const { POST } = await import('./route');

    const res = await POST(postReq(VALID_BODY));

    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('rejects a request missing required fields', async () => {
    const { POST } = await import('./route');

    const res = await POST(postReq({ industry_slug: 'spray_foam_removal' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.missing_fields).toEqual(expect.arrayContaining(['homeowner_name', 'postcode']));
  });

  it('rejects when neither mobile nor email is given', async () => {
    const { POST } = await import('./route');

    const res = await POST(postReq({ ...VALID_BODY, mobile: undefined }));

    expect(res.status).toBe(400);
  });

  it('rejects an unknown industry', async () => {
    isConfiguredIndustrySlugMock.mockReturnValue(false);
    const { POST } = await import('./route');

    const res = await POST(postReq(VALID_BODY));

    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('creates a QUALIFIED lead and logs an audit entry including the meta lead id', async () => {
    sqlMock
      .mockResolvedValueOnce([{ id: 9 }]) // industries lookup
      .mockResolvedValueOnce([{ id: 55 }]) // leads insert
      .mockResolvedValueOnce([]); // audit_log insert
    const { POST } = await import('./route');

    const res = await POST(postReq(VALID_BODY));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.lead_id).toBe(55);
    expect(data.reference).toBe('HLX-LEAD-000055');
    expect(data.status).toBe('QUALIFIED');

    const auditCallArgs = sqlMock.mock.calls[2];
    const auditJson = JSON.stringify(auditCallArgs);
    expect(auditJson).toContain('meta_lead_id');
    expect(auditJson).toContain('l:1234567890');
  });
});

describe('GET /api/admin/leads', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    sqlMock.mockReset();
    requireAdminMock.mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    sqlMock.mockResolvedValue([]);
  });

  it('requires admin auth', async () => {
    requireAdminMock.mockResolvedValue({ response: new Response(JSON.stringify({ error: 'Not authenticated.' }), { status: 401 }) });
    const { GET } = await import('./route');

    const res = await GET(getReq());

    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('lists leads with no filter', async () => {
    sqlMock.mockResolvedValue([{ id: 1, status: 'QUALIFIED' }]);
    const { GET } = await import('./route');

    const res = await GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.leads).toEqual([{ id: 1, status: 'QUALIFIED' }]);
  });

  it('filters by status when given', async () => {
    sqlMock.mockResolvedValue([{ id: 2, status: 'DELIVERED' }]);
    const { GET } = await import('./route');

    const res = await GET(getReq('?status=DELIVERED'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.leads).toEqual([{ id: 2, status: 'DELIVERED' }]);
  });
});
