import type { Metadata } from 'next';
import RegisterInterestForm from './RegisterInterestForm';

export const metadata: Metadata = {
  title: 'Register Your Interest | Halo Lead Exchange',
  description:
    'Register your business’s interest in the Halo Lead Exchange. A short form, not the full application -- we’ll follow up with more information.',
  robots: 'index, follow',
};

export default function RegisterInterestPage() {
  return (
    <section>
      <div className="container" style={{ maxWidth: 700 }}>
        <div className="eyebrow">Register Your Interest</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 12 }}>Tell us a little about your business.</h1>
        <p>
          This is a short registration, not the full application &mdash; it takes about a minute.
          We&rsquo;ll follow up with more information about the Lead Exchange and, when you&rsquo;re
          ready, a link to the full application.
        </p>
        <RegisterInterestForm />
      </div>
    </section>
  );
}
