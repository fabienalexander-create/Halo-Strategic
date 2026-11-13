import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { attemptSync, buildLeadRowValues } from '../../../../../../lib/sheetsSync';

const INDUSTRY_LABELS: Record<string, string> = {
  spray_foam_removal: 'Spray Foam Removal',
  solar_battery: 'Solar & Battery',
  roofing: 'Roofing',
};

// Retries a FAILED (or still-PENDING) sync entry WITHOUT repeating the original enquiry --
// idempotent in the same way the transactional-email retry is: attemptSync skips an entry already
// SYNCED, and separately checks the sheet itself by lead reference before appending, so retrying
// something that actually succeeded just before this request landed never creates a duplicate row.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const syncId = Number(params.id);
  if (!Number.isInteger(syncId)) {
    return NextResponse.json({ error: 'Invalid sync id.' }, { status: 400 });
  }

  const db = getDatabase();
  const rows = await db.sql`
    SELECT
      s.id AS sync_id, l.id AS lead_id, i.slug AS industry_slug,
      l.homeowner_name, l.homeowner_contact, l.postcode, l.acquisition_campaign, l.created_at,
      cr.wording_version, cr.source
    FROM lead_sheet_syncs s
    JOIN leads l ON l.id = s.lead_id
    JOIN industries i ON i.id = l.industry_id
    LEFT JOIN consent_records cr ON cr.id = l.consent_record_id
    WHERE s.id = ${syncId}
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No matching sync entry found.' }, { status: 404 });
  }

  const row = rows[0] as {
    sync_id: number; lead_id: number; industry_slug: string;
    homeowner_name: string; homeowner_contact: { email?: string; mobile?: string };
    postcode: string; acquisition_campaign: string | null; created_at: string;
    wording_version: string | null; source: string | null;
  };

  const leadReference = `HLX-LEAD-${String(row.lead_id).padStart(6, '0')}`;
  const rowValues = buildLeadRowValues({
    leadReference,
    industryLabel: INDUSTRY_LABELS[row.industry_slug] ?? row.industry_slug,
    campaignOrSource: row.acquisition_campaign ?? 'Website form',
    receivedAt: new Date(row.created_at).toISOString(),
    fullName: row.homeowner_name,
    phone: row.homeowner_contact?.mobile ?? '',
    email: row.homeowner_contact?.email ?? '',
    postcode: row.postcode,
    consentSummary: row.wording_version ? `${row.wording_version} via ${row.source}` : 'Not recorded',
  });

  const result = await attemptSync(db, syncId, leadReference, rowValues);
  return NextResponse.json(result);
}
