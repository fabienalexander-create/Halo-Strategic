import { describe, expect, it } from 'vitest';
import { FOLLOW_UP_TOKEN_TTL_DAYS, buildFollowUpUrl, generateFollowUpToken, hashFollowUpToken } from './metaFollowUpToken';

describe('generateFollowUpToken', () => {
  it('generates a URL-safe raw token with no characters that need escaping in a query string', () => {
    const { rawToken } = generateFollowUpToken();
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(rawToken.length).toBeGreaterThan(32); // 256 bits of randomness, base64url-encoded
  });

  it('never generates the same raw token twice', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      seen.add(generateFollowUpToken().rawToken);
    }
    expect(seen.size).toBe(50);
  });

  it('stores a hash, never the raw token itself, and the hash matches hashFollowUpToken(rawToken)', () => {
    const { rawToken, tokenHash } = generateFollowUpToken();
    expect(tokenHash).not.toBe(rawToken);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex digest
    expect(tokenHash).toBe(hashFollowUpToken(rawToken));
  });

  it('sets expiry FOLLOW_UP_TOKEN_TTL_DAYS days after the given "now"', () => {
    const now = new Date('2026-11-18T12:00:00Z');
    const { expiresAt } = generateFollowUpToken(now);
    const expectedMs = now.getTime() + FOLLOW_UP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBe(expectedMs);
  });
});

describe('hashFollowUpToken', () => {
  it('is deterministic -- the same raw token always hashes the same way', () => {
    expect(hashFollowUpToken('same-input')).toBe(hashFollowUpToken('same-input'));
  });

  it('different raw tokens hash differently', () => {
    expect(hashFollowUpToken('token-a')).not.toBe(hashFollowUpToken('token-b'));
  });
});

describe('buildFollowUpUrl', () => {
  it('embeds the raw token as a query parameter on the website completion page', () => {
    const url = buildFollowUpUrl('abc123');
    expect(url).toBe('https://halostrategic.com/leads-exchange/spray-foam-removal/complete?token=abc123');
  });
});
