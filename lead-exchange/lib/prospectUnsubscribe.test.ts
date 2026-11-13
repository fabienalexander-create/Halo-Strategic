import { describe, expect, it, vi } from 'vitest';
import type { SqlDb } from './buyerProspectEmail';

interface FakeProspect {
  id: number;
  prospect_reference: string;
  unsubscribe_token: string;
  nurture_status: string;
  marketing_consent: boolean;
}

interface FakeAuditRow {
  actor: string;
  action: string;
  entity_type: string;
  entity_id: number;
  previous_state: Record<string, unknown>;
  new_state: Record<string, unknown>;
}

function fakeDb(
  seed: FakeProspect[],
  options: { throwOnAuditInsert?: boolean } = {}
): { db: SqlDb; prospects: FakeProspect[]; auditLog: FakeAuditRow[] } {
  const prospects = seed.map((p) => ({ ...p }));
  const auditLog: FakeAuditRow[] = [];

  const db: SqlDb = {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join(' ? ');

      if (text.includes('SELECT id FROM buyer_prospects WHERE unsubscribe_token')) {
        const [token] = values as [string];
        const row = prospects.find((p) => p.unsubscribe_token === token);
        return row ? [{ id: row.id }] : [];
      }

      if (text.includes('BUYER_PROSPECT_UNSUBSCRIBED_INTRO')) {
        const [prospectId, method] = values as [number, string];
        const row = prospects.find((p) => p.id === prospectId);
        if (!row || row.nurture_status === 'UNSUBSCRIBED') {
          return [{ updated: 0, logged: 0 }];
        }
        if (options.throwOnAuditInsert) {
          throw new Error('simulated audit_log insert failure -- nothing committed');
        }
        const prevStatus = row.nurture_status;
        row.nurture_status = 'UNSUBSCRIBED';
        auditLog.push({
          actor: row.prospect_reference, action: 'BUYER_PROSPECT_UNSUBSCRIBED_INTRO', entity_type: 'buyer_prospect',
          entity_id: row.id, previous_state: { nurture_status: prevStatus }, new_state: { nurture_status: 'UNSUBSCRIBED', method },
        });
        return [{ updated: 1, logged: 1 }];
      }

      if (text.includes('BUYER_PROSPECT_UNSUBSCRIBED_MARKETING')) {
        const [prospectId] = values as [number];
        const row = prospects.find((p) => p.id === prospectId);
        if (!row || row.marketing_consent === false) {
          return [{ updated: 0, logged: 0 }];
        }
        if (options.throwOnAuditInsert) {
          throw new Error('simulated audit_log insert failure -- nothing committed');
        }
        row.marketing_consent = false;
        auditLog.push({
          actor: row.prospect_reference, action: 'BUYER_PROSPECT_UNSUBSCRIBED_MARKETING', entity_type: 'buyer_prospect',
          entity_id: row.id, previous_state: { marketing_consent: true }, new_state: { marketing_consent: false },
        });
        return [{ updated: 1, logged: 1 }];
      }

      throw new Error(`fakeDb: unrecognised query: ${text}`);
    }),
  };

  return { db, prospects, auditLog };
}

const VALID_TOKEN = 'a'.repeat(64);

describe('recordUnsubscribe', () => {
  it('an unknown token is reported as not found, no error thrown', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db } = fakeDb([]);

    const result = await recordUnsubscribe(db, VALID_TOKEN, 'intro');

    expect(result).toEqual({ found: false });
  });

  it('rejects a malformed token without querying the database', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db } = fakeDb([{ id: 1, prospect_reference: 'HLX-PROSPECT-000001', unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true }]);

    const result = await recordUnsubscribe(db, 'not-a-real-token', 'intro');

    expect(result).toEqual({ found: false });
    expect(db.sql).not.toHaveBeenCalled();
  });

  it('scope=intro: real transition, audit entry written with the genuine previous state, marketing untouched', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects, auditLog } = fakeDb([{ id: 1, prospect_reference: 'HLX-PROSPECT-000001', unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true }]);

    const result = await recordUnsubscribe(db, VALID_TOKEN, 'intro');

    expect(result).toEqual({ found: true, scope: 'intro', alreadyApplied: false });
    expect(prospects[0].nurture_status).toBe('UNSUBSCRIBED');
    expect(prospects[0].marketing_consent).toBe(true); // untouched
    expect(auditLog).toEqual([
      { actor: 'HLX-PROSPECT-000001', action: 'BUYER_PROSPECT_UNSUBSCRIBED_INTRO', entity_type: 'buyer_prospect', entity_id: 1, previous_state: { nurture_status: 'ACTIVE' }, new_state: { nurture_status: 'UNSUBSCRIBED', method: 'link' } },
    ]);
  });

  it('scope=marketing: real transition, audit entry written, nurture_status untouched', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects, auditLog } = fakeDb([{ id: 1, prospect_reference: 'HLX-PROSPECT-000001', unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true }]);

    const result = await recordUnsubscribe(db, VALID_TOKEN, 'marketing');

    expect(result).toEqual({ found: true, scope: 'marketing', alreadyApplied: false });
    expect(prospects[0].marketing_consent).toBe(false);
    expect(prospects[0].nurture_status).toBe('ACTIVE'); // untouched -- the critical distinction
    expect(auditLog).toEqual([
      { actor: 'HLX-PROSPECT-000001', action: 'BUYER_PROSPECT_UNSUBSCRIBED_MARKETING', entity_type: 'buyer_prospect', entity_id: 1, previous_state: { marketing_consent: true }, new_state: { marketing_consent: false } },
    ]);
  });

  it('scope=all applies both independently, writing two separate audit entries', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects, auditLog } = fakeDb([{ id: 1, prospect_reference: 'HLX-PROSPECT-000001', unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true }]);

    await recordUnsubscribe(db, VALID_TOKEN, 'all');

    expect(prospects[0].nurture_status).toBe('UNSUBSCRIBED');
    expect(prospects[0].marketing_consent).toBe(false);
    expect(auditLog).toHaveLength(2);
    expect(auditLog.map((a) => a.action)).toEqual(['BUYER_PROSPECT_UNSUBSCRIBED_INTRO', 'BUYER_PROSPECT_UNSUBSCRIBED_MARKETING']);
  });

  it('a repeated intro unsubscribe is idempotent: no state change, no additional audit entry', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects, auditLog } = fakeDb([{ id: 1, prospect_reference: 'HLX-PROSPECT-000001', unsubscribe_token: VALID_TOKEN, nurture_status: 'UNSUBSCRIBED', marketing_consent: true }]);

    const result = await recordUnsubscribe(db, VALID_TOKEN, 'intro');

    expect(result).toEqual({ found: true, scope: 'intro', alreadyApplied: true });
    expect(auditLog).toHaveLength(0); // no duplicate audit entry for a no-op
  });

  it('a repeated marketing unsubscribe is idempotent: no state change, no additional audit entry', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects, auditLog } = fakeDb([{ id: 1, prospect_reference: 'HLX-PROSPECT-000001', unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: false }]);

    const result = await recordUnsubscribe(db, VALID_TOKEN, 'marketing');

    expect(result).toEqual({ found: true, scope: 'marketing', alreadyApplied: true });
    expect(auditLog).toHaveLength(0);
  });

  it('unsubscribing from marketing does not flip nurture_status even if intro was never active', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects } = fakeDb([{ id: 1, prospect_reference: 'HLX-PROSPECT-000001', unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true }]);

    await recordUnsubscribe(db, VALID_TOKEN, 'marketing');

    expect(prospects[0].nurture_status).toBe('ACTIVE');
  });

  it('records which method was used (one-click vs link) in the audit entry', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, auditLog } = fakeDb([{ id: 1, prospect_reference: 'HLX-PROSPECT-000001', unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true }]);

    await recordUnsubscribe(db, VALID_TOKEN, 'intro', 'one_click');

    expect(auditLog[0].new_state).toEqual({ nurture_status: 'UNSUBSCRIBED', method: 'one_click' });
  });

  it('the audit payload never contains the unsubscribe token or an email address', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, auditLog } = fakeDb([{ id: 1, prospect_reference: 'HLX-PROSPECT-000001', unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true }]);

    await recordUnsubscribe(db, VALID_TOKEN, 'intro');

    const serialised = JSON.stringify(auditLog[0]);
    expect(serialised).not.toContain(VALID_TOKEN);
    expect(serialised).not.toContain('@');
  });

  it('atomicity: if the audit insert would fail, the state change is not applied either (simulated single-statement failure)', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects, auditLog } = fakeDb(
      [{ id: 1, prospect_reference: 'HLX-PROSPECT-000001', unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true }],
      { throwOnAuditInsert: true }
    );

    await expect(recordUnsubscribe(db, VALID_TOKEN, 'intro')).rejects.toThrow('simulated audit_log insert failure');

    expect(prospects[0].nurture_status).toBe('ACTIVE'); // never mutated -- the whole statement rolled back
    expect(auditLog).toHaveLength(0);
  });

  it('concurrent/repeated calls for the same prospect result in exactly one applied transition and one audit entry', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects, auditLog } = fakeDb([{ id: 1, prospect_reference: 'HLX-PROSPECT-000001', unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true }]);

    // Simulates two requests racing for the same prospect -- the row lock in the real CTE means
    // only one would ever observe nurture_status != 'UNSUBSCRIBED' and apply the change; this fake
    // db mutates synchronously, so calling sequentially here reproduces that same end state.
    const [first, second] = await Promise.all([
      recordUnsubscribe(db, VALID_TOKEN, 'intro'),
      recordUnsubscribe(db, VALID_TOKEN, 'intro'),
    ]);

    const results = [first, second];
    expect(results.filter((r) => r.alreadyApplied === false)).toHaveLength(1);
    expect(results.filter((r) => r.alreadyApplied === true)).toHaveLength(1);
    expect(prospects[0].nurture_status).toBe('UNSUBSCRIBED');
    expect(auditLog).toHaveLength(1);
  });
});
