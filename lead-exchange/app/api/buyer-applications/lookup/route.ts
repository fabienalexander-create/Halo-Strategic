import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

/**
 * Admin-only read-only verification lookup -- NOT a public endpoint, NOT the real admin screen
 * (Priority 2, not built yet). Gated by the same session auth as every other admin route
 * (requireAdmin -- see lib/requireAdmin.ts), per Fabien's 2026-11-04 security review:
 *
 * - Admin session required (no email-matching trick substituting for real auth).
 * - Takes one specific application_reference, never an open filter/search.
 * - Returns only what's needed to verify a submission: reference, status, marketing consent,
 *   and the relevant consent timestamps -- no company name, no contact email, no suitability
 *   score, nothing beyond that.
 * - Errors are caught and logged server-side only; the client gets a generic message, never a
 *   raw Postgres/driver error or connection detail.
 *
 * KNOWN GAP, flagged rather than hidden: this is NOT enforced as read-only at the database
 * permission level -- @netlify/database's getDatabase() connects with the single auto-provisioned
 * connection string, which has full privileges. True DB-level read-only enforcement needs a
 * dedicated Postgres role with SELECT-only grants and its own connection string, which can't be
 * set up from this session without committing a role password to a migration file (a secret in
 * source control) or another way of generating and storing that credential outside the repo.
 * Right now this route is read-only by code convention (it only ever runs a SELECT) and by admin
 * auth, not by database privilege -- a real gap worth closing before this handles anything
 * beyond test verification.
 */
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const reference = req.nextUrl.searchParams.get('reference');
  if (!reference) {
    return NextResponse.json({ error: 'A reference query param is required.' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const rows = await db.sql`
      SELECT
        application_reference,
        application_status,
        marketing_consent,
        agreed_buyer_terms_at,
        acknowledged_replacement_policy_at,
        created_at
      FROM buyers
      WHERE application_reference = ${reference}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No matching application found.' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('Buyer application lookup failed', err);
    return NextResponse.json({ error: 'Lookup failed. Please try again.' }, { status: 500 });
  }
}
