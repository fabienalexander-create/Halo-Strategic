import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqlDb } from './email';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

function fakeDb(initialRows: Array<Record<string, unknown>> = []): { db: SqlDb; inserts: unknown[][] } {
  const inserts: unknown[][] = [];
  const db: SqlDb = {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join('?');
      if (text.includes('SELECT id FROM transactional_emails')) {
        return initialRows;
      }
      if (text.includes('INSERT INTO transactional_emails')) {
        inserts.push(values);
        return [];
      }
      return [];
    }),
  };
  return { db, inserts };
}

const baseParams = {
  buyerId: 42,
  emailType: 'APPLICATION_RECEIVED' as const,
  to: 'james@example.com',
  subject: 'Subject',
  html: '<p>Body</p>',
  text: 'Body',
};

describe('sendBuyerEmail', () => {
  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
    process.env.RESEND_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it('sends successfully and logs a SENT row', async () => {
    sendMock.mockResolvedValue({ data: { id: 'msg_123' }, error: null });
    const { sendBuyerEmail, resetEmailClientCacheForTests } = await import('./email');
    resetEmailClientCacheForTests();
    const { db, inserts } = fakeDb([]);

    const result = await sendBuyerEmail(db, baseParams);

    expect(result).toEqual({ sent: true, skipped: false });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual([42, 'APPLICATION_RECEIVED', 'james@example.com', 'SENT', 'msg_123', null]);
  });

  it('logs a FAILED row and does not throw when the provider returns an error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'Invalid recipient' } });
    const { sendBuyerEmail, resetEmailClientCacheForTests } = await import('./email');
    resetEmailClientCacheForTests();
    const { db, inserts } = fakeDb([]);

    const result = await sendBuyerEmail(db, baseParams);

    expect(result).toEqual({ sent: false, skipped: false, error: 'Invalid recipient' });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual([42, 'APPLICATION_RECEIVED', 'james@example.com', 'FAILED', null, 'Invalid recipient']);
  });

  it('logs a FAILED row and does not throw when the SDK call itself throws', async () => {
    sendMock.mockRejectedValue(new Error('network down'));
    const { sendBuyerEmail, resetEmailClientCacheForTests } = await import('./email');
    resetEmailClientCacheForTests();
    const { db, inserts } = fakeDb([]);

    const result = await sendBuyerEmail(db, baseParams);

    expect(result).toEqual({ sent: false, skipped: false, error: 'network down' });
    expect(inserts).toHaveLength(1);
    expect(inserts[0][3]).toBe('FAILED');
  });

  it('does not attempt to send, and does not throw, when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendBuyerEmail, resetEmailClientCacheForTests } = await import('./email');
    resetEmailClientCacheForTests();
    const { db, inserts } = fakeDb([]);

    const result = await sendBuyerEmail(db, baseParams);

    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/RESEND_API_KEY/);
    expect(sendMock).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(1);
    expect(inserts[0][3]).toBe('FAILED');
  });

  it('skips sending when this email type was already sent for this buyer (duplicate prevention)', async () => {
    const { sendBuyerEmail, resetEmailClientCacheForTests } = await import('./email');
    resetEmailClientCacheForTests();
    const { db, inserts } = fakeDb([{ id: 1 }]); // a prior SENT row already exists

    const result = await sendBuyerEmail(db, baseParams);

    expect(result).toEqual({ sent: false, skipped: true });
    expect(sendMock).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });
});
