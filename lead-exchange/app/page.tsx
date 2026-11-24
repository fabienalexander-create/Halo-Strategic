import Link from 'next/link';
import LoftCrossSection from './components/LoftCrossSection';
import SolarBatteryIllustration from './components/SolarBatteryIllustration';
import RoofingIllustration from './components/RoofingIllustration';
import ProcessSteps from './components/ProcessSteps';
import Reveal from './components/Reveal';
import { indexablePage } from '../lib/seo';

export const metadata = indexablePage({
  path: '/',
  title: 'Halo Lead Exchange | Homeowner Enquiries for Installers',
  description: 'Lead Exchange connects UK home-improvement businesses with homeowners looking for their services. Every enquiry is checked, with a preview before you buy.',
});

export default function HomePage() {
  return (
    <>
      <Reveal />
      <section className="hero hero-split">
        <div className="container hero-grid">
          <div className="hero-copy">
          <div className="eyebrow">Halo Lead Exchange</div>
          <h1>Better homeowner enquiries. More opportunities for your business.</h1>
          <p className="lead">
            Lead Exchange connects home-improvement businesses with homeowners actively looking for
            services. We focus on qualification, transparent lead information, and giving you control
            over how you buy.
          </p>
          <p className="form-note" style={{ margin: '4px 0 0' }}>
            Built for home-improvement businesses across the UK and USA.
          </p>
          <div className="hero-actions">
            <Link href="/become-a-buyer" className="btn btn-bronze">
              Apply to Become a Buyer
            </Link>
            <a href="#industries" className="hero-homeowner-link">
              Homeowner? See what we cover &rarr;
            </a>
          </div>
          </div>
          <div className="hero-art" data-reveal>
            <LoftCrossSection />
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container" data-reveal>
          <div className="eyebrow">Why Businesses Use Lead Exchange</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>
            We don&rsquo;t simply pass contact lists to businesses.
          </h2>
          <p>
            We build targeted acquisition and qualification systems that turn homeowner interest into
            commercially useful opportunities — for one specialist market at a time, built properly
            rather than launched everywhere at once.
          </p>
          <div className="card-grid">
            <div className="mini-card">
              <div className="k">LOCAL OPPORTUNITIES</div>
              <h3>Matched to where you work</h3>
              <p>
                Enquiries are only offered to buyers whose approved territory covers them, so you see
                opportunities in the areas you actually serve.
              </p>
            </div>
            <div className="mini-card">
              <div className="k">RELEVANT ENQUIRIES</div>
              <h3>Project detail, not just a contact</h3>
              <p>
                Each enquiry carries the qualification and project information gathered before it&rsquo;s
                offered, not a bare name and number.
              </p>
            </div>
            <div className="mini-card">
              <div className="k">SPEND CONTROL</div>
              <h3>You choose what you buy</h3>
              <p>
                See a redacted preview of each enquiry and decide lead by lead. Pricing is agreed with you
                during onboarding and set out in your buyer agreement.
              </p>
            </div>
            <div className="mini-card">
              <div className="k">LESS COMPETITION</div>
              <h3>Exclusive, where that&rsquo;s agreed</h3>
              <p>
                Some leads are sold to one buyer only. Whether a given lead is exclusive or shared is
                set out in your buyer agreement, never assumed.
              </p>
            </div>
            <div className="mini-card">
              <div className="k">ROOM TO GROW</div>
              <h3>Scale with your own capacity</h3>
              <p>
                Take on more, or less, as your business has room for it &mdash; access is matched to the
                services and volume you can actually handle.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="industries">
        <div className="container" data-reveal>
          <div className="eyebrow">Find the Right Specialist</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 12 }}>
            Find the right specialist for your home improvement project.
          </h2>
          <p style={{ marginBottom: 0 }}>
            Tell us what you need help with and we&rsquo;ll connect your enquiry with a suitable
            specialist operating in your area.
          </p>
          <div className="industry-cards">
            <div className="industry-card">
              <LoftCrossSection />
              <span className="industry-card-badge">Existing market</span>
              <h3>Spray Foam Removal</h3>
              <p>
                Homeowners exploring removal of existing spray foam insulation, qualified before any
                enquiry reaches a buyer.
              </p>
              <Link href="/spray-foam-removal" className="btn btn-bronze">
                Explore Spray Foam Removal
              </Link>
            </div>
            <div className="industry-card">
              <SolarBatteryIllustration />
              <span className="industry-card-badge industry-card-badge--soon">New market &mdash; opening to buyers</span>
              <h3>Solar &amp; Battery</h3>
              <p>
                Homeowners exploring solar panels, battery storage, or both, qualified before any
                enquiry reaches a buyer.
              </p>
              <Link href="/solar-battery" className="btn btn-bronze">
                Explore Solar &amp; Battery
              </Link>
            </div>
            <div className="industry-card">
              <RoofingIllustration />
              <span className="industry-card-badge industry-card-badge--soon">New market &mdash; opening to buyers</span>
              <h3>Roofing</h3>
              <p>
                Homeowners needing a roof repair or replacement, qualified before any enquiry reaches a
                buyer.
              </p>
              <Link href="/roofing" className="btn btn-bronze">
                Explore Roofing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container" data-reveal>
          <div className="eyebrow">How It Works</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Six stages, from enquiry to delivery.</h2>
          <ProcessSteps />
          <Link href="/how-it-works" className="btn btn-bronze" style={{ marginTop: 24 }}>
            Read the Full Process
          </Link>
        </div>
      </section>

      <section>
        <div className="container" data-reveal>
          <div className="eyebrow">UK and USA</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 12 }}>
            Built for home-improvement businesses on both sides of the Atlantic.
          </h2>
          <p style={{ marginBottom: 0 }}>
            Lead Exchange started in the UK. We&rsquo;re applying the same structured approach, market by
            market, as we open the platform to US buyers, not promising national coverage before it
            exists.
          </p>
          <div className="market-grid">
            <div className="industry-card">
              <span className="industry-card-badge">Live today</span>
              <h3>United Kingdom</h3>
              <p>
                Our acquisition, qualification and buyer-approval systems are live and running across our
                current UK markets: Spray Foam Removal, with Solar &amp; Battery and Roofing opening to
                new buyers as we establish coverage.
              </p>
            </div>
            <div className="industry-card">
              <span className="industry-card-badge industry-card-badge--soon">Opening to buyers</span>
              <h3>United States</h3>
              <p>
                We&rsquo;re building the same acquisition and qualification approach for US
                home-improvement businesses. Buyer coverage is being established market by market, not
                offered everywhere at once.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container" data-reveal>
          <div className="eyebrow">For Contractors</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>
            Already know your market? Apply to become a buyer.
          </h2>
          <p>
            Every application is reviewed individually, with a short onboarding call to confirm fit
            before your account goes live. Pricing, coverage area and exclusivity are agreed directly
            with you, not fixed in advance or the same for every buyer.
          </p>
          <Link href="/become-a-buyer" className="btn btn-bronze" style={{ marginTop: 8 }}>
            Explore Becoming a Buyer
          </Link>
        </div>
      </section>

      <section id="faq" className="tight" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ maxWidth: 800 }} data-reveal>
          <div className="eyebrow">FAQ</div>
          <h2 className="section-title" style={{ fontSize: '1.7rem' }}>What people ask first.</h2>
          <div className="faq">
            <details>
              <summary>How does Lead Exchange work?</summary>
              <p>
                We develop acquisition campaigns, generate homeowner enquiries, check them against
                criteria agreed with approved buyers, and offer suitable enquiries to the matching buyer.
              </p>
            </details>
            <details>
              <summary>Which markets do you operate in today?</summary>
              <p>
                The UK is live today, with Spray Foam Removal open to new buyers and Solar &amp; Battery
                and Roofing opening as we establish coverage. We&rsquo;re building the same approach for
                US buyers, market by market.
              </p>
            </details>
            <details>
              <summary>Is exclusivity available?</summary>
              <p>
                Not claimed as standard. Whether a lead is sold to one buyer only or shared is set out in
                your individual buyer agreement, not assumed as a platform-wide default.
              </p>
            </details>
            <details>
              <summary>What happens if a lead turns out to be invalid?</summary>
              <p>
                We don&rsquo;t operate a cash refund model. Where a lead meets the agreed criteria for
                being invalid, we provide an equivalent{' '}
                <Link href="/lead-replacement-policy" style={{ color: 'var(--bronze)' }}>
                  replacement lead
                </Link>
                , not an automatic refund.
              </p>
            </details>
            <details>
              <summary>How does pricing work?</summary>
              <p>Agreed individually during onboarding, based on your industry, coverage area and arrangement.</p>
            </details>
            <details>
              <summary>How do I get started?</summary>
              <p>
                <Link href="/become-a-buyer" style={{ color: 'var(--bronze)' }}>
                  Apply to become a buyer
                </Link>
                . Every application is reviewed individually, with a short onboarding call before your
                account goes live.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section>
        <div className="container" data-reveal>
          <div className="eyebrow">More From Halo Strategic</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Behind the Lead Exchange.</h2>
          <div className="site-links">
            <a className="site-link" href="https://halostrategic.com">
              <span className="site-link-title">Halo Strategic</span>
              <span className="site-link-body">The commercial growth consultancy that runs the Lead Exchange.</span>
            </a>
            <a className="site-link" href="https://halostrategic.com/about">
              <span className="site-link-title">About Fabien</span>
              <span className="site-link-body">Who is behind Halo Strategic and how we work.</span>
            </a>
            <a className="site-link" href="https://halostrategic.com/insights/">
              <span className="site-link-title">Halo Insights</span>
              <span className="site-link-body">Articles on finding what is really holding a business back.</span>
            </a>
            <Link className="site-link" href="/insights">
              <span className="site-link-title">Lead Exchange Insights</span>
              <span className="site-link-body">Articles for spray foam removal and solar contractors.</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
