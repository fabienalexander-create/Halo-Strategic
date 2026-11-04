import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Why Solar Installers Need Qualified Enquiries, Not Just More Leads | Halo Lead Exchange',
  description:
    'Volume is easy to buy. A homeowner who is actually ready, in the right property, is harder to find -- and worth more.',
  robots: 'index, follow',
};

export default function Article() {
  return (
    <article>
      <section className="hero" style={{ textAlign: 'left' }}>
        <div className="container">
          <div className="eyebrow">Insights &middot; Solar</div>
          <h1 style={{ fontSize: '2rem', maxWidth: '28em' }}>
            Why Solar Installers Need Qualified Enquiries, Not Just More Leads
          </h1>
        </div>
      </section>

      <section>
        <div className="container">
          <p>
            Volume is the easiest thing to sell in lead generation, and often the least useful thing to
            buy. A thousand solar enquiries a month means nothing if most of them are the wrong property
            type, outside your coverage area, or a homeowner who was never seriously considering it.
          </p>
          <p>
            Solar is a particularly bad fit for a volume-first approach. Roof orientation, pitch, shading
            and a household&rsquo;s actual electricity usage all affect whether a property is even worth
            quoting on &mdash; an installer finds that out properly on survey, but a lot of it can and
            should be screened for before an enquiry ever reaches a sales team.
          </p>

          <h2 style={{ fontSize: '1.3rem', margin: '32px 0 12px' }}>What &ldquo;qualified&rdquo; should mean for solar</h2>
          <p>At minimum, a solar enquiry worth paying for should have:</p>
          <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
            <li>A confirmed postcode inside the installer&rsquo;s actual service area</li>
            <li>Property type recorded, not assumed</li>
            <li>Clear interest in solar, battery, or both &mdash; not inferred from a generic enquiry</li>
            <li>A stated timeframe, distinguishing someone ready to act from someone still researching</li>
          </ul>
          <p>
            None of that replaces a proper site survey. It just means the enquiry was worth the survey in
            the first place.
          </p>

          <h2 style={{ fontSize: '1.3rem', margin: '32px 0 12px' }}>The honest limits of qualification</h2>
          <p>
            Qualifying an enquiry doesn&rsquo;t guarantee it converts into an installation. Pricing,
            response speed and a buyer&rsquo;s own sales process still decide that. What qualification
            does is make sure the opportunity was real to begin with &mdash; which is a different, narrower
            promise than &ldquo;this will definitely become a sale,&rdquo; and the only one worth making
            honestly.
          </p>

          <p style={{ marginTop: 32 }}>
            Solar is the Lead Exchange&rsquo;s next vertical, after spray foam removal. If you&rsquo;re a
            solar or battery installer and want to register interest ahead of that launch,{' '}
            <a href="/contact" style={{ color: 'var(--bronze)' }}>
              get in touch
            </a>
            .
          </p>
        </div>
      </section>
    </article>
  );
}
