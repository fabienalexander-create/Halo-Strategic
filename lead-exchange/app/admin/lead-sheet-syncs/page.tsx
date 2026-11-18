import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../../../lib/adminSession';
import LeadSheetSyncQueue from './LeadSheetSyncQueue';
import AdminLogoutButton from '../AdminLogoutButton';

// Server-side check for the page render itself -- a UX convenience, not the security boundary.
// The API routes behind this page independently re-verify via requireAdmin() on every request.
export default function LeadSheetSyncsPage() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <section>
      <div className="container">
        <div className="eyebrow">Admin</div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>Google Sheet Sync</h1>
        <p style={{ color: 'var(--slate)', marginBottom: 20 }}>
          Every lead gets exactly one sync entry here, regardless of source (website form or Meta).
          A FAILED row means the lead itself was saved correctly -- the sync is a separate,
          independently-retryable outbox, same discipline as the transactional email outbox.
        </p>
        <LeadSheetSyncQueue />
        <AdminLogoutButton />
      </div>
    </section>
  );
}
