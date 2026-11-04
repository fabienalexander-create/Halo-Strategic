import type { Metadata } from 'next';
import Link from 'next/link';
import RequestQuoteForm from './RequestQuoteForm';

export const metadata: Metadata = {
  title: 'Spray Foam Removal Quotes | Halo Lead Exchange',
  description:
    'Thinking about having spray foam insulation removed? Tell us about your property and we will connect you with a suitable, vetted removal specialist in your area.',
  robots: 'index, follow',
};

export default function RequestQuotePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="eyebrow">Homeowners &mdash; Spray Foam Removal</div>
          <h1>Thinking about having spray foam insulation removed?</h1>
          <p className="lead" style={{ margin: '0 auto 0' }}>
            Tell us about your property and the spray foam you&rsquo;re looking to have removed. We check
            your enquiry against agreed criteria and, only with your consent, connect you with one
            suitable, vetted removal specialist covering your area &mdash; not a list sold to several
            companies at once.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">Why Homeowners Get In Touch</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Common reasons people look into removal.</h2>
          <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
            <li>A mortgage lender, surveyor or buyer has flagged the spray foam during a sale or remortgage</li>
            <li>Concerns about damp, condensation or roof ventilation</li>
            <li>Planning a re-roof or other roof work and want the foam out first</li>
            <li>Not sure whether it&rsquo;s actually a problem, but want a specialist to take a look</li>
          </ul>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="eyebrow">What Happens After You Submit</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>No cold calls, no automatic sharing.</h2>
          <p>
            We check what you&rsquo;ve told us against the criteria we&rsquo;ve agreed with approved removal
            specialists &mdash; things like your postcode, property type, and where the foam is. We only pass
            your details to a specialist if you&rsquo;ve specifically agreed to that, and only once we judge
            your enquiry a genuine fit for a business covering your area. If there isn&rsquo;t a suitable
            match, your details aren&rsquo;t shared with anyone.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">Your Privacy</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Separate, specific consent &mdash; not bundled together.</h2>
          <p>
            Below, you choose separately whether we can contact you, whether we can share your details with
            a specialist, and whether you&rsquo;ve read our privacy policy &mdash; these are three distinct
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
