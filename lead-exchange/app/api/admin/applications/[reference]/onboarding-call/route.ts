import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '../../../../../../lib/requireAdmin';

interface OnboardingCallPayload {
  conducted_by?: unknown;
  completed_at?: unknown;
  confirm_call_took_place?: unknown;
}

// The conductor is stored as plain text, shown back in the admin UI (React escapes it on render)
// and copied into the audit log. Keep it to a short, single-line name: no control characters,
// no newlines, bounded length.
function cleanConductor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/[\u0000-\u001f\u007f<>]/.test(value)) return null; // control characters (incl. line breaks) and angle brackets
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 2 || cleaned.length > 100) return null;
  return cleaned;
}

// Records that the mandatory onboarding call has taken place. Only valid once the application has
// been reviewed and approved (PENDING_COMMERCIALS): application review first, call second. This
// is a recorded milestone, not a status -- the ../activate step refuses to run without it.
export async function POST(req: NextRequest, { params }: { params: { reference: string } }) {
  const auth = await requireOwner(req);
  if ('response' in auth) return auth.response;

  let body: OnboardingCallPayload = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (body.confirm_call_took_place !== true) {
    return NextResponse.json(
      { error: 'You must confirm that the onboarding call has actually taken place (confirm_call_took_place: true).' },
      { status: 400 }
    );
  }

  const conductedBy = cleanConductor(body.conducted_by ?? auth.session.email);
  if (!conductedBy) {
    return NextResponse.json(
      { error: 'conducted_by must be a plain-text name of 2 to 100 characters with no line breaks or angle brackets.' },
      { status: 400 }
    );
  }

  let completedAt: string | null = null;
  if (body.completed_at !== undefined && body.completed_at !== null) {
    if (typeof body.completed_at !== 'string') {
      return NextResponse.json({ error: 'completed_at must be a valid date-time.' }, { status: 400 });
    }
    const parsed = new Date(body.completed_at);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'completed_at must be a valid date-time.' }, { status: 400 });
    }
    if (parsed.getTime() > Date.now() + 60_000) {
      return NextResponse.json({ error: 'completed_at cannot be in the future.' }, { status: 400 });
    }
    completedAt = parsed.toISOString();
  }

  try {
    const db = getDatabase();
    const buyers = await db.sql`
      SELECT id, application_status, onboarding_call_completed_at
      FROM buyers WHERE application_reference = ${params.reference}
    `;
    if (buyers.length === 0) {
      return NextResponse.json({ error: 'No matching application found.' }, { status: 404 });
    }

    const buyer = buyers[0];
    if (buyer.application_status !== 'PENDING_COMMERCIALS') {
      return NextResponse.json(
        {
          error: `The onboarding call is recorded after application review, while PENDING_COMMERCIALS. Current status: ${buyer.application_status}.`,
          current_status: buyer.application_status,
        },
        { status: 409 }
      );
    }
    if (buyer.onboarding_call_completed_at) {
      return NextResponse.json({ error: 'An onboarding call is already recorded for this buyer.' }, { status: 409 });
    }

    await db.sql`
      UPDATE buyers SET
        onboarding_call_completed_at = COALESCE(${completedAt}::timestamptz, now()),
        onboarding_call_conducted_by = ${conductedBy},
        updated_at = now()
      WHERE id = ${buyer.id}
    `;

    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
      VALUES (${auth.session.email}, 'BUYER_ONBOARDING_CALL_RECORDED', 'buyer', ${buyer.id},
        ${JSON.stringify({ conducted_by: conductedBy, completed_at: completedAt ?? 'now' })})
    `;

    return NextResponse.json({ onboarding_call_recorded: true });
  } catch (err) {
    console.error('Recording onboarding call failed', err);
    return NextResponse.json({ error: 'Failed to record onboarding call.' }, { status: 500 });
  }
}
