import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqlDb } from './buyerProspectEmail';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

interface FakeRow {
  id: number;
  prospect_id: number;
  nurture_step: number;
  recipient: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  attempt_count: number;
}

function fakeProspectEmailDb(seed: FakeRow[] = []): { db: SqlDb; rows: FakeRow[] } {
  const rows: FakeRow[] = seed.map((r) => ({ ...r }));
  let nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;

  const db: SqlDb = {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join(' ? ');

      if (text.includes('INSERT INTO buyer_prospect_emails')) {
        const [prospectId, nurtureStep, recipient] = values as [number, number, string];
        const existing = rows.find((r) => r.prospect_id === prospectId && r.nurture_step === nurtureStep);
        if (existing) return [];
        const row: FakeRow = {
          id: nextId++, prospect_id: prospectId, nurture_step: nurtureStep, recipient,
          status: 'PENDING', provider_message_id: null, error_message: null, attempt_count: 0,
        };
        rows.push(row);
        return [{ id: row.id, prospect_id: row.prospect_id, nurture_step: row.nurture_step, recipient: row.recipient, status: row.status }];
      }

      if (text.includes('SELECT') && text.includes('WHERE prospect_id') && text.includes('AND nurture_step')) {
        const [prospectId, nurtureStep] = values as [number, number];
        const row = rows.find((r) => r.prospect_id === prospectId && r.nurture_step === nurtureStep);
        return row ? [{ id: row.id, prospect_id: row.prospect_id, nurture_step: row.nurture_step, recipient: row.recipient, status: row.status }] : [];
      }

      if (text.includes('SELECT') && text.includes('WHERE id')) {
        const [id] = values as [number];
        const row = rows.find((r) => r.id === id);
        return row ? [{ id: row.id, prospect_id: row.prospect_id, nurture_step: row.nurture_step, recipient: row.recipient, status: row.status }] : [];
      }

      if (text.includes("SET status = 'SENT'")) {
        const [providerMessageId, id] = values as [string | null, number];
        const row = rows.find((r) => r.id === id);
        if (row) { row.status = 'SENT'; row.provider_message_id = providerMessageId; row.error_message = null; row.attempt_count += 1; }
        return [];
      }

      if (text.includes("SET status = 'FAILED'")) {
        const [errorMessage, id] = values as [string | null, number];
        const row = rows.find((r) => r.id === id);
        if (row) { row.status = 'FAILED'; row.error_message = errorMessage; row.attempt_count += 1; }
        return [];
      }

      throw new Error(`fakeProspectEmailDb: unrecognised query: ${text}`);
    }),
  };

  return { db, rows };
}

const content = { subject: 'Subject', html: '<p>Body</p>', text: 'Body' };

describe('buyer prospect nurture outbox', () => {
  beforeEach(async () => {
    sendMock.mockReset();
    process.env.RESEND_API_KEY = 'test-key';
    const { resetBuyerProspectEmailClientCacheForTests } = await import('./buyerProspectEmail');
    resetBuyerProspectEmailClientCacheForTests();
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it('createProspectEmailEntry is idempotent per (prospect, step)', async () => {
    const { createProspectEmailEntry } = await import('./buyerProspectEmail');
    const { db, rows } = fakeProspectEmailDb();

    const first = await createProspectEmailEntry(db, { prospectId: 1, nurtureStep: 1, recipient: 'buyer@example.com' });
    const second = await createProspectEmailEntry(db, { prospectId: 1, nurtureStep: 1, recipient: 'buyer@example.com' });

    expect(first.id).toBe(second.id);
    expect(rows).toHaveLength(1);
  });

  it('sendProspectNurtureEmail sends successfully and records SENT', async () => {
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    const { sendProspectNurtureEmail } = await import('./buyerProspectEmail');
    const { db, rows } = fakeProspectEmailDb();

    const result = await sendProspectNurtureEmail(db, { prospectId: 1, nurtureStep: 1, to: 'buyer@example.com', ...content });

    expect(result).toEqual({ sent: true, skipped: false });
    expect(rows[0].status).toBe('SENT');
  });

  it('records FAILED without contacting the provider when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendProspectNurtureEmail } = await import('./buyerProspectEmail');
    const { db, rows } = fakeProspectEmailDb();

    const result = await sendProspectNurtureEmail(db, { prospectId: 1, nurtureStep: 1, to: 'buyer@example.com', ...content });

    expect(result.sent).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('FAILED');
  });

  it('a later step for the same prospect is a separate row, not a duplicate', async () => {
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    const { sendProspectNurtureEmail } = await import('./buyerProspectEmail');
    const { db, rows } = fakeProspectEmailDb();

    await sendProspectNurtureEmail(db, { prospectId: 1, nurtureStep: 1, to: 'buyer@example.com', ...content });
    await sendProspectNurtureEmail(db, { prospectId: 1, nurtureStep: 2, to: 'buyer@example.com', ...content });

    expect(rows).toHaveLength(2);
  });

  it('attemptSendProspectEmail skips a step already SENT, never re-contacting the provider', async () => {
    const { attemptSendProspectEmail } = await import('./buyerProspectEmail');
    const { db } = fakeProspectEmailDb([
      { id: 1, prospect_id: 1, nurture_step: 1, recipient: 'buyer@example.com', status: 'SENT', provider_message_id: 'msg_1', error_message: null, attempt_count: 1 },
    ]);

    const result = await attemptSendProspectEmail(db, 1, content);

    expect(result).toEqual({ sent: false, skipped: true });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
