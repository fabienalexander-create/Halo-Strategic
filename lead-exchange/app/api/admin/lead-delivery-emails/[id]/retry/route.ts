import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { attemptSendLeadDeliveryEmail } from '../../../../../../lib/leadDeliveryEmail';
import { leadOfferEmail, internalOfferCopyEmail, leadUnlockedEmail, internalReleaseCopyEmail } from '../../../../../../lib/emailTemplates';

const INDUSTRY_LABELS: Record<string, string> = {
  spray_foam_removal: 'Spray Foam Removal',
  solar_battery: 'Solar & Battery',
  roofing: 'Roofing',
};

// Retries a FAILED (or still-PENDING) lead_delivery_emails row -- same idempotent shape as the
// lead-sheet-syncs and transactional-emails retry endpoints. Re-derives the email content from
// the current state of the allocation/lead/buyer rather than storing rendered content, so a retry
// days later still reflects reality (e.g. if a price were ever corrected -- though nothing in this
// codebase does that today).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
  }

  const db = getDatabase();
  const rows = await db.sql`
    SELECT e.id AS email_id, e.email_type, e.recipient,
           a.id AS allocation_id, a.agreed_price, a.package_id,
           l.id AS lead_id, l.homeowner_name, l.homeowner_contact, l.postcode, l.property_type, l.service_requirement,
           i.slug AS industry_slug, b.company_name, p.payment_reference
    FROM lead_delivery_emails e
    JOIN lead_allocations a ON a.id = e.lead_allocation_id
    JOIN leads l ON l.id = a.lead_id
    JOIN industries i ON i.id = l.industry_id
    JOIN buyers b ON b.id = a.buyer_id
    LEFT JOIN payments p ON p.lead_allocation_id = a.id
    WHERE e.id = ${id}
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No matching lead delivery email found.' }, { status: 404 });
  }
  const row = rows[0] as {
    email_id: number; email_type: string; recipient: string; allocation_id: number;
    agreed_price: number | null; package_id: number | null; lead_id: number;
    homeowner_name: string; homeowner_contact: { email?: string; mobile?: string };
    postcode: string; property_type: string; service_requirement: string;
    industry_slug: string; company_name: string; payment_reference: string | null;
  };

  const industryLabel = INDUSTRY_LABELS[row.industry_slug] ?? row.industry_slug;
  const leadReference = `HLX-LEAD-${String(row.lead_id).padStart(6, '0')}`;
  const packageCovered = row.package_id !== null;

  let content;
  switch (row.email_type) {
    case 'LEAD_OFFER':
      content = leadOfferEmail({
        leadReference, industryLabel, postcode: row.postcode, propertyType: row.property_type,
        serviceRequirement: row.service_requirement, currency: 'GBP', price: row.agreed_price,
        packageCovered, paymentReference: row.payment_reference,
      });
      break;
    case 'INTERNAL_OFFER_COPY':
      content = internalOfferCopyEmail({
        leadReference, companyName: row.company_name, industryLabel, postcode: row.postcode,
        price: row.agreed_price, packageCovered,
      });
      break;
    case 'LEAD_UNLOCKED':
      content = leadUnlockedEmail({
        leadReference, industryLabel, homeownerName: row.homeowner_name,
        phone: row.homeowner_contact?.mobile ?? '', email: row.homeowner_contact?.email ?? '',
        postcode: row.postcode, propertyType: row.property_type, serviceRequirement: row.service_requirement,
      });
      break;
    case 'INTERNAL_RELEASE_COPY':
      content = internalReleaseCopyEmail({
        leadReference, companyName: row.company_name, homeownerName: row.homeowner_name,
        phone: row.homeowner_contact?.mobile ?? '', email: row.homeowner_contact?.email ?? '',
        postcode: row.postcode, packageCovered,
      });
      break;
    default:
      return NextResponse.json({ error: `Unknown email_type: ${row.email_type}` }, { status: 500 });
  }

  const result = await attemptSendLeadDeliveryEmail(db, row.email_id, content);
  return NextResponse.json(result);
}
