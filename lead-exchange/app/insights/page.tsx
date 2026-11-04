import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Insights | Halo Lead Exchange',
  description:
    'Why Halo Strategic qualifies spray foam removal and solar enquiries the way it does, and what that means for the installers and removal companies who buy them.',
  robots: 'index, follow',
};

const articles = [
  {
    slug: 'why-we-qualify-every-spray-foam-removal-enquiry',
    title: 'Why We Qualify Every Spray Foam Removal Enquiry Before You See It',
    excerpt:
      'A qualified enquiry and a cheap one are not the same thing. Here is what we actually check before a spray foam removal lead reaches a buyer.',
  },
  {
    slug: 'halo-strategic-background-spray-foam-removal-leads',
    title: 'What a Halo Strategic Background Means for Spray Foam Removal Leads',
    excerpt:
      'Halo Strategic did not start as a lead-generation business. That history is why the Lead Exchange is built around qualification first.',
  },
  {
    slug: 'why-solar-installers-need-qualified-enquiries-not-just-more-leads',
    title: 'Why Solar Installers Need Qualified Enquiries, Not Just More Leads',
    excerpt:
      'Volume is easy to buy. A homeowner who is actually ready, in the right property, is harder to find -- and worth more.',
  },
  {
    slug: 'halo-strategic-approach-solar-battery-lead-qualification',
    title: 'The Halo Strategic Approach to Solar and Battery Lead Qualification',
    excerpt:
      'Six years of running paid-social campaigns across home-improvement trades taught one lesson that shapes how we qualify solar and battery enquiries today.',
  },
];

export default function InsightsIndexPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Insights</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>
          Why we qualify enquiries the way we do.
        </h1>
        <p>
          Short, plain explanations of how the Halo Lead Exchange qualifies homeowner enquiries, and
          why that matters more than volume to the installers and removal companies who buy them.
        </p>
        <div style={{ marginTop: 32 }}>
          {articles.map((a) => (
            <div key={a.slug} style={{ borderBottom: '1px solid var(--border)', padding: '20px 0' }}>
              <h2 style={{ fontSize: '1.15rem', marginBottom: 8 }}>
                <Link href={`/insights/${a.slug}`} style={{ textDecoration: 'none', color: 'var(--navy-deep)' }}>
                  {a.title}
                </Link>
              </h2>
              <p style={{ color: 'var(--slate)', margin: 0 }}>{a.excerpt}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
