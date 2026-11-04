export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="eyebrow">Halo Lead Exchange</div>
          <h1>Qualified home improvement enquiries. Delivered to the right businesses.</h1>
          <p className="lead" style={{ margin: '0 auto 28px' }}>
            Halo Strategic connects UK service providers with homeowners actively exploring relevant
            home-improvement services. We focus on qualification, transparent lead information, and a
            controlled purchasing and delivery process.
          </p>
          <a href="/become-a-buyer" className="btn btn-bronze">
            Apply to Become a Buyer
          </a>
        </div>
      </section>

      <section className="band">
        <div className="container">
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
        <div className="container">
          <div className="eyebrow">Initial Market</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Spray Foam Removal</h2>
          <p>
            Our first specialist market is UK spray foam removal — homeowners exploring removal of
            existing spray foam insulation, qualified against agreed criteria before any enquiry reaches
            a buyer.
          </p>
          <a href="/spray-foam-removal" className="btn btn-bronze" style={{ marginTop: 12 }}>
            See the Spray Foam Removal Market
          </a>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <div className="eyebrow">How It Works</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Six stages, from enquiry to delivery.</h2>
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="mini-card">
              <div className="k">01&ndash;02</div>
              <h3>Generate &amp; qualify</h3>
              <p>A homeowner enquiry is generated and checked against agreed criteria.</p>
            </div>
            <div className="mini-card">
              <div className="k">03&ndash;04</div>
              <h3>Preview &amp; accept</h3>
              <p>An approved buyer sees a redacted preview and decides whether to purchase.</p>
            </div>
            <div className="mini-card">
              <div className="k">05&ndash;06</div>
              <h3>Pay &amp; deliver</h3>
              <p>Payment is independently verified, then full contact details are released.</p>
            </div>
          </div>
          <a href="/how-it-works" className="btn btn-bronze" style={{ marginTop: 24 }}>
            Read the Full Process
          </a>
        </div>
      </section>

      <section>
        <div className="container">
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
