import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../../../lib/adminSession';
import LeadsQueue from './LeadsQueue';
import AdminLogoutButton from '../AdminLogoutButton';

export default function LeadsPage() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <section>
      <div className="container">
        <div className="eyebrow">Admin</div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>Leads</h1>
        <LeadsQueue />
        <AdminLogoutButton />
      </div>
    </section>
  );
}
