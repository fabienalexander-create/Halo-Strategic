import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const recordUnsubscribeMock = vi.fn();
vi.mock('../../../../lib/prospectUnsubscribe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../lib/prospectUnsubscribe')>();
  return { ...actual, recordUnsubscribe: recordUnsubscribeMock };
});

vi.mock('@netlify/database', () => ({
  getDatabase: vi.fn(() => ({ sql: vi.fn() })),
}));

const VALID_TOKEN = 'a'.repeat(64);

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('https://example.com/api/buyer-prospects/unsubscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function oneClickRequest(token: string): NextRequest {
  return new NextRequest(`https://example.com/api/buyer-prospects/unsubscribe?token=${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click',
  });
}

describe('POST /api/buyer-prospects/unsubscribe', () => {
  beforeEach(() => {
    recordUnsubscribeMock.mockReset();
  });

  it('rejects a missing scope', async () => {
    const { POST } = await import('./route');
    const res = await POST(jsonRequest({ token: VALID_TOKEN }));
    expect(res.status).toBe(400);
    expect(recordUnsubscribeMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid scope', async () => {
    const { POST } = await import('./route');
    const res = await POST(jsonRequest({ token: VALID_TOKEN, scope: 'everything' }));
    expect(res.status).toBe(400);
  });

  it('rejects a missing token', async () => {
    const { POST } = await import('./route');
    const res = await POST(jsonRequest({ scope: 'intro' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 with a generic message for an unknown token', async () => {
    recordUnsubscribeMock.mockResolvedValue({ found: false });
    const { POST } = await import('./route');

    const res = await POST(jsonRequest({ token: VALID_TOKEN, scope: 'intro' }));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('This link is invalid or has expired.');
  });

  it('applies scope=intro and returns 200', async () => {
    recordUnsubscribeMock.mockResolvedValue({ found: true, scope: 'intro', alreadyApplied: false });
    const { POST } = await import('./route');

    const res = await POST(jsonRequest({ token: VALID_TOKEN, scope: 'intro' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ scope: 'intro', alreadyApplied: false });
    expect(recordUnsubscribeMock).toHaveBeenCalledWith(expect.anything(), VALID_TOKEN, 'intro', 'link');
  });

  it('a repeated unsubscribe is idempotent (200, alreadyApplied true), never an error', async () => {
    recordUnsubscribeMock.mockResolvedValue({ found: true, scope: 'intro', alreadyApplied: true });
    const { POST } = await import('./route');

    const res = await POST(jsonRequest({ token: VALID_TOKEN, scope: 'intro' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.alreadyApplied).toBe(true);
  });

  it('an RFC 8058 one-click request is treated as scope=intro, reading the token from the URL', async () => {
    recordUnsubscribeMock.mockResolvedValue({ found: true, scope: 'intro', alreadyApplied: false });
    const { POST } = await import('./route');

    const res = await POST(oneClickRequest(VALID_TOKEN));

    expect(res.status).toBe(200);
    expect(recordUnsubscribeMock).toHaveBeenCalledWith(expect.anything(), VALID_TOKEN, 'intro', 'one_click');
  });

  it('a one-click request never applies scope=marketing or scope=all', async () => {
    recordUnsubscribeMock.mockResolvedValue({ found: true, scope: 'intro', alreadyApplied: false });
    const { POST } = await import('./route');

    await POST(oneClickRequest(VALID_TOKEN));

    expect(recordUnsubscribeMock).toHaveBeenCalledWith(expect.anything(), VALID_TOKEN, 'intro', 'one_click');
    expect(recordUnsubscribeMock).not.toHaveBeenCalledWith(expect.anything(), VALID_TOKEN, 'marketing', expect.anything());
    expect(recordUnsubscribeMock).not.toHaveBeenCalledWith(expect.anything(), VALID_TOKEN, 'all', expect.anything());
  });
});
