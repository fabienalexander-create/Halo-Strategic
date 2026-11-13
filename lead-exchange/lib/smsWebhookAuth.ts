import { createHash, timingSafeEqual } from 'crypto';

// Constant-time comparison of a presented shared secret with the configured one. Both sides are
// hashed first so differing lengths cannot be told apart by timing.
export function secretMatches(presented: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || !presented) return false;
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
