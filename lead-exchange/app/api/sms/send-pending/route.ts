import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { sendPendingVerifications } from '../../../../lib/smsSender';
import { sendPendingFollowUpSms } from '../../../../lib/metaFollowUpSms';
import { secretMatches } from '../../../../lib/smsWebhookAuth';

// Retry trigger for pending texts (for a scheduler to call). Header x-halo-sms-secret must equal
// SMS_SENDER_SECRET. Fails closed. Each outbox gates itself: verification texts need
// SMS_VERIFICATION_ENABLED=true, follow-up texts need META_FOLLOW_UP_SMS_ENABLED; both need the
// Make webhook configured.
export async function POST(req: NextRequest) {
  const secret = process.env.SMS_SENDER_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });
  if (!secretMatches(req.headers.get('x-halo-sms-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 });
  }
  try {
    const db = getDatabase();
    const verification = await sendPendingVerifications(db, { limit: 20 });
    const followUp = await sendPendingFollowUpSms(db, { limit: 20 });
    return NextResponse.json({ ...verification, follow_up: followUp }, { status: 200 });
  } catch (err) {
    console.error('SMS send-pending failed', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}
