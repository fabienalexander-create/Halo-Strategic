import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminMock = vi.fn();
vi.mock('../../../../lib/requireAdmin', () => ({ requireAdmin: requireAdminMock }));

const sqlMock = vi.fn();
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn(() => ({ sql: sqlMock })) }));

function getReq(query = ''): NextRequest {
  return new NextRequest(`https://example.com/api/admin/payments${query}`);
}

describe('GET /api/admin/payments', () => {
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

  it('lists payments with no filter', async () => {
    sqlMock.mockResolvedValue([{ id: 1, status: 'PENDING' }]);
    const { GET } = await import('./route');

    const res = await GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.payments).toEqual([{ id: 1, status: 'PENDING' }]);
  });

  it('filters by status when given', async () => {
    sqlMock.mockResolvedValue([{ id: 2, status: 'PAID' }]);
    const { GET } = await import('./route');

    const res = await GET(getReq('?status=PAID'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.payments).toEqual([{ id: 2, status: 'PAID' }]);
  });
});
