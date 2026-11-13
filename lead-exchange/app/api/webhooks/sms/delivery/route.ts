import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { recordDelivery } from '../../../../../lib/smsVerification';
import { secretMatches } from '../../../../../lib/smsWebhookAuth';

// Delivery receipts relayed by Make. Records DELIVERED or FAILED only. Never VERIFIED.
// Auth as the inbound route (SMS_INBOUND_SECRET). Body: { message_id, status, detail? }.
export async function POST(req: NextRequest) {
  const secret = process.env.SMS_INBOUND_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });
  if (!secretMatches(req.headers.get('x-halo-sms-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 });
  }
  const raw = await req.text();
  if (raw.length > 5000) return NextResponse.json({ error: 'Too large.' }, { status: 413 });
  let body: { message_id?: unknown; status?: unknown; detail?: unknown };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const status = typeof body.status === 'string' ? body.status.toLowerCase() : '';
  const delivered = status === 'delivered' || status === 'd';
  const failed = ['failed', 'undelivered', 'rejected', 'expired', 'f', 'u', 'r'].includes(status);
  if (!delivered && !failed) return NextResponse.json({ updated: 0 }, { status: 200 });

  try {
    const updated = await recordDelivery(getDatabase(), { providerMessageId: body.message_id, delivered, detail: body.detail ?? status });
    return NextResponse.json({ updated }, { status: 200 });
  } catch (err) {
    console.error('SMS delivery failed', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}
