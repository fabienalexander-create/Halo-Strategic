export type SalesStage = 'NEW' | 'CONTACT_AUTHORISED' | 'CONTACTED' | 'RESPONDED' | 'QUALIFIED' | 'CALL_COMPLETED' | 'PACKAGE_AGREED';
export type SalesActivityType =
  | 'STAGE_CHANGE' | 'EMAIL_SENT' | 'SMS_SENT' | 'RESPONSE_RECEIVED'
  | 'CALL_ATTEMPTED' | 'CALL_COMPLETED' | 'QUALIFICATION_NOTE' | 'FOLLOW_UP_SCHEDULED';

// Forward-only, one step at a time -- enforced here for a clear error message; the database
// trigger (trg_buyer_prospects_guard_sales_stage) is the real backstop, and only enforces the
// one rule that actually matters for lawfulness: no stage past NEW without authorisation.
const STAGE_ORDER: SalesStage[] = ['NEW', 'CONTACT_AUTHORISED', 'CONTACTED', 'RESPONDED', 'QUALIFIED', 'CALL_COMPLETED', 'PACKAGE_AGREED'];

export interface RecordSalesActivityParams {
  prospectId: number;
  activityType: SalesActivityType;
  recordedBy: string;
  note?: string;
  // Only meaningful for activityType === 'STAGE_CHANGE'.
  newStage?: SalesStage;
  // Required when newStage === 'CONTACT_AUTHORISED'. This is the actual, human-written record of
  // why contacting this person is lawful -- never a boolean, never inferred.
  authorisationBasis?: string;
  // Required when newStage === 'PACKAGE_AGREED'.
  agreedPackageDefinitionId?: number;
  nextFollowUpAt?: Date | null;
}

export interface SalesActivityResult {
  activityId: number;
  prospectId: number;
  stage: SalesStage;
}

interface NetlifyDb {
  pool: { connect(): Promise<PgClient> };
}
interface PgClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
}

export class SalesPipelineError extends Error {}

/**
 * The single write path for the sales pipeline, mirroring lib/buyerProspectCapture.ts: one
 * atomic transaction that updates buyer_prospects (if this activity changes its state) and
 * inserts exactly one buyer_prospect_sales_activity row, together or not at all.
 *
 * Deliberately does NOT infer or default personal_contact_authorised_at -- moving to
 * CONTACT_AUTHORISED always requires an explicit authorisationBasis string from the caller, and
 * the database trigger refuses any later stage if authorisation was never actually set. This
 * function cannot be used to route around that; it only ever writes what it's explicitly told.
 */
export async function recordSalesActivity(
  db: NetlifyDb,
  p: RecordSalesActivityParams
): Promise<SalesActivityResult> {
  if (p.activityType === 'STAGE_CHANGE') {
    if (!p.newStage) throw new SalesPipelineError('newStage is required for a STAGE_CHANGE activity');
    if (p.newStage === 'CONTACT_AUTHORISED' && !p.authorisationBasis?.trim()) {
      throw new SalesPipelineError('authorisationBasis is required when moving to CONTACT_AUTHORISED -- it must never be inferred');
    }
    if (p.newStage === 'PACKAGE_AGREED' && !p.agreedPackageDefinitionId) {
      throw new SalesPipelineError('agreedPackageDefinitionId is required when moving to PACKAGE_AGREED');
    }
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const prospectRows = await client.query(
      `SELECT id, sales_stage, personal_contact_authorised_at FROM buyer_prospects WHERE id = $1 FOR UPDATE`,
      [p.prospectId]
    );
    if (prospectRows.rows.length === 0) {
      throw new SalesPipelineError(`No such prospect: ${p.prospectId}`);
    }
    const current = prospectRows.rows[0];
    const previousStage = current.sales_stage as SalesStage;

    let newStageToWrite: SalesStage = previousStage;

    if (p.activityType === 'STAGE_CHANGE' && p.newStage) {
      const fromIndex = STAGE_ORDER.indexOf(previousStage);
      const toIndex = STAGE_ORDER.indexOf(p.newStage);
      if (toIndex !== fromIndex + 1) {
        throw new SalesPipelineError(
          `Cannot move prospect ${p.prospectId} from ${previousStage} to ${p.newStage} -- stages advance one step at a time`
        );
      }
      newStageToWrite = p.newStage;

      const setClauses: string[] = ['sales_stage = $1'];
      const values: unknown[] = [newStageToWrite];
      let idx = 2;

      if (p.newStage === 'CONTACT_AUTHORISED') {
        setClauses.push(`personal_contact_authorised_at = now()`, `personal_contact_authorised_by = $${idx++}`, `contact_authorisation_basis = $${idx++}`);
        values.push(p.recordedBy, p.authorisationBasis);
      }
      if (p.newStage === 'PACKAGE_AGREED') {
        setClauses.push(`agreed_package_definition_id = $${idx++}`, `agreed_package_at = now()`, `agreed_package_by = $${idx++}`);
        values.push(p.agreedPackageDefinitionId, p.recordedBy);
      }
      if (p.nextFollowUpAt !== undefined) {
        setClauses.push(`next_follow_up_at = $${idx++}`);
        values.push(p.nextFollowUpAt);
      }
      values.push(p.prospectId);

      await client.query(`UPDATE buyer_prospects SET ${setClauses.join(', ')} WHERE id = $${idx}`, values);
    } else if (p.nextFollowUpAt !== undefined) {
      // A non-stage-changing activity (e.g. logging a call attempt) can still schedule a
      // follow-up without touching sales_stage.
      await client.query(`UPDATE buyer_prospects SET next_follow_up_at = $1 WHERE id = $2`, [p.nextFollowUpAt, p.prospectId]);
    }

    const inserted = await client.query(
      `INSERT INTO buyer_prospect_sales_activity (prospect_id, activity_type, previous_stage, new_stage, note, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        p.prospectId, p.activityType,
        p.activityType === 'STAGE_CHANGE' ? previousStage : null,
        p.activityType === 'STAGE_CHANGE' ? newStageToWrite : null,
        p.note ?? null, p.recordedBy,
      ]
    );

    // The authorisation decision specifically is significant enough to also carry in audit_log
    // (same append-only table every other state transition in this app uses), not just the
    // activity log -- it's the one event this whole feature exists to make provable later.
    if (p.activityType === 'STAGE_CHANGE' && p.newStage === 'CONTACT_AUTHORISED') {
      await client.query(
        `INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
         VALUES ($1, 'BUYER_PROSPECT_CONTACT_AUTHORISED', 'buyer_prospect', $2, $3, $4)`,
        [
          p.recordedBy, p.prospectId,
          JSON.stringify({ personal_contact_authorised_at: null }),
          JSON.stringify({ personal_contact_authorised_at: new Date().toISOString(), basis: p.authorisationBasis }),
        ]
      );
    }

    await client.query('COMMIT');
    return { activityId: inserted.rows[0].id as number, prospectId: p.prospectId, stage: newStageToWrite };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
