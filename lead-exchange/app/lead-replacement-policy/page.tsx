import Link from 'next/link';

export default function LeadReplacementPolicyPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Solar &amp; Battery and Roofing &mdash; Standard Policy</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>Lead Replacement Policy</h1>

        <p className="form-note" style={{ marginBottom: 24 }}>Version 2027-01-01-v1.0. Effective 1 January 2027.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>1. Our commitment</h2>
        <p>
          At Halo Lead Exchange, we aim to provide genuine homeowner enquiries that meet the agreed
          qualification criteria for the relevant service and territory.
        </p>
        <p>
          If a supplied lead is demonstrably invalid or materially different from the service requested,
          buyers may request a replacement under this policy.
        </p>
        <p>
          Our standard replacement request window is <strong>three calendar days from the date and time
          the full lead details are released to the buyer</strong>.
        </p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>2. Reasons eligible for replacement</h2>
        <p>A replacement may be approved where:</p>
        <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
          <li><strong>Invalid contact information:</strong> the supplied telephone number is disconnected, incorrect or demonstrably belongs to an unrelated person.</li>
          <li><strong>Incorrect individual:</strong> the person supplied did not submit the enquiry and has no connection to the property or project.</li>
          <li><strong>No genuine service interest:</strong> the individual confirms they did not request the advertised service and are not seeking it.</li>
          <li><strong>Incorrect service:</strong> the individual was enquiring about a completely different service from the one for which the lead was purchased.</li>
          <li><strong>Duplicate enquiry:</strong> the same homeowner and project have already been supplied to the same buyer within the agreed duplicate period.</li>
        </ul>
        <p>All requests are subject to review and reasonable supporting evidence.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>3. Reasons not eligible for replacement</h2>
        <p>A lead will not normally qualify for replacement simply because:</p>
        <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
          <li>The homeowner does not answer calls or messages.</li>
          <li>The homeowner does not respond to follow-up attempts.</li>
          <li>The homeowner changes their mind after submitting a genuine enquiry.</li>
          <li>The homeowner decides not to proceed with the project.</li>
          <li>The contractor is unable to agree a price with the homeowner.</li>
          <li>The homeowner chooses another contractor.</li>
          <li>The project does not convert into a sale.</li>
          <li>The contractor considers the opportunity commercially unattractive despite it meeting the agreed qualification criteria.</li>
        </ul>
        <p>
          Halo Lead Exchange supplies homeowner opportunities, not guaranteed appointments, quotations or
          installations.
        </p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>4. How to request a replacement</h2>
        <p>Buyers must:</p>
        <ol style={{ color: 'var(--slate)', paddingLeft: 20 }}>
          <li>Contact Halo Lead Exchange within three calendar days of receiving the full lead details.</li>
          <li>Provide the relevant lead reference.</li>
          <li>Explain the reason for the replacement request.</li>
          <li>Provide reasonable supporting information, such as call notes or confirmation from the homeowner.</li>
        </ol>
        <p>Requests submitted outside the three-day period will not normally qualify.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>5. Review and resolution</h2>
        <p>
          Halo Lead Exchange will review the request against the original enquiry, agreed qualification
          criteria and supporting evidence.
        </p>
        <p>
          Where a replacement is approved, Halo will provide <strong>one comparable replacement
          opportunity</strong> per approved claim &mdash; matched in service, territory and agreed
          qualification criteria to the original lead &mdash; not an unlimited credit or cash refund.
        </p>
        <p>
          Any alternative resolution will be considered only where appropriate under the applicable buyer
          agreement and consumer or business law.
        </p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>6. Important conditions</h2>
        <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
          <li>The three-calendar-day period (including weekends) begins when the buyer receives the full homeowner contact details.</li>
          <li>Buyers should review and report issues promptly.</li>
          <li>Replacement approval is based on the validity of the original enquiry, not the contractor&rsquo;s eventual sales outcome.</li>
          <li>Industry-specific qualification criteria and agreed commercial terms remain relevant.</li>
          <li>This policy does not override any mandatory legal rights or separately agreed contractual provisions.</li>
        </ul>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>7. Scope</h2>
        <p>
          This policy applies to the Solar &amp; Battery and Roofing verticals. Spray Foam Removal is
          covered by its own, separately approved{' '}
          <Link href="/refund-policy" style={{ color: 'var(--bronze)' }}>Refund &amp; Replacement Policy</Link>,
          which remains unchanged and in force.
        </p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>8. Contact</h2>
        <p>
          For replacement requests, buyers should contact Halo Lead Exchange and include their buyer
          reference and lead reference.
        </p>
      </div>
    </section>
  );
}
