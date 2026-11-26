import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../../../lib/adminSession';
import AppointmentsPanel from './AppointmentsPanel';
import AdminLogoutButton from '../AdminLogoutButton';

export default function AppointmentsPage() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <section>
      <div className="container">
        <div className="eyebrow">Admin</div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>Booked Appointments</h1>
        <AppointmentsPanel />
        <AdminLogoutButton />
      </div>
    </section>
  );
}
