import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../../../lib/adminSession';
import EmailStatusQueue from './EmailStatusQueue';
import AdminLogoutButton from '../AdminLogoutButton';

// Server-side check for the page render itself -- a UX convenience, not the security boundary.
// The API routes behind this page re-verify via requireAdmin() on every request.
export default function EmailsPage() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <section>
      <div className="container">
        <div className="eyebrow">Admin</div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>Buyer Emails</h1>
        <p style={{ color: 'var(--slate)', marginBottom: 20 }}>
          Every application, lead offer and lead unlock email, with what Resend reported for it.
          Retry is offered only for failed emails that definitely did not go out.
        </p>
        <EmailStatusQueue />
        <AdminLogoutButton />
      </div>
    </section>
  );
}
