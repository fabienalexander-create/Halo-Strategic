import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Roofing — Coming Soon | Halo Lead Exchange',
  description: 'Roofing is a planned future market on the Halo Lead Exchange, not yet open for enquiries or buyer applications.',
  robots: 'noindex, nofollow',
};

// Deliberately minimal -- Roofing is scoped for after Solar & Battery (Fabien's brief, phase
// ordering). This page exists only so the homepage's third industry card has somewhere honest to
// link to, rather than a dead link or a fully-built journey for a vertical that isn't ready. The
// `roofing` industries row is_enabled=false, so even if someone found a form elsewhere, the API
// would refuse it regardless of what this page says.
export default function RoofingPage() {
  return (
    <section className="hero">
      <div className="container">
        <div className="eyebrow">Roofing &mdash; Coming Soon</div>
        <h1>Roofing is next on the Lead Exchange.</h1>
        <p className="lead" style={{ margin: '0 auto' }}>
          We&rsquo;re not yet taking homeowner enquiries or buyer applications for roofing &mdash; we want
          to get Solar &amp; Battery right first. If you&rsquo;re a roofing contractor interested in being
          one of our first approved buyers when this opens, get in touch via our{' '}
          <Link href="/contact" style={{ color: 'var(--bronze)' }}>
            contact page
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
