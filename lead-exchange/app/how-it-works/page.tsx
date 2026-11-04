const stages = [
  { n: '01', title: 'Lead generation', body: 'Halo generates or acquires a homeowner enquiry.' },
  { n: '02', title: 'Qualification', body: 'The enquiry is checked against agreed criteria before it enters inventory.' },
  { n: '03', title: 'Lead preview', body: 'An approved buyer sees a redacted preview — enough to decide, not enough to contact the homeowner directly.' },
  { n: '04', title: 'Buyer acceptance', body: 'The buyer accepts, declines, or lets the reservation expire.' },
  { n: '05', title: 'Secure payment', body: 'A payment request is issued and independently verified — never released on a buyer’s word alone.' },
  { n: '06', title: 'Full lead delivery', body: 'Once payment is verified, full contact details are released and the lead is marked sold.' },
];

export default function HowItWorksPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">How It Works</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>From enquiry to delivery, six stages.</h1>
        <p>
          Every lead moves through the same controlled process. No step is skipped, and contact details
          are never released before the step before it has actually happened.
        </p>
        <div className="step-row" style={{ flexWrap: 'wrap' }}>
          {stages.map((s) => (
            <div className="step" key={s.n} style={{ minWidth: 220 }}>
              <div className="n">{s.n}</div>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
