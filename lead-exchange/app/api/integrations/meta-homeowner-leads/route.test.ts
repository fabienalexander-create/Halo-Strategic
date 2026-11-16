import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const isConfiguredIndustrySlugMock = vi.fn();
vi.mock('../../../../lib/industries', () => ({ isConfiguredIndustrySlug: isConfiguredIndustrySlugMock }));

const sqlMock = vi.fn();
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn(() => ({ sql: sqlMock })) }));

function req(body: unknown, secret?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret !== undefined) headers['x-halo-integration-secret'] = secret;
  return new NextRequest('https://example.com/api/integrations/meta-homeowner-leads', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  meta_lead_id: 'l:1796652051564840',
  campaign_id: 'c:1',
  form_id: 'f:1',
  mapped: {
    industry_slug: 'spray_foam_removal',
    homeowner_name: 'Ebrehime Wadu',
    mobile: '+447450949888',
    postcode: 'N15 5DF',
    property_type: 'Flat',
    service_requirement: 'Closed-cell removal',
    owns_property: true,
  },
};

describe('POST /api/integrations/meta-homeowner-leads', () => {
  const ORIGINAL_SECRET = process.env.META_HOMEOWNER_LEADS_WEBHOOK_SECRET;

  beforeEach(() => {
    isConfiguredIndustrySlugMock.mockReset();
    sqlMock.mockReset();
    isConfiguredIndustrySlugMock.mockReturnValue(true);
    process.env.META_HOMEOWNER_LEADS_WEBHOOK_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.META_HOMEOWNER_LEADS_WEBHOOK_SECRET = ORIGINAL_SECRET;
  });

  describe('authentication', () => {
    it('refuses with 503 when no secret is configured', async () => {
      delete process.env.META_HOMEOWNER_LEADS_WEBHOOK_SECRET;
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'test-secret'));

      expect(res.status).toBe(503);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it('refuses with 401 when no secret header is presented', async () => {
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY));

      expect(res.status).toBe(401);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it('refuses with 401 when the presented secret is wrong', async () => {
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'wrong-secret'));

      expect(res.status).toBe(401);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it('proceeds when the correct secret is presented', async () => {
      sqlMock.mockResolvedValueOnce([{ id: 9, is_enabled: true }]).mockResolvedValueOnce([{ id: 55 }]).mockResolvedValueOnce([]);
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'test-secret'));

      expect(res.status).toBe(201);
    });
  });

  describe('validation', () => {
    it('rejects invalid JSON', async () => {
      const { POST } = await import('./route');
      const badReq = new NextRequest('https://example.com/api/integrations/meta-homeowner-leads', {
        method: 'POST', headers: { 'x-halo-integration-secret': 'test-secret' }, body: '{not json',
      });

      const res = await POST(badReq);

      expect(res.status).toBe(400);
    });

    it('rejects a missing meta_lead_id', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, meta_lead_id: undefined }, 'test-secret'));

      expect(res.status).toBe(400);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it('rejects a missing mapped object', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ meta_lead_id: 'l:1' }, 'test-secret'));

      expect(res.status).toBe(400);
    });

    it('rejects missing required mapped fields', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ meta_lead_id: 'l:1', mapped: { industry_slug: 'spray_foam_removal' } }, 'test-secret'));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.missing_fields).toEqual(expect.arrayContaining(['homeowner_name', 'postcode']));
    });

    it('rejects when neither mobile nor email is given', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, mapped: { ...VALID_BODY.mapped, mobile: undefined } }, 'test-secret'));

      expect(res.status).toBe(400);
    });

    it('rejects an unknown industry', async () => {
      isConfiguredIndustrySlugMock.mockReturnValue(false);
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'test-secret'));

      expect(res.status).toBe(400);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it('rejects an industry that is not enabled', async () => {
      sqlMock.mockResolvedValueOnce([{ id: 9, is_enabled: false }]);
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'test-secret'));

      expect(res.status).toBe(400);
    });
  });

  describe('new lead creation', () => {
    it('creates a QUALIFICATION_PENDING lead, preserving meta_lead_id and source', async () => {
      sqlMock.mockResolvedValueOnce([{ id: 9, is_enabled: true }]).mockResolvedValueOnce([{ id: 55 }]).mockResolvedValueOnce([]);
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'test-secret'));
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.lead_id).toBe(55);
      expect(data.reference).toBe('HLX-LEAD-000055');
      expect(data.status).toBe('QUALIFICATION_PENDING');
      expect(data.duplicate).toBe(false);

      const insertCall = sqlMock.mock.calls[1];
      const insertJson = JSON.stringify(insertCall);
      expect(insertJson).toContain('l:1796652051564840');
      expect(insertJson).toContain('meta_instant_form');
    });
  });

  describe('duplicate submissions (idempotency)', () => {
    it('reports a duplicate without creating a new row when ON CONFLICT DO NOTHING matches nothing new', async () => {
      sqlMock
        .mockResolvedValueOnce([{ id: 9, is_enabled: true }]) // industries
        .mockResolvedValueOnce([]) // insert returns nothing -- conflict
        .mockResolvedValueOnce([{ id: 55, status: 'RESERVED' }]); // existing lookup
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'test-secret'));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.duplicate).toBe(true);
      expect(data.lead_id).toBe(55);
      expect(data.status).toBe('RESERVED');
      // No audit_log call for a duplicate -- only 3 sql calls total (industries, insert, existing lookup)
      expect(sqlMock).toHaveBeenCalledTimes(3);
    });

    it('fails loudly rather than guessing if the conflict row genuinely cannot be found', async () => {
      sqlMock
        .mockResolvedValueOnce([{ id: 9, is_enabled: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'test-secret'));

      expect(res.status).toBe(500);
    });
  });

  describe('never allocates, offers, charges or releases', () => {
    it('only ever touches leads and audit_log -- no lead_allocations, payments or email tables', async () => {
      sqlMock.mockResolvedValueOnce([{ id: 9, is_enabled: true }]).mockResolvedValueOnce([{ id: 55 }]).mockResolvedValueOnce([]);
      const { POST } = await import('./route');

      await POST(req(VALID_BODY, 'test-secret'));

      const allSql = sqlMock.mock.calls.map((c) => JSON.stringify(c)).join('\n');
      expect(allSql).not.toContain('lead_allocations');
      expect(allSql).not.toContain('payments');
      expect(allSql).not.toContain('lead_delivery_emails');
      expect(allSql).not.toContain('homeowner_confirmations');
    });
  });
});
