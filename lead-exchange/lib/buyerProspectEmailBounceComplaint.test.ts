import { describe, expect, it, vi } from 'vitest';
import type { SqlDb } from './buyerProspectEmail';

interface FakeOutboxRow {
  id: number;
  prospect_id: number;
  provider_message_id: string;
  status: string;
}

interface FakeProspect {
  id: number;
  prospect_reference: string;
  email_bounced_at: string | null;
  email_complained_at: string | null;
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
  outboxSeed: FakeOutboxRow[],
  prospectSeed: FakeProspect[],
  options: { throwOnAuditInsert?: boolean } = {}
): { db: SqlDb; outbox: FakeOutboxRow[]; prospects: FakeProspect[]; auditLog: FakeAuditRow[] } {
  const outbox = outboxSeed.map((r) => ({ ...r }));
  const prospects = prospectSeed.map((p) => ({ ...p }));
  const auditLog: FakeAuditRow[] = [];

  function process(providerMessageId: string, action: 'BUYER_PROSPECT_EMAIL_BOUNCED' | 'BUYER_PROSPECT_EMAIL_COMPLAINED', newStatus: 'BOUNCED' | 'COMPLAINED'): void {
    const row = outbox.find((r) => r.provider_message_id === providerMessageId && (r.status === 'SENT' || r.status === 'PENDING'));
    if (!row) return; // no matching CTE arm -- safe no-op, matches the real trigger/lock behaviour
    if (options.throwOnAuditInsert) {
      throw new Error('simulated audit_log insert failure -- nothing committed');
    }
    const prospect = prospects.find((p) => p.id === row.prospect_id)!;
    const prevStatus = row.status;
    row.status = newStatus;
    const suppressField = action === 'BUYER_PROSPECT_EMAIL_BOUNCED' ? 'email_bounced_at' : 'email_complained_at';
    if (!prospect[suppressField]) prospect[suppressField] = new Date().toISOString();
    auditLog.push({
      actor: 'system:resend_webhook', action, entity_type: 'buyer_prospect', entity_id: row.prospect_id,
      previous_state: { outbox_status: prevStatus }, new_state: { outbox_status: newStatus, provider_message_id: providerMessageId },
    });
  }

  const db: SqlDb = {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join(' ? ');
      const [providerMessageId] = values as [string];

      if (text.includes('BUYER_PROSPECT_EMAIL_BOUNCED')) {
        process(providerMessageId, 'BUYER_PROSPECT_EMAIL_BOUNCED', 'BOUNCED');
        return [];
      }
      if (text.includes('BUYER_PROSPECT_EMAIL_COMPLAINED')) {
        process(providerMessageId, 'BUYER_PROSPECT_EMAIL_COMPLAINED', 'COMPLAINED');
        return [];
      }

      throw new Error(`fakeDb: unrecognised query: ${text}`);
    }),
  };

  return { db, outbox, prospects, auditLog };
}

describe('markProspectEmailBounced', () => {
  it('a real bounce: outbox row moves to BOUNCED, prospect suppressed, one audit entry with the genuine previous state', async () => {
    const { markProspectEmailBounced } = await import('./buyerProspectEmail');
    const { db, outbox, prospects, auditLog } = fakeDb(
      [{ id: 1, prospect_id: 10, provider_message_id: 'msg_1', status: 'SENT' }],
      [{ id: 10, prospect_reference: 'HLX-PROSPECT-000010', email_bounced_at: null, email_complained_at: null }]
    );

    await markProspectEmailBounced(db, 'msg_1');

    expect(outbox[0].status).toBe('BOUNCED');
    expect(prospects[0].email_bounced_at).not.toBeNull();
    expect(auditLog).toEqual([
      { actor: 'system:resend_webhook', action: 'BUYER_PROSPECT_EMAIL_BOUNCED', entity_type: 'buyer_prospect', entity_id: 10, previous_state: { outbox_status: 'SENT' }, new_state: { outbox_status: 'BOUNCED', provider_message_id: 'msg_1' } },
    ]);
  });

  it('an unknown provider_message_id is a safe no-op: no mutation, no audit entry', async () => {
    const { markProspectEmailBounced } = await import('./buyerProspectEmail');
    const { db, auditLog } = fakeDb([], []);

    await markProspectEmailBounced(db, 'msg_unknown');

    expect(auditLog).toHaveLength(0);
  });

  it('repeated/concurrent webhook delivery of the same event is idempotent: one transition, one audit entry', async () => {
    const { markProspectEmailBounced } = await import('./buyerProspectEmail');
    const { db, outbox, auditLog } = fakeDb(
      [{ id: 1, prospect_id: 10, provider_message_id: 'msg_1', status: 'SENT' }],
      [{ id: 10, prospect_reference: 'HLX-PROSPECT-000010', email_bounced_at: null, email_complained_at: null }]
    );

    await Promise.all([markProspectEmailBounced(db, 'msg_1'), markProspectEmailBounced(db, 'msg_1')]);

    expect(outbox[0].status).toBe('BOUNCED');
    expect(auditLog).toHaveLength(1); // the second delivery found the row already BOUNCED and did nothing
  });

  it('a second bounce on a different outbox row for an already-suppressed prospect still logs its own transition', async () => {
    const { markProspectEmailBounced } = await import('./buyerProspectEmail');
    const { db, prospects, auditLog } = fakeDb(
      [
        { id: 1, prospect_id: 10, provider_message_id: 'msg_1', status: 'SENT' },
        { id: 2, prospect_id: 10, provider_message_id: 'msg_2', status: 'SENT' },
      ],
      [{ id: 10, prospect_reference: 'HLX-PROSPECT-000010', email_bounced_at: new Date('2026-01-01').toISOString(), email_complained_at: null }]
    );

    await markProspectEmailBounced(db, 'msg_2');

    expect(prospects[0].email_bounced_at).toBe(new Date('2026-01-01').toISOString()); // not overwritten
    expect(auditLog).toHaveLength(1); // but this row's own transition is still recorded
  });

  it('atomicity: if the audit insert would fail, the outbox row is not mutated either', async () => {
    const { markProspectEmailBounced } = await import('./buyerProspectEmail');
    const { db, outbox, auditLog } = fakeDb(
      [{ id: 1, prospect_id: 10, provider_message_id: 'msg_1', status: 'SENT' }],
      [{ id: 10, prospect_reference: 'HLX-PROSPECT-000010', email_bounced_at: null, email_complained_at: null }],
      { throwOnAuditInsert: true }
    );

    await expect(markProspectEmailBounced(db, 'msg_1')).rejects.toThrow('simulated audit_log insert failure');

    expect(outbox[0].status).toBe('SENT'); // never mutated
    expect(auditLog).toHaveLength(0);
  });

  it('the audit payload never contains an email address', async () => {
    const { markProspectEmailBounced } = await import('./buyerProspectEmail');
    const { db, auditLog } = fakeDb(
      [{ id: 1, prospect_id: 10, provider_message_id: 'msg_1', status: 'SENT' }],
      [{ id: 10, prospect_reference: 'HLX-PROSPECT-000010', email_bounced_at: null, email_complained_at: null }]
    );

    await markProspectEmailBounced(db, 'msg_1');

    expect(JSON.stringify(auditLog[0])).not.toContain('@');
  });
});

describe('markProspectEmailComplained', () => {
  it('a real complaint: outbox row moves to COMPLAINED, prospect suppressed, one audit entry', async () => {
    const { markProspectEmailComplained } = await import('./buyerProspectEmail');
    const { db, outbox, prospects, auditLog } = fakeDb(
      [{ id: 1, prospect_id: 20, provider_message_id: 'msg_2', status: 'SENT' }],
      [{ id: 20, prospect_reference: 'HLX-PROSPECT-000020', email_bounced_at: null, email_complained_at: null }]
    );

    await markProspectEmailComplained(db, 'msg_2');

    expect(outbox[0].status).toBe('COMPLAINED');
    expect(prospects[0].email_complained_at).not.toBeNull();
    expect(auditLog[0].action).toBe('BUYER_PROSPECT_EMAIL_COMPLAINED');
  });

  it('repeated webhook delivery is idempotent', async () => {
    const { markProspectEmailComplained } = await import('./buyerProspectEmail');
    const { db, auditLog } = fakeDb(
      [{ id: 1, prospect_id: 20, provider_message_id: 'msg_2', status: 'SENT' }],
      [{ id: 20, prospect_reference: 'HLX-PROSPECT-000020', email_bounced_at: null, email_complained_at: null }]
    );

    await markProspectEmailComplained(db, 'msg_2');
    await markProspectEmailComplained(db, 'msg_2');

    expect(auditLog).toHaveLength(1);
  });
});
