import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminMock = vi.fn();
vi.mock('../../../../../../lib/requireAdmin', () => ({ requireAdmin: requireAdminMock }));

const sqlMock = vi.fn();
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn(() => ({ sql: sqlMock })) }));

function req(): NextRequest {
  return new NextRequest('https://example.com/api/admin/leads/55/eligible-buyers', { method: 'GET' });
}

describe('GET /api/admin/leads/[id]/eligible-buyers', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    sqlMock.mockReset();
    requireAdminMock.mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
  });

  it('returns 404 for a lead that does not exist', async () => {
    sqlMock.mockResolvedValueOnce([]);
    const { GET } = await import('./route');

    const res = await GET(req(), { params: { id: '55' } });
    expect(res.status).toBe(404);
  });

  it('returns only buyers eligible for the lead', async () => {
    sqlMock
      .mockResolvedValueOnce([{ id: 55, industry_id: 3, postcode: 'SW2 4UR' }]) // lead lookup
      .mockResolvedValueOnce([{ buyer_id: 42 }]) // James's existing live allocation
      .mockResolvedValueOnce([
        { id: 42, company_name: 'James', application_status: 'ACTIVE', industry_id: 3, agreed_price_per_lead: 80, exclusivity_arrangement: 'exclusive', coverage_type: 'national', counties_covered: [], postcodes_covered: [], weekly_lead_capacity: null, live_allocations_last_7_days: '1' },
        { id: 99, company_name: 'Russell', application_status: 'ACTIVE', industry_id: 3, agreed_price_per_lead: 65, exclusivity_arrangement: 'shared', coverage_type: 'national', counties_covered: [], postcodes_covered: [], weekly_lead_capacity: null, live_allocations_last_7_days: '0' },
      ]);
    const { GET } = await import('./route');

    const res = await GET(req(), { params: { id: '55' } });
    const data = await res.json();

    expect(res.status).toBe(200);
    // James is excluded: he already has the live allocation this lookup excludes by buyer id.
    // Russell is included: shared arrangement, not at capacity, covers the lead's area.
    expect(data.buyers.map((b: { id: number }) => b.id)).toEqual([99]);
  });
});
