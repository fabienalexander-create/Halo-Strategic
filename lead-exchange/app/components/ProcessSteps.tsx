// Homepage "How It Works": the same three stage groups and copy as before, now with a
// line icon per stage and a connecting line (horizontal on desktop, vertical on mobile).
// Icons follow the Design Bible: 24px grid, 1.5px single-weight stroke, currentColor.
const icon = {
  qualify: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="M8.5 12.5l2.2 2.2 4.8-4.9" />
    </svg>
  ),
  preview: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  ),
  deliver: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.6-1.7" />
      <path d="M12 15v2.5" />
    </svg>
  ),
};

const steps = [
  { k: '01–02', icon: icon.qualify, title: 'Generate & qualify', body: 'A homeowner enquiry is generated and checked against agreed criteria.' },
  { k: '03–04', icon: icon.preview, title: 'Preview & accept', body: 'An approved buyer sees a redacted preview and decides whether to purchase.' },
  { k: '05–06', icon: icon.deliver, title: 'Pay & deliver', body: 'Payment is independently verified, then full contact details are released.' },
];

export default function ProcessSteps() {
  return (
    <ol className="process" data-reveal>
      <span className="process-line" aria-hidden="true" />
      {steps.map((s, i) => (
        <li className="process-step" key={s.k} style={{ ['--i' as string]: i }}>
          <span className="process-icon">{s.icon}</span>
          <div className="k">{s.k}</div>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
