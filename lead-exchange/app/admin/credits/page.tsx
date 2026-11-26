import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../../../lib/adminSession';
import CreditsPanel from './CreditsPanel';
import AdminLogoutButton from '../AdminLogoutButton';

export default function CreditsPage() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <section>
      <div className="container">
        <div className="eyebrow">Admin</div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>Credits &amp; Replacements</h1>
        <CreditsPanel />
        <AdminLogoutButton />
      </div>
    </section>
  );
}
