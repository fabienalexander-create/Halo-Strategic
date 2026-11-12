import type { SqlDb } from './buyerProspectEmail';

export type UnsubscribeScope = 'intro' | 'marketing' | 'all';
export type UnsubscribeMethod = 'link' | 'one_click';

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
 * Stops the bounded five-email introductory sequence. One statement, atomic: a CTE locks the row
 * (FOR UPDATE), only proceeds if it isn't already unsubscribed, captures the genuine prior state
 * before mutating anything, updates nurture_status, and inserts the audit_log entry -- all in the
 * same statement, so the state change and its audit record can never diverge (one succeeds only if
 * the other does too). If the WHERE clause doesn't match (already unsubscribed, or concurrently
 * unsubscribed by another request that got there first under the row lock), every CTE arm is empty
 * and this is a safe, silent no-op: zero rows updated, zero audit entries written. That's what makes
 * a repeated click, or two concurrent requests for the same prospect, idempotent -- not a duplicate
 * marked as a dup, but genuinely nothing happening twice.
 */
async function applyIntroUnsubscribe(db: SqlDb, prospectId: number, method: UnsubscribeMethod): Promise<{ applied: boolean }> {
  const result = await db.sql`
    WITH prev AS (
      SELECT id, nurture_status, prospect_reference
      FROM buyer_prospects
      WHERE id = ${prospectId} AND nurture_status != 'UNSUBSCRIBED'
      FOR UPDATE
    ), updated AS (
      UPDATE buyer_prospects
      SET nurture_status = 'UNSUBSCRIBED', nurture_unsubscribed_at = now()
      FROM prev WHERE buyer_prospects.id = prev.id
      RETURNING buyer_prospects.id
    ), logged AS (
      INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
      SELECT prev.prospect_reference, 'BUYER_PROSPECT_UNSUBSCRIBED_INTRO', 'buyer_prospect', prev.id,
        jsonb_build_object('nurture_status', prev.nurture_status),
        jsonb_build_object('nurture_status', 'UNSUBSCRIBED', 'method', ${method}::text)
      FROM prev
      RETURNING id
    )
    SELECT (SELECT count(*) FROM updated) AS updated, (SELECT count(*) FROM logged) AS logged
  `;
  const row = result[0] as { updated: number | string; logged: number | string };
  return { applied: Number(row.updated) === 1 };
}

/**
 * Withdraws optional ongoing marketing consent only. Same single-statement, atomic, idempotent
 * shape as applyIntroUnsubscribe above -- deliberately a separate function, not a shared helper
 * with a parameter, so the two permissions can never accidentally be merged into one code path.
 * Never touches nurture_status.
 */
async function applyMarketingUnsubscribe(db: SqlDb, prospectId: number): Promise<{ applied: boolean }> {
  const result = await db.sql`
    WITH prev AS (
      SELECT id, marketing_consent, prospect_reference
      FROM buyer_prospects
      WHERE id = ${prospectId} AND marketing_consent = true
      FOR UPDATE
    ), updated AS (
      UPDATE buyer_prospects
      SET marketing_consent = false, marketing_unsubscribed_at = now()
      FROM prev WHERE buyer_prospects.id = prev.id
      RETURNING buyer_prospects.id
    ), logged AS (
      INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
      SELECT prev.prospect_reference, 'BUYER_PROSPECT_UNSUBSCRIBED_MARKETING', 'buyer_prospect', prev.id,
        jsonb_build_object('marketing_consent', prev.marketing_consent),
        jsonb_build_object('marketing_consent', false)
      FROM prev
      RETURNING id
    )
    SELECT (SELECT count(*) FROM updated) AS updated, (SELECT count(*) FROM logged) AS logged
  `;
  const row = result[0] as { updated: number | string; logged: number | string };
  return { applied: Number(row.updated) === 1 };
}

/**
 * Records an unsubscribe request against a prospect identified only by their opaque token -- never
 * by id or email in the request itself. The two permissions are kept structurally separate here,
 * matching Fabien's explicit requirement:
 *
 * - 'intro' stops the bounded five-email introductory/registration sequence. Does NOT touch
 *   marketing_consent.
 * - 'marketing' withdraws optional ongoing marketing consent only. Does NOT touch nurture_status,
 *   and must never stop the introductory sequence.
 * - 'all' applies both, as two independent atomic operations -- not merged into one combined
 *   transaction, since treating them as genuinely separate permissions (per Fabien's instruction)
 *   means one succeeding or failing should never depend on the other.
 *
 * Idempotent: calling this again for an already-applied scope is a harmless no-op, reported back as
 * alreadyApplied rather than as an error. Every audit_log entry this writes corresponds to a real
 * state transition that actually happened in this call -- a repeat produces no additional entries.
 */
export async function recordUnsubscribe(
  db: SqlDb,
  token: string,
  scope: UnsubscribeScope,
  method: UnsubscribeMethod = 'link'
): Promise<UnsubscribeResult> {
  if (!isValidTokenFormat(token)) {
    return { found: false };
  }

  // Read-only lookup, no side effects -- just to give a clean 404 for a token that doesn't exist at
  // all, before attempting any state change.
  const rows = await db.sql`SELECT id FROM buyer_prospects WHERE unsubscribe_token = ${token}`;
  if (rows.length === 0) {
    return { found: false };
  }
  const prospectId = (rows[0] as { id: number }).id;

  let introApplied = false;
  let marketingApplied = false;
  if (scope === 'intro' || scope === 'all') {
    introApplied = (await applyIntroUnsubscribe(db, prospectId, method)).applied;
  }
  if (scope === 'marketing' || scope === 'all') {
    marketingApplied = (await applyMarketingUnsubscribe(db, prospectId)).applied;
  }

  const alreadyApplied =
    scope === 'intro' ? !introApplied : scope === 'marketing' ? !marketingApplied : !introApplied && !marketingApplied;

  return { found: true, scope, alreadyApplied };
}
