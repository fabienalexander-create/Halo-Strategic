export default function RefundPolicyPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Spray Foam Removal &mdash; Pilot Policy</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>Refund &amp; Replacement Policy</h1>

        <div className="disclaimer-box" style={{ marginBottom: 28 }}>
          <strong>Draft, not yet legally reviewed.</strong> This policy has been confirmed commercially
          by Halo Strategic but has not yet been reviewed by a solicitor. It is not active or enforceable
          against any buyer, and must not be relied upon as final, until that review is complete.
        </div>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>1. Replacement, not automatic refund</h2>
        <p>
          Where a lead meets the criteria below, Halo Strategic will provide an equivalent replacement
          lead at no additional charge. The remedy is a replacement lead, not an automatic cash refund.
        </p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>
          2. Three-day contact window and documented attempts
        </h2>
        <p>
          The buyer must make reasonable, documented attempts to contact the homeowner within three
          calendar days of the recorded lead delivery timestamp (not the payment time). Evidence must
          include dated contact attempts &mdash; telephone call attempts, text messages, or emails where
          an email address has been supplied. Three days of silence without reasonable, documented contact
          attempts does not qualify for replacement.
        </p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>3. What &ldquo;equivalent replacement&rdquo; means</h2>
        <p>
          A replacement lead must meet the same agreed service, geographic, and qualification criteria as
          the original lead &mdash; not simply be another enquiry of any kind.
        </p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>4. Scope</h2>
        <p>
          This policy applies initially to the Spray Foam Removal vertical only. Future industries,
          including solar and HVAC, may have different replacement windows and eligibility criteria.
        </p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>5. What does not qualify on its own</h2>
        <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
          <li>A lead that does not convert into a paying customer. Non-conversion is never itself grounds for replacement.</li>
          <li>A buyer who does not attempt contact within the three-day window.</li>
          <li>A homeowner who changes their mind after being reached.</li>
        </ul>
        <p>
          These are distinct from an invalid or materially inaccurate lead (incorrect qualification data,
          for example), which is a separate ground for replacement or dispute, not covered by the
          three-day contact rule.
        </p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>6. Disputed cases</h2>
        <p>
          Disputed cases are reviewed by a Halo Strategic administrator, with the outcome recorded against
          the lead&rsquo;s record. Replacement eligibility in a contested case is not decided by an
          automated rule alone.
        </p>
      </div>
    </section>
  );
}
