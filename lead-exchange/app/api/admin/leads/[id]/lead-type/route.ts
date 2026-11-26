import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';

// Changes a lead between VERIFIED_ENQUIRY and BOOKED_APPOINTMENT (booked appointments,
// 2026-11-26) -- e.g. once Halo has phoned the homeowner and agreed a time. Only before the lead
// has ever been allocated: leads_lead_type_guard refuses it afterwards, whatever this route says.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const leadId = Number(params.id);
  if (!Number.isInteger(leadId)) return NextResponse.json({ error: 'Invalid lead id.' }, { status: 400 });

  let body: { lead_type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (body.lead_type !== 'VERIFIED_ENQUIRY' && body.lead_type !== 'BOOKED_APPOINTMENT') {
    return NextResponse.json({ error: "lead_type must be 'VERIFIED_ENQUIRY' or 'BOOKED_APPOINTMENT'." }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const leads = await db.sql`
      SELECT l.lead_type, EXISTS (SELECT 1 FROM lead_allocations a WHERE a.lead_id = l.id) AS allocated
      FROM leads l WHERE l.id = ${leadId}
    `;
    if (leads.length === 0) return NextResponse.json({ error: 'No matching lead found.' }, { status: 404 });
    if (leads[0].allocated) {
      return NextResponse.json({ error: 'This lead has been allocated; its type can no longer be changed.' }, { status: 409 });
    }
    if (leads[0].lead_type === body.lead_type) return NextResponse.json({ lead_type: body.lead_type, changed: false });

    try {
      await db.sql`UPDATE leads SET lead_type = ${body.lead_type} WHERE id = ${leadId}`;
    } catch (err) {
      if (/cannot be changed/i.test(err instanceof Error ? err.message : '')) {
        return NextResponse.json({ error: 'This lead has been allocated; its type can no longer be changed.' }, { status: 409 });
      }
      throw err;
    }
    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
      VALUES (${auth.session.email}, 'LEAD_TYPE_CHANGED', 'lead', ${leadId},
              ${JSON.stringify({ lead_type: leads[0].lead_type })}, ${JSON.stringify({ lead_type: body.lead_type })})
    `;
    return NextResponse.json({ lead_type: body.lead_type, changed: true });
  } catch (err) {
    console.error('Changing lead type failed', err);
    return NextResponse.json({ error: 'Failed to change lead type.' }, { status: 500 });
  }
}
