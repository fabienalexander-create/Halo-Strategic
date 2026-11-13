import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const captureMock = vi.fn();
vi.mock('../../../../lib/buyerProspectCapture', () => ({
  captureBuyerProspectTouch: captureMock,
}));

const sqlMock = vi.fn();
vi.mock('@netlify/database', () => ({
  getDatabase: vi.fn(() => ({ sql: sqlMock, pool: { connect: vi.fn() } })),
}));

function req(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://example.com/api/integrations/meta-lead-ads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = {
  meta_lead_id: 'lead_123',
  campaign_id: 'camp_1',
  campaign_name: 'Autumn Push',
  mapped: {
    industry_slug: 'solar_battery',
    company_name: 'Acme Solar',
    contact_name: 'Jo Bloggs',
    contact_email: 'jo@acme.test',
    telephone: '07700900000',
    consent_contact: true,
    consent_wording_version: '2026-11-meta-instant-form-v1',
    consent_evidence: { question: 'May we contact you about this enquiry?', answer: 'Yes' },
  },
};

describe('POST /api/integrations/meta-lead-ads', () => {
  beforeEach(() => {
    captureMock.mockReset();
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([{ id: 1, is_enabled: true }]);
    process.env.META_LEAD_ADS_WEBHOOK_SECRET = 'test-secret';
  });
  afterEach(() => {
    delete process.env.META_LEAD_ADS_WEBHOOK_SECRET;
  });

  it('fails closed (503) when the integration secret is not configured', async () => {
    delete process.env.META_LEAD_ADS_WEBHOOK_SECRET;
    const { POST } = await import('./route');
    const res = await POST(req(validBody, { 'x-halo-integration-secret': 'anything' }));
    expect(res.status).toBe(503);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('rejects a missing or wrong secret (401), without touching the database', async () => {
    const { POST } = await import('./route');
    const res = await POST(req(validBody, { 'x-halo-integration-secret': 'wrong' }));
    expect(res.status).toBe(401);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('rejects a missing meta_lead_id', async () => {
    const { POST } = await import('./route');
    const { meta_lead_id, ...rest } = validBody;
    const res = await POST(req(rest, { 'x-halo-integration-secret': 'test-secret' }));
    expect(res.status).toBe(400);
  });

  it('rejects an unknown industry slug', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      req({ ...validBody, mapped: { ...validBody.mapped, industry_slug: 'made_up' } }, { 'x-halo-integration-secret': 'test-secret' })
    );
    expect(res.status).toBe(400);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('rejects consent_contact !== true -- never assumes consent', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      req({ ...validBody, mapped: { ...validBody.mapped, consent_contact: false } }, { 'x-halo-integration-secret': 'test-secret' })
    );
    expect(res.status).toBe(400);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('rejects consent_contact=true with no consent_evidence -- a boolean alone is not enough', async () => {
    const { POST } = await import('./route');
    const { consent_evidence, ...mappedWithoutEvidence } = validBody.mapped;
    const res = await POST(req({ ...validBody, mapped: mappedWithoutEvidence }, { 'x-halo-integration-secret': 'test-secret' }));
    expect(res.status).toBe(400);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('rejects consent_evidence missing an actual answer', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      req(
        { ...validBody, mapped: { ...validBody.mapped, consent_evidence: { question: 'May we contact you?', answer: '' } } },
        { 'x-halo-integration-secret': 'test-secret' }
      )
    );
    expect(res.status).toBe(400);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('rejects a missing consent_wording_version', async () => {
    const { POST } = await import('./route');
    const { consent_wording_version, ...mappedWithoutVersion } = validBody.mapped;
    const res = await POST(req({ ...validBody, mapped: mappedWithoutVersion }, { 'x-halo-integration-secret': 'test-secret' }));
    expect(res.status).toBe(400);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('accepts a valid payload and writes via the shared capture helper, channel=meta_instant_form', async () => {
    captureMock.mockResolvedValue({ prospectId: 1, prospectReference: 'HLX-PROSPECT-000001', isNewProspect: true, isDuplicateMetaLead: false });
    const { POST } = await import('./route');
    const res = await POST(req(validBody, { 'x-halo-integration-secret': 'test-secret' }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.reference).toBe('HLX-PROSPECT-000001');
    expect(captureMock).toHaveBeenCalledWith(expect.objectContaining({ sql: sqlMock }), expect.objectContaining({
      channel: 'meta_instant_form',
      metaLeadId: 'lead_123',
      contactEmail: 'jo@acme.test',
    }));
  });

  it('a duplicate/retried meta_lead_id returns 200 with duplicate:true, no new prospect', async () => {
    captureMock.mockResolvedValue({ prospectId: 1, prospectReference: 'HLX-PROSPECT-000001', isNewProspect: false, isDuplicateMetaLead: true });
    const { POST } = await import('./route');
    const res = await POST(req(validBody, { 'x-halo-integration-secret': 'test-secret' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.duplicate).toBe(true);
  });

  it('rejects when the industry is not enabled', async () => {
    sqlMock.mockResolvedValue([{ id: 1, is_enabled: false }]);
    const { POST } = await import('./route');
    const res = await POST(req(validBody, { 'x-halo-integration-secret': 'test-secret' }));
    expect(res.status).toBe(400);
    expect(captureMock).not.toHaveBeenCalled();
  });
});
