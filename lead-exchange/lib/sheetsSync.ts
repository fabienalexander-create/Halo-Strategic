import { google } from 'googleapis';

// Narrow structural type for the one thing we need from @netlify/database's getDatabase() return
// value (or a transaction client exposing the same .sql tag) -- same pattern as lib/email.ts, so
// this module and its tests don't need the real database client.
export interface SqlDb {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<Array<Record<string, unknown>>>;
}

export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface LeadSheetSyncRow {
  id: number;
  lead_id: number;
  status: SyncStatus;
  sheet_row_number: number | null;
}

const SHEET_TAB = '01 Leads (Master)';
// A1:AA1 -- 27 columns, exactly as read from the live sheet (see the integration design doc).
const SHEET_RANGE = `'${SHEET_TAB}'!A1`;

let cachedSheetsClient: ReturnType<typeof google.sheets> | null = null;

function getClient(): { sheets: ReturnType<typeof google.sheets>; spreadsheetId: string } | null {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!clientEmail || !privateKey || !spreadsheetId) return null;

  if (!cachedSheetsClient) {
    const auth = new google.auth.JWT({
      email: clientEmail,
      // Netlify env vars store literal \n, not real newlines -- same handling any service-account
      // key needs when passed through an environment variable rather than a JSON file.
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    cachedSheetsClient = google.sheets({ version: 'v4', auth });
  }
  return { sheets: cachedSheetsClient, spreadsheetId };
}

// Exposed only so tests can reset the module-level cache between cases.
export function resetSheetsClientCacheForTests(): void {
  cachedSheetsClient = null;
}

/**
 * Creates the sync outbox row for one lead, or returns the existing one. This IS the idempotency
 * boundary: lead_id is unique, so calling this twice for the same lead (e.g. a retried request)
 * never creates a second row. Call this in the SAME transaction as the lead insert, not
 * afterwards, so the sync entry can never be lost even if the process dies before commit.
 */
export async function createSyncEntry(db: SqlDb, params: { leadId: number }): Promise<LeadSheetSyncRow> {
  const inserted = await db.sql`
    INSERT INTO lead_sheet_syncs (lead_id, status)
    VALUES (${params.leadId}, 'PENDING')
    ON CONFLICT (lead_id) DO NOTHING
    RETURNING id, lead_id, status, sheet_row_number
  `;
  if (inserted.length > 0) {
    return inserted[0] as unknown as LeadSheetSyncRow;
  }
  const existing = await db.sql`
    SELECT id, lead_id, status, sheet_row_number FROM lead_sheet_syncs WHERE lead_id = ${params.leadId}
  `;
  return existing[0] as unknown as LeadSheetSyncRow;
}

export interface AttemptSyncResult {
  synced: boolean;
  skipped: boolean;
  alreadyPresent?: boolean;
  rowNumber?: number;
  error?: string;
}

/**
 * Finds a row already carrying this lead reference in column A, so a retry after a successful
 * append that never got recorded (e.g. the process died between the API call returning and the
 * UPDATE that marks SYNCED) can heal itself instead of appending a second row. Returns the
 * spreadsheet row number (1-indexed) if found, else null.
 */
async function findExistingRow(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  leadReference: string
): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET_TAB}'!A:A`,
  });
  const rows = res.data.values ?? [];
  const index = rows.findIndex((row) => row[0] === leadReference);
  return index === -1 ? null : index + 1; // 1-indexed row number
}

/**
 * Attempts to append a lead's row to the operational sheet. Idempotent in two layers: a row
 * already SYNCED is skipped without calling the Sheets API at all; and even on a fresh attempt,
 * the sheet itself is checked by lead reference before appending, so a retry after an
 * unconfirmed-but-actually-successful previous append can never create a duplicate row. Never
 * throws -- callers (the enquiry route, the admin retry endpoint) rely on that so a Sheets failure
 * can never undo an already-committed database write.
 */
export async function attemptSync(
  db: SqlDb,
  syncId: number,
  leadReference: string,
  rowValues: string[]
): Promise<AttemptSyncResult> {
  const rows = await db.sql`
    SELECT id, lead_id, status, sheet_row_number FROM lead_sheet_syncs WHERE id = ${syncId}
  `;
  if (rows.length === 0) {
    return { synced: false, skipped: false, error: 'Sync entry not found' };
  }
  const row = rows[0] as unknown as LeadSheetSyncRow;
  if (row.status === 'SYNCED') {
    return { synced: false, skipped: true, rowNumber: row.sheet_row_number ?? undefined };
  }

  const client = getClient();
  if (!client) {
    const message = 'Google Sheets is not configured (missing GOOGLE_SHEETS_* environment variables)';
    console.error(`Sheet sync not attempted (${message}): lead ${row.lead_id} (sync #${syncId})`);
    await markOutcome(db, syncId, { status: 'FAILED', errorMessage: message });
    return { synced: false, skipped: false, error: message };
  }

  try {
    const existingRow = await findExistingRow(client.sheets, client.spreadsheetId, leadReference);
    if (existingRow !== null) {
      await markOutcome(db, syncId, { status: 'SYNCED', sheetRowNumber: existingRow });
      return { synced: false, skipped: true, alreadyPresent: true, rowNumber: existingRow };
    }

    const appendResult = await client.sheets.spreadsheets.values.append({
      spreadsheetId: client.spreadsheetId,
      range: SHEET_RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowValues] },
    });

    const updatedRange = appendResult.data.updates?.updatedRange ?? '';
    const rowMatch = updatedRange.match(/![A-Z]+(\d+)/);
    const rowNumber = rowMatch ? Number(rowMatch[1]) : undefined;

    await markOutcome(db, syncId, { status: 'SYNCED', sheetRowNumber: rowNumber ?? null });
    return { synced: true, skipped: false, rowNumber };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Sheet sync failed: lead ${row.lead_id} (sync #${syncId})`, err);
    await markOutcome(db, syncId, { status: 'FAILED', errorMessage: message });
    return { synced: false, skipped: false, error: message };
  }
}

/**
 * Builds the row in the exact column order of '01 Leads (Master)' (confirmed by reading the live
 * sheet -- see the integration design doc). Only the fields the enquiry itself provides are set;
 * everything an admin fills in later (qualification, buyer assignment, delivery, pricing) is left
 * blank, or set to the sheet's own existing "not started yet" convention, and is never touched by
 * a later sync run for the same lead.
 */
export function buildLeadRowValues(params: {
  leadReference: string;
  industryLabel: string;
  campaignOrSource: string;
  receivedAt: string;
  fullName: string;
  phone: string;
  email: string;
  postcode: string;
  consentSummary: string;
}): string[] {
  return [
    params.leadReference,
    params.industryLabel,
    params.campaignOrSource,
    params.receivedAt,
    params.fullName,
    params.phone,
    params.email,
    params.postcode,
    params.consentSummary,
    'NOT STARTED', // Qualification Status
    '', // Qualification Notes
    'NOT CHECKED', // Duplicate Check
    '', // Assigned Buyer
    '', // Delivery Timestamp
    '', // Delivery Channel
    '', // Buyer Contact Deadline
    '', // Reminder 1 Sent (24h)
    '', // Reminder 2 Sent (48h)
    '', // Overdue Escalated (72h)
    '', // Buyer Contact Outcome
    '', // Dispute/Replacement Status
    'PENDING', // Chargeable Status
    '', // Price
    'GBP', // Currency
    'N', // Credit Deducted (Y/N)
    '', // Order/Invoice Ref
    '', // Notes
  ];
}

async function markOutcome(
  db: SqlDb,
  syncId: number,
  outcome: { status: 'SYNCED'; sheetRowNumber: number | null } | { status: 'FAILED'; errorMessage: string }
): Promise<void> {
  try {
    if (outcome.status === 'SYNCED') {
      await db.sql`
        UPDATE lead_sheet_syncs
        SET status = 'SYNCED', sheet_row_number = ${outcome.sheetRowNumber}, error_message = NULL,
            attempt_count = attempt_count + 1, synced_at = now(), updated_at = now()
        WHERE id = ${syncId}
      `;
    } else {
      await db.sql`
        UPDATE lead_sheet_syncs
        SET status = 'FAILED', error_message = ${outcome.errorMessage},
            attempt_count = attempt_count + 1, updated_at = now()
        WHERE id = ${syncId}
      `;
    }
  } catch (err) {
    // Recording the outcome is best-effort -- never let it surface as a sync failure, and never
    // let it affect the caller's already-committed database transaction.
    console.error(`Failed to record outcome for sync #${syncId}`, err);
  }
}
