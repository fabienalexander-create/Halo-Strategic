import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

// Lists individual-lead payments (package-covered allocations take no payment, so never appear
// here), newest first, optionally filtered by status -- the queue an admin works from to verify
// against what they've actually seen in Tide.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const statusFilter = req.nextUrl.searchParams.get('status');

  try {
    const db = getDatabase();
    const rows = statusFilter
      ? await db.sql`
          SELECT p.id, p.status, p.expected_amount, p.amount_received, p.currency, p.payment_link,
                 p.payment_reference, p.transaction_reference, p.verified_by, p.verified_at, p.created_at,
                 a.lead_id, a.buyer_id, b.company_name AS buyer_company_name
          FROM payments p
          JOIN lead_allocations a ON a.id = p.lead_allocation_id
          JOIN buyers b ON b.id = a.buyer_id
          WHERE p.status = ${statusFilter}
          ORDER BY p.created_at DESC LIMIT 200
        `
      : await db.sql`
          SELECT p.id, p.status, p.expected_amount, p.amount_received, p.currency, p.payment_link,
                 p.payment_reference, p.transaction_reference, p.verified_by, p.verified_at, p.created_at,
                 a.lead_id, a.buyer_id, b.company_name AS buyer_company_name
          FROM payments p
          JOIN lead_allocations a ON a.id = p.lead_allocation_id
          JOIN buyers b ON b.id = a.buyer_id
          ORDER BY p.created_at DESC LIMIT 200
        `;
    return NextResponse.json({ payments: rows });
  } catch (err) {
    console.error('Listing payments failed', err);
    return NextResponse.json({ error: 'Failed to list payments.' }, { status: 500 });
  }
}
