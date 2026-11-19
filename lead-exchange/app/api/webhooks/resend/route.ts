import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { applyResendEventToOutboxes } from '../../../../lib/emailEvents';
import { markProspectEmailBounced, markProspectEmailComplained, markProspectEmailDelivered } from '../../../../lib/buyerProspectEmail';

// Resend signs its webhooks using Svix. Configuring this is optional and separate from
// RESEND_API_KEY -- it requires Fabien to add a webhook in the Resend dashboard pointing at this
// route and to put the signing secret it generates into RESEND_WEBHOOK_SECRET. Until that's done,
// this route refuses every request rather than trusting an unsigned payload; "SENT" (provider
// accepted) still works without it; delivered/bounced/complained/failed visibility depends on this.
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

  let event: { type: string; data?: { email_id?: string; bounce?: { message?: string }; failed?: { reason?: string } } };
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

  // Buyer-facing outboxes (transactional_emails, lead_delivery_emails): delivered, bounced,
  // complained and failed all update the row's status, so the admin Emails page shows what really
  // happened (lib/emailEvents.ts). Other events are recorded as last_event only.
  //
  // buyer_prospect_emails (the prospect nurture sequence): unchanged. Delivered, bounced and
  // complained are acted on; a bounce or complaint suppresses the prospect's address for every
  // future send. Every handler is guarded and idempotent, so a replayed webhook is a no-op.
  if (event.data?.email_id) {
    const db = getDatabase();
    const emailId = event.data.email_id;
    await applyResendEventToOutboxes(db, event.type, emailId, { reason: event.data.bounce?.message ?? event.data.failed?.reason ?? null });
    if (event.type === 'email.delivered') {
      await markProspectEmailDelivered(db, emailId);
    } else if (event.type === 'email.bounced') {
      await markProspectEmailBounced(db, emailId);
    } else if (event.type === 'email.complained') {
      await markProspectEmailComplained(db, emailId);
    }
  }

  return NextResponse.json({ received: true });
}
