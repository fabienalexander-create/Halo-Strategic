import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { sendLeadDeliveryEmail } from '../../../../../../lib/leadDeliveryEmail';
import { leadOfferEmail, internalOfferCopyEmail, leadUnlockedEmail, internalReleaseCopyEmail } from '../../../../../../lib/emailTemplates';

const INDUSTRY_LABELS: Record<string, string> = {
  spray_foam_removal: 'Spray Foam Removal',
  solar_battery: 'Solar & Battery',
  roofing: 'Roofing',
};

interface Body {
  buyer_id?: number;
  homeowner_confirmation_id?: number;
  package_id?: number;
}

// Offers a lead to a buyer -- the first and only place a lead_allocations row is ever created.
// This models the whole deal as already agreed over the phone (price, or package, already settled
// with the buyer) and recorded here in one step: there's no separate buyer-facing accept/decline
// UI yet, so status goes straight to PURCHASED rather than OFFERED/ACCEPTED (those statuses stay
// available in the schema for a later self-service flow, not used by this route). The price is
// copied from the buyer's agreed_price_per_lead into agreed_price AT THIS MOMENT -- a snapshot --
// and nothing anywhere in this codebase ever updates agreed_price afterwards, so a later change to
// the buyer's rate can never silently alter an existing allocation.
//
// A homeowner confirmation (recorded separately via /api/admin/homeowner-confirmations) is always
// required -- this route checks it belongs to the same lead and buyer and isn't withdrawn itself,
// as a clearer error than the database trigger's own exception, which still applies as the final
// backstop.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const leadId = Number(params.id);
  if (!Number.isInteger(leadId)) {
    return NextResponse.json({ error: 'Invalid lead id.' }, { status: 400 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body.buyer_id) {
    return NextResponse.json({ error: 'buyer_id is required.' }, { status: 400 });
  }
  if (!body.homeowner_confirmation_id) {
    return NextResponse.json({ error: 'homeowner_confirmation_id is required.' }, { status: 400 });
  }

  try {
    const db = getDatabase();

    const leads = await db.sql`
      SELECT l.id, l.status, l.homeowner_name, l.homeowner_contact, l.property_type, l.postcode,
             l.service_requirement, i.slug AS industry_slug, i.id AS industry_id
      FROM leads l JOIN industries i ON i.id = l.industry_id
      WHERE l.id = ${leadId}
    `;
    if (leads.length === 0) {
      return NextResponse.json({ error: 'No matching lead found.' }, { status: 404 });
    }
    const lead = leads[0] as {
      id: number; status: string; homeowner_name: string; homeowner_contact: { email?: string; mobile?: string };
      property_type: string; postcode: string; service_requirement: string; industry_slug: string; industry_id: number;
    };

    const liveAllocations = await db.sql`
      SELECT id FROM lead_allocations WHERE lead_id = ${leadId} AND status IN ('OFFERED', 'ACCEPTED', 'PURCHASED')
    `;
    if (liveAllocations.length > 0) {
      return NextResponse.json({ error: 'This lead already has a live allocation.' }, { status: 409 });
    }

    const buyers = await db.sql`
      SELECT id, industry_id, application_status, company_name, contact_email, agreed_price_per_lead
      FROM buyers WHERE id = ${body.buyer_id}
    `;
    if (buyers.length === 0) {
      return NextResponse.json({ error: 'No matching buyer found.' }, { status: 404 });
    }
    const buyer = buyers[0] as {
      id: number; industry_id: number; application_status: string; company_name: string;
      contact_email: string; agreed_price_per_lead: number | null;
    };
    if (buyer.application_status !== 'ACTIVE') {
      return NextResponse.json({ error: `Buyer is not ACTIVE (currently ${buyer.application_status}).` }, { status: 409 });
    }
    if (buyer.industry_id !== lead.industry_id) {
      return NextResponse.json({ error: 'This buyer and lead are in different industries.' }, { status: 400 });
    }

    const confirmations = await db.sql`
      SELECT id, lead_id, buyer_id, withdrawn_at FROM homeowner_confirmations WHERE id = ${body.homeowner_confirmation_id}
    `;
    if (confirmations.length === 0) {
      return NextResponse.json({ error: 'No matching homeowner confirmation found.' }, { status: 404 });
    }
    const confirmation = confirmations[0] as { id: number; lead_id: number; buyer_id: number; withdrawn_at: string | null };
    if (confirmation.lead_id !== leadId || confirmation.buyer_id !== body.buyer_id) {
      return NextResponse.json({ error: 'This homeowner confirmation is for a different lead or buyer.' }, { status: 400 });
    }
    if (confirmation.withdrawn_at) {
      return NextResponse.json({ error: 'This homeowner confirmation has been withdrawn.' }, { status: 409 });
    }

    let agreedPrice: number | null = null;
    if (body.package_id) {
      const packages = await db.sql`
        SELECT id, buyer_id, leads_used, leads_included FROM buyer_packages WHERE id = ${body.package_id}
      `;
      if (packages.length === 0) {
        return NextResponse.json({ error: 'No matching buyer package found.' }, { status: 404 });
      }
      const pkg = packages[0] as { id: number; buyer_id: number; leads_used: number; leads_included: number };
      if (pkg.buyer_id !== body.buyer_id) {
        return NextResponse.json({ error: 'This package belongs to a different buyer.' }, { status: 400 });
      }
      if (pkg.leads_used >= pkg.leads_included) {
        return NextResponse.json({ error: 'This package has no remaining leads.' }, { status: 409 });
      }
    } else {
      if (buyer.agreed_price_per_lead === null) {
        return NextResponse.json({ error: 'Buyer has no agreed_price_per_lead set; cannot snapshot a price without a package.' }, { status: 422 });
      }
      agreedPrice = buyer.agreed_price_per_lead;
    }

    const inserted = await db.sql`
      INSERT INTO lead_allocations (
        lead_id, buyer_id, allocation_type, allocation_sequence, status,
        notified_at, decided_at, agreed_price, package_id, homeowner_confirmation_id
      ) VALUES (
        ${leadId}, ${body.buyer_id}, 'EXCLUSIVE_WINDOW', 1, 'PURCHASED',
        now(), now(), ${agreedPrice}, ${body.package_id ?? null}, ${body.homeowner_confirmation_id}
      )
      RETURNING id
    `;
    const allocationId = inserted[0].id;

    await db.sql`UPDATE leads SET status = 'RESERVED' WHERE id = ${leadId}`;

    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
      VALUES (
        ${auth.session.email}, 'LEAD_ALLOCATED', 'lead_allocation', ${allocationId},
        ${JSON.stringify({ lead_id: leadId, buyer_id: body.buyer_id, agreed_price: agreedPrice, package_id: body.package_id ?? null })}
      )
    `;

    const industryLabel = INDUSTRY_LABELS[lead.industry_slug] ?? lead.industry_slug;
    const leadReference = `HLX-LEAD-${String(leadId).padStart(6, '0')}`;
    const packageCovered = Boolean(body.package_id);

    let paymentReference: string | null = null;
    if (!packageCovered) {
      const paymentInserted = await db.sql`
        INSERT INTO payments (lead_allocation_id, expected_amount, status)
        VALUES (${allocationId}, ${agreedPrice}, 'PENDING')
        RETURNING id
      `;
      const paymentId = paymentInserted[0].id;
      paymentReference = `HLX-PAY-${String(paymentId).padStart(6, '0')}`;
      await db.sql`UPDATE payments SET payment_reference = ${paymentReference} WHERE id = ${paymentId}`;
    }

    // Offer emails are sent after the allocation (and, if applicable, the payment row) are
    // already committed, and never allowed to throw -- a failed email must never undo an
    // already-recorded allocation. Admin addresses looked up the same way as ADMIN_NEW_APPLICATION.
    const adminRows = await db.sql`SELECT email FROM admin_users ORDER BY id`;
    const adminEmails = (adminRows as { email: string }[]).map((r) => r.email).join(',');

    await sendLeadDeliveryEmail(db, {
      leadAllocationId: allocationId,
      emailType: 'LEAD_OFFER',
      to: buyer.contact_email,
      ...leadOfferEmail({
        leadReference, industryLabel, postcode: lead.postcode, propertyType: lead.property_type,
        serviceRequirement: lead.service_requirement, currency: 'GBP', price: agreedPrice,
        packageCovered, paymentReference,
      }),
    });
    if (adminEmails) {
      await sendLeadDeliveryEmail(db, {
        leadAllocationId: allocationId,
        emailType: 'INTERNAL_OFFER_COPY',
        to: adminEmails,
        ...internalOfferCopyEmail({
          leadReference, companyName: buyer.company_name, industryLabel, postcode: lead.postcode,
          price: agreedPrice, packageCovered,
        }),
      });
    }

    let released = false;
    if (packageCovered) {
      // Package-covered allocations need no payment: release (a delivery record, then the unlock
      // emails) can happen immediately. allocation_release_check still runs as the database's own
      // gate on the deliveries INSERT below -- this isn't trusted blindly.
      try {
        await db.sql`
          INSERT INTO deliveries (lead_allocation_id, delivery_method, delivered_to_email, delivered_at, status)
          VALUES (${allocationId}, 'email', ${buyer.contact_email}, now(), 'SENT')
        `;
        await db.sql`UPDATE leads SET status = 'DELIVERED' WHERE id = ${leadId}`;
        released = true;
      } catch (err) {
        console.error(`Release check blocked delivery for allocation ${allocationId} despite package cover`, err);
      }

      if (released) {
        await sendLeadDeliveryEmail(db, {
          leadAllocationId: allocationId,
          emailType: 'LEAD_UNLOCKED',
          to: buyer.contact_email,
          ...leadUnlockedEmail({
            leadReference, industryLabel, homeownerName: lead.homeowner_name,
            phone: lead.homeowner_contact?.mobile ?? '', email: lead.homeowner_contact?.email ?? '',
            postcode: lead.postcode, propertyType: lead.property_type, serviceRequirement: lead.service_requirement,
          }),
        });
        if (adminEmails) {
          await sendLeadDeliveryEmail(db, {
            leadAllocationId: allocationId,
            emailType: 'INTERNAL_RELEASE_COPY',
            to: adminEmails,
            ...internalReleaseCopyEmail({
              leadReference, companyName: buyer.company_name, homeownerName: lead.homeowner_name,
              phone: lead.homeowner_contact?.mobile ?? '', email: lead.homeowner_contact?.email ?? '',
              postcode: lead.postcode, packageCovered: true,
            }),
          });
        }
      }
    }

    return NextResponse.json({ allocation_id: allocationId, status: 'PURCHASED', package_covered: packageCovered, payment_reference: paymentReference, released });
  } catch (err) {
    console.error('Allocating lead failed', err);
    return NextResponse.json({ error: 'Failed to allocate lead.' }, { status: 500 });
  }
}
