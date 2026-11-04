import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Why We Qualify Every Spray Foam Removal Enquiry | Halo Lead Exchange',
  description:
    'A qualified enquiry and a cheap one are not the same thing. Here is what we actually check before a spray foam removal lead reaches a buyer.',
  robots: 'index, follow',
};

export default function Article() {
  return (
    <article>
      <section className="hero" style={{ textAlign: 'left' }}>
        <div className="container">
          <div className="eyebrow">Insights &middot; Spray Foam Removal</div>
          <h1 style={{ fontSize: '2rem', maxWidth: '28em' }}>
            Why We Qualify Every Spray Foam Removal Enquiry Before You See It
          </h1>
        </div>
      </section>

      <section>
        <div className="container">
          <p>
            A cheap enquiry and a qualified enquiry are not the same product, even when they look
            identical on a spreadsheet. The difference only shows up later &mdash; in how many calls
            your team has to make before someone answers, how many addresses turn out not to have
            spray foam at all, and how much time gets spent on enquiries that were never going anywhere.
          </p>
          <p>
            We built the Halo Lead Exchange around a simple position: an enquiry is only worth selling
            once it has actually been checked, not just collected.
          </p>

          <h2 style={{ fontSize: '1.3rem', margin: '32px 0 12px' }}>What &ldquo;qualified&rdquo; actually means here</h2>
          <p>Before a spray foam removal enquiry is offered to a buyer, we check:</p>
          <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
            <li>Whether the homeowner has confirmed spray foam is actually present, and where (loft or roof)</li>
            <li>Property type and postcode, so it falls inside a buyer&rsquo;s actual coverage area</li>
            <li>Why removal is being considered, and how far along that decision is</li>
            <li>Roof access information and any previous inspections or quotations, where supplied</li>
          </ul>
          <p>
            Where an answer is a homeowner&rsquo;s own estimate rather than a confirmed fact, we record it
            as an estimate. We don&rsquo;t upgrade uncertain information to &ldquo;confirmed&rdquo; just because
            it would make the enquiry look tidier.
          </p>

          <h2 style={{ fontSize: '1.3rem', margin: '32px 0 12px' }}>
            Why this matters more for spray foam removal specifically
          </h2>
          <p>
            Spray foam removal is a specialist job. A removal company&rsquo;s time is worth more spent on
            a genuine enquiry than on three vague ones. Qualifying before delivery, rather than after a
            buyer has already paid and called, is the whole point of the process &mdash; it moves the
            cost of a poor-fit enquiry back onto us, not onto the business that bought it.
          </p>

          <h2 style={{ fontSize: '1.3rem', margin: '32px 0 12px' }}>What this is not</h2>
          <p>
            Qualification does not mean a guarantee of a sale. A qualified enquiry still depends on your
            own follow-up speed, pricing and survey process to convert into a job. What it does mean is
            that the enquiry itself was worth receiving in the first place.
          </p>

          <p style={{ marginTop: 32 }}>
            <a href="/spray-foam-removal" className="btn btn-bronze">
              See the Spray Foam Removal Market
            </a>
          </p>
        </div>
      </section>
    </article>
  );
}
