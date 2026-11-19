import { getDatabase } from '@netlify/database';
import { sendPendingVerifications } from '../../lib/smsSender';

// Homeowner SMS stage 2 (Fabien, 2026-11-19): the scheduler the SMS engine was built to expect.
// Every 15 minutes it runs the same sender the intake routes use, so that:
//  - Meta follow-up texts held outside 08:00-20:00 Europe/London go out from 08:00;
//  - a hand-off to Make that failed is retried (max 3 attempts, the SAME link every time);
//  - texts not sent within their window expire instead of going out late;
//  - numbers that replied STOP are closed before anything is claimed.
// All the rules live in lib/smsSender.ts and lib/smsVerification.ts; this adds none of its own.
//
// OFF unless SMS_VERIFICATION_ENABLED=true: it returns before touching the database. Meta
// follow-ups additionally need META_FOLLOW_UP_SMS_ENABLED=true and SMS_LINK_ENCRYPTION_KEY, and
// nothing is handed to Make without MAKE_SMS_OUT_WEBHOOK_URL and MAKE_SMS_OUT_SECRET. Logs counts
// only: never a phone number, reference or message text.
export default async function handler(): Promise<Response> {
  if (process.env.SMS_VERIFICATION_ENABLED !== 'true') {
    return Response.json({ skipped: 'NOT_ENABLED' });
  }
  try {
    const summary = await sendPendingVerifications(getDatabase(), { limit: 20 });
    console.log('sms-send-pending', JSON.stringify(summary));
    return Response.json(summary);
  } catch (err) {
    console.error('sms-send-pending failed', err instanceof Error ? err.message : 'unknown');
    return Response.json({ error: 'Failed.' }, { status: 500 });
  }
}

export const config = { schedule: '*/15 * * * *' };
