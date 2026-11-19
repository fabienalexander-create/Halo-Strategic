import { runScheduledSmsSend } from '../../lib/smsScheduledSend';

// Netlify scheduled function: every 15 minutes, runs the homeowner SMS sender. All behaviour,
// including doing nothing while SMS_VERIFICATION_ENABLED is unset, is in lib/smsScheduledSend.ts.
// Scheduled functions only run on the published production deploy.
export default async () => runScheduledSmsSend();

export const config = { schedule: '*/15 * * * *' };
