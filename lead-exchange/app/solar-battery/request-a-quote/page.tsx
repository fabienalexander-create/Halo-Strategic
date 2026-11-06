import type { Metadata } from 'next';
import Link from 'next/link';
import RequestQuoteForm from './RequestQuoteForm';

export const metadata: Metadata = {
  title: 'Solar & Battery Quotes | Halo Lead Exchange',
  description:
    'Thinking about solar panels or battery storage? Tell us about your property and we will connect you with a suitable, vetted installer in your area.',
  robots: 'index, follow',
};

export default function RequestQuotePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="eyebrow">Homeowners &mdash; Solar &amp; Battery</div>
          <h1>Thinking about solar panels or battery storage?</h1>
          <p className="lead" style={{ margin: '0 auto 0' }}>
            Tell us about your property and what you&rsquo;re exploring. We check your enquiry against
            agreed criteria and, only with your consent, connect you with one suitable, vetted installer
            covering your area &mdash; not a list sold to several companies at once.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">Why Homeowners Get In Touch</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Common reasons people look into solar.</h2>
          <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
            <li>Rising energy bills and wanting to generate their own electricity</li>
            <li>Interested in battery storage, with or without existing solar panels</li>
            <li>Planning a re-roof or other roof work and want to consider solar at the same time</li>
            <li>Not sure yet what&rsquo;s suitable for their roof, but want a specialist to assess it</li>
          </ul>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="eyebrow">What Happens After You Submit</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>No cold calls, no automatic sharing.</h2>
          <p>
            We check what you&rsquo;ve told us against the criteria we&rsquo;ve agreed with approved Solar
            &amp; Battery installers &mdash; things like your postcode, property type, and what you&rsquo;re
            interested in. We only pass your details to an installer if you&rsquo;ve specifically agreed to
            that, and only once we judge your enquiry a genuine fit for a business covering your area. If
            there isn&rsquo;t a suitable match, your details aren&rsquo;t shared with anyone.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">Your Privacy</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Separate, specific consent &mdash; not bundled together.</h2>
          <p>
            Below, you choose separately whether we can contact you, whether we can share your details with
            an installer, and whether you&rsquo;ve read our privacy policy &mdash; these are three distinct
            choices, not one tick-box covering everything. Marketing emails are optional and off by default.
            See our full{' '}
            <Link href="/privacy-policy" style={{ color: 'var(--bronze)' }}>
              Privacy Policy
            </Link>{' '}
            for details.
          </p>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="eyebrow">Request a Quote</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Tell us about your property.</h2>
          <RequestQuoteForm />
        </div>
      </section>
    </>
  );
}
