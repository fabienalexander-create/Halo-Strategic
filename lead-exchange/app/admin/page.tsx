import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
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
        <p style={{ marginTop: 20 }}>
          <Link href="/admin/applications" className="btn btn-bronze">
            Buyer Applications
          </Link>
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/prospect-emails" className="btn btn-bronze">
            Prospect Nurture Emails
          </Link>
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/emails" className="btn btn-bronze">
            Buyer Emails (delivery status)
          </Link>
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/prospect-pipeline" className="btn btn-bronze">
            Buyer Acquisition Pipeline
          </Link>
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/leads" className="btn btn-bronze">
            Leads
          </Link>
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/payments" className="btn btn-bronze">
            Payments
          </Link>
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/credits" className="btn btn-bronze">
            Credits &amp; Replacements
          </Link>
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/buyers/new" className="btn btn-bronze">
            Add Buyer Directly
          </Link>
        </p>
        <div className="disclaimer-box" style={{ marginTop: 20 }}>
          Priority 2 (application review) is working. Lead entry, allocation and payment
          verification are now manual-admin workflows (Leads/Payments pages) built on top of the
          existing pay-to-unlock schema. Inventory controls and automatic Meta ingestion for
          homeowner leads are not built yet.
        </div>
        <AdminLogoutButton />
      </div>
    </section>
  );
}
