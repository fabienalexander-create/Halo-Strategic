import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

describe('verifyTurnstileToken', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.unstubAllGlobals();
  });

  it('is soft-disabled (ok, no network call) when TURNSTILE_SECRET_KEY is not configured', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const { verifyTurnstileToken } = await import('./turnstile');

    const result = await verifyTurnstileToken('some-token');

    expect(result).toEqual({ ok: true, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a missing token once a secret is configured, without calling Cloudflare', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    const { verifyTurnstileToken } = await import('./turnstile');

    const result = await verifyTurnstileToken(undefined);

    expect(result).toEqual({ ok: false, reason: 'missing_token' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a valid token', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const { verifyTurnstileToken } = await import('./turnstile');

    const result = await verifyTurnstileToken('good-token');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses an invalid token', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) });
    const { verifyTurnstileToken } = await import('./turnstile');

    const result = await verifyTurnstileToken('bad-token');

    expect(result).toEqual({ ok: false, reason: 'invalid_token' });
  });

  it('fails open when Cloudflare returns a non-2xx response', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const { verifyTurnstileToken } = await import('./turnstile');

    const result = await verifyTurnstileToken('some-token');

    expect(result).toEqual({ ok: true, reason: 'verification_unavailable' });
  });

  it('fails open when the verification request throws (network error)', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    fetchMock.mockRejectedValue(new Error('network down'));
    const { verifyTurnstileToken } = await import('./turnstile');

    const result = await verifyTurnstileToken('some-token');

    expect(result).toEqual({ ok: true, reason: 'verification_unavailable' });
  });
});
