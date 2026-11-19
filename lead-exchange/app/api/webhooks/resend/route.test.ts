import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyMock = vi.fn();
vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({ verify: verifyMock })),
}));

const applyOutboxEventMock = vi.fn();
vi.mock('../../../../lib/emailEvents', () => ({
  applyResendEventToOutboxes: applyOutboxEventMock,
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
    applyOutboxEventMock.mockReset();
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
    expect(applyOutboxEventMock).not.toHaveBeenCalled();
  });

  it('email.delivered marks the buyer outboxes and buyer_prospect_emails', async () => {
    verifyMock.mockReturnValue({ type: 'email.delivered', data: { email_id: 'msg_1' } });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ type: 'email.delivered', data: { email_id: 'msg_1' } }));

    expect(res.status).toBe(200);
    expect(applyOutboxEventMock).toHaveBeenCalledWith(expect.anything(), 'email.delivered', 'msg_1', { reason: null });
    expect(markProspectEmailDeliveredMock).toHaveBeenCalledWith(expect.anything(), 'msg_1');
    expect(markProspectEmailBouncedMock).not.toHaveBeenCalled();
    expect(markProspectEmailComplainedMock).not.toHaveBeenCalled();
  });

  it('email.bounced suppresses the prospect and records the bounce, with its reason, on the buyer outboxes', async () => {
    verifyMock.mockReturnValue({ type: 'email.bounced', data: { email_id: 'msg_2', bounce: { message: 'Mailbox does not exist' } } });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ type: 'email.bounced', data: { email_id: 'msg_2' } }));

    expect(res.status).toBe(200);
    expect(markProspectEmailBouncedMock).toHaveBeenCalledWith(expect.anything(), 'msg_2');
    expect(applyOutboxEventMock).toHaveBeenCalledWith(expect.anything(), 'email.bounced', 'msg_2', { reason: 'Mailbox does not exist' });
    expect(markProspectEmailDeliveredMock).not.toHaveBeenCalled();
  });

  it('email.complained suppresses the prospect', async () => {
    verifyMock.mockReturnValue({ type: 'email.complained', data: { email_id: 'msg_3' } });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ type: 'email.complained', data: { email_id: 'msg_3' } }));

    expect(res.status).toBe(200);
    expect(markProspectEmailComplainedMock).toHaveBeenCalledWith(expect.anything(), 'msg_3');
  });

  it('an unrelated event type is only recorded as the last event; no prospect is marked', async () => {
    verifyMock.mockReturnValue({ type: 'email.opened', data: { email_id: 'msg_4' } });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ type: 'email.opened', data: { email_id: 'msg_4' } }));

    expect(res.status).toBe(200);
    expect(applyOutboxEventMock).toHaveBeenCalledWith(expect.anything(), 'email.opened', 'msg_4', { reason: null });
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

  it('email.failed passes the Resend reason to the buyer outboxes', async () => {
    verifyMock.mockReturnValue({ type: 'email.failed', data: { email_id: 'msg_5', failed: { reason: 'Rejected' } } });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ type: 'email.failed', data: { email_id: 'msg_5' } }));

    expect(res.status).toBe(200);
    expect(applyOutboxEventMock).toHaveBeenCalledWith(expect.anything(), 'email.failed', 'msg_5', { reason: 'Rejected' });
  });
});
