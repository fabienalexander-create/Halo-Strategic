import { createHmac } from 'crypto';

export interface MakeOutResult {
  providerId: string | null;
  error: string | null;
}

/**
 * Posts one outbound SMS to the Make "SMS out" webhook, HMAC-signed over `${timestamp}.${body}`.
 * Shared by every outbound SMS outbox (phone verification, Meta follow-up). Never logs the payload.
 */
export async function postSmsToMake(
  url: string,
  secret: string,
  payload: Record<string, unknown>,
  doFetch: typeof fetch
): Promise<MakeOutResult> {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-halo-timestamp': timestamp, 'x-halo-signature': signature },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { providerId: null, error: `Make returned ${res.status}` };
    try {
      const json = (await res.json()) as { message_id?: unknown };
      if (typeof json.message_id === 'string' || typeof json.message_id === 'number') {
        return { providerId: String(json.message_id).slice(0, 200), error: null };
      }
    } catch { /* a body without JSON is fine; delivery receipts can still match later */ }
    return { providerId: null, error: null };
  } catch (err) {
    return { providerId: null, error: err instanceof Error ? err.name : 'send failed' };
  }
}
