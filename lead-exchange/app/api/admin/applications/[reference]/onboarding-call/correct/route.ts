import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '../../../../../../../lib/requireAdmin';

interface CorrectionPayload {
  reason?: unknown;
  confirm_correction?: unknown;
}

const MIN_REASON = 10;
const MAX_REASON = 500;

function cleanReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/[\u0000-\u0008\u000b-\u001f\u007f<>]/.test(value)) return null; // control chars (tab and newline allowed) and angle brackets
  const cleaned = value.trim();
  if (cleaned.length < MIN_REASON || cleaned.length > MAX_REASON) return null;
  return cleaned;
}

// Corrects a mistaken onboarding-call record. Owner only, only while PENDING_COMMERCIALS, a written
// reason and an explicit confirmation are mandatory. The previous call details and the reason are
// written to the append-only audit log in the SAME statement that clears the record, so the
// correction cannot happen without its audit entry (and vice versa). Nothing is silently
// overwritten: the original BUYER_ONBOARDING_CALL_RECORDED entry stays in the log untouched.
// After correction the call can be recorded again through ../ (the normal route).
export async function POST(req: NextRequest, { params }: { params: { reference: string } }) {
  const auth = await requireOwner(req);
  if ('response' in auth) return auth.response;

  let body: CorrectionPayload = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (body.confirm_correction !== true) {
    return NextResponse.json(
      { error: 'You must explicitly confirm the correction (confirm_correction: true).' },
      { status: 400 }
    );
  }
  const reason = cleanReason(body.reason);
  if (!reason) {
    return NextResponse.json(
      { error: `A written reason of ${MIN_REASON} to ${MAX_REASON} characters is required (no angle brackets).` },
      { status: 400 }
    );
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
          error: `A call record can only be corrected while PENDING_COMMERCIALS. Current status: ${buyer.application_status}.`,
          current_status: buyer.application_status,
        },
        { status: 409 }
      );
    }
    if (!buyer.onboarding_call_completed_at) {
      return NextResponse.json({ error: 'There is no onboarding call record to correct.' }, { status: 409 });
    }

    // One statement: lock the row, capture the previous values, clear them, write the audit entry.
    const changed = await db.sql`
      WITH prev AS (
        SELECT id, onboarding_call_completed_at AS completed_at, onboarding_call_conducted_by AS conducted_by
        FROM buyers
        WHERE id = ${buyer.id} AND application_status = 'PENDING_COMMERCIALS'
          AND onboarding_call_completed_at IS NOT NULL
        FOR UPDATE
      ), cleared AS (
        UPDATE buyers SET onboarding_call_completed_at = NULL, onboarding_call_conducted_by = NULL, updated_at = now()
        FROM prev WHERE buyers.id = prev.id
        RETURNING buyers.id
      ), logged AS (
        INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
        SELECT ${auth.session.email}, 'BUYER_ONBOARDING_CALL_CORRECTED', 'buyer', prev.id,
          jsonb_build_object('completed_at', prev.completed_at, 'conducted_by', prev.conducted_by),
          jsonb_build_object('onboarding_call', 'cleared', 'reason', ${reason}::text)
        FROM prev
        RETURNING id
      )
      SELECT (SELECT count(*) FROM cleared) AS cleared, (SELECT count(*) FROM logged) AS logged
    `;
    if (Number(changed[0]?.cleared) !== 1 || Number(changed[0]?.logged) !== 1) {
      return NextResponse.json({ error: 'The record changed while correcting. Reload and try again.' }, { status: 409 });
    }

    return NextResponse.json({ onboarding_call_recorded: false, corrected: true });
  } catch (err) {
    console.error('Correcting onboarding call failed', err);
    return NextResponse.json({ error: 'Failed to correct onboarding call.' }, { status: 500 });
  }
}
