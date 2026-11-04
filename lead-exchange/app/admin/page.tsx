import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../../lib/adminSession';
import AdminLogoutButton from './AdminLogoutButton';

export default function AdminHomePage() {
  // Server-side check for the page render itself. This is a UX convenience (redirect to login
  // if clearly not signed in) — it is NOT the security boundary. Every admin API route
  // independently re-verifies the session via requireAdmin(), because a hidden page is not
  // access control (brief: "No reliance on hiding frontend pages for security").
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <section>
      <div className="container">
        <div className="eyebrow">Admin</div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 12 }}>Signed in as {session.email}</h1>
        <p style={{ color: 'var(--slate)' }}>Role: {session.role}</p>
        <div className="disclaimer-box" style={{ marginTop: 20 }}>
          Priority 1 (admin authentication) is working. Application review, lead management, buyer
          profiles, and inventory controls (Priorities 2&ndash;5) are not built yet &mdash; this page
          is intentionally just a signed-in landing spot for now.
        </div>
        <AdminLogoutButton />
      </div>
    </section>
  );
}
