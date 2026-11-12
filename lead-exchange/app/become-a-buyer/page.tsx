import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Halo Lead Exchange for Businesses | Halo Strategic',
  description:
    'Connect your business with new customer opportunities through the Halo Lead Exchange, a structured marketplace for relevant homeowner enquiries.',
  robots: 'index, follow',
};

// The buyer acquisition landing page -- the first stage a prospective buyer sees, before either
// the short interest registration or the full application. Deliberately carries no pricing,
// volume, verification or guaranteed-supply claims anywhere on it (Fabien's explicit instruction);
// every commercial detail is pushed to "agreed during onboarding" rather than stated here.
export default function BecomeABuyerLandingPage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="eyebrow">Halo Lead Exchange</div>
          <h1>Connect your business with new customer opportunities.</h1>
          <p className="lead" style={{ margin: '0 auto 0' }}>
            Access relevant homeowner enquiries through a structured marketplace designed to connect
            businesses with potential customers in their operating areas.
          </p>
          <div className="hero-actions" style={{ marginTop: 20 }}>
            <Link href="/become-a-buyer/register-interest" className="btn btn-bronze">
              Register Your Interest
            </Link>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">How It Works</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>A straightforward process.</h2>
          <div className="step-row">
            <div className="step"><div className="n">01</div><h4>Register your interest</h4><p>A short registration &mdash; a minute or two.</p></div>
            <div className="step"><div className="n">02</div><h4>Complete your application</h4><p>Your business details, coverage area and service capability.</p></div>
            <div className="step"><div className="n">03</div><h4>Application reviewed</h4><p>Every application is reviewed individually, not auto-approved.</p></div>
            <div className="step"><div className="n">04</div><h4>Onboarding call</h4><p>A mandatory call to confirm fit and agree terms.</p></div>
            <div className="step"><div className="n">05</div><h4>Commercial arrangements agreed</h4><p>Pricing and lead-acceptance terms agreed directly with you.</p></div>
            <div className="step"><div className="n">06</div><h4>Approved and activated</h4><p>Your account goes live once terms are agreed.</p></div>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="eyebrow">Illustrative Example</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>What an enquiry looks like.</h2>
          <p className="form-note" style={{ textAlign: 'left', marginBottom: 12 }}>
            The example below is illustrative only and does not represent a real enquiry.
          </p>
          <div className="disclaimer-box">
            <p style={{ margin: 0 }}>
              <strong>Postcode area:</strong> CM1 &middot; <strong>Property type:</strong> Detached house
              <br />
              <strong>Service required:</strong> Spray foam removal &middot; <strong>Reason:</strong> Mortgage concern raised by surveyor
            </p>
          </div>
          <p style={{ marginTop: 16 }}>
            Full homeowner contact details are only released to an approved, activated buyer, after
            payment is verified.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">Quality and Transparency</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Enquiries are generated, checked, then offered.</h2>
          <p>
            Enquiries are generated through targeted acquisition campaigns, then checked against
            criteria agreed with each buyer before being offered. Today, this is live for{' '}
            <Link href="/spray-foam-removal" style={{ color: 'var(--bronze)' }}>Spray Foam Removal</Link>.{' '}
            <Link href="/solar-battery" style={{ color: 'var(--bronze)' }}>Solar &amp; Battery</Link> and{' '}
            <Link href="/roofing" style={{ color: 'var(--bronze)' }}>Roofing</Link> are configured in
            the platform, but not yet open to new buyers while we establish coverage in those markets.
          </p>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="eyebrow">Built Around Transparency</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Every application is reviewed.</h2>
          <p>
            Access isn&rsquo;t automatic. Every prospective buyer&rsquo;s application is reviewed, and
            every approved applicant completes a mandatory onboarding call before any account is
            activated. Suitability and available supply both factor into that decision.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">Commercial Process</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Terms agreed directly with you.</h2>
          <p>
            Pricing and lead-acceptance terms are agreed individually during onboarding, not fixed in
            advance &mdash; they depend on your industry, coverage area and the arrangement that suits
            your business.
          </p>
        </div>
      </section>

      <section id="faq" className="tight" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <div className="eyebrow">FAQ</div>
          <h2 className="section-title" style={{ fontSize: '1.7rem' }}>What people ask first.</h2>
          <div className="faq">
            <details>
              <summary>How does the Lead Exchange work?</summary>
              <p>Halo develops acquisition campaigns, generates homeowner enquiries, checks them against criteria agreed with approved buyers, and offers suitable enquiries to the matching buyer.</p>
            </details>
            <details>
              <summary>Which industries are supported?</summary>
              <p>Spray Foam Removal is live today. Solar &amp; Battery and Roofing are configured in the platform but not yet open to new buyers.</p>
            </details>
            <details>
              <summary>How are enquiries generated?</summary>
              <p>Through targeted acquisition campaigns aimed at homeowners, not bought in bulk from third parties.</p>
            </details>
            <details>
              <summary>How does distribution work?</summary>
              <p>An enquiry is only ever offered to a buyer whose agreed coverage area and criteria match it.</p>
            </details>
            <details>
              <summary>Is exclusivity available?</summary>
              <p>Not claimed as standard. Whether a lead is sold to one buyer only or shared is set out in your individual buyer agreement, not assumed as a platform-wide default.</p>
            </details>
            <details>
              <summary>How does pricing work?</summary>
              <p>Agreed individually during onboarding, based on your industry, coverage area and arrangement.</p>
            </details>
            <details>
              <summary>Why is an onboarding call required?</summary>
              <p>To confirm your business is a genuine fit and agree the criteria and commercial terms your account will run on, before anything is activated.</p>
            </details>
            <details>
              <summary>When can my business become active?</summary>
              <p>After your application is reviewed, your onboarding call is completed, and commercial terms are agreed.</p>
            </details>
          </div>
        </div>
      </section>

      <section id="cta" className="band-dark tight">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="eyebrow" style={{ color: 'var(--bronze-light)' }}>Interested in Becoming a Buyer?</div>
          <h2 className="section-title" style={{ color: '#fff' }}>Register your business interest to receive further information.</h2>
          <Link href="/become-a-buyer/register-interest" className="btn btn-bronze" style={{ marginTop: 16, display: 'inline-block' }}>
            Register Your Interest
          </Link>
          <p style={{ marginTop: 16, color: '#C7CBD4' }}>
            Already know you&rsquo;re ready?{' '}
            <Link href="/become-a-buyer/apply" style={{ color: '#fff', textDecoration: 'underline' }}>Go straight to the full application</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
