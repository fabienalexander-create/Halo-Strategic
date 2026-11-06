import Link from 'next/link';
import LoftCrossSection from './components/LoftCrossSection';
import SolarBatteryIllustration from './components/SolarBatteryIllustration';
import RoofingIllustration from './components/RoofingIllustration';
import ProcessSteps from './components/ProcessSteps';
import Reveal from './components/Reveal';

export default function HomePage() {
  return (
    <>
      <Reveal />
      <section className="hero hero-split">
        <div className="container hero-grid">
          <div className="hero-copy">
          <div className="eyebrow">Halo Lead Exchange</div>
          <h1>Qualified home improvement enquiries. Delivered to the right businesses.</h1>
          <p className="lead">
            Halo Strategic connects UK service providers with homeowners actively exploring relevant
            home-improvement services. We focus on qualification, transparent lead information, and a
            controlled purchasing and delivery process.
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
          <div className="eyebrow">What We Do</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>
            We don&rsquo;t simply pass contact lists to businesses.
          </h2>
          <p>
            We build targeted acquisition and qualification systems that turn homeowner interest into
            commercially useful opportunities — for one specialist market at a time, built properly
            rather than launched everywhere at once.
          </p>
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
              <span className="industry-card-badge">New market</span>
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
              <span className="industry-card-badge">New market</span>
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
