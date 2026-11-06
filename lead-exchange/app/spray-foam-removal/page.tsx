import Link from 'next/link';
import LoftCrossSection from '../components/LoftCrossSection';
import Reveal from '../components/Reveal';

export default function SprayFoamRemovalPage() {
  return (
    <>
      <Reveal />
      <section className="hero hero-split">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">Spray Foam Removal &mdash; Pilot Market</div>
            <h1>Qualified spray foam removal enquiries for UK removal specialists.</h1>
            <p className="lead">
              Homeowners exploring removal of existing spray foam insulation, qualified against agreed
              criteria before any enquiry reaches a buyer. This is a pilot market &mdash; built properly
              before we expand to others.
            </p>
            <div className="hero-actions">
              <Link href="/become-a-buyer" className="btn btn-bronze">
                Apply to Become a Buyer
              </Link>
            </div>
            <p className="form-note" style={{ marginTop: 12 }}>
              Homeowner looking to have spray foam removed?{' '}
              <Link href="/spray-foam-removal/request-a-quote" style={{ color: 'var(--bronze)' }}>
                Request a quote here
              </Link>
              .
            </p>
          </div>
          <div className="hero-art" data-reveal>
            <LoftCrossSection />
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">Who We Qualify</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Homeowner and property qualification.</h2>
          <p>Each enquiry is checked against criteria agreed with approved buyers, which can include:</p>
          <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
            <li>Homeowner status (confirmed, not assumed)</li>
            <li>Property type and postcode</li>
            <li>Whether spray foam is present, and where (loft/roof)</li>
            <li>Open-cell or closed-cell, where known</li>
            <li>Reason removal is being considered</li>
            <li>Desired timescale</li>
            <li>Roof access information</li>
            <li>Previous inspections or quotations, if any</li>
          </ul>
          <p>
            The system distinguishes <strong>confirmed information</strong> from{' '}
            <strong>homeowner estimates</strong> and <strong>unknown information</strong> &mdash; nothing
            uncertain is presented to a buyer as confirmed.
          </p>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="eyebrow">Geographic Targeting</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Enquiries matched to your coverage.</h2>
          <p>
            Buyers set their approved service territories when they&rsquo;re onboarded. An enquiry is only
            ever offered to a buyer whose territory covers it &mdash; we don&rsquo;t broadcast enquiries
            outside agreed coverage.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">What You See Before You Buy</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>A redacted preview, not a blind purchase.</h2>
          <p>
            Before you pay, you see a redacted preview: general location, property type, qualification
            summary, and price &mdash; enough to decide whether it&rsquo;s worth pursuing, without enough
            detail to identify or contact the homeowner before purchase. Full contact details are released
            only after payment is verified.
          </p>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="eyebrow">Lead Acceptance &amp; Replacement</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Our Spray Foam Removal replacement policy.</h2>
          <p>
            If you can&rsquo;t make contact with the homeowner within 3 calendar days of delivery, with
            documented attempts (calls, texts, or emails where supplied), the lead is replaced with an
            equivalent lead at no additional charge. This is a <strong>replacement, not an automatic cash
            refund</strong>. A lead that simply doesn&rsquo;t convert into a sale, or a homeowner who
            changes their mind after being reached, doesn&rsquo;t on its own qualify &mdash; see our{' '}
            <Link href="/refund-policy" style={{ color: 'var(--bronze)' }}>
              full Refund &amp; Replacement Policy
            </Link>{' '}
            for the exact criteria.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">Exclusivity</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Exclusive only where agreed.</h2>
          <p>
            We don&rsquo;t claim every lead is exclusive. Whether a lead is sold to one buyer only or
            shared is set out in your individual buyer agreement, not assumed as a platform-wide default.
          </p>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="eyebrow">Becoming a Buyer</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Approval before access.</h2>
          <p>
            Every buyer applies and is reviewed before getting access to lead inventory &mdash; we
            don&rsquo;t give unverified applicants automatic access.
          </p>
          <Link href="/become-a-buyer" className="btn btn-bronze" style={{ marginTop: 12 }}>
            Apply to Become a Buyer
          </Link>
        </div>
      </section>
    </>
  );
}
