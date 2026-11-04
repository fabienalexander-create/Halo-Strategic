import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { markDelivered } from '../../../../lib/email';

// Resend signs its webhooks using Svix. Configuring this is optional and separate from
// RESEND_API_KEY -- it requires Fabien to add a webhook in the Resend dashboard pointing at this
// route and to put the signing secret it generates into RESEND_WEBHOOK_SECRET. Until that's done,
// this route refuses every request rather than trusting an unsigned payload; "SENT" (provider
// accepted) still works without it -- only the SENT -> DELIVERED distinction depends on this.
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 501 });
  }

  const payload = await req.text();
  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing webhook signature headers.' }, { status: 400 });
  }

  let event: { type: string; data?: { email_id?: string } };
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof event;
  } catch (err) {
    console.error('Resend webhook signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // Only the delivered event moves an outbox row to DELIVERED. Other event types (bounced,
  // complained, delivery_delayed, etc.) are acknowledged but not acted on here -- out of scope
  // for these two buyer-application emails; SENT already covers "provider accepted it."
  if (event.type === 'email.delivered' && event.data?.email_id) {
    const db = getDatabase();
    await markDelivered(db, event.data.email_id);
  }

  return NextResponse.json({ received: true });
}
