import type { Metadata } from 'next';
import RequestQuoteForm from './RequestQuoteForm';

export const metadata: Metadata = {
  title: 'Request a Spray Foam Removal Quote | Halo Lead Exchange',
  description:
    'Tell us about the spray foam insulation in your property and we will help connect you with a suitable removal specialist.',
  robots: 'index, follow',
};

export default function RequestQuotePage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Spray Foam Removal</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 12 }}>Request a spray foam removal quote</h1>
        <p className="lead" style={{ marginBottom: 28 }}>
          Tell us about your property and the spray foam insulation you&rsquo;re looking to have removed.
          We only pass your details to a suitable business if you agree, and only after we judge your
          enquiry a genuine fit.
        </p>
        <RequestQuoteForm />
      </div>
    </section>
  );
}
