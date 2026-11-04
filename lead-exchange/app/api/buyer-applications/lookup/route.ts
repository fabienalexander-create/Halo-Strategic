import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Minimal read-only verification lookup -- NOT an admin screen. Requires both the application
 * reference AND the contact email the application was submitted with, so this can't be used to
 * enumerate or browse other applicants' data by guessing reference numbers. Exists specifically
 * to let production testing confirm a submitted record actually landed correctly, ahead of the
 * real admin application-review queue (Priority 2, not built yet).
 */
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference');
  const email = req.nextUrl.searchParams.get('email');

  if (!reference || !email) {
    return NextResponse.json({ error: 'Both reference and email query params are required.' }, { status: 400 });
  }

  const db = getDatabase();
  const rows = await db.sql`
    SELECT
      application_reference, application_status, company_name, contact_email,
      marketing_consent, agreed_buyer_terms_version, acknowledged_replacement_policy_version,
      internal_suitability_score IS NOT NULL AS has_suitability_score, created_at
    FROM buyers
    WHERE application_reference = ${reference} AND contact_email = ${email}
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No matching application found.' }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}
