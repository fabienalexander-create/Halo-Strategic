import Link from 'next/link';
import { indexablePage } from '../../lib/seo';

export const metadata = indexablePage({
  path: '/how-it-works',
  title: 'How Halo Lead Exchange Works | Enquiry to Delivery',
  description: 'How businesses join Halo Lead Exchange, how homeowner enquiries are qualified and matched, and how payment and lead delivery work, step by step.',
});

const stages = [
  { n: '01', title: 'Lead generation', body: 'Halo generates or acquires a homeowner enquiry.' },
  { n: '02', title: 'Qualification', body: 'The enquiry is checked against agreed criteria before it enters inventory.' },
  { n: '03', title: 'Lead preview', body: 'An approved buyer sees a redacted preview — enough to decide, not enough to contact the homeowner directly.' },
  { n: '04', title: 'Buyer acceptance', body: 'The buyer accepts, declines, or lets the reservation expire.' },
  { n: '05', title: 'Secure payment', body: 'A payment request is issued and independently verified — never released on a buyer’s word alone.' },
  { n: '06', title: 'Full lead delivery', body: 'Once payment is verified, full contact details are released and the lead is marked sold.' },
];

const h2 = { fontSize: '1.5rem', marginBottom: 16 } as const;

export default function HowItWorksPage() {
  return (
    <>
      <section>
        <div className="container">
          <div className="eyebrow">How It Works</div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>From enquiry to delivery, six stages.</h1>
          <p>
            Every lead moves through the same controlled process. No step is skipped, and contact details
            are never released before the step before it has actually happened.
          </p>
          <div className="step-row" style={{ flexWrap: 'wrap' }}>
            {stages.map((s) => (
              <div className="step" key={s.n} style={{ minWidth: 220 }}>
                <div className="n">{s.n}</div>
                <h4>{s.title}</h4>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">For Businesses</div>
          <h2 style={h2}>How businesses join and are approved.</h2>
          <p>
            Lead Exchange is not open self-service. Every business that buys leads is reviewed and agrees
            terms with us first:
          </p>
          <ol>
            <li>
              <strong>Register your interest.</strong> A short form: your company, contact details, the
              service you provide and the areas you cover.
            </li>
            <li>
              <strong>Complete the full application.</strong> Your business details, coverage area and
              service capability.
            </li>
            <li>
              <strong>Application review.</strong> Each application is reviewed individually, not
              approved automatically.
            </li>
            <li>
              <strong>Onboarding call.</strong> A call to confirm fit and to agree how you work, before
              anything is offered to you.
            </li>
            <li>
              <strong>Commercial terms agreed.</strong> Pricing, lead-acceptance terms and whether leads
              are exclusive to you or shared are agreed directly with you and set out in your buyer
              agreement.
            </li>
            <li>
              <strong>Approved and activated.</strong> Your account goes live, and you start receiving
              offers that match your coverage.
            </li>
          </ol>
          <p>
            <Link href="/become-a-buyer">Apply to become a buyer</Link>
          </p>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="eyebrow">Qualification</div>
          <h2 style={h2}>How homeowner enquiries are qualified.</h2>
          <p>
            Every enquiry is checked against criteria agreed with approved buyers before it is offered to
            anyone. What is checked depends on the service. For example:
          </p>
          <ul>
            <li>
              Homeowner status, property type and postcode for every enquiry.
            </li>
            <li>
              <strong>Roofing:</strong> repair, partial or full replacement, roof type where known, and
              urgency.
            </li>
            <li>
              <strong>Solar &amp; battery:</strong> panels, storage or both, roof type where known, any
              existing installation, and timescale.
            </li>
            <li>
              <strong>Spray foam removal:</strong> where the foam is, open- or closed-cell where known, why
              removal is being considered, and roof access.
            </li>
          </ul>
          <p>
            Each answer is recorded as confirmed by the homeowner, estimated, or unknown, and nothing
            uncertain is presented to a buyer as confirmed. The homeowner also agrees to their details
            being shared with a suitable business before any enquiry can be offered.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">Matching</div>
          <h2 style={h2}>How enquiries are matched to businesses.</h2>
          <p>
            Enquiries are not broadcast to every buyer. Each one is matched on:
          </p>
          <ul>
            <li>
              <strong>Service:</strong> only buyers approved for that type of work.
            </li>
            <li>
              <strong>Location:</strong> only buyers whose approved territory covers the homeowner&rsquo;s
              postcode.
            </li>
            <li>
              <strong>Capacity:</strong> the volume of work each buyer has told us they can take on.
            </li>
            <li>
              <strong>Your agreement:</strong> whether that buyer takes leads exclusively or shared, as
              agreed with them.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="eyebrow">Payment &amp; Delivery</div>
          <h2 style={h2}>How payment and lead delivery work.</h2>
          <p>
            When an enquiry matches, you receive an offer with a redacted preview: the general location,
            property type, qualification summary and price. It is enough to decide whether the lead is
            worth pursuing, but not enough to identify or contact the homeowner. You can accept it,
            decline it, or let the reservation expire.
          </p>
          <p>
            If you accept, a payment request is issued for that lead, unless it is covered by a package
            agreed with you. Payment is verified independently before anything is released. Once it is
            verified, the homeowner&rsquo;s full contact details are delivered to you and the lead is
            marked as sold.
          </p>
          <p>
            If a lead turns out not to meet the agreed criteria, for example invalid contact details or the
            wrong service, our{' '}
            <Link href="/lead-replacement-policy">Lead Replacement Policy</Link> sets out when it is
            replaced and how to report it. A lead that simply does not convert into a sale is not, on its
            own, grounds for a replacement.
          </p>
        </div>
      </section>
    </>
  );
}
