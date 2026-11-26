import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

// Booked appointments (2026-11-26), soonest first, with their recorded history.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  try {
    const db = getDatabase();
    const rows = await db.sql`
      SELECT ap.id, ap.lead_allocation_id, ap.scheduled_at, ap.appointment_kind, ap.location_notes,
             ap.homeowner_confirmed_at, ap.arranged_by, ap.status, ap.outcome_notes, ap.updated_by, ap.updated_at,
             a.lead_id, a.buyer_id, b.company_name, l.postcode, a.status AS allocation_status,
             EXISTS (SELECT 1 FROM deliveries d WHERE d.lead_allocation_id = a.id AND d.status = 'SENT') AS delivered,
             (SELECT json_agg(json_build_object('event', e.event, 'scheduled_at', e.new_scheduled_at,
                                                'notes', e.notes, 'actor', e.actor, 'at', e.created_at) ORDER BY e.id)
                FROM lead_appointment_events e WHERE e.lead_appointment_id = ap.id) AS history
      FROM lead_appointments ap
      JOIN lead_allocations a ON a.id = ap.lead_allocation_id
      JOIN buyers b ON b.id = a.buyer_id
      JOIN leads l ON l.id = a.lead_id
      ORDER BY (ap.status IN ('BOOKED', 'RESCHEDULED')) DESC, ap.scheduled_at
      LIMIT 300
    `;
    return NextResponse.json({ appointments: rows });
  } catch (err) {
    console.error('Listing appointments failed', err);
    return NextResponse.json({ error: 'Failed to list appointments.' }, { status: 500 });
  }
}
