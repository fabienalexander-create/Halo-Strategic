import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminMock = vi.fn();
vi.mock('../../../../../../lib/requireAdmin', () => ({ requireAdmin: requireAdminMock }));
const attemptSendMock = vi.fn();
vi.mock('../../../../../../lib/email', () => ({ attemptSend: attemptSendMock }));
const sqlMock = vi.fn();
vi.mock('@netlify/database', () => ({ getDatabase: vi.fn(() => ({ sql: sqlMock })) }));

const ROW = {
  id: 5, status: 'FAILED', contact_name: 'Russell Griffiths', company_name: 'Shared Buyer Ltd',
  application_reference: 'HLX-BYR-000004', industry_slug: 'spray_foam_removal',
};

function req(body?: unknown): NextRequest {
  return new NextRequest('https://example.com/api/admin/transactional-emails/5/retry', {
    method: 'POST', body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('POST /api/admin/transactional-emails/[id]/retry', () => {
  beforeEach(() => {
    requireAdminMock.mockReset().mockResolvedValue({ session: { adminId: 1, email: 'admin@halostrategic.com', role: 'owner' } });
    attemptSendMock.mockReset().mockResolvedValue({ sent: true, skipped: false });
    sqlMock.mockReset();
  });

  it('retries ADMIN_NEW_APPLICATION with the admin template, not the applicant approval text (bug fixed 2026-11-19)', async () => {
    sqlMock.mockResolvedValueOnce([{ ...ROW, email_type: 'ADMIN_NEW_APPLICATION' }]);
    const { POST } = await import('./route');

    const res = await POST(req(), { params: { id: '5' } });

    expect(res.status).toBe(200);
    const content = attemptSendMock.mock.calls[0][2];
    expect(content.subject).toBe('New Spray Foam Removal buyer application: Shared Buyer Ltd');
    expect(content.text).toContain('HLX-BYR-000004');
    expect(content.text).not.toMatch(/approved/i);
  });

  it('retries the two applicant emails with their own templates', async () => {
    const { POST } = await import('./route');
    sqlMock.mockResolvedValueOnce([{ ...ROW, email_type: 'APPLICATION_RECEIVED' }]);
    await POST(req(), { params: { id: '5' } });
    sqlMock.mockResolvedValueOnce([{ ...ROW, email_type: 'APPLICATION_APPROVED_FOR_COMMERCIAL_REVIEW' }]);
    await POST(req(), { params: { id: '5' } });

    const [received, approved] = attemptSendMock.mock.calls.map((c) => c[2].subject);
    expect(received).not.toBe(approved);
  });

  it('refuses an unrecognised email type instead of sending a guessed template', async () => {
    sqlMock.mockResolvedValueOnce([{ ...ROW, email_type: 'SOMETHING_NEW' }]);
    const { POST } = await import('./route');

    const res = await POST(req(), { params: { id: '5' } });

    expect(res.status).toBe(422);
    expect(attemptSendMock).not.toHaveBeenCalled();
  });

  it('refuses a superseded email', async () => {
    sqlMock.mockResolvedValueOnce([{ ...ROW, email_type: 'APPLICATION_RECEIVED', status: 'SUPERSEDED' }]);
    const { POST } = await import('./route');

    const res = await POST(req(), { params: { id: '5' } });

    expect(res.status).toBe(409);
    expect(attemptSendMock).not.toHaveBeenCalled();
  });

  it('refuses a bounced email', async () => {
    sqlMock.mockResolvedValueOnce([{ ...ROW, email_type: 'APPLICATION_RECEIVED', status: 'BOUNCED' }]);
    const { POST } = await import('./route');

    expect((await POST(req(), { params: { id: '5' } })).status).toBe(409);
    expect(attemptSendMock).not.toHaveBeenCalled();
  });

  it('passes an admin confirmation through only when explicitly given', async () => {
    const { POST } = await import('./route');
    sqlMock.mockResolvedValueOnce([{ ...ROW, email_type: 'APPLICATION_RECEIVED' }]);
    await POST(req(), { params: { id: '5' } });
    sqlMock.mockResolvedValueOnce([{ ...ROW, email_type: 'APPLICATION_RECEIVED' }]);
    await POST(req({ confirmed_not_received: true }), { params: { id: '5' } });

    expect(attemptSendMock.mock.calls[0][3]).toEqual({ confirmedNotReceived: false });
    expect(attemptSendMock.mock.calls[1][3]).toEqual({ confirmedNotReceived: true });
  });

  it('answers 409 when an earlier attempt may already have arrived', async () => {
    attemptSendMock.mockResolvedValueOnce({ sent: false, skipped: false, outcomeUnknown: true, error: 'check first' });
    sqlMock.mockResolvedValueOnce([{ ...ROW, email_type: 'APPLICATION_RECEIVED' }]);
    const { POST } = await import('./route');

    expect((await POST(req(), { params: { id: '5' } })).status).toBe(409);
  });
});
