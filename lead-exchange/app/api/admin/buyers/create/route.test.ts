import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminMock = vi.fn();
vi.mock('../../../../../lib/requireAdmin', () => ({ requireAdmin: requireAdminMock }));

const isConfiguredIndustrySlugMock = vi.fn();
vi.mock('../../../../../lib/industries', () => ({ isConfiguredIndustrySlug: isConfiguredIndustrySlugMock }));

const sqlMock = vi.fn();
const queryMock = vi.fn();
const client = { query: queryMock, release: vi.fn() };
const connectMock = vi.fn(async () => client);
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn(() => ({ sql: sqlMock, pool: { connect: connectMock } })) }));

function req(body: unknown): NextRequest {
  return new NextRequest('https://example.com/api/admin/buyers/create', { method: 'POST', body: JSON.stringify(body) });
}

const VALID_BODY = {
  industry_slug: 'spray_foam_removal',
  company_name: 'Russell Griffiths (business name pending)',
  contact_name: 'Russell Griffiths',
  contact_email: 'russellgriffiths@yahoo.com',
  telephone: '07700900099',
};

describe('POST /api/admin/buyers/create', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    isConfiguredIndustrySlugMock.mockReset();
    sqlMock.mockReset();
    queryMock.mockReset();
    requireAdminMock.mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    isConfiguredIndustrySlugMock.mockReturnValue(true);
    sqlMock.mockResolvedValue([{ id: 7 }]);
    queryMock.mockImplementation(async (text: string) => {
      if (text.includes('BEGIN') || text.includes('COMMIT') || text.includes('ROLLBACK')) return { rows: [] };
      if (text.startsWith('INSERT INTO buyers')) return { rows: [{ id: 42 }] };
      return { rows: [] };
    });
  });

  it('requires admin auth', async () => {
    requireAdminMock.mockResolvedValue({ response: new Response(JSON.stringify({ error: 'Not authenticated.' }), { status: 401 }) });
    const { POST } = await import('./route');

    const res = await POST(req(VALID_BODY));

    expect(res.status).toBe(401);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('rejects a request missing required fields', async () => {
    const { POST } = await import('./route');

    const res = await POST(req({ industry_slug: 'spray_foam_removal' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.missing_fields).toEqual(expect.arrayContaining(['company_name', 'contact_name', 'contact_email', 'telephone']));
  });

  it('rejects an unknown industry', async () => {
    isConfiguredIndustrySlugMock.mockReturnValue(false);
    const { POST } = await import('./route');

    const res = await POST(req(VALID_BODY));

    expect(res.status).toBe(400);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('creates a PENDING_REVIEW buyer, generates the application reference, logs an audit entry', async () => {
    const { POST } = await import('./route');

    const res = await POST(req(VALID_BODY));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.buyer_id).toBe(42);
    expect(data.application_reference).toBe('HLX-BYR-000042');
    expect(data.application_status).toBe('PENDING_REVIEW');

    const calls = queryMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.startsWith('INSERT INTO buyers'))).toBe(true);
    expect(calls.some((c) => c.includes('UPDATE buyers SET application_reference'))).toBe(true);
    expect(calls.some((c) => c.startsWith('INSERT INTO buyer_notification_preferences'))).toBe(true);
    expect(calls.some((c) => c.includes("'BUYER_RECORD_CREATED_BY_ADMIN'"))).toBe(true);
    expect(calls).toContain('COMMIT');
  });

  it('stores postcodes_covered for a regional buyer instead of defaulting to Nationwide', async () => {
    const { POST } = await import('./route');

    await POST(req({ ...VALID_BODY, coverage_type: 'regional', postcodes_covered: ['LE', 'NN', 'CV'] }));

    const insertCall = queryMock.mock.calls.find((c) => (c[0] as string).startsWith('INSERT INTO buyers'));
    expect(insertCall).toBeDefined();
    const params = insertCall![1] as unknown[];
    // coverage_type, counties_covered, postcodes_covered are params 6-8 (1-indexed in the SQL).
    expect(params[5]).toBe('regional');
    expect(params[7]).toBe(JSON.stringify(['LE', 'NN', 'CV']));
  });

  it('defaults counties_covered and postcodes_covered to empty arrays, never a fabricated Nationwide value', async () => {
    const { POST } = await import('./route');

    await POST(req(VALID_BODY));

    const insertCall = queryMock.mock.calls.find((c) => (c[0] as string).startsWith('INSERT INTO buyers'));
    const params = insertCall![1] as unknown[];
    expect(params[6]).toBe(JSON.stringify([]));
    expect(params[7]).toBe(JSON.stringify([]));
  });

  it('rolls back and rethrows if the insert fails partway through', async () => {
    queryMock.mockImplementation(async (text: string) => {
      if (text.includes('BEGIN') || text.includes('ROLLBACK')) return { rows: [] };
      if (text.startsWith('INSERT INTO buyers')) throw new Error('db exploded');
      return { rows: [] };
    });
    const { POST } = await import('./route');

    const res = await POST(req(VALID_BODY));

    expect(res.status).toBe(500);
    expect(queryMock.mock.calls.map((c) => c[0])).toContain('ROLLBACK');
  });
});
