import { describe, expect, it, vi } from 'vitest';
import { recordSalesActivity, SalesPipelineError } from './buyerProspectSalesPipeline';

function fakeDb(prospect: { id: number; sales_stage: string; personal_contact_authorised_at: string | null }) {
  const state = { ...prospect };
  const activity: Record<string, unknown>[] = [];
  const auditLog: Record<string, unknown>[] = [];

  const client = {
    query: vi.fn(async (text: string, values: unknown[] = []) => {
      if (text.includes('BEGIN') || text.includes('COMMIT') || text.includes('ROLLBACK')) return { rows: [] };
      if (text.includes('FOR UPDATE')) {
        return state.id === values[0] ? { rows: [{ ...state }] } : { rows: [] };
      }
      if (text.startsWith('UPDATE buyer_prospects SET')) {
        // Crude but sufficient for these tests: just record that it was called with the new stage.
        if (text.includes('sales_stage = $1')) state.sales_stage = values[0] as string;
        if (text.includes('personal_contact_authorised_at = now()')) state.personal_contact_authorised_at = new Date().toISOString();
        return { rows: [] };
      }
      if (text.startsWith('INSERT INTO buyer_prospect_sales_activity')) {
        const id = activity.length + 1;
        activity.push({ id, prospect_id: values[0], activity_type: values[1] });
        return { rows: [{ id }] };
      }
      if (text.startsWith('INSERT INTO audit_log')) {
        const actionMatch = text.match(/VALUES \(\$1, '([A-Z_]+)'/);
        auditLog.push({ actor: values[0], action: actionMatch?.[1] });
        return { rows: [] };
      }
      throw new Error(`fakeDb: unrecognised query: ${text}`);
    }),
    release: vi.fn(),
  };

  return { db: { pool: { connect: vi.fn(async () => client) } }, state, activity, auditLog };
}

describe('recordSalesActivity', () => {
  it('rejects moving to CONTACT_AUTHORISED without an authorisation basis', async () => {
    const { db } = fakeDb({ id: 1, sales_stage: 'NEW', personal_contact_authorised_at: null });

    await expect(
      recordSalesActivity(db, { prospectId: 1, activityType: 'STAGE_CHANGE', newStage: 'CONTACT_AUTHORISED', recordedBy: 'admin@halostrategic.com' })
    ).rejects.toThrow(SalesPipelineError);
  });

  it('authorises contact when a basis is given, writes one activity row and one audit_log entry', async () => {
    const { db, state, activity, auditLog } = fakeDb({ id: 1, sales_stage: 'NEW', personal_contact_authorised_at: null });

    const result = await recordSalesActivity(db, {
      prospectId: 1, activityType: 'STAGE_CHANGE', newStage: 'CONTACT_AUTHORISED',
      recordedBy: 'admin@halostrategic.com', authorisationBasis: 'Registered via website, replied confirming interest by email 2026-11-15.',
    });

    expect(result.stage).toBe('CONTACT_AUTHORISED');
    expect(state.sales_stage).toBe('CONTACT_AUTHORISED');
    expect(state.personal_contact_authorised_at).not.toBeNull();
    expect(activity).toHaveLength(1);
    expect(auditLog).toHaveLength(1);
    expect(auditLog[0].action).toBe('BUYER_PROSPECT_CONTACT_AUTHORISED');
  });

  it('rejects skipping a stage (NEW straight to QUALIFIED)', async () => {
    const { db } = fakeDb({ id: 1, sales_stage: 'NEW', personal_contact_authorised_at: null });

    await expect(
      recordSalesActivity(db, { prospectId: 1, activityType: 'STAGE_CHANGE', newStage: 'QUALIFIED', recordedBy: 'admin@halostrategic.com' })
    ).rejects.toThrow(/one step at a time/);
  });

  it('rejects moving to PACKAGE_AGREED without a package id', async () => {
    const { db } = fakeDb({ id: 1, sales_stage: 'CALL_COMPLETED', personal_contact_authorised_at: '2026-11-15T00:00:00Z' });

    await expect(
      recordSalesActivity(db, { prospectId: 1, activityType: 'STAGE_CHANGE', newStage: 'PACKAGE_AGREED', recordedBy: 'admin@halostrategic.com' })
    ).rejects.toThrow(SalesPipelineError);
  });

  it('records PACKAGE_AGREED with a package id, no audit_log entry (only authorisation gets one)', async () => {
    const { db, state, activity, auditLog } = fakeDb({ id: 1, sales_stage: 'CALL_COMPLETED', personal_contact_authorised_at: '2026-11-15T00:00:00Z' });

    const result = await recordSalesActivity(db, {
      prospectId: 1, activityType: 'STAGE_CHANGE', newStage: 'PACKAGE_AGREED',
      recordedBy: 'admin@halostrategic.com', agreedPackageDefinitionId: 2,
    });

    expect(result.stage).toBe('PACKAGE_AGREED');
    expect(state.sales_stage).toBe('PACKAGE_AGREED');
    expect(activity).toHaveLength(1);
    expect(auditLog).toHaveLength(0);
  });

  it('logs a non-stage-changing activity (e.g. a manually sent email) without touching sales_stage', async () => {
    const { db, state, activity } = fakeDb({ id: 1, sales_stage: 'CONTACT_AUTHORISED', personal_contact_authorised_at: '2026-11-15T00:00:00Z' });

    await recordSalesActivity(db, { prospectId: 1, activityType: 'EMAIL_SENT', recordedBy: 'admin@halostrategic.com', note: 'Sent introductory email.' });

    expect(state.sales_stage).toBe('CONTACT_AUTHORISED'); // unchanged
    expect(activity).toHaveLength(1);
  });

  it('rolls back and rethrows if a write fails partway through', async () => {
    const { db } = fakeDb({ id: 1, sales_stage: 'NEW', personal_contact_authorised_at: null });
    const client = await db.pool.connect();
    const originalImpl = client.query.getMockImplementation()!;
    client.query.mockImplementation(async (text: string, values: unknown[] = []) => {
      if (text.startsWith('INSERT INTO buyer_prospect_sales_activity')) throw new Error('simulated failure');
      return originalImpl(text, values);
    });

    await expect(
      recordSalesActivity(db, { prospectId: 1, activityType: 'EMAIL_SENT', recordedBy: 'admin@halostrategic.com' })
    ).rejects.toThrow('simulated failure');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
