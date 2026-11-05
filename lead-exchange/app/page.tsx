import Link from 'next/link';
import LoftCrossSection from './components/LoftCrossSection';
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
            <Link href="/spray-foam-removal/request-a-quote" className="hero-homeowner-link">
              Homeowner? Request a spray foam removal quote &rarr;
            </Link>
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

      <section>
        <div className="container" data-reveal>
          <div className="eyebrow">Initial Market</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Spray Foam Removal</h2>
          <p>
            Our first specialist market is UK spray foam removal — homeowners exploring removal of
            existing spray foam insulation, qualified against agreed criteria before any enquiry reaches
            a buyer.
          </p>
          <Link href="/spray-foam-removal" className="btn btn-bronze" style={{ marginTop: 12 }}>
            See the Spray Foam Removal Market
          </Link>
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
          <div className="disclaimer-box">
            <strong>A note on the numbers you&rsquo;ll see here.</strong> This platform is in its pilot
            phase. We do not publish invented customer reviews, fabricated lead volumes, or performance
            claims we can&rsquo;t evidence from our own platform records. Where we don&rsquo;t yet have
            real data to show, we say so rather than make something up.
          </div>
        </div>
      </section>
    </>
  );
}
