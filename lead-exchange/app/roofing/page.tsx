import Link from 'next/link';
import RoofingIllustration from '../components/RoofingIllustration';
import Reveal from '../components/Reveal';

export default function RoofingPage() {
  return (
    <>
      <Reveal />
      <section className="hero hero-split">
        <div className="container hero-grid">
          <div className="hero-copy">
          <div className="eyebrow">Roofing &mdash; New Market</div>
          <h1>Qualified roofing enquiries for UK roofing contractors.</h1>
          <p className="lead">
            Homeowners needing a roof repair or replacement, qualified against agreed criteria before
            any enquiry reaches a buyer.
          </p>
          <div className="hero-actions">
            <Link href="/become-a-buyer" className="btn btn-bronze">
              Apply to Become a Buyer
            </Link>
          </div>
          <p className="form-note" style={{ marginTop: 12 }}>
            Homeowner needing a roof repair or replacement?{' '}
            <Link href="/roofing/request-a-quote" style={{ color: 'var(--bronze)' }}>
              Request a quote here
            </Link>
            .
          </p>
          </div>
          <div className="hero-art" data-reveal>
            <RoofingIllustration />
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
            <li>Roof type, where known</li>
            <li>Repair, partial replacement, or full replacement</li>
            <li>Urgency (e.g. an active leak versus just researching)</li>
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
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Replacement terms, agreed individually for now.</h2>
          <p>
            Roofing is a new market on the Lead Exchange, and we don&rsquo;t yet have a published
            replacement policy for it the way Spray Foam Removal does. Until one exists, lead
            acceptance and replacement terms are agreed individually with each approved buyer as part
            of onboarding, not assumed from another vertical&rsquo;s policy.
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
