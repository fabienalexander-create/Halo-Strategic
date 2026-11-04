import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Halo Strategic Approach to Solar and Battery Lead Qualification | Halo Lead Exchange',
  description:
    'Six years of running paid-social campaigns across home-improvement trades taught one lesson that shapes how we qualify solar and battery enquiries today.',
  robots: 'index, follow',
};

export default function Article() {
  return (
    <article>
      <section className="hero" style={{ textAlign: 'left' }}>
        <div className="container">
          <div className="eyebrow">Insights &middot; Solar</div>
          <h1 style={{ fontSize: '2rem', maxWidth: '28em' }}>
            The Halo Strategic Approach to Solar and Battery Lead Qualification
          </h1>
        </div>
      </section>

      <section>
        <div className="container">
          <p>
            Solar is not a new market for Halo Strategic&rsquo;s founder, even though it is a new vertical
            for the Lead Exchange. Fabien Alexander ran paid-social lead generation across solar,
            conservatory roofs, kitchens, double glazing and other home-improvement trades for six years
            before Halo existed as a consultancy, for clients including Mercedes-Benz Trucks &amp; Vans,
            AJ Renewables and TQL Kitchens.
          </p>
          <p>
            Across that combined work &mdash; not solar alone, and not a Lead Exchange result, since the
            Lead Exchange has run no solar campaigns yet &mdash; total ad spend ran to roughly
            &pound;102,663, producing 15,797 leads at a blended &pound;6.50 cost-per-lead. Real
            cost-per-lead ranged from &pound;2 to &pound;20 depending on the trade and audience, and could
            swing by a factor of ten on the same day for the same trade, purely from targeting. The
            figure that mattered most from that period wasn&rsquo;t the average: it was how much variation
            sat underneath it, and how little that variation had to do with the enquiry&rsquo;s quality
            versus simply who it was shown to.
          </p>

          <h2 style={{ fontSize: '1.3rem', margin: '32px 0 12px' }}>
            Why qualification criteria come before volume, by 2024
          </h2>
          <p>
            By 2024, that earlier work had shifted to qualifying leads on cost-per-acquisition, conversion
            rate and lifetime value before ever discussing volume with a client. That ordering &mdash;
            criteria first, scale second &mdash; is the same discipline carried into how the Lead Exchange
            is being built for solar: agree what a valid enquiry looks like (property type, postcode,
            genuine interest in solar, battery, or both, timeframe) before any enquiry is generated at
            scale, not after.
          </p>

          <h2 style={{ fontSize: '1.3rem', margin: '32px 0 12px' }}>What this means in practice for solar</h2>
          <p>
            It means the questions a solar installer answers before buying an enquiry (what counts as
            valid, what&rsquo;s your actual coverage, what&rsquo;s your capacity) come first, not as an
            afterthought once volume is already flowing. It also means we won&rsquo;t publish specific
            solar conversion or volume figures for the Lead Exchange itself until there is real, documented
            performance to report &mdash; the historical figures above are from Halo&rsquo;s founder&rsquo;s
            earlier agency work, offered as the reasoning behind the approach, not as a substitute for the
            Lead Exchange&rsquo;s own track record.
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
