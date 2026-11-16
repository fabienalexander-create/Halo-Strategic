import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminMock = vi.fn();
vi.mock('../../../../lib/requireAdmin', () => ({ requireAdmin: requireAdminMock }));

const sqlMock = vi.fn();
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn(() => ({ sql: sqlMock })) }));

function req(query = ''): NextRequest {
  return new NextRequest(`https://example.com/api/admin/prospect-emails${query}`);
}

describe('GET /api/admin/prospect-emails', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
  });

  it('requires admin auth -- returns whatever requireAdmin returns, unauthenticated', async () => {
    requireAdminMock.mockResolvedValue({ response: new Response(JSON.stringify({ error: 'Not authenticated.' }), { status: 401 }) });
    const { GET } = await import('./route');

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('lists emails with no filter when authenticated', async () => {
    requireAdminMock.mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    sqlMock.mockResolvedValue([{ id: 1, status: 'SENT' }]);
    const { GET } = await import('./route');

    const res = await GET(req());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.emails).toEqual([{ id: 1, status: 'SENT' }]);
  });

  it('rejects a status filter with no recognised values, without querying the database', async () => {
    requireAdminMock.mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    const { GET } = await import('./route');

    const res = await GET(req('?status=NOT_A_REAL_STATUS'));

    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('accepts a valid comma-separated status filter and still queries', async () => {
    requireAdminMock.mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    sqlMock.mockResolvedValue([{ id: 2, status: 'SUPPRESSED' }]);
    const { GET } = await import('./route');

    const res = await GET(req('?status=failed,suppressed'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalled();
    expect(data.emails).toEqual([{ id: 2, status: 'SUPPRESSED' }]);
  });
});
