import type { Metadata } from 'next';
import Link from 'next/link';
import { buildAttributionQuery, pickAttributionParams } from '../../lib/attribution';
import { BASE_PATH } from '../../lib/basePath';

// Paid-traffic landing page (video funnel) at /leads-exchange/vsl: linked from the Meta Instant
// Form's completion screen and A/B tested against /become-a-buyer.
// Deliberately NOT indexable: the root layout's noindex default applies, and robots is set here
// explicitly too, so it never competes with the five organic landing pages.
//
// Unlike /become-a-buyer, this page states the commercial structure and prices (Fabien,
// 2026-11-26): a 5-lead starter pack paid up front, then pay per lead. The figures live in the
// constants below so they are changed in one place, and must match what onboarding and the buyer
// agreement actually charge.
export const metadata: Metadata = {
  title: 'Get Started with Halo Lead Exchange',
  description:
    'Checked homeowner enquiries and booked appointments for UK solar & battery, roofing and spray foam removal installers. Start with 5 leads, then pay per lead.',
  robots: 'noindex, nofollow',
};

// Pricing agreed 2026-11-12 (confirmed by Fabien 2026-11-26). Two lead types; a starter pack is
// 5 leads of one type paid up front, then pay per lead at the same per-lead price. The same for all
// three live trades: a solar-specific price was discussed but never finalised, so it is not shown.
const PRICING = [
  { key: 'enquiry', name: 'Verified enquiry', perLead: '£85', starter: '£425', note: 'A checked homeowner enquiry with full contact details once released.' },
  { key: 'appointment', name: 'Booked appointment', perLead: '£125', starter: '£625', note: 'A checked enquiry with a time and date arranged with the homeowner for you.' },
];

const promises = [
  { k: 'CHECKED', h: 'Every enquiry checked', p: 'Each enquiry is checked against agreed criteria before it is offered to anyone.' },
  { k: 'IN CONTROL', h: 'Preview, then decide', p: 'After your starter pack, you see a redacted preview of each lead and only pay for the ones you accept.' },
  { k: 'PROTECTED', h: 'Payment verified first', p: 'Full homeowner details are released only once payment is verified.' },
];

const trades = [
  { href: '/solar-battery', name: 'Solar & battery', body: 'Panels, storage or both, with roof and timescale checked.' },
  { href: '/roofing', name: 'Roofing', body: 'Repairs to full replacements, with urgency and roof type.' },
  { href: '/spray-foam-removal', name: 'Spray foam removal', body: 'Foam type, location, reason for removal and access.' },
];

export default function VslPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Same attribution hand-off as /become-a-buyer: next/link drops the query string, so utm_* and
  // fbclid from the ad are forwarded explicitly to the apply/register pages.
  const attributionQuery = buildAttributionQuery(pickAttributionParams(searchParams));
  const withAttribution = (path: string) => (attributionQuery ? `${path}?${attributionQuery}` : path);

  const steps = [
    { n: '01', h: 'Apply', p: 'A short application: your business, your trade and the areas you cover. Every application is reviewed by a person.' },
    { n: '02', h: 'Onboarding call', p: 'We confirm your territory and how many jobs you can take on, and set out your terms in a buyer agreement.' },
    { n: '03', h: 'Your first 5 leads', p: 'Choose a starter pack of 5 verified enquiries (£425) or 5 booked appointments (£625), paid up front. Each lead is delivered in full as it comes in.' },
    { n: '04', h: 'Then pay per lead', p: 'After your first 5, you pay per lead: £85 for a verified enquiry or £125 for a booked appointment. You see a redacted preview first and only pay for the leads you accept.' },
  ];

  return (
    <>
      <section className="hero hero-split">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">For UK solar, roofing and spray foam installers</div>
            <h1>Checked homeowner enquiries, on clear terms.</h1>
            <p className="lead">
              Start with 5 leads. After that, see each enquiry before you buy it, and only pay for the ones you
              choose.
            </p>
            <div className="hero-actions">
              <Link href={withAttribution('/become-a-buyer/apply')} className="btn btn-bronze">
                Apply to become a buyer
              </Link>
              <a href="#get-started" className="hero-homeowner-link">
                How getting started works &rarr;
              </a>
            </div>
          </div>
          <figure className="hero-video">
            <video
              controls
              playsInline
              preload="metadata"
              poster={`${BASE_PATH}/media/how-it-works-poster.jpg`}
              aria-label="How Halo Lead Exchange works, a 70-second video with captions"
            >
              <source src={`${BASE_PATH}/media/how-it-works.mp4`} type="video/mp4" />
            </video>
            <figcaption>How it works in 70 seconds.</figcaption>
          </figure>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="card-grid">
            {promises.map((x) => (
              <div className="mini-card" key={x.k}>
                <div className="k">{x.k}</div>
                <h3>{x.h}</h3>
                <p>{x.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="get-started">
        <div className="container">
          <div className="eyebrow">Get started</div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 12 }}>Four steps, no surprises.</h2>
          <p>Your starter pack gets you going. After that, every lead is your choice.</p>
          <div className="step-row" style={{ flexWrap: 'wrap' }}>
            {steps.map((s) => (
              <div className="step" key={s.n} style={{ minWidth: 220 }}>
                <div className="n">{s.n}</div>
                <h4>{s.h}</h4>
                <p>{s.p}</p>
              </div>
            ))}
          </div>
          <div className="pricing-summary">
            {PRICING.map((x) => (
              <div key={x.key}>
                <div className="k">{x.name}</div>
                <div className="price">{x.perLead} <span className="per">per lead</span></div>
                <p>{x.note}</p>
                <p className="starter">Starter pack: 5 for {x.starter}, paid up front.</p>
              </div>
            ))}
          </div>
          <p className="form-note" style={{ marginTop: 12 }}>
            Prices apply to solar &amp; battery, roofing and spray foam removal. Your terms are confirmed in your buyer
            agreement before your first lead.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">Example lead preview</div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 12 }}>What a preview looks like.</h2>
          <div className="preview-sample" aria-label="Illustrative sample preview, not a real enquiry">
            <div className="preview-top">
              <span className="k">Illustrative example · not a real enquiry</span>
              <span className="sample-badge">Sample</span>
            </div>
            <h3>Solar panels + battery</h3>
            <dl>
              <dt>Area</dt><dd>Postcode district only (e.g. AB1)</dd>
              <dt>Property</dt><dd>Semi-detached, owner-occupied</dd>
              <dt>Timescale</dt><dd>1 to 3 months</dd>
              <dt>Contact</dt><dd>Hidden until paid</dd>
            </dl>
          </div>
          <p className="form-note">Real previews show only what the homeowner actually told us.</p>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="eyebrow">Live trades</div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 12 }}>Built for three trades.</h2>
          <div className="card-grid">
            {trades.map((x) => (
              <Link href={x.href} className="mini-card" key={x.href} style={{ textDecoration: 'none' }}>
                <h3>{x.name}</h3>
                <p>{x.body}</p>
              </Link>
            ))}
          </div>
          <p className="form-note" style={{ marginTop: 16 }}>
            Work in another home-improvement trade?{' '}
            <Link href={withAttribution('/become-a-buyer/register-interest')}>Register your interest</Link> and we will
            contact you first when your trade opens.
          </p>
        </div>
      </section>

      <section className="band faq">
        <div className="container">
          <h2 style={{ fontSize: '1.6rem', marginBottom: 16 }}>Questions installers ask</h2>
          <details>
            <summary>What is the difference between a verified enquiry and a booked appointment?</summary>
            <p>
              A verified enquiry is a checked homeowner enquiry: you get the full contact details and arrange the visit
              yourself. A booked appointment is the same checked enquiry with a time and date already arranged with the
              homeowner for you.
            </p>
          </details>
          <details>
            <summary>Why a starter pack?</summary>
            <p>It gets your first 5 leads to you straight away, so you can judge the quality before moving to pay per lead.</p>
          </details>
          <details>
            <summary>Are the leads exclusive?</summary>
            <p>That is agreed with you individually and written into your buyer agreement. We never promise blanket exclusivity.</p>
          </details>
          <details>
            <summary>What if a lead is wrong?</summary>
            <p>
              If it does not meet the agreed criteria, such as invalid contact details or the wrong service, our{' '}
              <Link href="/lead-replacement-policy">Lead Replacement Policy</Link> sets out when it is replaced.
            </p>
          </details>
          <details>
            <summary>Do I have to take every lead after the starter pack?</summary>
            <p>No. You see each preview and decide lead by lead.</p>
          </details>
        </div>
      </section>

      <section>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 12 }}>Want checked enquiries in your area?</h2>
          <p style={{ margin: '0 auto 20px' }}>Apply in a few minutes. We review every application and call you before anything is offered.</p>
          <Link href={withAttribution('/become-a-buyer/apply')} className="btn btn-bronze">
            Apply to become a buyer
          </Link>
        </div>
      </section>
    </>
  );
}
