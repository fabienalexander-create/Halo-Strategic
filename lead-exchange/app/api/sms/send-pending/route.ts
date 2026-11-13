import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { sendPendingVerifications } from '../../../../lib/smsSender';
import { secretMatches } from '../../../../lib/smsWebhookAuth';

// Retry trigger for pending verification texts (for a scheduler to call). Header
// x-halo-sms-secret must equal SMS_SENDER_SECRET. Fails closed. Does nothing unless
// SMS_VERIFICATION_ENABLED=true and the Make webhook is configured.
export async function POST(req: NextRequest) {
  const secret = process.env.SMS_SENDER_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });
  if (!secretMatches(req.headers.get('x-halo-sms-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 });
  }
  try {
    return NextResponse.json(await sendPendingVerifications(getDatabase(), { limit: 20 }), { status: 200 });
  } catch (err) {
    console.error('SMS send-pending failed', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}
