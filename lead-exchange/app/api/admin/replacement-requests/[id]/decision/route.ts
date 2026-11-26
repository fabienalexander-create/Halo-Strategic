import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '../../../../../../lib/requireAdmin';
import { decideReplacementRequest, LedgerError } from '../../../../../../lib/creditsLedger';

// Approves or denies a replacement claim, once. Owner only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOwner(req);
  if ('response' in auth) return auth.response;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
  let body: { decision?: 'APPROVED' | 'DENIED'; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  try {
    const result = await decideReplacementRequest(getDatabase().pool, auth.session.email, id, body.decision as 'APPROVED' | 'DENIED', body.notes);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LedgerError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Deciding replacement request failed', err);
    return NextResponse.json({ error: 'Failed to record the decision.' }, { status: 500 });
  }
}
