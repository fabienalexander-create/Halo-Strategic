import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireOwnerMock = vi.fn();
vi.mock('../../../../../../lib/requireAdmin', () => ({ requireOwner: requireOwnerMock }));

const sqlMock = vi.fn();
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn(() => ({ sql: sqlMock })) }));

function req(body: unknown): NextRequest {
  return new NextRequest('https://example.com/api/admin/buyers/HLX-BYR-000003/coverage', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const VALID_REASON = 'Approved expansion of James coverage from Chelmsford, per audit follow-up.';

describe('POST /api/admin/buyers/[reference]/coverage', () => {
  beforeEach(() => {
    requireOwnerMock.mockReset();
    sqlMock.mockReset();
    requireOwnerMock.mockResolvedValue({ session: { adminId: 1, email: 'owner@halostrategic.com', role: 'owner' } });
    sqlMock.mockImplementation(async (strings: readonly string[]) => {
      const text = strings.join('');
      if (text.includes('FROM buyers WHERE application_reference')) {
        return [{ id: 3, company_name: 'We fix roofs', postcodes_covered: ['Essex', 'Suffolk'] }];
      }
      if (text.includes('WITH prev AS')) {
        return [{ updated: '1', logged: '1' }];
      }
      return [];
    });
  });

  it('requires owner auth', async () => {
    requireOwnerMock.mockResolvedValue({ response: new Response(JSON.stringify({ error: 'Owner role required.' }), { status: 403 }) });
    const { POST } = await import('./route');

    const res = await POST(req({ postcodes_covered: ['CM'], reason: VALID_REASON, confirm: true }), { params: { reference: 'HLX-BYR-000003' } });

    expect(res.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('rejects without explicit confirmation', async () => {
    const { POST } = await import('./route');

    const res = await POST(req({ postcodes_covered: ['CM'], reason: VALID_REASON }), { params: { reference: 'HLX-BYR-000003' } });

    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('rejects a reason that is too short', async () => {
    const { POST } = await import('./route');

    const res = await POST(req({ postcodes_covered: ['CM'], reason: 'too short', confirm: true }), { params: { reference: 'HLX-BYR-000003' } });

    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('rejects county names and other non-outward-code entries, same bug this route exists to stop recurring', async () => {
    const { POST } = await import('./route');

    const res = await POST(req({ postcodes_covered: ['Essex', 'Suffolk'], reason: VALID_REASON, confirm: true }), {
      params: { reference: 'HLX-BYR-000003' },
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/doesn't look like a UK outward postcode code/);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('rejects an empty postcode list', async () => {
    const { POST } = await import('./route');

    const res = await POST(req({ postcodes_covered: [], reason: VALID_REASON, confirm: true }), { params: { reference: 'HLX-BYR-000003' } });

    expect(res.status).toBe(400);
  });

  it('404s when the buyer reference does not exist', async () => {
    sqlMock.mockImplementation(async () => []);
    const { POST } = await import('./route');

    const res = await POST(req({ postcodes_covered: ['CM'], reason: VALID_REASON, confirm: true }), { params: { reference: 'HLX-BYR-999999' } });

    expect(res.status).toBe(404);
  });

  it('accepts a valid district and area-level mix, de-duplicates, and reports before/after', async () => {
    const { POST } = await import('./route');

    const res = await POST(
      req({
        postcodes_covered: ['CM', 'co', 'SS', 'rm', 'IP', 'CB', 'pe1', 'PE1', 'PE19', 'AL', 'SG', 'WD', 'EN', 'HP1', 'HP23', 'LU', 'MK', 'NN'],
        reason: VALID_REASON,
        confirm: true,
      }),
      { params: { reference: 'HLX-BYR-000003' } }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.updated).toBe(true);
    expect(data.previous_postcodes_covered).toEqual(['Essex', 'Suffolk']);
    expect(data.postcodes_covered).toEqual(
      expect.arrayContaining(['CM', 'CO', 'SS', 'RM', 'IP', 'CB', 'PE1', 'PE19', 'AL', 'SG', 'WD', 'EN', 'HP1', 'HP23', 'LU', 'MK', 'NN'])
    );
    // "pe1" and "PE1" collapse to one entry.
    expect(data.postcodes_covered.filter((p: string) => p === 'PE1')).toHaveLength(1);

    const updateCall = sqlMock.mock.calls.find((c) => (c[0] as readonly string[]).join('').includes('WITH prev AS'));
    expect(updateCall).toBeDefined();
  });
});
