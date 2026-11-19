import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';
import { reissueFollowUpLink, sendPendingFollowUpSms } from '../../../../../../lib/metaFollowUpSms';

// Issues a fresh website completion link for a QUALIFICATION_PENDING spray foam lead. The old link
// stops working immediately. The new URL is returned once in this response (for the admin to send
// by hand if needed) and never stored. If META_FOLLOW_UP_SMS_ENABLED is on, a text is also queued,
// subject to every normal gate; with it off, nothing is sent.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  const leadId = Number(params.id);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ error: 'Invalid lead id.' }, { status: 400 });
  }
  let queueSms = true;
  try {
    const body = (await req.json()) as { queue_sms?: unknown };
    if (body.queue_sms === false) queueSms = false;
  } catch { /* empty body: default to queueing (still gated by the env switch) */ }

  try {
    const db = getDatabase();
    const result = await reissueFollowUpLink(db, { leadId, actor: auth.session.email, queueSms });
    if (!result.ok) {
      const status = result.reason === 'NOT_FOUND' ? 404 : 409;
      const error = {
        NOT_FOUND: 'Lead not found.',
        NOT_AWAITING_QUALIFICATION: 'Only leads awaiting qualification can be sent a follow-up link.',
        UNSUPPORTED_INDUSTRY: 'Follow-up links are only available for spray foam removal leads.',
      }[result.reason];
      return NextResponse.json({ error, reason: result.reason }, { status });
    }

    if (result.sms.queued) {
      try {
        await sendPendingFollowUpSms(db, { limit: 1, leadId });
      } catch (err) {
        console.error('Follow-up SMS send after reissue failed', err instanceof Error ? err.message : 'unknown');
      }
    }

    return NextResponse.json({
      follow_up_url: result.followUpUrl,
      expires_at: result.expiresAt.toISOString(),
      cancelled_messages: result.cancelledMessages,
      sms_queued: result.sms.queued,
      sms_reason: result.sms.queued ? null : result.sms.reason,
    }, { status: 200 });
  } catch (err) {
    console.error('Follow-up link reissue failed', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed to reissue follow-up link.' }, { status: 500 });
  }
}
