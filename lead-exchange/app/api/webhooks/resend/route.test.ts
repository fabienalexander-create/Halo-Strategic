import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyMock = vi.fn();
vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({ verify: verifyMock })),
}));

const markDeliveredMock = vi.fn();
vi.mock('../../../../lib/email', () => ({
  markDelivered: markDeliveredMock,
}));

const markProspectEmailDeliveredMock = vi.fn();
const markProspectEmailBouncedMock = vi.fn();
const markProspectEmailComplainedMock = vi.fn();
vi.mock('../../../../lib/buyerProspectEmail', () => ({
  markProspectEmailDelivered: markProspectEmailDeliveredMock,
  markProspectEmailBounced: markProspectEmailBouncedMock,
  markProspectEmailComplained: markProspectEmailComplainedMock,
}));

vi.mock('@netlify/database', () => ({
  getDatabase: vi.fn(() => ({ sql: vi.fn() })),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('https://example.com/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'svix-id': 'id_1',
      'svix-timestamp': '123',
      'svix-signature': 'sig_1',
    },
    body: JSON.stringify(body),
  });
}

describe('Resend webhook', () => {
  beforeEach(() => {
    verifyMock.mockReset();
    markDeliveredMock.mockReset();
    markProspectEmailDeliveredMock.mockReset();
    markProspectEmailBouncedMock.mockReset();
    markProspectEmailComplainedMock.mockReset();
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';
  });

  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  it('returns 501 without contacting anything if RESEND_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ type: 'email.delivered', data: { email_id: 'msg_1' } }));

    expect(res.status).toBe(501);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('rejects a request with an invalid signature', async () => {
    verifyMock.mockImplementation(() => { throw new Error('bad signature'); });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ type: 'email.delivered', data: { email_id: 'msg_1' } }));

    expect(res.status).toBe(400);
    expect(markDeliveredMock).not.toHaveBeenCalled();
  });

  it('email.delivered marks both transactional_emails and buyer_prospect_emails', async () => {
    verifyMock.mockReturnValue({ type: 'email.delivered', data: { email_id: 'msg_1' } });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ type: 'email.delivered', data: { email_id: 'msg_1' } }));

    expect(res.status).toBe(200);
    expect(markDeliveredMock).toHaveBeenCalledWith(expect.anything(), 'msg_1');
    expect(markProspectEmailDeliveredMock).toHaveBeenCalledWith(expect.anything(), 'msg_1');
    expect(markProspectEmailBouncedMock).not.toHaveBeenCalled();
    expect(markProspectEmailComplainedMock).not.toHaveBeenCalled();
  });

  it('email.bounced suppresses the prospect, and does not touch transactional_emails delivery tracking', async () => {
    verifyMock.mockReturnValue({ type: 'email.bounced', data: { email_id: 'msg_2' } });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ type: 'email.bounced', data: { email_id: 'msg_2' } }));

    expect(res.status).toBe(200);
    expect(markProspectEmailBouncedMock).toHaveBeenCalledWith(expect.anything(), 'msg_2');
    expect(markDeliveredMock).not.toHaveBeenCalled();
    expect(markProspectEmailDeliveredMock).not.toHaveBeenCalled();
  });

  it('email.complained suppresses the prospect', async () => {
    verifyMock.mockReturnValue({ type: 'email.complained', data: { email_id: 'msg_3' } });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ type: 'email.complained', data: { email_id: 'msg_3' } }));

    expect(res.status).toBe(200);
    expect(markProspectEmailComplainedMock).toHaveBeenCalledWith(expect.anything(), 'msg_3');
  });

  it('an unrelated event type is acknowledged but nothing is marked', async () => {
    verifyMock.mockReturnValue({ type: 'email.opened', data: { email_id: 'msg_4' } });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ type: 'email.opened', data: { email_id: 'msg_4' } }));

    expect(res.status).toBe(200);
    expect(markDeliveredMock).not.toHaveBeenCalled();
    expect(markProspectEmailDeliveredMock).not.toHaveBeenCalled();
    expect(markProspectEmailBouncedMock).not.toHaveBeenCalled();
    expect(markProspectEmailComplainedMock).not.toHaveBeenCalled();
  });

  it('repeated delivery of the same event is idempotent at the route level (calls through each time; the underlying guarded UPDATEs make repeats harmless)', async () => {
    verifyMock.mockReturnValue({ type: 'email.delivered', data: { email_id: 'msg_1' } });
    const { POST } = await import('./route');

    await POST(makeRequest({ type: 'email.delivered', data: { email_id: 'msg_1' } }));
    await POST(makeRequest({ type: 'email.delivered', data: { email_id: 'msg_1' } }));

    expect(markProspectEmailDeliveredMock).toHaveBeenCalledTimes(2);
  });
});
