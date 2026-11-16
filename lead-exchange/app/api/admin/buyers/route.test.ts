import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminMock = vi.fn();
vi.mock('../../../../lib/requireAdmin', () => ({ requireAdmin: requireAdminMock }));

const sqlMock = vi.fn();
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn(() => ({ sql: sqlMock })) }));

function getReq(query = ''): NextRequest {
  return new NextRequest(`https://example.com/api/admin/buyers${query}`);
}

describe('GET /api/admin/buyers', () => {
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

  it('lists buyers with no filter', async () => {
    sqlMock.mockResolvedValue([{ id: 1, company_name: 'We Fix Roofs Limited' }]);
    const { GET } = await import('./route');

    const res = await GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.buyers).toEqual([{ id: 1, company_name: 'We Fix Roofs Limited' }]);
  });

  it('filters by application_status when given', async () => {
    sqlMock.mockResolvedValue([{ id: 2, application_status: 'ACTIVE' }]);
    const { GET } = await import('./route');

    const res = await GET(getReq('?status=ACTIVE'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.buyers).toEqual([{ id: 2, application_status: 'ACTIVE' }]);
  });
});
