import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { getEligibleBuyers } from '../../../../../../lib/buyerMatching';

// Suggests which ACTIVE buyers a lead should actually be offered to -- matched by industry,
// coverage and remaining weekly capacity, and consistent with each buyer's own exclusivity
// arrangement given who else already has a live allocation on this lead. This never allocates
// anything; it only narrows the admin's picker so that offering a lead to several buyers (the
// default model as of 2026-11-18) stays a matched decision rather than a blind broadcast.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const leadId = Number(params.id);
  if (!Number.isInteger(leadId)) {
    return NextResponse.json({ error: 'Invalid lead id.' }, { status: 400 });
  }

  try {
    const db = getDatabase();

    const leads = await db.sql`SELECT id, industry_id, postcode FROM leads WHERE id = ${leadId}`;
    if (leads.length === 0) {
      return NextResponse.json({ error: 'No matching lead found.' }, { status: 404 });
    }
    const lead = leads[0] as { id: number; industry_id: number; postcode: string | null };

    const liveAllocations = await db.sql`
      SELECT buyer_id FROM lead_allocations WHERE lead_id = ${leadId} AND status IN ('OFFERED', 'ACCEPTED', 'PURCHASED')
    `;
    const excludeBuyerIds = (liveAllocations as { buyer_id: number }[]).map((a) => a.buyer_id);

    const eligible = await getEligibleBuyers(db, lead, excludeBuyerIds);

    return NextResponse.json({ buyers: eligible });
  } catch (err) {
    console.error('Listing eligible buyers failed', err);
    return NextResponse.json({ error: 'Failed to list eligible buyers.' }, { status: 500 });
  }
}
