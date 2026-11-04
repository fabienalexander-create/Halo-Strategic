import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../../../../lib/adminSession';
import ApplicationDetail from './ApplicationDetail';

export default function ApplicationDetailPage({ params }: { params: { reference: string } }) {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <section>
      <div className="container">
        <div className="eyebrow">Admin &middot; Application</div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>{params.reference}</h1>
        <ApplicationDetail reference={params.reference} />
      </div>
    </section>
  );
}
