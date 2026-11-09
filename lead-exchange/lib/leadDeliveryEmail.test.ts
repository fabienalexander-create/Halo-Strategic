import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqlDb } from './leadDeliveryEmail';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

interface FakeRow {
  id: number;
  lead_allocation_id: number;
  email_type: string;
  recipient: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  attempt_count: number;
}

// Same discipline as lib/email.test.ts's fakeOutboxDb, but keyed on (lead_allocation_id,
// email_type) -- this table's own idempotency boundary -- and able to simulate the database's
// release-gate trigger refusing a LEAD_UNLOCKED/INTERNAL_RELEASE_COPY insert (via blockReleaseFor).
function fakeLeadDeliveryEmailDb(
  seed: FakeRow[] = [],
  options: { blockReleaseFor?: number } = {}
): { db: SqlDb; rows: FakeRow[] } {
  const rows: FakeRow[] = seed.map((r) => ({ ...r }));
  let nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;

  const db: SqlDb = {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join(' ? ');

      if (text.includes('INSERT INTO lead_delivery_emails')) {
        const [leadAllocationId, emailType, recipient] = values as [number, string, string];
        if (
          options.blockReleaseFor === leadAllocationId &&
          (emailType === 'LEAD_UNLOCKED' || emailType === 'INTERNAL_RELEASE_COPY')
        ) {
          throw new Error(`allocation ${leadAllocationId} has no verified payment and cannot be released`);
        }
        const existing = rows.find((r) => r.lead_allocation_id === leadAllocationId && r.email_type === emailType);
        if (existing) return [];
        const row: FakeRow = {
          id: nextId++, lead_allocation_id: leadAllocationId, email_type: emailType, recipient,
          status: 'PENDING', provider_message_id: null, error_message: null, attempt_count: 0,
        };
        rows.push(row);
        return [{ id: row.id, lead_allocation_id: row.lead_allocation_id, email_type: row.email_type, recipient: row.recipient, status: row.status }];
      }

      if (text.includes('SELECT') && text.includes('WHERE lead_allocation_id') && text.includes('AND email_type')) {
        const [leadAllocationId, emailType] = values as [number, string];
        const row = rows.find((r) => r.lead_allocation_id === leadAllocationId && r.email_type === emailType);
        return row ? [{ id: row.id, lead_allocation_id: row.lead_allocation_id, email_type: row.email_type, recipient: row.recipient, status: row.status }] : [];
      }

      if (text.includes('SELECT') && text.includes('WHERE id')) {
        const [id] = values as [number];
        const row = rows.find((r) => r.id === id);
        return row ? [{ id: row.id, lead_allocation_id: row.lead_allocation_id, email_type: row.email_type, recipient: row.recipient, status: row.status }] : [];
      }

      if (text.includes("SET status = 'SENT'")) {
        const [providerMessageId, id] = values as [string | null, number];
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.status = 'SENT'; row.provider_message_id = providerMessageId; row.error_message = null; row.attempt_count += 1;
        }
        return [];
      }

      if (text.includes("SET status = 'FAILED'")) {
        const [errorMessage, id] = values as [string | null, number];
        const row = rows.find((r) => r.id === id);
        if (row) { row.status = 'FAILED'; row.error_message = errorMessage; row.attempt_count += 1; }
        return [];
      }

      throw new Error(`fakeLeadDeliveryEmailDb: unrecognised query: ${text}`);
    }),
  };

  return { db, rows };
}

const content = { subject: 'Subject', html: '<p>Body</p>', text: 'Body' };

describe('lead delivery email outbox', () => {
  beforeEach(async () => {
    sendMock.mockReset();
    process.env.RESEND_API_KEY = 'test-key';
    const { resetLeadDeliveryEmailClientCacheForTests } = await import('./leadDeliveryEmail');
    resetLeadDeliveryEmailClientCacheForTests();
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it('createLeadDeliveryEmailEntry is idempotent: a second call for the same allocation+type returns the existing row, not a new one', async () => {
    const { createLeadDeliveryEmailEntry } = await import('./leadDeliveryEmail');
    const { db, rows } = fakeLeadDeliveryEmailDb();

    const first = await createLeadDeliveryEmailEntry(db, { leadAllocationId: 1, emailType: 'LEAD_OFFER', recipient: 'buyer@example.com' });
    const second = await createLeadDeliveryEmailEntry(db, { leadAllocationId: 1, emailType: 'LEAD_OFFER', recipient: 'buyer@example.com' });

    expect(first.row?.id).toBe(second.row?.id);
    expect(rows).toHaveLength(1);
  });

  it('sendLeadDeliveryEmail sends successfully and records SENT with the provider message id', async () => {
    sendMock.mockResolvedValue({ data: { id: 'msg_123' }, error: null });
    const { sendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
    const { db, rows } = fakeLeadDeliveryEmailDb();

    const result = await sendLeadDeliveryEmail(db, { leadAllocationId: 1, emailType: 'LEAD_OFFER', to: 'buyer@example.com', ...content });

    expect(result).toEqual({ sent: true, skipped: false, blocked: false });
    expect(rows[0].status).toBe('SENT');
    expect(rows[0].provider_message_id).toBe('msg_123');
  });

  it('records FAILED (not a throw) when the provider rejects the send', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'Invalid recipient' } });
    const { sendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
    const { db, rows } = fakeLeadDeliveryEmailDb();

    const result = await sendLeadDeliveryEmail(db, { leadAllocationId: 1, emailType: 'LEAD_OFFER', to: 'buyer@example.com', ...content });

    expect(result).toEqual({ sent: false, skipped: false, blocked: false, error: 'Invalid recipient' });
    expect(rows[0].status).toBe('FAILED');
  });

  it('records FAILED without contacting the provider when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
    const { db, rows } = fakeLeadDeliveryEmailDb();

    const result = await sendLeadDeliveryEmail(db, { leadAllocationId: 1, emailType: 'LEAD_OFFER', to: 'buyer@example.com', ...content });

    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/RESEND_API_KEY/);
    expect(sendMock).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('FAILED');
  });

  it('reports blocked (not a throw, no outbox row) when the database release gate refuses a LEAD_UNLOCKED insert', async () => {
    const { sendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
    const { db, rows } = fakeLeadDeliveryEmailDb([], { blockReleaseFor: 1 });

    const result = await sendLeadDeliveryEmail(db, { leadAllocationId: 1, emailType: 'LEAD_UNLOCKED', to: 'buyer@example.com', ...content });

    expect(result.blocked).toBe(true);
    expect(result.blockedReason).toMatch(/no verified payment/);
    expect(result.sent).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });

  it('LEAD_OFFER for the same allocation is unaffected by a blocked LEAD_UNLOCKED on another allocation (release gate is per email_type, not global)', async () => {
    const { sendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
    const { db } = fakeLeadDeliveryEmailDb([], { blockReleaseFor: 1 });

    const offerResult = await sendLeadDeliveryEmail(db, { leadAllocationId: 1, emailType: 'LEAD_OFFER', to: 'buyer@example.com', ...content });

    expect(offerResult.blocked).toBe(false);
  });

  it('a retry on a FAILED row succeeds without creating a second outbox entry', async () => {
    const { createLeadDeliveryEmailEntry, attemptSendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
    const { db, rows } = fakeLeadDeliveryEmailDb();

    const created = await createLeadDeliveryEmailEntry(db, { leadAllocationId: 1, emailType: 'LEAD_OFFER', recipient: 'buyer@example.com' });
    const entryId = created.row!.id;

    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'temporary provider error' } });
    const firstAttempt = await attemptSendLeadDeliveryEmail(db, entryId, content);
    expect(firstAttempt.sent).toBe(false);
    expect(rows[0].status).toBe('FAILED');

    sendMock.mockResolvedValueOnce({ data: { id: 'msg_456' }, error: null });
    const retryResult = await attemptSendLeadDeliveryEmail(db, entryId, content);

    expect(retryResult).toEqual({ sent: true, skipped: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('SENT');
    expect(rows[0].attempt_count).toBe(2);
  });

  it('attemptSendLeadDeliveryEmail skips (does not re-contact the provider) when the row is already SENT', async () => {
    const { attemptSendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
    const { db } = fakeLeadDeliveryEmailDb([
      { id: 1, lead_allocation_id: 1, email_type: 'LEAD_OFFER', recipient: 'buyer@example.com', status: 'SENT', provider_message_id: 'msg_1', error_message: null, attempt_count: 1 },
    ]);

    const result = await attemptSendLeadDeliveryEmail(db, 1, content);

    expect(result).toEqual({ sent: false, skipped: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('two different email_types for the same allocation (LEAD_OFFER and INTERNAL_OFFER_COPY) coexist as separate rows', async () => {
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    const { sendLeadDeliveryEmail } = await import('./leadDeliveryEmail');
    const { db, rows } = fakeLeadDeliveryEmailDb();

    await sendLeadDeliveryEmail(db, { leadAllocationId: 1, emailType: 'LEAD_OFFER', to: 'buyer@example.com', ...content });
    await sendLeadDeliveryEmail(db, { leadAllocationId: 1, emailType: 'INTERNAL_OFFER_COPY', to: 'admin@example.com', ...content });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.email_type).sort()).toEqual(['INTERNAL_OFFER_COPY', 'LEAD_OFFER']);
  });
});
