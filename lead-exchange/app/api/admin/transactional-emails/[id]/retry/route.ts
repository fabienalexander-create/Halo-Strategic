import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { attemptSend } from '../../../../../../lib/email';
import {
  applicationReceivedEmail,
  applicationApprovedForCommercialReviewEmail,
  adminNewApplicationEmail,
} from '../../../../../../lib/emailTemplates';
import { categoryLabel } from '../../../../../../lib/industries';

// Retries a FAILED (or still-PENDING) outbox entry WITHOUT repeating the original application or
// approval action. Safe to call repeatedly or concurrently: attemptSend claims the row first and
// never resends one that already went out, bounced or was superseded.
//
// Each email type maps to its own template explicitly (fixed 2026-11-19: ADMIN_NEW_APPLICATION
// used to fall through to the approval template, so a retry would have sent the admin mailbox the
// applicant's approval text). An unrecognised type is refused, never sent with a guessed template.
//
// Body (optional): { confirmed_not_received: true } once an admin has checked that an earlier
// attempt whose outcome was unknown did not reach the recipient.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const outboxId = Number(params.id);
  if (!Number.isInteger(outboxId)) {
    return NextResponse.json({ error: 'Invalid outbox id.' }, { status: 400 });
  }
  let body: { confirmed_not_received?: boolean } = {};
  try {
    const raw = await req.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const db = getDatabase();
  const rows = await db.sql`
    SELECT e.id, e.email_type, e.status, b.contact_name, b.company_name, b.application_reference, i.slug AS industry_slug
    FROM transactional_emails e
    JOIN buyers b ON b.id = e.buyer_id
    LEFT JOIN industries i ON i.id = b.industry_id
    WHERE e.id = ${outboxId}
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No matching outbox entry found.' }, { status: 404 });
  }

  const row = rows[0] as {
    id: number; email_type: string; status: string; contact_name: string; company_name: string;
    application_reference: string; industry_slug: string | null;
  };
  if (row.status === 'SUPERSEDED') {
    return NextResponse.json({ error: 'This email was superseded and will not be sent.' }, { status: 409 });
  }
  if (row.status === 'BOUNCED' || row.status === 'COMPLAINED') {
    return NextResponse.json({ error: `This email ${row.status === 'BOUNCED' ? 'bounced' : 'was marked as spam'}. Fix the address before sending anything else.` }, { status: 409 });
  }

  let content;
  switch (row.email_type) {
    case 'APPLICATION_RECEIVED':
      content = applicationReceivedEmail(row.contact_name);
      break;
    case 'APPLICATION_APPROVED_FOR_COMMERCIAL_REVIEW':
      content = applicationApprovedForCommercialReviewEmail(row.contact_name);
      break;
    case 'ADMIN_NEW_APPLICATION':
      content = adminNewApplicationEmail({
        companyName: row.company_name,
        contactName: row.contact_name,
        industryLabel: categoryLabel(row.industry_slug),
        applicationReference: row.application_reference,
      });
      break;
    default:
      return NextResponse.json({ error: `No template for email type ${row.email_type}; not sent.` }, { status: 422 });
  }

  const result = await attemptSend(db, outboxId, content, { confirmedNotReceived: body.confirmed_not_received === true });
  return NextResponse.json(result, { status: result.outcomeUnknown && !result.sent ? 409 : 200 });
}
