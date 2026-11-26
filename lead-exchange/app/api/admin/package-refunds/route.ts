import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '../../../../lib/requireAdmin';
import { LedgerError, recordPackageRefund } from '../../../../lib/creditsLedger';

interface Body {
  buyer_package_id?: number;
  credits?: number;
  reason?: 'BUYER_STOPPED' | 'CREDITS_EXPIRED';
  transaction_reference?: string;
  refunded_at?: string;
  notes?: string;
}

// Records a refund of unused package credits that has ALREADY been paid manually through Tide
// (Fabien, 2026-11-26). Owner only: it moves money. The amount is calculated from the package
// (price per credit x credits), and the database refuses more credits than remain unused.
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if ('response' in auth) return auth.response;
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body.buyer_package_id) return NextResponse.json({ error: 'buyer_package_id is required.' }, { status: 400 });
  try {
    const db = getDatabase();
    const result = await recordPackageRefund(db.pool, auth.session.email, {
      buyerPackageId: body.buyer_package_id,
      credits: Number(body.credits),
      reason: body.reason as 'BUYER_STOPPED' | 'CREDITS_EXPIRED',
      transactionReference: body.transaction_reference ?? '',
      refundedAt: body.refunded_at ?? '',
      notes: body.notes,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof LedgerError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Recording package refund failed', err);
    return NextResponse.json({ error: 'Failed to record the refund.' }, { status: 500 });
  }
}
