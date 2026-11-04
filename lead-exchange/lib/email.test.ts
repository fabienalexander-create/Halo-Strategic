import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqlDb } from './email';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

interface FakeRow {
  id: number;
  buyer_id: number;
  email_type: string;
  recipient: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  attempt_count: number;
}

// A minimal in-memory stand-in for the transactional_emails outbox table, just realistic enough
// to exercise createOutboxEntry / attemptSend / markDelivered's actual SQL shapes rather than a
// hand-wavy mock -- it specifically has to get idempotent INSERT ... ON CONFLICT DO NOTHING right.
function fakeOutboxDb(seed: FakeRow[] = []): { db: SqlDb; rows: FakeRow[] } {
  const rows: FakeRow[] = seed.map((r) => ({ ...r }));
  let nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;

  const db: SqlDb = {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join(' ? ');

      if (text.includes('INSERT INTO transactional_emails')) {
        const [buyerId, emailType, recipient] = values as [number, string, string];
        const existing = rows.find((r) => r.buyer_id === buyerId && r.email_type === emailType);
        if (existing) return []; // ON CONFLICT DO NOTHING
        const row: FakeRow = {
          id: nextId++,
          buyer_id: buyerId,
          email_type: emailType,
          recipient,
          status: 'PENDING',
          provider_message_id: null,
          error_message: null,
          attempt_count: 0,
        };
        rows.push(row);
        return [{ id: row.id, buyer_id: row.buyer_id, email_type: row.email_type, recipient: row.recipient, status: row.status }];
      }

      if (text.includes('SELECT') && text.includes('WHERE buyer_id') && text.includes('AND email_type')) {
        const [buyerId, emailType] = values as [number, string];
        const row = rows.find((r) => r.buyer_id === buyerId && r.email_type === emailType);
        return row ? [{ id: row.id, buyer_id: row.buyer_id, email_type: row.email_type, recipient: row.recipient, status: row.status }] : [];
      }

      if (text.includes('SELECT') && text.includes('WHERE id')) {
        const [id] = values as [number];
        const row = rows.find((r) => r.id === id);
        return row ? [{ id: row.id, buyer_id: row.buyer_id, email_type: row.email_type, recipient: row.recipient, status: row.status }] : [];
      }

      if (text.includes("SET status = 'SENT'")) {
        const [providerMessageId, id] = values as [string | null, number];
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.status = 'SENT';
          row.provider_message_id = providerMessageId;
          row.error_message = null;
          row.attempt_count += 1;
        }
        return [];
      }

      if (text.includes("SET status = 'FAILED'")) {
        const [errorMessage, id] = values as [string | null, number];
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.status = 'FAILED';
          row.error_message = errorMessage;
          row.attempt_count += 1;
        }
        return [];
      }

      if (text.includes("SET status = 'DELIVERED'")) {
        const [providerMessageId] = values as [string];
        const row = rows.find((r) => r.provider_message_id === providerMessageId && r.status === 'SENT');
        if (row) row.status = 'DELIVERED';
        return [];
      }

      throw new Error(`fakeOutboxDb: unrecognised query: ${text}`);
    }),
  };

  return { db, rows };
}

const content = { subject: 'Subject', html: '<p>Body</p>', text: 'Body' };

describe('email outbox', () => {
  beforeEach(async () => {
    sendMock.mockReset();
    process.env.RESEND_API_KEY = 'test-key';
    const { resetEmailClientCacheForTests } = await import('./email');
    resetEmailClientCacheForTests();
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it('createOutboxEntry is idempotent: a second call for the same buyer+type returns the existing row, not a new one', async () => {
    const { createOutboxEntry } = await import('./email');
    const { db, rows } = fakeOutboxDb();

    const first = await createOutboxEntry(db, { buyerId: 1, emailType: 'APPLICATION_RECEIVED', recipient: 'james@example.com' });
    const second = await createOutboxEntry(db, { buyerId: 1, emailType: 'APPLICATION_RECEIVED', recipient: 'james@example.com' });

    expect(first.id).toBe(second.id);
    expect(rows).toHaveLength(1);
  });

  it('sendBuyerEmail sends successfully and records SENT with the provider message id', async () => {
    sendMock.mockResolvedValue({ data: { id: 'msg_123' }, error: null });
    const { sendBuyerEmail } = await import('./email');
    const { db, rows } = fakeOutboxDb();

    const result = await sendBuyerEmail(db, { buyerId: 1, emailType: 'APPLICATION_RECEIVED', to: 'james@example.com', ...content });

    expect(result).toEqual({ sent: true, skipped: false });
    expect(rows[0].status).toBe('SENT');
    expect(rows[0].provider_message_id).toBe('msg_123');
    expect(rows[0].attempt_count).toBe(1);
  });

  it('records FAILED (not a throw) when the provider rejects the send, and leaves the row retryable', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'Invalid recipient' } });
    const { sendBuyerEmail } = await import('./email');
    const { db, rows } = fakeOutboxDb();

    const result = await sendBuyerEmail(db, { buyerId: 1, emailType: 'APPLICATION_RECEIVED', to: 'james@example.com', ...content });

    expect(result).toEqual({ sent: false, skipped: false, error: 'Invalid recipient' });
    expect(rows[0].status).toBe('FAILED');
    expect(rows[0].error_message).toBe('Invalid recipient');
  });

  it('records FAILED (not a throw) when the SDK call itself throws', async () => {
    sendMock.mockRejectedValue(new Error('network down'));
    const { sendBuyerEmail } = await import('./email');
    const { db, rows } = fakeOutboxDb();

    const result = await sendBuyerEmail(db, { buyerId: 1, emailType: 'APPLICATION_RECEIVED', to: 'james@example.com', ...content });

    expect(result.sent).toBe(false);
    expect(rows[0].status).toBe('FAILED');
  });

  it('records FAILED without contacting the provider when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendBuyerEmail } = await import('./email');
    const { db, rows } = fakeOutboxDb();

    const result = await sendBuyerEmail(db, { buyerId: 1, emailType: 'APPLICATION_RECEIVED', to: 'james@example.com', ...content });

    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/RESEND_API_KEY/);
    expect(sendMock).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('FAILED');
  });

  it('a retry on a FAILED row succeeds without creating a second outbox entry or repeating the original event', async () => {
    const { createOutboxEntry, attemptSend } = await import('./email');
    const { db, rows } = fakeOutboxDb();

    const outbox = await createOutboxEntry(db, { buyerId: 1, emailType: 'APPLICATION_RECEIVED', recipient: 'james@example.com' });

    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'temporary provider error' } });
    const firstAttempt = await attemptSend(db, outbox.id, content);
    expect(firstAttempt.sent).toBe(false);
    expect(rows[0].status).toBe('FAILED');

    // The retry (e.g. the admin "retry" endpoint) is called with the SAME outbox id -- it never
    // re-runs the buyer-application insert, and never creates a new transactional_emails row.
    sendMock.mockResolvedValueOnce({ data: { id: 'msg_456' }, error: null });
    const retryResult = await attemptSend(db, outbox.id, content);

    expect(retryResult).toEqual({ sent: true, skipped: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('SENT');
    expect(rows[0].attempt_count).toBe(2);
  });

  it('attemptSend skips (does not re-contact the provider) when the row is already SENT', async () => {
    const { attemptSend } = await import('./email');
    const { db, rows } = fakeOutboxDb([
      { id: 1, buyer_id: 1, email_type: 'APPLICATION_RECEIVED', recipient: 'james@example.com', status: 'SENT', provider_message_id: 'msg_1', error_message: null, attempt_count: 1 },
    ]);

    const result = await attemptSend(db, 1, content);

    expect(result).toEqual({ sent: false, skipped: true });
    expect(sendMock).not.toHaveBeenCalled();
    expect(rows[0].attempt_count).toBe(1);
  });

  it('attemptSend skips when the row is already DELIVERED', async () => {
    const { attemptSend } = await import('./email');
    const { db } = fakeOutboxDb([
      { id: 1, buyer_id: 1, email_type: 'APPLICATION_RECEIVED', recipient: 'james@example.com', status: 'DELIVERED', provider_message_id: 'msg_1', error_message: null, attempt_count: 1 },
    ]);

    const result = await attemptSend(db, 1, content);

    expect(result).toEqual({ sent: false, skipped: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('markDelivered moves a SENT row to DELIVERED by provider_message_id', async () => {
    const { markDelivered } = await import('./email');
    const { db, rows } = fakeOutboxDb([
      { id: 1, buyer_id: 1, email_type: 'APPLICATION_RECEIVED', recipient: 'james@example.com', status: 'SENT', provider_message_id: 'msg_1', error_message: null, attempt_count: 1 },
    ]);

    await markDelivered(db, 'msg_1');

    expect(rows[0].status).toBe('DELIVERED');
  });

  it('a duplicate application-submission retry never sends a second email: outbox creation is idempotent and a second create+send call on an already-SENT event is skipped', async () => {
    sendMock.mockResolvedValue({ data: { id: 'msg_123' }, error: null });
    const { sendBuyerEmail } = await import('./email');
    const { db, rows } = fakeOutboxDb();

    const firstSubmission = await sendBuyerEmail(db, { buyerId: 1, emailType: 'APPLICATION_RECEIVED', to: 'james@example.com', ...content });
    expect(firstSubmission.sent).toBe(true);

    // Simulates James's browser retrying the original POST after a network blip -- the route
    // would 409 before this ever runs in practice, but even called directly a second time here,
    // no second row is created and no second send happens.
    const retriedSubmission = await sendBuyerEmail(db, { buyerId: 1, emailType: 'APPLICATION_RECEIVED', to: 'james@example.com', ...content });

    expect(retriedSubmission).toEqual({ sent: false, skipped: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });
});
