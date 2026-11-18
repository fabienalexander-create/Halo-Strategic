import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { sendLeadDeliveryEmail } from '../../../../../../lib/leadDeliveryEmail';
import { leadOfferEmail, internalOfferCopyEmail, leadUnlockedEmail, internalReleaseCopyEmail } from '../../../../../../lib/emailTemplates';
import { buildQualificationSummary } from '../../../../../../lib/leadQualificationSummary';

const INDUSTRY_LABELS: Record<string, string> = {
  spray_foam_removal: 'Spray Foam Removal',
  solar_battery: 'Solar & Battery',
  roofing: 'Roofing',
};

interface Body {
  buyer_id?: number;
  homeowner_confirmation_id?: number;
  package_id?: number;
  payment_link?: string;
  allocation_type?: 'EXCLUSIVE_WINDOW' | 'SHARED';
  // Required, and only meaningful, when the lead carries qualification_answers.needs_manual_review
  // -- Fabien, 2026-11-18: "manual review shouldn't mean permanently blocking a lead. It means the
  // admin sees why it's flagged, checks the circumstances and explicitly acknowledges the decision
  // before proceeding." Never inferred from the request simply being made; see the explicit check
  // below, which refuses the allocation outright without it.
  manual_review_acknowledged?: boolean;
  manual_review_acknowledgement_note?: string;
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
// backstop. It is buyer-specific: selling the same lead to two buyers means recording two separate
// confirmations, one naming each business -- never inferred from the other.
//
// Multi-buyer distribution is the default commercial model (Fabien, 2026-11-18: "exclusivity is
// being removed as the default... each homeowner lead may be allocated to multiple suppliers"),
// not a one-off admin override. allocation_type is therefore not a platform-wide default: it
// follows what was actually agreed with the buyer (buyers.exclusivity_arrangement, required
// before a buyer can go ACTIVE) when the admin doesn't pass one explicitly, and an explicit
// request that contradicts that buyer's own contract is refused outright, here and in the
// database trigger (lead_allocations_guard, netlify/database/migrations/
// 20261118100000_multi_buyer_distribution_model.sql). An EXCLUSIVE_WINDOW request is refused the
// moment any live allocation already exists for the lead (you cannot claim exclusivity over a
// lead someone else already has); a SHARED request is allowed regardless, and the database's own
// unique index (uq_lead_allocations_live_per_lead, scoped to allocation_type = 'EXCLUSIVE_WINDOW')
// is the final backstop behind this check.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
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
  if (body.allocation_type !== undefined && body.allocation_type !== 'EXCLUSIVE_WINDOW' && body.allocation_type !== 'SHARED') {
    return NextResponse.json({ error: "allocation_type must be 'EXCLUSIVE_WINDOW' or 'SHARED'." }, { status: 400 });
  }

  try {
    const db = getDatabase();

    const leads = await db.sql`
      SELECT l.id, l.status, l.homeowner_name, l.homeowner_contact, l.property_type, l.postcode,
             l.service_requirement, l.qualification_answers, i.slug AS industry_slug, i.id AS industry_id
      FROM leads l JOIN industries i ON i.id = l.industry_id
      WHERE l.id = ${leadId}
    `;
    if (leads.length === 0) {
      return NextResponse.json({ error: 'No matching lead found.' }, { status: 404 });
    }
    const lead = leads[0] as {
      id: number; status: string; homeowner_name: string; homeowner_contact: { email?: string; mobile?: string };
      property_type: string; postcode: string; service_requirement: string;
      qualification_answers: Record<string, unknown> | null; industry_slug: string; industry_id: number;
    };

    // The manual-review flag (set at ingestion -- renter, outside service area, researching-only)
    // is never silently bypassed: an allocation is refused outright until an admin has explicitly
    // acknowledged it, here, not just seen a warning in the UI. Preserved for every future
    // allocation attempt on this lead, not just the first -- the flag never clears itself.
    const needsManualReview = lead.qualification_answers?.needs_manual_review === true;
    const reviewReasons = (lead.qualification_answers?.review_reasons as string[] | undefined) ?? [];
    if (needsManualReview && body.manual_review_acknowledged !== true) {
      return NextResponse.json(
        { error: 'This lead is flagged for manual review and cannot be allocated without an explicit acknowledgement.', review_reasons: reviewReasons },
        { status: 409 }
      );
    }

    const liveAllocations = await db.sql`
      SELECT id, buyer_id FROM lead_allocations WHERE lead_id = ${leadId} AND status IN ('OFFERED', 'ACCEPTED', 'PURCHASED')
    `;
    if (liveAllocations.some((a) => (a as { buyer_id: number }).buyer_id === body.buyer_id)) {
      return NextResponse.json({ error: 'This buyer already has a live allocation for this lead.' }, { status: 409 });
    }

    const buyers = await db.sql`
      SELECT id, industry_id, application_status, company_name, contact_email, agreed_price_per_lead, exclusivity_arrangement
      FROM buyers WHERE id = ${body.buyer_id}
    `;
    if (buyers.length === 0) {
      return NextResponse.json({ error: 'No matching buyer found.' }, { status: 404 });
    }
    const buyer = buyers[0] as {
      id: number; industry_id: number; application_status: string; company_name: string;
      contact_email: string; agreed_price_per_lead: number | null; exclusivity_arrangement: 'exclusive' | 'shared' | null;
    };
    if (buyer.application_status !== 'ACTIVE') {
      return NextResponse.json({ error: `Buyer is not ACTIVE (currently ${buyer.application_status}).` }, { status: 409 });
    }
    if (buyer.industry_id !== lead.industry_id) {
      return NextResponse.json({ error: 'This buyer and lead are in different industries.' }, { status: 400 });
    }

    // Default to what was actually agreed with this buyer (buyers.exclusivity_arrangement, set
    // before the buyer could go ACTIVE) rather than to a platform-wide default -- multi-buyer
    // sharing is the normal model now, not a one-off admin override, so there is no single
    // sensible default that ignores the buyer's own contract. A buyer with no arrangement
    // recorded yet defaults to SHARED, the new baseline. An admin can still request a specific
    // type explicitly, but not one that contradicts the buyer's recorded contract.
    const allocationType = body.allocation_type ?? (buyer.exclusivity_arrangement === 'exclusive' ? 'EXCLUSIVE_WINDOW' : 'SHARED');
    if (buyer.exclusivity_arrangement === 'shared' && allocationType === 'EXCLUSIVE_WINDOW') {
      return NextResponse.json({ error: 'This buyer is contracted for shared leads only; cannot allocate EXCLUSIVE_WINDOW.' }, { status: 409 });
    }
    if (buyer.exclusivity_arrangement === 'exclusive' && allocationType === 'SHARED') {
      return NextResponse.json({ error: 'This buyer is contracted for exclusive leads only; cannot allocate SHARED.' }, { status: 409 });
    }
    if (allocationType === 'EXCLUSIVE_WINDOW' && liveAllocations.length > 0) {
      return NextResponse.json({ error: 'This lead already has a live allocation -- cannot claim it exclusively.' }, { status: 409 });
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

    const allocationSequence = allocationType === 'EXCLUSIVE_WINDOW' ? 1 : null;
    const inserted = await db.sql`
      INSERT INTO lead_allocations (
        lead_id, buyer_id, allocation_type, allocation_sequence, status,
        notified_at, decided_at, agreed_price, package_id, homeowner_confirmation_id
      ) VALUES (
        ${leadId}, ${body.buyer_id}, ${allocationType}, ${allocationSequence}, 'PURCHASED',
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
        ${JSON.stringify({
          lead_id: leadId, buyer_id: body.buyer_id, agreed_price: agreedPrice, package_id: body.package_id ?? null,
          allocation_type: allocationType, other_live_buyer_ids: liveAllocations.map((a) => (a as { buyer_id: number }).buyer_id),
          manual_review: needsManualReview
            ? { reasons: reviewReasons, acknowledged: true, acknowledgement_note: body.manual_review_acknowledgement_note ?? null }
            : null,
        })}
      )
    `;

    const industryLabel = INDUSTRY_LABELS[lead.industry_slug] ?? lead.industry_slug;
    const leadReference = `HLX-LEAD-${String(leadId).padStart(6, '0')}`;
    const packageCovered = Boolean(body.package_id);

    let paymentReference: string | null = null;
    if (!packageCovered) {
      const paymentInserted = await db.sql`
        INSERT INTO payments (lead_allocation_id, expected_amount, status, payment_link)
        VALUES (${allocationId}, ${agreedPrice}, 'PENDING', ${body.payment_link ?? null})
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
        packageCovered, paymentReference, paymentLink: body.payment_link ?? null,
        qualificationHighlights: buildQualificationSummary(lead.qualification_answers),
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
