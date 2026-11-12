import { describe, expect, it, vi } from 'vitest';
import type { SqlDb } from './buyerProspectEmail';

interface FakeProspect {
  id: number;
  unsubscribe_token: string;
  nurture_status: string;
  marketing_consent: boolean;
  marketing_unsubscribed_at: string | null;
  nurture_unsubscribed_at: string | null;
}

function fakeDb(seed: FakeProspect[]): { db: SqlDb; prospects: FakeProspect[] } {
  const prospects = seed.map((p) => ({ ...p }));

  const db: SqlDb = {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join(' ? ');

      if (text.includes('SELECT') && text.includes('WHERE unsubscribe_token')) {
        const [token] = values as [string];
        const row = prospects.find((p) => p.unsubscribe_token === token);
        return row ? [{ id: row.id, nurture_status: row.nurture_status, marketing_consent: row.marketing_consent }] : [];
      }

      if (text.includes("SET nurture_status = 'UNSUBSCRIBED'")) {
        const [id] = values as [number];
        const row = prospects.find((p) => p.id === id);
        if (row && row.nurture_status !== 'UNSUBSCRIBED') {
          row.nurture_status = 'UNSUBSCRIBED';
          row.nurture_unsubscribed_at = row.nurture_unsubscribed_at ?? new Date().toISOString();
        }
        return [];
      }

      if (text.includes('SET marketing_consent = false')) {
        const [id] = values as [number];
        const row = prospects.find((p) => p.id === id);
        if (row && row.marketing_consent) {
          row.marketing_consent = false;
          row.marketing_unsubscribed_at = row.marketing_unsubscribed_at ?? new Date().toISOString();
        }
        return [];
      }

      throw new Error(`fakeDb: unrecognised query: ${text}`);
    }),
  };

  return { db, prospects };
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
    const { db } = fakeDb([{ id: 1, unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true, marketing_unsubscribed_at: null, nurture_unsubscribed_at: null }]);

    const result = await recordUnsubscribe(db, 'not-a-real-token', 'intro');

    expect(result).toEqual({ found: false });
    expect(db.sql).not.toHaveBeenCalled();
  });

  it('scope=intro sets nurture_status to UNSUBSCRIBED and leaves marketing_consent untouched', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects } = fakeDb([{ id: 1, unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true, marketing_unsubscribed_at: null, nurture_unsubscribed_at: null }]);

    const result = await recordUnsubscribe(db, VALID_TOKEN, 'intro');

    expect(result).toEqual({ found: true, scope: 'intro', alreadyApplied: false });
    expect(prospects[0].nurture_status).toBe('UNSUBSCRIBED');
    expect(prospects[0].marketing_consent).toBe(true); // untouched
  });

  it('scope=marketing withdraws marketing consent and leaves nurture_status untouched', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects } = fakeDb([{ id: 1, unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true, marketing_unsubscribed_at: null, nurture_unsubscribed_at: null }]);

    const result = await recordUnsubscribe(db, VALID_TOKEN, 'marketing');

    expect(result).toEqual({ found: true, scope: 'marketing', alreadyApplied: false });
    expect(prospects[0].marketing_consent).toBe(false);
    expect(prospects[0].nurture_status).toBe('ACTIVE'); // untouched -- the critical distinction
  });

  it('scope=all applies both independently', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects } = fakeDb([{ id: 1, unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true, marketing_unsubscribed_at: null, nurture_unsubscribed_at: null }]);

    await recordUnsubscribe(db, VALID_TOKEN, 'all');

    expect(prospects[0].nurture_status).toBe('UNSUBSCRIBED');
    expect(prospects[0].marketing_consent).toBe(false);
  });

  it('a repeated intro unsubscribe is idempotent and reports alreadyApplied', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects } = fakeDb([{ id: 1, unsubscribe_token: VALID_TOKEN, nurture_status: 'UNSUBSCRIBED', marketing_consent: true, marketing_unsubscribed_at: null, nurture_unsubscribed_at: '2026-11-12T00:00:00Z' }]);

    const result = await recordUnsubscribe(db, VALID_TOKEN, 'intro');

    expect(result).toEqual({ found: true, scope: 'intro', alreadyApplied: true });
    expect(prospects[0].nurture_unsubscribed_at).toBe('2026-11-12T00:00:00Z'); // not overwritten
  });

  it('a repeated marketing unsubscribe is idempotent', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects } = fakeDb([{ id: 1, unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: false, marketing_unsubscribed_at: '2026-11-12T00:00:00Z', nurture_unsubscribed_at: null }]);

    const result = await recordUnsubscribe(db, VALID_TOKEN, 'marketing');

    expect(result).toEqual({ found: true, scope: 'marketing', alreadyApplied: true });
    expect(prospects[0].marketing_unsubscribed_at).toBe('2026-11-12T00:00:00Z');
  });

  it('unsubscribing from marketing does not flip nurture_status even if intro was never active', async () => {
    const { recordUnsubscribe } = await import('./prospectUnsubscribe');
    const { db, prospects } = fakeDb([{ id: 1, unsubscribe_token: VALID_TOKEN, nurture_status: 'ACTIVE', marketing_consent: true, marketing_unsubscribed_at: null, nurture_unsubscribed_at: null }]);

    await recordUnsubscribe(db, VALID_TOKEN, 'marketing');

    expect(prospects[0].nurture_status).toBe('ACTIVE');
  });
});
