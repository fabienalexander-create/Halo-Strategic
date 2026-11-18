import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const isConfiguredIndustrySlugMock = vi.fn();
vi.mock('../../../../lib/industries', () => ({
  isConfiguredIndustrySlug: isConfiguredIndustrySlugMock,
  HOMEOWNER_CONSENT_CONFIG: {
    spray_foam_removal: {
      consentVersion: '2026-11-18-v0.2',
      source: 'spray_foam_removal_homeowner_form',
      shareBuyerLabel: 'test label',
      namedRecipientOrCategory: 'One or more approved Spray Foam Removal buyers (installers)',
    },
  },
}));

const attemptSyncMock = vi.fn();
const buildLeadRowValuesMock = vi.fn().mockReturnValue(['row']);
vi.mock('../../../../lib/sheetsSync', () => ({
  attemptSync: attemptSyncMock,
  buildLeadRowValues: buildLeadRowValuesMock,
}));

const sqlMock = vi.fn();
const clientQueryMock = vi.fn();
const releaseMock = vi.fn();
vi.mock('@netlify/database', () => ({
  getDatabase: vi.fn(() => ({
    sql: sqlMock,
    pool: { connect: vi.fn(async () => ({ query: clientQueryMock, release: releaseMock })) },
  })),
}));

function req(body: unknown, secret?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret !== undefined) headers['x-halo-integration-secret'] = secret;
  return new NextRequest('https://example.com/api/integrations/meta-homeowner-leads', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

const VALID_MAPPED = {
  industry_slug: 'spray_foam_removal',
  homeowner_name: 'Ebrehime Wadu',
  mobile: '+447450949888',
  postcode: 'N15 5DF',
  property_type: 'Flat',
  service_requirement: 'Closed-cell removal',
  owns_property: true,
  reason_for_enquiry: 'Selling the property',
  timeframe: 'Within 3 months',
  preferred_contact_method: 'Phone',
  consent_contact: true,
};
const VALID_BODY = {
  meta_lead_id: 'l:1796652051564840',
  campaign_id: 'c:1',
  form_id: 'f:1',
  mapped: VALID_MAPPED,
};

// db.sql call sequence before the pool.connect()/transaction starts, for a request that reaches
// that point: industries lookup, then the active-buyers coverage lookup. One buyer with national
// coverage means the outside-service-area classification never fires unless a test overrides it.
function mockPreTransactionSql(buyers: Record<string, unknown>[] = [{ coverage_type: 'national', counties_covered: [], postcodes_covered: [] }]) {
  sqlMock.mockResolvedValueOnce([{ id: 9, is_enabled: true }]).mockResolvedValueOnce(buyers);
}

// client.query call sequence for a successful new-lead happy path: BEGIN, consent insert, lead
// insert, consent update, audit_log insert, sheet-sync insert, COMMIT.
function mockHappyPathClientQueries(leadId = 55, consentId = 3, syncId = 7) {
  clientQueryMock
    .mockResolvedValueOnce({ rows: [] }) // BEGIN
    .mockResolvedValueOnce({ rows: [{ id: consentId }] }) // consent_records insert
    .mockResolvedValueOnce({ rows: [{ id: leadId }] }) // leads insert
    .mockResolvedValueOnce({ rows: [] }) // consent_records update
    .mockResolvedValueOnce({ rows: [] }) // audit_log insert
    .mockResolvedValueOnce({ rows: [{ id: syncId }] }) // lead_sheet_syncs insert
    .mockResolvedValueOnce({ rows: [] }); // COMMIT
}

describe('POST /api/integrations/meta-homeowner-leads', () => {
  const ORIGINAL_SECRET = process.env.META_HOMEOWNER_LEADS_WEBHOOK_SECRET;

  beforeEach(() => {
    isConfiguredIndustrySlugMock.mockReset();
    sqlMock.mockReset();
    clientQueryMock.mockReset();
    releaseMock.mockReset();
    attemptSyncMock.mockReset();
    buildLeadRowValuesMock.mockClear();
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
      mockPreTransactionSql();
      mockHappyPathClientQueries();
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

    it('rejects missing required mapped string fields', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ meta_lead_id: 'l:1', mapped: { industry_slug: 'spray_foam_removal' } }, 'test-secret'));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.missing_fields).toEqual(expect.arrayContaining(['homeowner_name', 'postcode', 'mobile', 'reason_for_enquiry', 'timeframe', 'preferred_contact_method']));
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it('rejects when owns_property is not a boolean (missing or wrong type)', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, mapped: { ...VALID_MAPPED, owns_property: undefined } }, 'test-secret'));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.missing_fields).toEqual(['owns_property']);
    });

    it('does NOT treat owns_property: false (a renter) as a missing field', async () => {
      mockPreTransactionSql();
      mockHappyPathClientQueries();
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, mapped: { ...VALID_MAPPED, owns_property: false } }, 'test-secret'));

      expect(res.status).toBe(201);
    });

    it('rejects when consent_contact is not a boolean', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, mapped: { ...VALID_MAPPED, consent_contact: undefined } }, 'test-secret'));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.missing_fields).toEqual(['consent_contact']);
    });

    it('rejects an explicit consent_contact: false', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, mapped: { ...VALID_MAPPED, consent_contact: false } }, 'test-secret'));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/[Cc]onsent/);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it('email is optional', async () => {
      mockPreTransactionSql();
      mockHappyPathClientQueries();
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, mapped: { ...VALID_MAPPED, email: undefined } }, 'test-secret'));

      expect(res.status).toBe(201);
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
    it('creates a QUALIFICATION_PENDING lead, with consent, qualification answers and a sheet-sync entry', async () => {
      mockPreTransactionSql();
      mockHappyPathClientQueries(55);
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'test-secret'));
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.lead_id).toBe(55);
      expect(data.reference).toBe('HLX-LEAD-000055');
      expect(data.status).toBe('QUALIFICATION_PENDING');
      expect(data.duplicate).toBe(false);

      expect(clientQueryMock.mock.calls[0][0]).toBe('BEGIN');
      const consentInsertCall = clientQueryMock.mock.calls[1];
      expect(consentInsertCall[0]).toContain('INSERT INTO consent_records');
      expect(consentInsertCall[1]).toEqual(['2026-11-18-v0.2', 'meta_instant_form', 'One or more approved Spray Foam Removal buyers (installers)']);

      const leadInsertCall = clientQueryMock.mock.calls[2];
      expect(leadInsertCall[0]).toContain('INSERT INTO leads');
      expect(leadInsertCall[0]).toContain('meta_lead_id');
      const qualificationAnswersJson = leadInsertCall[1][6] as string;
      const qualificationAnswers = JSON.parse(qualificationAnswersJson);
      expect(qualificationAnswers.consent_contact).toBe(true);
      expect(qualificationAnswers.consent_share_buyer).toBe(true);
      expect(qualificationAnswers.needs_manual_review).toBe(false);
      expect(qualificationAnswers.lead_intent).toBe('active');

      expect(clientQueryMock.mock.calls[6][0]).toBe('COMMIT');
      expect(releaseMock).toHaveBeenCalledTimes(1);
      expect(attemptSyncMock).toHaveBeenCalledWith(expect.anything(), 7, 'HLX-LEAD-000055', ['row']);
    });

    it('flags a renter for manual review without rejecting the enquiry', async () => {
      mockPreTransactionSql();
      mockHappyPathClientQueries();
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, mapped: { ...VALID_MAPPED, owns_property: false } }, 'test-secret'));

      expect(res.status).toBe(201);
      const leadInsertCall = clientQueryMock.mock.calls[2];
      const qualificationAnswers = JSON.parse(leadInsertCall[1][6] as string);
      expect(qualificationAnswers.needs_manual_review).toBe(true);
      expect(qualificationAnswers.review_reasons).toContain('renter');
    });

    it('flags an out-of-area enquiry for manual review when no ACTIVE buyer covers the postcode', async () => {
      mockPreTransactionSql([{ coverage_type: null, counties_covered: [], postcodes_covered: ['SW2'] }]);
      mockHappyPathClientQueries();
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'test-secret')); // postcode N15 5DF, buyer only covers SW2

      expect(res.status).toBe(201);
      const leadInsertCall = clientQueryMock.mock.calls[2];
      const qualificationAnswers = JSON.parse(leadInsertCall[1][6] as string);
      expect(qualificationAnswers.needs_manual_review).toBe(true);
      expect(qualificationAnswers.review_reasons).toContain('outside_service_area');
    });

    it('classifies a "just researching" reason as lead_intent researching, not active', async () => {
      mockPreTransactionSql();
      mockHappyPathClientQueries();
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, mapped: { ...VALID_MAPPED, reason_for_enquiry: 'Just researching options' } }, 'test-secret'));

      expect(res.status).toBe(201);
      const leadInsertCall = clientQueryMock.mock.calls[2];
      const qualificationAnswers = JSON.parse(leadInsertCall[1][6] as string);
      expect(qualificationAnswers.lead_intent).toBe('researching');
    });
  });

  describe('duplicate submissions (idempotency)', () => {
    it('rolls back and reports a duplicate without creating a new row when ON CONFLICT DO NOTHING matches nothing new', async () => {
      mockPreTransactionSql();
      clientQueryMock
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 3 }] }) // consent_records insert
        .mockResolvedValueOnce({ rows: [] }) // leads insert -- conflict, no row returned
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
      sqlMock.mockResolvedValueOnce([{ id: 55, status: 'RESERVED' }]); // existing lookup, after pre-transaction mocks
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'test-secret'));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.duplicate).toBe(true);
      expect(data.lead_id).toBe(55);
      expect(data.status).toBe('RESERVED');
      expect(clientQueryMock.mock.calls.some((c) => c[0] === 'ROLLBACK')).toBe(true);
      expect(clientQueryMock.mock.calls.some((c) => c[0] === 'COMMIT')).toBe(false);
      expect(releaseMock).toHaveBeenCalledTimes(1);
      expect(attemptSyncMock).not.toHaveBeenCalled();
    });

    it('fails loudly rather than guessing if the conflict row genuinely cannot be found', async () => {
      mockPreTransactionSql();
      clientQueryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      sqlMock.mockResolvedValueOnce([]); // existing lookup finds nothing either
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY, 'test-secret'));

      expect(res.status).toBe(500);
    });
  });

  describe('never allocates, offers, charges or releases', () => {
    it('only ever touches leads, consent_records, audit_log and lead_sheet_syncs -- no lead_allocations, payments or email tables', async () => {
      mockPreTransactionSql();
      mockHappyPathClientQueries();
      const { POST } = await import('./route');

      await POST(req(VALID_BODY, 'test-secret'));

      const allQueries = clientQueryMock.mock.calls.map((c) => JSON.stringify(c)).join('\n');
      expect(allQueries).not.toContain('lead_allocations');
      expect(allQueries).not.toContain('payments');
      expect(allQueries).not.toContain('lead_delivery_emails');
      expect(allQueries).not.toContain('homeowner_confirmations');
    });
  });
});
