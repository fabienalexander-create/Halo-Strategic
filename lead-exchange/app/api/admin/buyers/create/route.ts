import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { isConfiguredIndustrySlug } from '../../../../../lib/industries';

interface Body {
  industry_slug?: string;
  company_name?: string;
  contact_name?: string;
  contact_email?: string;
  telephone?: string;
  coverage_type?: string;
  counties_covered?: string[];
  postcodes_covered?: string[];
  notes?: string;
}

const REQUIRED_FIELDS: (keyof Body)[] = ['industry_slug', 'company_name', 'contact_name', 'contact_email', 'telephone'];

/**
 * Admin-only entry point for a buyer onboarded directly (by phone/email), rather than through the
 * public buyer-applications form -- e.g. Russell Griffiths, agreed nationwide pay-per-lead at £65,
 * 2026-11-16. Deliberately minimal: this only creates the PENDING_REVIEW buyer record with the
 * same application_reference scheme (HLX-BYR-xxxxxx) as a real application. Everything after that
 * -- review decision, commercials, the mandatory onboarding call, activation -- goes through the
 * existing, already-built /admin/applications/[reference] pipeline unchanged. No suitability score
 * (nothing to score), no buyer-terms timestamps (never shown the public form), no application
 * emails (this isn't a real application submission).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const missing = REQUIRED_FIELDS.filter((f) => !body[f]);
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Missing required field(s).', missing_fields: missing }, { status: 400 });
  }
  if (!isConfiguredIndustrySlug(body.industry_slug)) {
    return NextResponse.json({ error: 'Unknown or unsupported industry.' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const industryRows = await db.sql`SELECT id FROM industries WHERE slug = ${body.industry_slug}`;
    if (industryRows.length === 0) {
      return NextResponse.json({ error: 'Unknown industry.' }, { status: 400 });
    }
    const industryId = industryRows[0].id as number;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const inserted = await client.query(
        `INSERT INTO buyers (
          company_name, contact_name, contact_email, telephone, industry_id,
          coverage_type, counties_covered, postcodes_covered, review_notes,
          confirmed_info_accurate, confirmed_can_deliver_services,
          confirmed_payment_before_release_understanding, agreed_pii_handling, agreed_account_notifications,
          application_status, application_reference
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          false, false,
          false, false, false,
          'PENDING_REVIEW', $10
        ) RETURNING id`,
        [
          body.company_name, body.contact_name, body.contact_email, body.telephone, industryId,
          // 'national' coverage needs no list -- lib/buyerMatching.ts's buyerCoversPostcode
          // short-circuits to "covers everywhere" on coverage_type === 'national' alone. For
          // 'regional', postcodes_covered is the field that function actually matches a lead's
          // postcode against; counties_covered is never read by that matching logic at all (it
          // only counts towards "has any coverage recorded"), so it's kept for display/record
          // purposes only -- never fabricated as ['Nationwide'] the way this used to work.
          body.coverage_type ?? 'national', JSON.stringify(body.counties_covered ?? []), JSON.stringify(body.postcodes_covered ?? []),
          body.notes ?? 'Onboarded directly by admin (not via public application form).',
          `PENDING-${randomUUID()}`,
        ]
      );
      const buyerId = inserted.rows[0].id;
      const applicationReference = `HLX-BYR-${String(buyerId).padStart(6, '0')}`;
      await client.query(`UPDATE buyers SET application_reference = $1 WHERE id = $2`, [applicationReference, buyerId]);

      await client.query(`INSERT INTO buyer_notification_preferences (buyer_id) VALUES ($1)`, [buyerId]);

      await client.query(
        `INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
         VALUES ($1, 'BUYER_RECORD_CREATED_BY_ADMIN', 'buyer', $2, $3)`,
        [auth.session.email, buyerId, JSON.stringify({ company_name: body.company_name, contact_email: body.contact_email, industry_slug: body.industry_slug })]
      );

      await client.query('COMMIT');
      return NextResponse.json({ buyer_id: buyerId, application_reference: applicationReference, application_status: 'PENDING_REVIEW' }, { status: 201 });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Admin buyer creation failed', err);
    return NextResponse.json({ error: 'Failed to create buyer record.' }, { status: 500 });
  }
}
