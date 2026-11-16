import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { recordSalesActivity, SalesPipelineError, type SalesActivityType, type SalesStage } from '../../../../../../lib/buyerProspectSalesPipeline';

const VALID_ACTIVITY_TYPES = new Set<SalesActivityType>([
  'STAGE_CHANGE', 'EMAIL_SENT', 'SMS_SENT', 'RESPONSE_RECEIVED',
  'CALL_ATTEMPTED', 'CALL_COMPLETED', 'QUALIFICATION_NOTE', 'FOLLOW_UP_SCHEDULED',
]);

interface ActivityPayload {
  activity_type?: string;
  note?: string;
  new_stage?: string;
  authorisation_basis?: string;
  agreed_package_definition_id?: number;
  next_follow_up_at?: string;
}

// The only write path for the sales pipeline -- every stage change, every logged email/SMS/call,
// every qualification note goes through here, which is just this route plus
// lib/buyerProspectSalesPipeline.ts. This route records that a human admin took an action
// (e.g. "I sent Stuart an email"); it never sends anything itself.
export async function POST(req: NextRequest, { params }: { params: { reference: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  let body: ActivityPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.activity_type || !VALID_ACTIVITY_TYPES.has(body.activity_type as SalesActivityType)) {
    return NextResponse.json({ error: 'Missing or unrecognised activity_type.' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const prospectRows = await db.sql`SELECT id FROM buyer_prospects WHERE prospect_reference = ${params.reference}`;
    if (prospectRows.length === 0) {
      return NextResponse.json({ error: 'No matching prospect found.' }, { status: 404 });
    }
    const prospectId = prospectRows[0].id as number;

    const result = await recordSalesActivity(db, {
      prospectId,
      activityType: body.activity_type as SalesActivityType,
      recordedBy: auth.session.email,
      note: body.note,
      newStage: body.new_stage as SalesStage | undefined,
      authorisationBasis: body.authorisation_basis,
      agreedPackageDefinitionId: body.agreed_package_definition_id,
      nextFollowUpAt: body.next_follow_up_at ? new Date(body.next_follow_up_at) : undefined,
    });

    return NextResponse.json({ activity_id: result.activityId, stage: result.stage }, { status: 201 });
  } catch (err) {
    if (err instanceof SalesPipelineError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Recording sales activity failed', err);
    return NextResponse.json({ error: 'Failed to record activity.' }, { status: 500 });
  }
}
