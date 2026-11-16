import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../../../../lib/adminSession';
import NewBuyerForm from './NewBuyerForm';
import AdminLogoutButton from '../../AdminLogoutButton';

export default function NewBuyerPage() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <section>
      <div className="container">
        <div className="eyebrow">Admin</div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>Add a buyer directly</h1>
        <p className="form-note" style={{ marginBottom: 20 }}>
          For a buyer onboarded by phone/email rather than through the public application form.
          This only creates the PENDING_REVIEW record &mdash; review, commercials, the mandatory
          onboarding call and activation all happen afterwards in the normal{' '}
          <a href="/leads-exchange/admin/applications">Buyer Applications</a> queue.
        </p>
        <NewBuyerForm />
        <AdminLogoutButton />
      </div>
    </section>
  );
}
