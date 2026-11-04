export default function AboutPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">About</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>A division of Halo Strategic.</h1>
        <p>
          The Halo Lead Exchange is a specialist lead-generation and lead-delivery platform operated by{' '}
          <a href="https://halostrategic.com" style={{ color: 'var(--bronze)' }}>
            Halo Strategic
          </a>
          , applying the same commercial discipline Halo brings to its wider consultancy work:
          qualification before volume, transparent process over sales pitches, and evidence over
          invented claims.
        </p>
        <div className="disclaimer-box">
          <strong>Draft placeholder.</strong> Full About content is pending — this page will be expanded
          with more detail on the relationship to Halo Strategic&rsquo;s wider commercial systems
          philosophy before launch.
        </div>
      </div>
    </section>
  );
}
