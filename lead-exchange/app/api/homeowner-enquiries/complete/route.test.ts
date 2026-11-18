import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../../../lib/industries', () => ({
  HOMEOWNER_CONSENT_CONFIG: {
    spray_foam_removal: {
      consentVersion: '2026-11-18-v0.2',
      source: 'spray_foam_removal_homeowner_form',
      shareBuyerLabel: 'test share-buyer label',
      namedRecipientOrCategory: 'One or more approved Spray Foam Removal buyers (installers)',
    },
  },
}));

const clientQueryMock = vi.fn();
const releaseMock = vi.fn();
vi.mock('@netlify/database', () => ({
  getDatabase: vi.fn(() => ({
    pool: { connect: vi.fn(async () => ({ query: clientQueryMock, release: releaseMock })) },
  })),
}));

let ipCounter = 0;
function req(body: unknown, ip?: string): NextRequest {
  ipCounter += 1;
  return new NextRequest('https://example.com/api/homeowner-enquiries/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip ?? `10.0.0.${ipCounter}` },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  token: 'raw-token-value',
  reason_for_enquiry: 'Selling the property',
  timeframe: 'Within 3 months',
  preferred_contact_method: 'Phone',
  consent_contact: true,
  consent_share_buyer: true,
  privacy_consent: true,
};

// client.query sequence for a successful completion: BEGIN, claim UPDATE, consent insert, leads
// UPDATE, audit_log insert, COMMIT.
function mockHappyPathClientQueries(leadId = 55, consentId = 9) {
  clientQueryMock
    .mockResolvedValueOnce({ rows: [] }) // BEGIN
    .mockResolvedValueOnce({
      rows: [{ id: leadId, qualification_answers: { review_reasons: ['awaiting_qualification'], needs_manual_review: true }, consent_record_id: null }],
    }) // claim UPDATE
    .mockResolvedValueOnce({ rows: [{ id: consentId }] }) // consent_records insert
    .mockResolvedValueOnce({ rows: [] }) // leads UPDATE
    .mockResolvedValueOnce({ rows: [] }) // audit_log insert
    .mockResolvedValueOnce({ rows: [] }); // COMMIT
}

describe('POST /api/homeowner-enquiries/complete', () => {
  beforeEach(() => {
    clientQueryMock.mockReset();
    releaseMock.mockReset();
  });

  describe('validation', () => {
    it('rejects invalid JSON', async () => {
      const { POST } = await import('./route');
      const badReq = new NextRequest('https://example.com/api/homeowner-enquiries/complete', {
        method: 'POST', headers: { 'x-forwarded-for': '10.0.1.1' }, body: '{not json',
      });

      const res = await POST(badReq);

      expect(res.status).toBe(400);
    });

    it('rejects a missing token', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, token: undefined }));

      expect(res.status).toBe(400);
      expect(clientQueryMock).not.toHaveBeenCalled();
    });

    it.each(['reason_for_enquiry', 'timeframe', 'preferred_contact_method'])('rejects a missing %s', async (field) => {
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, [field]: undefined }));

      expect(res.status).toBe(400);
      expect(clientQueryMock).not.toHaveBeenCalled();
    });

    it('rejects when consent_contact is not true', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, consent_contact: false }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/contacted/);
      expect(clientQueryMock).not.toHaveBeenCalled();
    });

    it('rejects when consent_share_buyer is not true', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, consent_share_buyer: false }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/share your details/);
      expect(clientQueryMock).not.toHaveBeenCalled();
    });

    it('rejects when privacy_consent is not true', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, privacy_consent: false }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/Privacy Policy/);
      expect(clientQueryMock).not.toHaveBeenCalled();
    });

    it('rejects a honeypot-triggering submission', async () => {
      const { POST } = await import('./route');

      const res = await POST(req({ ...VALID_BODY, bot_field: 'spam' }));

      expect(res.status).toBe(400);
      expect(clientQueryMock).not.toHaveBeenCalled();
    });
  });

  describe('token handling', () => {
    it('returns 410 for a token that is invalid, expired, or already used, without leaking which', async () => {
      clientQueryMock
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // claim UPDATE matches nothing
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY));
      const data = await res.json();

      expect(res.status).toBe(410);
      // One uniform message mentioning both possibilities, never confirming which one applies.
      expect(data.error).toMatch(/expired or already been used/i);
      expect(clientQueryMock.mock.calls.some((c) => c[0] === 'ROLLBACK')).toBe(true);
      expect(clientQueryMock.mock.calls.some((c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO consent_records'))).toBe(false);
      expect(releaseMock).toHaveBeenCalledTimes(1);
    });

    it('the claim UPDATE only matches a token that is unused and unexpired, using now() in SQL rather than app-side time', async () => {
      clientQueryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const { POST } = await import('./route');

      await POST(req(VALID_BODY));

      const claimCall = clientQueryMock.mock.calls[1];
      expect(claimCall[0]).toContain('follow_up_token_used_at IS NULL');
      expect(claimCall[0]).toContain('follow_up_token_expires_at > now()');
      expect(claimCall[0]).toContain('follow_up_token_used_at = now()');
    });

    it('refuses to complete again if the lead somehow already has a consent_record_id', async () => {
      clientQueryMock
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 55, qualification_answers: {}, consent_record_id: 3 }] }) // claim UPDATE
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY));

      expect(res.status).toBe(409);
      expect(clientQueryMock.mock.calls.some((c) => c[0] === 'ROLLBACK')).toBe(true);
      expect(clientQueryMock.mock.calls.some((c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO consent_records'))).toBe(false);
    });
  });

  describe('successful completion', () => {
    it('creates consent_records, merges qualification answers, sets status to NEW, and invalidates the token', async () => {
      mockHappyPathClientQueries(55, 9);
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.lead_id).toBe(55);
      expect(data.reference).toBe('HLX-LEAD-000055');
      expect(data.status).toBe('NEW');

      const consentInsertCall = clientQueryMock.mock.calls[2];
      expect(consentInsertCall[0]).toContain('INSERT INTO consent_records');
      expect(consentInsertCall[1]).toEqual([
        '2026-11-18-v0.2', 'spray_foam_removal_homeowner_followup',
        'One or more approved Spray Foam Removal buyers (installers)', 55,
      ]);

      const leadsUpdateCall = clientQueryMock.mock.calls[3];
      expect(leadsUpdateCall[0]).toContain("status = 'NEW'");
      const mergedAnswers = JSON.parse(leadsUpdateCall[1][0] as string);
      expect(mergedAnswers.consent_contact).toBe(true);
      expect(mergedAnswers.consent_share_buyer).toBe(true);
      expect(mergedAnswers.privacy_consent).toBe(true);
      expect(mergedAnswers.awaiting_qualification).toBe(false);
      expect(mergedAnswers.missing_qualification_fields).toEqual([]);
      expect(mergedAnswers.review_reasons).not.toContain('awaiting_qualification');
      expect(mergedAnswers.reason_for_enquiry).toBe('Selling the property');
      expect(leadsUpdateCall[1][1]).toBe(9); // consent_record_id
      expect(leadsUpdateCall[1][2]).toBe(55); // lead id

      expect(clientQueryMock.mock.calls[5][0]).toBe('COMMIT');
      expect(releaseMock).toHaveBeenCalledTimes(1);
    });

    it('preserves unrelated review_reasons (e.g. renter, outside_service_area) already on the lead', async () => {
      clientQueryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 60,
            qualification_answers: { review_reasons: ['awaiting_qualification', 'renter'], needs_manual_review: true },
            consent_record_id: null,
          }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 10 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const { POST } = await import('./route');

      const res = await POST(req(VALID_BODY));
      expect(res.status).toBe(200);

      const leadsUpdateCall = clientQueryMock.mock.calls[3];
      const mergedAnswers = JSON.parse(leadsUpdateCall[1][0] as string);
      expect(mergedAnswers.review_reasons).toEqual(['renter']);
      expect(mergedAnswers.needs_manual_review).toBe(true);
    });

    it('defaults marketing_consent to false when not given', async () => {
      mockHappyPathClientQueries();
      const { POST } = await import('./route');

      await POST(req(VALID_BODY));

      const leadsUpdateCall = clientQueryMock.mock.calls[3];
      const mergedAnswers = JSON.parse(leadsUpdateCall[1][0] as string);
      expect(mergedAnswers.marketing_consent).toBe(false);
    });
  });

  describe('rate limiting', () => {
    it('rejects the 6th submission from the same IP within the window', async () => {
      const { POST } = await import('./route');
      const ip = '203.0.113.50';

      for (let i = 0; i < 5; i += 1) {
        mockHappyPathClientQueries();
        // eslint-disable-next-line no-await-in-loop
        const res = await POST(req(VALID_BODY, ip));
        expect(res.status).not.toBe(429);
      }
      // 6th request is blocked before it ever reaches the database.
      const sixth = await POST(req(VALID_BODY, ip));
      expect(sixth.status).toBe(429);
      expect(clientQueryMock).toHaveBeenCalledTimes(30); // 6 calls x 5 successful completions, none for the 6th
    });
  });
});
