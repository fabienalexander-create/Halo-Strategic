import { createHash, randomBytes } from 'crypto';

// Supports the website follow-up journey for an incomplete Meta-sourced lead (see
// app/api/integrations/meta-homeowner-leads/route.ts and app/api/homeowner-enquiries/complete/
// route.ts). A token is cryptographically random, single-use and time-limited; only its hash is
// ever stored (netlify/database/migrations/20261118130000_meta_followup_token.sql) -- the raw
// value exists only in the URL handed to whoever will send it to the homeowner, and briefly in
// the completion request itself.
//
// 30 days is long enough for a homeowner to actually respond, short enough to bound how long a
// leaked link (e.g. from an email/SMS provider's own logs, once sending is wired up) stays live.
export const FOLLOW_UP_TOKEN_TTL_DAYS = 30;

export interface FollowUpToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

// 256 bits of randomness, URL-safe (base64url -- no padding, no characters that need escaping in
// a query string). Hashed with plain SHA-256, not a slow password hash: the token itself already
// carries 256 bits of entropy, so there is no offline-guessing risk to slow down, only an at-rest
// value to avoid storing in recoverable form.
export function generateFollowUpToken(now: Date = new Date()): FollowUpToken {
  const rawToken = randomBytes(32).toString('base64url');
  return {
    rawToken,
    tokenHash: hashFollowUpToken(rawToken),
    expiresAt: new Date(now.getTime() + FOLLOW_UP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}

export function hashFollowUpToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function buildFollowUpUrl(rawToken: string): string {
  return `https://halostrategic.com/leads-exchange/spray-foam-removal/complete?token=${rawToken}`;
}
