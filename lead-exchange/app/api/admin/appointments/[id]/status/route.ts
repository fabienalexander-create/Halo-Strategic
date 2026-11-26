import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from '../../../../../../lib/appointments';

// Records what happened to a booked appointment (2026-11-26): rescheduled to a new time, cancelled
// by the homeowner or the buyer, the homeowner didn't attend, or completed. Every rule (which
// changes are allowed, outcomes only after the time, final states fixed) is enforced by
// lead_appointments_guard in the database; this route gives friendlier errors and the audit entry.
// A no-show or homeowner cancellation does not itself refund or replace anything: the buyer's
// claim is then recorded through the normal replacement-request process.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid appointment id.' }, { status: 400 });

  let body: { status?: string; scheduled_at?: string; outcome_notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const status = body.status as AppointmentStatus;
  if (!APPOINTMENT_STATUSES.includes(status) || status === 'BOOKED') {
    return NextResponse.json({ error: 'status must be RESCHEDULED, CANCELLED_BY_HOMEOWNER, HOMEOWNER_NO_SHOW, CANCELLED_BY_BUYER or COMPLETED.' }, { status: 400 });
  }
  let newTime: string | null = null;
  if (status === 'RESCHEDULED') {
    const t = body.scheduled_at ? new Date(body.scheduled_at) : null;
    if (!t || Number.isNaN(t.getTime()) || t.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'A rescheduled appointment needs a new date and time in the future.' }, { status: 400 });
    }
    newTime = t.toISOString();
  } else if (body.scheduled_at) {
    return NextResponse.json({ error: 'Only a reschedule can change the appointment time.' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const rows = await db.sql`SELECT id, status, scheduled_at FROM lead_appointments WHERE id = ${id}`;
    if (rows.length === 0) return NextResponse.json({ error: 'No matching appointment found.' }, { status: 404 });
    const before = rows[0] as { status: string; scheduled_at: string };

    let updated;
    try {
      updated = await db.sql`
        UPDATE lead_appointments
           SET status = ${status}, scheduled_at = COALESCE(${newTime}::timestamptz, scheduled_at),
               outcome_notes = COALESCE(${body.outcome_notes?.trim() || null}, outcome_notes),
               updated_by = ${auth.session.email}, updated_at = now()
         WHERE id = ${id}
         RETURNING status, scheduled_at
      `;
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/appointment|cannot be changed|has not happened yet/i.test(message)) {
        // The database's own explanation is written for an admin and holds no personal data.
        return NextResponse.json({ error: message.replace(/^.*?ERROR:\s*/, '') }, { status: 409 });
      }
      throw err;
    }

    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
      VALUES (${auth.session.email}, 'APPOINTMENT_STATUS_RECORDED', 'lead_appointment', ${id},
              ${JSON.stringify(before)}, ${JSON.stringify({ ...updated[0], outcome_notes: body.outcome_notes ?? null })})
    `;
    return NextResponse.json({ status: updated[0].status, scheduled_at: updated[0].scheduled_at });
  } catch (err) {
    console.error('Recording appointment status failed', err);
    return NextResponse.json({ error: 'Failed to record the appointment status.' }, { status: 500 });
  }
}
