import { describe, expect, it, vi } from 'vitest';
import { autoAuthoriseContactFromApplication } from './buyerProspectAutoAuthorise';

function mockClient() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }) };
}

describe('autoAuthoriseContactFromApplication', () => {
  it('authorises a prospect still at NEW with no authorisation recorded', async () => {
    const client = mockClient();
    const result = await autoAuthoriseContactFromApplication(client, {
      prospectId: 7, currentSalesStage: 'NEW', personalContactAuthorisedAt: null, applicationReference: 'HLX-BYR-000007',
    });

    expect(result).toBe(true);
    expect(client.query).toHaveBeenCalledTimes(3);

    const updateCall = client.query.mock.calls.find((c) => String(c[0]).includes('UPDATE buyer_prospects'));
    expect(updateCall?.[0]).toContain("sales_stage = 'CONTACT_AUTHORISED'");
    expect(updateCall?.[1]?.[1]).toBe(7);
    expect(String(updateCall?.[1]?.[0])).toContain('HLX-BYR-000007');

    const activityCall = client.query.mock.calls.find((c) => String(c[0]).includes('buyer_prospect_sales_activity'));
    expect(activityCall?.[1]).toEqual([7, 'Auto-authorised on submission of buyer application HLX-BYR-000007.']);

    const auditCall = client.query.mock.calls.find((c) => String(c[0]).includes('audit_log'));
    expect(auditCall?.[0]).toContain("'system'");
    expect(auditCall?.[1]?.[0]).toBe(7);
    expect(JSON.parse(auditCall?.[1]?.[1] as string)).toEqual({ personal_contact_authorised_at: null });
    const newState = JSON.parse(auditCall?.[1]?.[2] as string);
    expect(newState.source).toBe('buyer_application');
    expect(newState.application_reference).toBe('HLX-BYR-000007');
  });

  it('does nothing if the prospect already has authorisation recorded', async () => {
    const client = mockClient();
    const result = await autoAuthoriseContactFromApplication(client, {
      prospectId: 8, currentSalesStage: 'NEW', personalContactAuthorisedAt: '2026-11-01T00:00:00Z', applicationReference: 'HLX-BYR-000008',
    });

    expect(result).toBe(false);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('does nothing if the prospect has already moved past NEW (even without a recorded timestamp somehow)', async () => {
    const client = mockClient();
    const result = await autoAuthoriseContactFromApplication(client, {
      prospectId: 9, currentSalesStage: 'CONTACTED', personalContactAuthorisedAt: null, applicationReference: 'HLX-BYR-000009',
    });

    expect(result).toBe(false);
    expect(client.query).not.toHaveBeenCalled();
  });
});
