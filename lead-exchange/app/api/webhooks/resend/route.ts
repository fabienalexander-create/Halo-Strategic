import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { markDelivered } from '../../../../lib/email';
import { markProspectEmailBounced, markProspectEmailComplained, markProspectEmailDelivered } from '../../../../lib/buyerProspectEmail';

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

  // transactional_emails (buyer applications): only "delivered" is acted on, as before -- out of
  // scope for this change, which is specifically about prospect emails. Other event types for
  // those two emails (bounced, complained, delivery_delayed, etc.) are still just acknowledged.
  //
  // buyer_prospect_emails (the prospect nurture sequence): delivered, bounced and complained are
  // all acted on. A bounce or complaint suppresses the prospect's address for every future send
  // (see markProspectEmailBounced/Complained in lib/buyerProspectEmail.ts and the database guard
  // trigger) -- not just this one outbox row. Each handler is itself idempotent (guarded UPDATEs,
  // COALESCE on the suppression timestamp), so a repeated webhook delivery for the same event is a
  // harmless no-op, and processing one event type never touches rows for another.
  if (event.data?.email_id) {
    const db = getDatabase();
    const emailId = event.data.email_id;
    if (event.type === 'email.delivered') {
      await markDelivered(db, emailId);
      await markProspectEmailDelivered(db, emailId);
    } else if (event.type === 'email.bounced') {
      await markProspectEmailBounced(db, emailId);
    } else if (event.type === 'email.complained') {
      await markProspectEmailComplained(db, emailId);
    }
  }

  return NextResponse.json({ received: true });
}
