import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

// Read-only visibility into the lead-sheet-sync outbox, same shape as the existing
// transactional-emails admin view -- so a failed sync into the operational Google Sheet is
// visible without digging through function logs.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const db = getDatabase();
  const rows = await db.sql`
    SELECT s.id, s.lead_id, l.industry_id, s.status, s.sheet_row_number, s.attempt_count,
           s.error_message, s.synced_at, s.created_at
    FROM lead_sheet_syncs s
    JOIN leads l ON l.id = s.lead_id
    ORDER BY s.created_at DESC
    LIMIT 200
  `;
  return NextResponse.json({ syncs: rows });
}
