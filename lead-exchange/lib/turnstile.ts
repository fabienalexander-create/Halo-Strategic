export interface TurnstileResult {
  ok: boolean;
  reason?: 'not_configured' | 'missing_token' | 'invalid_token' | 'verification_unavailable';
}

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile token server-side. Deliberately soft-disabled until Fabien
 * configures TURNSTILE_SECRET_KEY: with no secret configured, this returns ok:true without making
 * any network call, so the form keeps working exactly as it does today (honeypot + rate limiting
 * only) right up until real credentials are supplied -- per his explicit instruction not to enable
 * production enforcement before then. Once a secret is configured, a missing or invalid token is a
 * hard refusal (400 from the caller).
 *
 * If Cloudflare's own verification endpoint is unreachable or errors, this fails OPEN (allows the
 * submission through) rather than blocking real applicants over a third-party outage -- consistent
 * with how this codebase already treats other non-critical external dependencies (e.g. Google
 * Sheets sync failures never block the underlying lead). This is a deliberate choice, logged
 * clearly, not a silent gap.
 */
export async function verifyTurnstileToken(token: string | undefined | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: true, reason: 'not_configured' };
  }
  if (!token) {
    return { ok: false, reason: 'missing_token' };
  }

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    if (!res.ok) {
      console.error(`Turnstile verification endpoint returned ${res.status}; allowing the submission through (fail-open).`);
      return { ok: true, reason: 'verification_unavailable' };
    }
    const data = (await res.json()) as { success?: boolean };
    if (data.success === true) {
      return { ok: true };
    }
    return { ok: false, reason: 'invalid_token' };
  } catch (err) {
    console.error('Turnstile verification request failed; allowing the submission through (fail-open).', err);
    return { ok: true, reason: 'verification_unavailable' };
  }
}
