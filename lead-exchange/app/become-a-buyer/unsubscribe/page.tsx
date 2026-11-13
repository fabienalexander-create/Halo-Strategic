import type { Metadata } from 'next';
import UnsubscribeForm from './UnsubscribeForm';

export const metadata: Metadata = {
  title: 'Unsubscribe | Halo Lead Exchange',
  robots: 'noindex, nofollow',
};

export default function UnsubscribePage() {
  return (
    <section>
      <div className="container" style={{ maxWidth: 600 }}>
        <div className="eyebrow">Email Preferences</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 12 }}>Manage your emails.</h1>
        <UnsubscribeForm />
      </div>
    </section>
  );
}
