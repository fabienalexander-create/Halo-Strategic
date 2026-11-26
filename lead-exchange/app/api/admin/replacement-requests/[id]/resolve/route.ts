import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '../../../../../../lib/requireAdmin';
import { LedgerError, resolveReplacementRequest } from '../../../../../../lib/creditsLedger';

// Resolves an approved claim: CREDIT_RESTORED (package lead) or REFUNDED (Buyer Terms 9.4, after
// the refund has been paid through Tide). A free replacement lead for a pay-per-lead claim is
// supplied from the allocate route with replacement_request_id. Owner only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOwner(req);
  if ('response' in auth) return auth.response;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
  let body: { resolution?: 'CREDIT_RESTORED' | 'REFUNDED'; refund_transaction_reference?: string; refunded_at?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  try {
    const result = await resolveReplacementRequest(getDatabase().pool, auth.session.email, id, {
      resolution: body.resolution as 'CREDIT_RESTORED' | 'REFUNDED',
      refundTransactionReference: body.refund_transaction_reference,
      refundedAt: body.refunded_at,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LedgerError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Resolving replacement request failed', err);
    return NextResponse.json({ error: 'Failed to resolve the request.' }, { status: 500 });
  }
}
