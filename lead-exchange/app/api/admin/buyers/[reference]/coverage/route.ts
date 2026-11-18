import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '../../../../../../lib/requireAdmin';

interface CoveragePayload {
  postcodes_covered?: unknown;
  reason?: unknown;
  confirm?: unknown;
}

const MIN_REASON = 10;
const MAX_REASON = 500;

// A UK postcode outward code: 1-2 letters, optionally followed by 1-2 digits and an optional
// trailing letter (e.g. "CM", "PE19", "SW1A"). Anything else -- a county name, "Nationwide",
// free text -- is rejected here rather than silently stored and silently never matched (which
// is exactly how HLX-BYR-000003 ended up with "Essex"/"Suffolk" in this field: a free-text entry
// that looked plausible, was never validated, and buyerCoversPostcode never matched against
// anything).
const OUTWARD_PATTERN = /^[A-Z]{1,2}(\d{1,2}[A-Z]?)?$/;

function cleanReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/[\u0000-\u0008\u000b-\u001f\u007f<>]/.test(value)) return null; // control chars (tab/newline allowed) and angle brackets
  const cleaned = value.trim();
  if (cleaned.length < MIN_REASON || cleaned.length > MAX_REASON) return null;
  return cleaned;
}

function cleanPostcodes(value: unknown): { ok: true; postcodes: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: 'postcodes_covered must be a non-empty array of outward postcode codes.' };
  }
  const cleaned: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !entry.trim()) {
      return { ok: false, error: `Invalid postcode entry: ${JSON.stringify(entry)}` };
    }
    const trimmed = entry.trim().toUpperCase();
    if (!OUTWARD_PATTERN.test(trimmed)) {
      return {
        ok: false,
        error: `"${entry}" doesn't look like a UK outward postcode code (e.g. "CM" or "PE19"). Store actual postcode prefixes, not county or region names.`,
      };
    }
    cleaned.push(trimmed);
  }
  return { ok: true, postcodes: Array.from(new Set(cleaned)) };
}

// Corrects an existing buyer's postcode coverage (postcodes_covered only -- coverage_type,
// counties_covered, status, commercial terms and every other field are left untouched).
// Owner-only and reason-gated, same shape as onboarding-call/correct: this changes which real
// leads a live buyer is offered, so the previous and new values are written to the permanent
// audit log in the same statement as the update, never just silently overwritten.
export async function POST(req: NextRequest, { params }: { params: { reference: string } }) {
  const auth = await requireOwner(req);
  if ('response' in auth) return auth.response;

  let body: CoveragePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (body.confirm !== true) {
    return NextResponse.json({ error: 'You must explicitly confirm the coverage change (confirm: true).' }, { status: 400 });
  }
  const reason = cleanReason(body.reason);
  if (!reason) {
    return NextResponse.json(
      { error: `A written reason of ${MIN_REASON} to ${MAX_REASON} characters is required (no angle brackets).` },
      { status: 400 }
    );
  }
  const postcodesResult = cleanPostcodes(body.postcodes_covered);
  if (!postcodesResult.ok) {
    return NextResponse.json({ error: postcodesResult.error }, { status: 400 });
  }
  const nextPostcodes = postcodesResult.postcodes;

  try {
    const db = getDatabase();
    const buyers = await db.sql`
      SELECT id, company_name, postcodes_covered FROM buyers WHERE application_reference = ${params.reference}
    `;
    if (buyers.length === 0) {
      return NextResponse.json({ error: 'No matching buyer found.' }, { status: 404 });
    }
    const buyer = buyers[0] as { id: number; company_name: string; postcodes_covered: string[] };

    const changed = await db.sql`
      WITH prev AS (
        SELECT id, postcodes_covered AS before FROM buyers WHERE id = ${buyer.id} FOR UPDATE
      ), updated AS (
        UPDATE buyers SET postcodes_covered = ${JSON.stringify(nextPostcodes)}, updated_at = now()
        FROM prev WHERE buyers.id = prev.id
        RETURNING buyers.id
      ), logged AS (
        INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
        SELECT ${auth.session.email}, 'BUYER_COVERAGE_CORRECTED', 'buyer', prev.id,
          jsonb_build_object('postcodes_covered', prev.before),
          jsonb_build_object('postcodes_covered', ${JSON.stringify(nextPostcodes)}::jsonb, 'reason', ${reason}::text)
        FROM prev
        RETURNING id
      )
      SELECT (SELECT count(*) FROM updated) AS updated, (SELECT count(*) FROM logged) AS logged
    `;
    if (Number(changed[0]?.updated) !== 1 || Number(changed[0]?.logged) !== 1) {
      return NextResponse.json({ error: 'The record changed while updating. Reload and try again.' }, { status: 409 });
    }

    return NextResponse.json({
      updated: true,
      company_name: buyer.company_name,
      previous_postcodes_covered: buyer.postcodes_covered,
      postcodes_covered: nextPostcodes,
    });
  } catch (err) {
    console.error('Correcting buyer coverage failed', err);
    return NextResponse.json({ error: 'Failed to update coverage.' }, { status: 500 });
  }
}
