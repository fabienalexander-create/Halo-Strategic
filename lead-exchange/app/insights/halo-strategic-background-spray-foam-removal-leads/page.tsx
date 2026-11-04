import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'What Halo Strategic’s Background Means for Spray Foam Removal Leads | Halo Lead Exchange',
  description:
    'Halo Strategic did not start as a lead-generation business. That history is why the Lead Exchange is built around qualification first.',
  robots: 'index, follow',
};

export default function Article() {
  return (
    <article>
      <section className="hero" style={{ textAlign: 'left' }}>
        <div className="container">
          <div className="eyebrow">Insights &middot; Spray Foam Removal</div>
          <h1 style={{ fontSize: '2rem', maxWidth: '28em' }}>
            What a Halo Strategic Background Means for Spray Foam Removal Leads
          </h1>
        </div>
      </section>

      <section>
        <div className="container">
          <p>
            Halo Strategic is a commercial growth consultancy first. The Lead Exchange is a newer,
            specific product built on top of that, not the other way round &mdash; and that order
            matters for how it was designed.
          </p>
          <p>
            Halo&rsquo;s founder, Fabien Alexander, ran a home-improvement lead-generation agency for six
            years before this, working across solar, conservatory roofs, kitchens, double glazing and
            other trades, for clients including Mercedes-Benz Trucks &amp; Vans, AJ Renewables and TQL
            Kitchens. Across that work, combined paid-social campaigns totalled roughly &pound;102,663
            in ad spend and generated 15,797 leads at a blended &pound;6.50 cost-per-lead &mdash; with real
            cost-per-lead swinging anywhere from &pound;2 to &pound;20 depending on the trade and targeting,
            sometimes by a factor of ten on the same day for the same trade. Those are documented figures
            from that earlier agency work across several home-improvement trades, not a spray-foam-specific
            case study, and not a result of the Lead Exchange&rsquo;s own pilots &mdash; we&rsquo;re not
            claiming otherwise.
          </p>

          <h2 style={{ fontSize: '1.3rem', margin: '32px 0 12px' }}>The lesson that actually carried over</h2>
          <p>
            What that work taught, repeatedly: generating an enquiry and generating a sale are two
            different problems. Installers who complained about &ldquo;bad leads&rdquo; were often losing
            the sale in their own follow-up process, not in the enquiry itself &mdash; but a genuinely
            poor-fit enquiry is still a real cost, and conflating the two helps no one.
          </p>
          <p>
            That&rsquo;s the discipline the Lead Exchange is built around: qualify what&rsquo;s worth
            qualifying, be plain about what&rsquo;s uncertain, and separate the two problems (lead quality,
            and what a buyer does with it) instead of pretending they&rsquo;re the same thing.
          </p>

          <h2 style={{ fontSize: '1.3rem', margin: '32px 0 12px' }}>Why that matters for a new vertical</h2>
          <p>
            Spray foam removal is the first market built on this platform, with solar as the next. Both
            get the same qualification standard, not because it&rsquo;s convenient to reuse, but because
            the underlying discipline &mdash; check before you sell, say what&rsquo;s confirmed versus
            estimated, don&rsquo;t publish results you haven&rsquo;t actually produced &mdash; doesn&rsquo;t
            change by industry.
          </p>

          <p style={{ marginTop: 32 }}>
            <Link href="/become-a-buyer" className="btn btn-bronze">
              Apply to Become a Buyer
            </Link>
          </p>
        </div>
      </section>
    </article>
  );
}
