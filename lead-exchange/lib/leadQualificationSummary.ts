// Turns a lead's qualification_answers JSON into a short, ordered, human-readable list -- used by
// both the admin leads UI (so an admin can actually see what was asked, not just postcode/status)
// and the buyer offer email (a redacted subset, pre-payment-safe: none of these keys are ever
// personal contact detail).
//
// Website-sourced and Meta-sourced leads use slightly different field names for the same
// question (e.g. reason_for_removal vs reason_for_enquiry) -- each entry lists every key that
// could hold the answer, in priority order, so one lead's answers render correctly regardless of
// which intake path it came from. Never a fixed enum: Meta's own question text isn't controlled
// by this codebase, and the website form's fields were already named before this file existed.
const QUALIFICATION_DISPLAY_FIELDS: { keys: string[]; label: string }[] = [
  { keys: ['foam_location'], label: 'Foam location' },
  { keys: ['foam_type', 'foam_extent'], label: 'Foam type' },
  { keys: ['reason_for_enquiry', 'reason_for_removal'], label: 'Reason for enquiry' },
  { keys: ['timeframe'], label: 'Timeframe' },
  { keys: ['roof_access'], label: 'Roof access' },
  { keys: ['loft_size_estimate'], label: 'Loft/roof size' },
  { keys: ['previous_inspection', 'previous_quotes'], label: 'Previous inspection or quotes' },
  { keys: ['preferred_contact_method'], label: 'Preferred contact method' },
  { keys: ['appointment_availability'], label: 'Appointment availability' },
];

export interface QualificationLine {
  label: string;
  value: string;
}

// Only ever reads the allowlisted keys above -- whatever else is in qualification_answers
// (consent flags, campaign metadata, the manual-review classification) is deliberately never
// included, so this can't accidentally leak something that wasn't meant to be shown here.
export function buildQualificationSummary(answers: Record<string, unknown> | null | undefined): QualificationLine[] {
  if (!answers) return [];
  const lines: QualificationLine[] = [];
  for (const field of QUALIFICATION_DISPLAY_FIELDS) {
    const key = field.keys.find((k) => {
      const v = answers[k];
      return typeof v === 'string' && v.trim().length > 0;
    });
    if (key) lines.push({ label: field.label, value: String(answers[key]) });
  }
  return lines;
}
