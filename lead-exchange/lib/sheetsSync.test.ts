import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqlDb } from './sheetsSync';

const getMock = vi.fn();
const appendMock = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    auth: { JWT: vi.fn().mockImplementation(() => ({})) },
    sheets: vi.fn().mockImplementation(() => ({
      spreadsheets: { values: { get: getMock, append: appendMock } },
    })),
  },
}));

interface FakeRow {
  id: number;
  lead_id: number;
  status: string;
  sheet_row_number: number | null;
  attempt_count: number;
  error_message: string | null;
}

// A minimal in-memory stand-in for the lead_sheet_syncs outbox table -- realistic enough to
// exercise createSyncEntry / attemptSync's actual SQL shapes, same discipline as lib/email.test.ts.
function fakeSyncDb(seed: FakeRow[] = []): { db: SqlDb; rows: FakeRow[] } {
  const rows: FakeRow[] = seed.map((r) => ({ ...r }));
  let nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;

  const db: SqlDb = {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join(' ? ');

      if (text.includes('INSERT INTO lead_sheet_syncs')) {
        const [leadId] = values as [number];
        const existing = rows.find((r) => r.lead_id === leadId);
        if (existing) return []; // ON CONFLICT DO NOTHING
        const row: FakeRow = { id: nextId++, lead_id: leadId, status: 'PENDING', sheet_row_number: null, attempt_count: 0, error_message: null };
        rows.push(row);
        return [{ id: row.id, lead_id: row.lead_id, status: row.status, sheet_row_number: row.sheet_row_number }];
      }

      if (text.includes('SELECT') && text.includes('WHERE lead_id')) {
        const [leadId] = values as [number];
        const row = rows.find((r) => r.lead_id === leadId);
        return row ? [{ id: row.id, lead_id: row.lead_id, status: row.status, sheet_row_number: row.sheet_row_number }] : [];
      }

      if (text.includes('SELECT') && text.includes('WHERE id')) {
        const [id] = values as [number];
        const row = rows.find((r) => r.id === id);
        return row ? [{ id: row.id, lead_id: row.lead_id, status: row.status, sheet_row_number: row.sheet_row_number }] : [];
      }

      if (text.includes("SET status = 'SYNCED'")) {
        const [sheetRowNumber, id] = values as [number | null, number];
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.status = 'SYNCED';
          row.sheet_row_number = sheetRowNumber;
          row.error_message = null;
          row.attempt_count += 1;
        }
        return [];
      }

      if (text.includes("SET status = 'FAILED'")) {
        const [errorMessage, id] = values as [string, number];
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.status = 'FAILED';
          row.error_message = errorMessage;
          row.attempt_count += 1;
        }
        return [];
      }

      throw new Error(`fakeSyncDb: unrecognised query: ${text}`);
    }),
  };

  return { db, rows };
}

const rowValues = ['HLX-LEAD-000001', 'Solar & Battery', 'Website form', '2026-11-07T00:00:00.000Z', 'Test Person', '07000000000', 't@example.com', 'SW1A 1AA', 'v1 via form'];

describe('lead sheet sync outbox', () => {
  beforeEach(async () => {
    getMock.mockReset();
    appendMock.mockReset();
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL = 'test@example.iam.gserviceaccount.com';
    process.env.GOOGLE_SHEETS_PRIVATE_KEY = 'fake-key';
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'fake-sheet-id';
    const { resetSheetsClientCacheForTests } = await import('./sheetsSync');
    resetSheetsClientCacheForTests();
  });

  afterEach(() => {
    delete process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    delete process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  });

  it('createSyncEntry is idempotent: a second call for the same lead returns the existing row, not a new one', async () => {
    const { createSyncEntry } = await import('./sheetsSync');
    const { db, rows } = fakeSyncDb();

    const first = await createSyncEntry(db, { leadId: 1 });
    const second = await createSyncEntry(db, { leadId: 1 });

    expect(first.id).toBe(second.id);
    expect(rows).toHaveLength(1);
  });

  it('appends successfully and records SYNCED with the row number parsed from the API response', async () => {
    getMock.mockResolvedValue({ data: { values: [] } }); // no existing row found
    appendMock.mockResolvedValue({ data: { updates: { updatedRange: "'01 Leads (Master)'!A42:AA42" } } });
    const { createSyncEntry, attemptSync } = await import('./sheetsSync');
    const { db, rows } = fakeSyncDb();
    const entry = await createSyncEntry(db, { leadId: 1 });

    const result = await attemptSync(db, entry.id, 'HLX-LEAD-000001', rowValues);

    expect(result).toEqual({ synced: true, skipped: false, rowNumber: 42 });
    expect(rows[0].status).toBe('SYNCED');
    expect(rows[0].sheet_row_number).toBe(42);
    expect(appendMock).toHaveBeenCalledTimes(1);
  });

  it('self-heals instead of double-appending when the row already exists in the sheet (e.g. a crash between a successful append and recording SYNCED)', async () => {
    getMock.mockResolvedValue({ data: { values: [['HLX-LEAD-000001'], ['HLX-LEAD-000002']] } });
    const { createSyncEntry, attemptSync } = await import('./sheetsSync');
    const { db, rows } = fakeSyncDb();
    const entry = await createSyncEntry(db, { leadId: 1 });

    const result = await attemptSync(db, entry.id, 'HLX-LEAD-000001', rowValues);

    expect(result).toEqual({ synced: false, skipped: true, alreadyPresent: true, rowNumber: 1 });
    expect(rows[0].status).toBe('SYNCED');
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('records FAILED (not a throw) when the Sheets API call throws, and leaves the row retryable', async () => {
    getMock.mockResolvedValue({ data: { values: [] } });
    appendMock.mockRejectedValue(new Error('Google Sheets API rate limited'));
    const { createSyncEntry, attemptSync } = await import('./sheetsSync');
    const { db, rows } = fakeSyncDb();
    const entry = await createSyncEntry(db, { leadId: 1 });

    const result = await attemptSync(db, entry.id, 'HLX-LEAD-000001', rowValues);

    expect(result.synced).toBe(false);
    expect(result.error).toMatch(/rate limited/);
    expect(rows[0].status).toBe('FAILED');
  });

  it('records FAILED without contacting the API when Google Sheets env vars are missing', async () => {
    delete process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const { createSyncEntry, attemptSync } = await import('./sheetsSync');
    const { db, rows } = fakeSyncDb();
    const entry = await createSyncEntry(db, { leadId: 1 });

    const result = await attemptSync(db, entry.id, 'HLX-LEAD-000001', rowValues);

    expect(result.synced).toBe(false);
    expect(result.error).toMatch(/not configured/);
    expect(getMock).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('FAILED');
  });

  it('a retry on a FAILED row succeeds without creating a second sync entry', async () => {
    const { createSyncEntry, attemptSync } = await import('./sheetsSync');
    const { db, rows } = fakeSyncDb();
    const entry = await createSyncEntry(db, { leadId: 1 });

    getMock.mockResolvedValueOnce({ data: { values: [] } });
    appendMock.mockRejectedValueOnce(new Error('temporary outage'));
    const firstAttempt = await attemptSync(db, entry.id, 'HLX-LEAD-000001', rowValues);
    expect(firstAttempt.synced).toBe(false);
    expect(rows[0].status).toBe('FAILED');

    // The retry (the admin "retry" endpoint) is called with the SAME sync id -- it never re-runs
    // the enquiry insert, and never creates a new lead_sheet_syncs row.
    getMock.mockResolvedValueOnce({ data: { values: [] } });
    appendMock.mockResolvedValueOnce({ data: { updates: { updatedRange: "'01 Leads (Master)'!A5:AA5" } } });
    const retryResult = await attemptSync(db, entry.id, 'HLX-LEAD-000001', rowValues);

    expect(retryResult).toEqual({ synced: true, skipped: false, rowNumber: 5 });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('SYNCED');
    expect(rows[0].attempt_count).toBe(2);
  });

  it('attemptSync skips (never calls the API) when the row is already SYNCED', async () => {
    const { attemptSync } = await import('./sheetsSync');
    const { db } = fakeSyncDb([{ id: 1, lead_id: 1, status: 'SYNCED', sheet_row_number: 7, attempt_count: 1, error_message: null }]);

    const result = await attemptSync(db, 1, 'HLX-LEAD-000001', rowValues);

    expect(result).toEqual({ synced: false, skipped: true, rowNumber: 7 });
    expect(getMock).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
  });
});
