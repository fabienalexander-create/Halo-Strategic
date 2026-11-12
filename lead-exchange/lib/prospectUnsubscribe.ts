import type { SqlDb } from './buyerProspectEmail';

export type UnsubscribeScope = 'intro' | 'marketing' | 'all';

export interface UnsubscribeResult {
  found: boolean;
  scope?: UnsubscribeScope;
  alreadyApplied?: boolean;
}

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function isValidTokenFormat(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

/**
 * Records an unsubscribe request against a prospect identified only by their opaque token -- never
 * by id or email in the request itself. The two permissions are kept structurally separate here,
 * matching Fabien's explicit requirement:
 *
 * - 'intro' stops the bounded five-email introductory/registration sequence (nurture_status =
 *   'UNSUBSCRIBED'), which the suppression check in lib/buyerProspectEmail.ts and the database
 *   trigger both honour. It does NOT touch marketing_consent.
 * - 'marketing' withdraws optional ongoing marketing consent only (marketing_unsubscribed_at,
 *   marketing_consent = false). It does NOT touch nurture_status, and must never stop the
 *   introductory sequence.
 * - 'all' does both, independently, in the same statement.
 *
 * Idempotent: calling this again for an already-applied scope is a harmless no-op, reported back
 * as alreadyApplied rather than as an error -- a person clicking an old unsubscribe link twice (or
 * a mail client retrying a webhook-style request) must never see a failure.
 */
export async function recordUnsubscribe(db: SqlDb, token: string, scope: UnsubscribeScope): Promise<UnsubscribeResult> {
  if (!isValidTokenFormat(token)) {
    return { found: false };
  }

  const rows = await db.sql`
    SELECT id, nurture_status, marketing_consent FROM buyer_prospects WHERE unsubscribe_token = ${token}
  `;
  if (rows.length === 0) {
    return { found: false };
  }
  const row = rows[0] as { id: number; nurture_status: string; marketing_consent: boolean };

  const introAlready = row.nurture_status === 'UNSUBSCRIBED';
  const marketingAlready = row.marketing_consent === false;

  if (scope === 'intro' || scope === 'all') {
    await db.sql`
      UPDATE buyer_prospects
      SET nurture_status = 'UNSUBSCRIBED', nurture_unsubscribed_at = COALESCE(nurture_unsubscribed_at, now())
      WHERE id = ${row.id} AND nurture_status != 'UNSUBSCRIBED'
    `;
  }
  if (scope === 'marketing' || scope === 'all') {
    await db.sql`
      UPDATE buyer_prospects
      SET marketing_consent = false, marketing_unsubscribed_at = COALESCE(marketing_unsubscribed_at, now())
      WHERE id = ${row.id} AND marketing_consent = true
    `;
  }

  const alreadyApplied =
    scope === 'intro' ? introAlready : scope === 'marketing' ? marketingAlready : introAlready && marketingAlready;

  return { found: true, scope, alreadyApplied };
}
