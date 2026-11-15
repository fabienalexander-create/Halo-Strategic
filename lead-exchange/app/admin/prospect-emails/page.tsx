import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../../../lib/adminSession';
import ProspectEmailQueue from './ProspectEmailQueue';
import AdminLogoutButton from '../AdminLogoutButton';

// Server-side check for the page render itself -- a UX convenience, not the security boundary.
// The API route behind this page independently re-verifies via requireAdmin() on every request.
export default function ProspectEmailsPage() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <section>
      <div className="container">
        <div className="eyebrow">Admin</div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>Prospect Nurture Emails</h1>
        <p style={{ color: 'var(--slate)', marginBottom: 20 }}>
          Read-only visibility into the buyer-prospect welcome/nurture outbox: status, failure
          reasons and suppression state. No send or retry controls here.
        </p>
        <ProspectEmailQueue />
        <AdminLogoutButton />
      </div>
    </section>
  );
}
