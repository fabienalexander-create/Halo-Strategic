// Booked appointments (2026-11-26): small shared helpers. The rules themselves live in the
// database (netlify/database/migrations/20261126150000_booked_appointments.sql); these only read.
import type { AppointmentDetails } from './emailTemplates';

export const APPOINTMENT_STATUSES = [
  'BOOKED', 'RESCHEDULED', 'CANCELLED_BY_HOMEOWNER', 'HOMEOWNER_NO_SHOW', 'CANCELLED_BY_BUYER', 'COMPLETED',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

// Statuses that can be recorded only once the appointment time has passed (enforced in SQL too).
export const AFTER_THE_TIME_STATUSES: AppointmentStatus[] = ['HOMEOWNER_NO_SHOW', 'COMPLETED'];
// Final statuses: nothing about the appointment can change afterwards.
export const FINAL_STATUSES: AppointmentStatus[] = ['CANCELLED_BY_HOMEOWNER', 'HOMEOWNER_NO_SHOW', 'CANCELLED_BY_BUYER', 'COMPLETED'];

// Columns to LEFT JOIN from lead_appointments as appt_scheduled_at, appt_kind, appt_location_notes;
// turns them into the emails' appointment details (null when the lead is not an appointment).
// Read at send time, so a rescheduled appointment shows its current time.
export function appointmentFromRow(row: {
  appt_scheduled_at?: string | Date | null; appt_kind?: string | null; appt_location_notes?: string | null;
}): AppointmentDetails | null {
  if (!row.appt_scheduled_at || !row.appt_kind) return null;
  return { scheduledAt: row.appt_scheduled_at, kind: row.appt_kind as AppointmentDetails['kind'], locationNotes: row.appt_location_notes ?? null };
}
