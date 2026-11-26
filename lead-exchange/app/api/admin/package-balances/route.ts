import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

// Credit balance per buyer package, from the package_balances view (migration
// 20261126100000_credits_ledger.sql), with each package's recorded refunds. balance_status is
// ACTIVE, USED_UP or REFUND_DUE (expired with unused credits: refund manually through Tide, then
// record it with POST /api/admin/package-refunds).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;
  const buyerParam = req.nextUrl.searchParams.get('buyer_id');
  const buyerId = buyerParam ? Number(buyerParam) : null;
  if (buyerParam && !Number.isInteger(buyerId)) {
    return NextResponse.json({ error: 'Invalid buyer_id.' }, { status: 400 });
  }
  try {
    const db = getDatabase();
    const packages = buyerId
      ? await db.sql`
          SELECT pb.*, b.company_name, pd.name AS package_name
          FROM package_balances pb JOIN buyers b ON b.id = pb.buyer_id
          LEFT JOIN package_definitions pd ON pd.id = pb.package_definition_id
          WHERE pb.buyer_id = ${buyerId} ORDER BY pb.verified_at DESC`
      : await db.sql`
          SELECT pb.*, b.company_name, pd.name AS package_name
          FROM package_balances pb JOIN buyers b ON b.id = pb.buyer_id
          LEFT JOIN package_definitions pd ON pd.id = pb.package_definition_id
          ORDER BY (pb.balance_status = 'REFUND_DUE') DESC, pb.verified_at DESC`;
    const refunds = await db.sql`
      SELECT id, buyer_package_id, credits_refunded, amount, currency, reason, transaction_reference, refunded_at, recorded_by
      FROM package_refunds ORDER BY refunded_at DESC`;
    return NextResponse.json({ packages, refunds });
  } catch (err) {
    console.error('Listing package balances failed', err);
    return NextResponse.json({ error: 'Failed to list package balances.' }, { status: 500 });
  }
}
