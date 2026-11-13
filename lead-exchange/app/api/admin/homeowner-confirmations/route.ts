import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

interface Body {
  lead_id?: number;
  buyer_id?: number;
  named_business?: string;
  purpose?: string;
  wording_used?: string;
  homeowner_response?: string;
  method?: 'SMS_YES' | 'ADMIN_AFTER_CALL';
  confirmed_at?: string;
  notes?: string;
  evidence_ref?: string;
}

const REQUIRED_FIELDS: (keyof Body)[] = [
  'lead_id', 'buyer_id', 'named_business', 'purpose', 'wording_used', 'homeowner_response', 'method', 'confirmed_at',
];

// Records the homeowner's explicit YES to being introduced to one named business, before any
// offer is made -- the migration's homeowner_confirmations table, never inferred from the
// enquiry form's general sharing consent (that's consent_records, a different, broader thing).
// Until an SMS flow exists, this is always ADMIN_AFTER_CALL: an admin took the call and is
// recording it here, with notes required (also enforced by the DB check).
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const missing = REQUIRED_FIELDS.filter((f) => !body[f]);
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Missing required field(s).', missing_fields: missing }, { status: 400 });
  }
  if (body.method !== 'SMS_YES' && body.method !== 'ADMIN_AFTER_CALL') {
    return NextResponse.json({ error: "method must be 'SMS_YES' or 'ADMIN_AFTER_CALL'." }, { status: 400 });
  }
  if (body.method === 'ADMIN_AFTER_CALL' && !body.notes?.trim()) {
    return NextResponse.json({ error: 'notes are required when method is ADMIN_AFTER_CALL.' }, { status: 400 });
  }

  try {
    const db = getDatabase();

    const leads = await db.sql`SELECT id, industry_id FROM leads WHERE id = ${body.lead_id}`;
    if (leads.length === 0) {
      return NextResponse.json({ error: 'No matching lead found.' }, { status: 404 });
    }
    const buyers = await db.sql`SELECT id, industry_id, company_name FROM buyers WHERE id = ${body.buyer_id}`;
    if (buyers.length === 0) {
      return NextResponse.json({ error: 'No matching buyer found.' }, { status: 404 });
    }
    if (buyers[0].industry_id !== leads[0].industry_id) {
      return NextResponse.json({ error: "This buyer and lead are in different industries." }, { status: 400 });
    }

    const existingActive = await db.sql`
      SELECT id FROM homeowner_confirmations
      WHERE lead_id = ${body.lead_id} AND buyer_id = ${body.buyer_id} AND withdrawn_at IS NULL
    `;
    if (existingActive.length > 0) {
      return NextResponse.json(
        { error: 'An active confirmation already exists for this lead and buyer.', confirmation_id: existingActive[0].id },
        { status: 409 }
      );
    }

    const inserted = await db.sql`
      INSERT INTO homeowner_confirmations (
        lead_id, buyer_id, named_business, purpose, wording_used, homeowner_response,
        method, confirmed_at, recorded_by, notes, evidence_ref
      ) VALUES (
        ${body.lead_id}, ${body.buyer_id}, ${body.named_business}, ${body.purpose}, ${body.wording_used},
        ${body.homeowner_response}, ${body.method}, ${body.confirmed_at}, ${auth.session.email},
        ${body.notes ?? null}, ${body.evidence_ref ?? null}
      )
      RETURNING id
    `;
    const confirmationId = inserted[0].id;

    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
      VALUES (
        ${auth.session.email}, 'HOMEOWNER_CONFIRMATION_RECORDED', 'homeowner_confirmation', ${confirmationId},
        ${JSON.stringify({ lead_id: body.lead_id, buyer_id: body.buyer_id, method: body.method })}
      )
    `;

    return NextResponse.json({ id: confirmationId }, { status: 201 });
  } catch (err) {
    console.error('Recording homeowner confirmation failed', err);
    return NextResponse.json({ error: 'Failed to record confirmation.' }, { status: 500 });
  }
}
