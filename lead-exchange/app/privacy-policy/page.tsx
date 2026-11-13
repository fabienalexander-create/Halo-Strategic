import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Halo Lead Exchange',
  description: 'How Halo Strategic collects, uses and shares personal information through halostrategic.com and the Halo Lead Exchange.',
  robots: 'index, follow',
};

export default function PrivacyPolicyPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Legal</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>Privacy Policy</h1>
        <p className="form-note" style={{ marginBottom: 24 }}>Version 2026-11-13-v0.3. Last updated 13 November 2026.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>1. Who we are</h2>
        <p>Halo Strategic Ltd is the controller of the personal information described in this policy. We are registered in England and Wales (company number 17409402), registered office 71-75 Shelton Street, London WC2H 9JQ.</p>
        <p>This policy covers halostrategic.com, including our homeowner enquiry pages and the Halo Lead Exchange at halostrategic.com/leads-exchange.</p>
        <p>Contact us about privacy at hello@halostrategic.com. We are not currently registered with the Information Commissioner&rsquo;s Office (ICO); we are reviewing whether registration is required for this activity.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>2. At a glance</h2>
        <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
          <li>You make an enquiry on one of our homeowner pages.</li>
          <li>We check it is a genuine fit for the service you asked about.</li>
          <li>Without your separate consent to sharing, your enquiry stays with Halo.</li>
          <li>With it, a business sees only a redacted summary first.</li>
          <li>Full contact details are shared only after that business has paid us and we have verified the payment.</li>
          <li>You can withdraw consent, or ask us to delete your data, at any time (section 10).</li>
        </ul>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>3. Homeowner information</h2>
        <p><strong>What we collect.</strong> When you ask for a quote on one of our homeowner pages, we collect what you type into the form:</p>
        <table style={{ width: '100%', marginBottom: 16 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: '4px 8px' }}>Category</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Examples</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: '4px 8px' }}>Identity and contact</td><td style={{ padding: '4px 8px' }}>First and last name, email, mobile number, preferred contact method</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Property</td><td style={{ padding: '4px 8px' }}>UK postcode, ownership status, property type</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Your enquiry</td><td style={{ padding: '4px 8px' }}>What you are interested in, existing installation, timeframe</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Your choices</td><td style={{ padding: '4px 8px' }}>Which consent boxes you ticked, consent wording version, time of submission</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>How you found us</td><td style={{ padding: '4px 8px' }}>Campaign and UTM source codes from the link you clicked, where available</td></tr>
          </tbody>
        </table>
        <p>We may add notes from any follow-up call where we confirm your enquiry, labelled as confirmed, your estimate, or unknown.</p>
        <p><strong>Why, and our lawful basis.</strong></p>
        <table style={{ width: '100%', marginBottom: 16 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: '4px 8px' }}>Purpose</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Lawful basis</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: '4px 8px' }}>Contact you about your enquiry and check it is a genuine fit</td><td style={{ padding: '4px 8px' }}>Your consent (&ldquo;happy for Halo Strategic to contact me&rdquo;) and our legitimate interest in handling enquiries</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Share your details with one suitable business</td><td style={{ padding: '4px 8px' }}>Your separate, specific consent to sharing. Not bundled with anything else</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Send you a one-time SMS to verify your mobile number for your enquiry (administrative only, no marketing)</td><td style={{ padding: '4px 8px' }}>Our legitimate interest in confirming that contact details are correct and that we can reach you about your enquiry</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Keep a record of what you agreed to and when</td><td style={{ padding: '4px 8px' }}>Legitimate interest and legal obligation (to show consent was given)</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Optional email tips and updates</td><td style={{ padding: '4px 8px' }}>Your separate marketing consent, only if you tick that box</td></tr>
          </tbody>
        </table>
        <p><strong>Phone number verification.</strong> We may send you one text message asking you to reply YES to confirm your mobile number. It contains no marketing. We store the number, a reference, whether you replied and when. If you reply STOP, we will not send you further verification messages and we keep your number on a do-not-text list for that purpose. We use Make (workflow automation) and TextMagic (SMS delivery) to send and receive these messages; they act on our instructions, and the transfer safeguards in section 7 apply.</p>
        <p>You can withdraw consent at any time (section 10). Withdrawing does not undo sharing that has already happened, but we will tell the business you have withdrawn.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>4. Sharing homeowner information</h2>
        <p>We only share your details with a business if you ticked the sharing box and we judge your enquiry to be a genuine fit for that business&rsquo;s services and area.</p>
        <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
          <li><strong>Who receives it:</strong> a business (the &ldquo;buyer&rdquo;) who has applied to us, been reviewed and approved, and agreed to our Buyer Terms.</li>
          <li><strong>What they see first:</strong> a summary with general location, property type and enquiry details. No name or contact details.</li>
          <li><strong>What they receive:</strong> your full contact and enquiry details, only after they have paid us for the enquiry and we have verified the payment.</li>
          <li><strong>How many:</strong> as agreed in that buyer&rsquo;s individual commercial terms &mdash; typically one, unless the enquiry is marked as shared.</li>
          <li><strong>What they may do with it:</strong> contact you about this enquiry and any work you agree. Our Buyer Terms forbid them from reselling or passing on your details, or adding you to unrelated marketing.</li>
          <li><strong>Their responsibility:</strong> once they receive your details, the business is a separate controller responsible for how they use them. Any quote, survey, finance or contract is between you and them.</li>
        </ul>
        <p>We are paid by buyers for qualified enquiries. You are never charged by us.</p>
        <p>We may also share information where the law requires it, or with professional advisers under confidentiality.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>5. Buyer and applicant information</h2>
        <p>When a business applies to buy enquiries, or contacts us through the Lead Exchange, we collect:</p>
        <table style={{ width: '100%', marginBottom: 16 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: '4px 8px' }}>Category</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Examples</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: '4px 8px' }}>Business and contact</td><td style={{ padding: '4px 8px' }}>Company name, registration number, website, location, contact name, email, telephone</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Capability and coverage</td><td style={{ padding: '4px 8px' }}>Services, insurance and qualifications, counties and postcodes covered, travel distance</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Commercial and sales information</td><td style={{ padding: '4px 8px' }}>Lead capacity, price expectations, previous lead suppliers, response times, conversion rates, average job value</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Agreements</td><td style={{ padding: '4px 8px' }}>Confirmations given, Buyer Terms and Replacement Policy versions accepted and when</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Account records</td><td style={{ padding: '4px 8px' }}>Approval status, commercial terms, lead purchases, replacements</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Admin records</td><td style={{ padding: '4px 8px' }}>An internal suitability score and notes, used only to help our review. It never approves or rejects anyone automatically</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Contact messages</td><td style={{ padding: '4px 8px' }}>Name, email and message</td></tr>
          </tbody>
        </table>
        <p><strong>Lawful basis:</strong> taking steps to enter into, and performing, our contract with the buyer; our legitimate interest in vetting buyers to protect homeowners; and legal obligations for financial records.</p>
        <p>These are business contacts, but sole traders and named contacts are individuals, so this policy applies to them.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>6. Marketing</h2>
        <p>We only send marketing emails if you tick the optional marketing box. Homeowners can opt in to occasional home-improvement tips; buyers can opt in to occasional updates from Halo Strategic. Account and lead notifications to buyers are service messages, not marketing.</p>
        <p>Every marketing email has an unsubscribe link. You can also email us to stop at any time. We do not sell your details to anyone for marketing, and we do not use advertising cookies or retargeting pixels.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>7. Service providers and international transfers</h2>
        <p>We use these providers to run the site and the Lead Exchange. They act on our instructions.</p>
        <table style={{ width: '100%', marginBottom: 16 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: '4px 8px' }}>Provider</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>What they do</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Where</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: '4px 8px' }}>Netlify</td><td style={{ padding: '4px 8px' }}>Website hosting, form submissions, Lead Exchange application and database</td><td style={{ padding: '4px 8px' }}>United States</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Resend</td><td style={{ padding: '4px 8px' }}>Sends our automated emails (e.g. confirming a buyer application has been received)</td><td style={{ padding: '4px 8px' }}>United States</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Google</td><td style={{ padding: '4px 8px' }}>Fonts (loaded on every page), Google Analytics 4 via Tag Manager only if you accept analytics cookies, Google Workspace for our email, and Google Sheets, where we keep an internal operational copy of homeowner enquiry details (name, contact details, postcode, enquiry answers) to track and action them</td><td style={{ padding: '4px 8px' }}>United States</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Tide</td><td style={{ padding: '4px 8px' }}>Business banking and buyer payment links</td><td style={{ padding: '4px 8px' }}>United Kingdom</td></tr>
          </tbody>
        </table>
        <p>Where a provider processes data outside the UK, we rely on the UK Extension to the EU-US Data Privacy Framework or the UK&rsquo;s International Data Transfer Addendum, as appropriate to that provider.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>8. How long we keep it</h2>
        <table style={{ width: '100%', marginBottom: 16 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: '4px 8px' }}>Information</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Kept for</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: '4px 8px' }}>Homeowner enquiry not shared with anyone</td><td style={{ padding: '4px 8px' }}>6 months from submission, then deleted</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Homeowner enquiry shared with a buyer</td><td style={{ padding: '4px 8px' }}>2 years from sharing, so we can handle replacements, disputes and complaints</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Phone verification record</td><td style={{ padding: '4px 8px' }}>Kept with the enquiry it relates to. A STOP entry is kept until you ask us to remove it, so we honour your request</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Record of your consents</td><td style={{ padding: '4px 8px' }}>As long as we hold the related data, plus 2 years</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Declined buyer applications</td><td style={{ padding: '4px 8px' }}>12 months from decision</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Active buyer accounts</td><td style={{ padding: '4px 8px' }}>While the account is open, plus 2 years</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Payment and transaction records</td><td style={{ padding: '4px 8px' }}>6 years, as required for tax and accounting</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Contact messages</td><td style={{ padding: '4px 8px' }}>12 months</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Analytics data</td><td style={{ padding: '4px 8px' }}>Google Analytics 4 retention setting of 14 months</td></tr>
          </tbody>
        </table>
        <p>When the period ends we delete the data or anonymise it so it no longer identifies you. Buyers keep the data we shared under their own retention policies.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>9. Security</h2>
        <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
          <li>Data is sent over encrypted connections (HTTPS).</li>
          <li>Only Halo administrators can see buyer applications and enquiry details. Admin accounts have no public sign-up, use hashed passwords, and every admin action is checked on the server and written to an audit log.</li>
          <li>Buyers never see a homeowner&rsquo;s contact details before payment is verified.</li>
          <li>Bots are filtered out of our forms, and form submissions are rate-limited.</li>
        </ul>
        <p>No system is perfectly secure. If a breach is likely to put you at risk, we will tell you and the ICO as the law requires.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>10. Your rights</h2>
        <p>Under UK data protection law you can ask us to:</p>
        <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
          <li>give you a copy of your information</li>
          <li>correct anything inaccurate</li>
          <li>delete your information</li>
          <li>restrict or object to how we use it, including stopping marketing at any time</li>
          <li>move your information to another provider</li>
          <li>withdraw any consent you gave</li>
        </ul>
        <p>If you ask us to delete or stop sharing your details after they have gone to a buyer, we will pass your request on to them.</p>
        <p>Email hello@halostrategic.com. We will reply within one month. There is no charge.</p>
        <p>If you are unhappy with how we handle your information, you can complain to the Information Commissioner&rsquo;s Office at ico.org.uk or on 0303 123 1113. We would appreciate the chance to sort it out first.</p>
      </div>
    </section>
  );
}
