import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { handleInboundReply } from '../../../../../lib/smsVerification';
import { secretMatches } from '../../../../../lib/smsWebhookAuth';

// Inbound homeowner SMS replies, relayed by the Make scenario "HLX SMS in".
// Auth: header x-halo-sms-secret must equal SMS_INBOUND_SECRET. Fails closed (503 when not
// configured, 401 when wrong). Business outcomes always return 200 so Make does not retry.
// Body: { from, text, message_id }.
export async function POST(req: NextRequest) {
  const secret = process.env.SMS_INBOUND_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });
  if (!secretMatches(req.headers.get('x-halo-sms-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 });
  }
  const raw = await req.text();
  if (raw.length > 5000) return NextResponse.json({ error: 'Too large.' }, { status: 413 });
  let body: { from?: unknown; text?: unknown; message_id?: unknown };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  try {
    const result = await handleInboundReply(getDatabase(), { from: body.from, text: body.text, messageId: body.message_id });
    return NextResponse.json({ outcome: result.outcome }, { status: 200 });
  } catch (err) {
    console.error('SMS inbound failed', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}
