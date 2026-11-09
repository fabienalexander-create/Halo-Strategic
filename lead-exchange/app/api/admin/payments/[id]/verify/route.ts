import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { sendLeadDeliveryEmail } from '../../../../../../lib/leadDeliveryEmail';
import { leadUnlockedEmail, internalReleaseCopyEmail } from '../../../../../../lib/emailTemplates';

const INDUSTRY_LABELS: Record<string, string> = {
  spray_foam_removal: 'Spray Foam Removal',
  solar_battery: 'Solar & Battery',
  roofing: 'Roofing',
};

interface Body {
  transaction_reference?: string;
  amount_received?: number;
  paid_at?: string;
}

const LIVE_ALLOCATION_STATUSES = ['OFFERED', 'ACCEPTED', 'PURCHASED'];

// Tide verification is authoritative here, and only here: nothing in this codebase marks a
// payment PAID except an admin calling this endpoint having actually checked the bank statement.
// An email, a browser redirect or a client-side "success" message is never enough on its own --
// this route takes transaction_reference and amount_received as the admin's own typed-in record
// of what they saw in Tide, not anything supplied by or trusted from the buyer's browser.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const paymentId = Number(params.id);
  if (!Number.isInteger(paymentId)) {
    return NextResponse.json({ error: 'Invalid payment id.' }, { status: 400 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body.transaction_reference?.trim()) {
    return NextResponse.json({ error: 'transaction_reference (the Tide reference) is required.' }, { status: 400 });
  }
  if (body.amount_received === undefined || body.amount_received === null) {
    return NextResponse.json({ error: 'amount_received is required.' }, { status: 400 });
  }

  try {
    const db = getDatabase();

    const rows = await db.sql`
      SELECT p.id, p.status AS payment_status, p.lead_allocation_id,
             a.status AS allocation_status, a.agreed_price, a.package_id, a.lead_id, a.buyer_id,
             l.homeowner_name, l.homeowner_contact, l.postcode, l.property_type, l.service_requirement,
             i.slug AS industry_slug, b.company_name, b.contact_email
      FROM payments p
      JOIN lead_allocations a ON a.id = p.lead_allocation_id
      JOIN leads l ON l.id = a.lead_id
      JOIN industries i ON i.id = l.industry_id
      JOIN buyers b ON b.id = a.buyer_id
      WHERE p.id = ${paymentId}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No matching payment found.' }, { status: 404 });
    }
    const row = rows[0] as {
      id: number; payment_status: string; lead_allocation_id: number; allocation_status: string;
      agreed_price: number | null; package_id: number | null; lead_id: number; buyer_id: number;
      homeowner_name: string; homeowner_contact: { email?: string; mobile?: string };
      postcode: string; property_type: string; service_requirement: string;
      industry_slug: string; company_name: string; contact_email: string;
    };

    // Duplicate-verification guard: already PAID/SETTLED is reported back as-is, never re-verified
    // or re-charged against. Safe to call this endpoint twice with the same or even different
    // details -- the second call is a no-op on the payment itself.
    if (row.payment_status === 'PAID' || row.payment_status === 'SETTLED') {
      return NextResponse.json({ payment_status: row.payment_status, already_verified: true });
    }
    if (row.payment_status === 'REFUNDED' || row.payment_status === 'DISPUTED') {
      return NextResponse.json(
        { error: `Payment is ${row.payment_status} and cannot be verified.` },
        { status: 409 }
      );
    }
    if (row.package_id !== null) {
      return NextResponse.json({ error: 'This allocation is package-covered and takes no payment.' }, { status: 409 });
    }
    if (row.agreed_price !== null && body.amount_received < row.agreed_price) {
      return NextResponse.json(
        { error: `Amount received (${body.amount_received}) is below the agreed price (${row.agreed_price}).` },
        { status: 422 }
      );
    }

    const isLive = LIVE_ALLOCATION_STATUSES.includes(row.allocation_status);
    const newPaymentStatus = isLive ? 'PAID' : 'UNDER_REVIEW';

    try {
      await db.sql`
        UPDATE payments
        SET status = ${newPaymentStatus}, transaction_reference = ${body.transaction_reference},
            amount_received = ${body.amount_received}, paid_at = COALESCE(${body.paid_at ?? null}, now()),
            verified_by = ${auth.session.email}, verified_at = now()
        WHERE id = ${paymentId}
      `;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('transaction_reference')) {
        return NextResponse.json({ error: 'This transaction reference has already been recorded against another payment.' }, { status: 409 });
      }
      throw err;
    }

    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
      VALUES (
        ${auth.session.email}, 'PAYMENT_VERIFIED', 'payment', ${paymentId},
        ${JSON.stringify({ status: newPaymentStatus, transaction_reference: body.transaction_reference, amount_received: body.amount_received })}
      )
    `;

    if (!isLive) {
      // Mirrors the migration's own documented behaviour: a payment arriving for an allocation
      // that's no longer live (expired, declined, superseded) stays UNDER_REVIEW for a human to
      // resolve -- it must never release a lead on its own.
      return NextResponse.json({ payment_status: 'UNDER_REVIEW', released: false, reason: `allocation is ${row.allocation_status}` });
    }

    let released = false;
    try {
      await db.sql`
        INSERT INTO deliveries (lead_allocation_id, delivery_method, delivered_to_email, delivered_at, status)
        VALUES (${row.lead_allocation_id}, 'email', ${row.contact_email}, now(), 'SENT')
      `;
      await db.sql`UPDATE leads SET status = 'DELIVERED' WHERE id = ${row.lead_id}`;
      released = true;
    } catch (err) {
      console.error(`Release check blocked delivery for allocation ${row.lead_allocation_id} after payment verification`, err);
    }

    if (released) {
      const industryLabel = INDUSTRY_LABELS[row.industry_slug] ?? row.industry_slug;
      const leadReference = `HLX-LEAD-${String(row.lead_id).padStart(6, '0')}`;

      await sendLeadDeliveryEmail(db, {
        leadAllocationId: row.lead_allocation_id,
        emailType: 'LEAD_UNLOCKED',
        to: row.contact_email,
        ...leadUnlockedEmail({
          leadReference, industryLabel, homeownerName: row.homeowner_name,
          phone: row.homeowner_contact?.mobile ?? '', email: row.homeowner_contact?.email ?? '',
          postcode: row.postcode, propertyType: row.property_type, serviceRequirement: row.service_requirement,
        }),
      });

      const adminRows = await db.sql`SELECT email FROM admin_users ORDER BY id`;
      const adminEmails = (adminRows as { email: string }[]).map((r) => r.email).join(',');
      if (adminEmails) {
        await sendLeadDeliveryEmail(db, {
          leadAllocationId: row.lead_allocation_id,
          emailType: 'INTERNAL_RELEASE_COPY',
          to: adminEmails,
          ...internalReleaseCopyEmail({
            leadReference, companyName: row.company_name, homeownerName: row.homeowner_name,
            phone: row.homeowner_contact?.mobile ?? '', email: row.homeowner_contact?.email ?? '',
            postcode: row.postcode, packageCovered: false,
          }),
        });
      }
    }

    return NextResponse.json({ payment_status: 'PAID', released });
  } catch (err) {
    console.error('Verifying payment failed', err);
    return NextResponse.json({ error: 'Failed to verify payment.' }, { status: 500 });
  }
}
