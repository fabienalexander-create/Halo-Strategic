import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Buyer Terms | Halo Lead Exchange',
  description: 'The terms that govern how approved businesses buy homeowner enquiries through the Halo Lead Exchange.',
  robots: 'index, follow',
};

export default function BuyerTermsPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Legal</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>Buyer Terms</h1>
        <p className="form-note" style={{ marginBottom: 24 }}>Version 2026-11-04-v0.1. Last updated 4 November 2026.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>1. About these terms</h2>
        <p>1.1 These terms govern how approved businesses buy homeowner enquiries through the Halo Lead Exchange at halostrategic.com/leads-exchange.</p>
        <p>1.2 The Lead Exchange is operated by Halo Strategic Ltd, a company registered in England and Wales (company number 17409402), registered office 71-75 Shelton Street, London WC2H 9JQ (&ldquo;Halo&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).</p>
        <p>1.3 The Lead Exchange is for businesses only. By applying, you confirm you act in the course of your business and not as a consumer.</p>
        <p>1.4 These terms work alongside the Refund &amp; Replacement Policy, the Lead Purchase &amp; Delivery Terms and the Privacy Policy. If they conflict, these Buyer Terms apply unless the other document says it overrides them on that point.</p>
        <p>1.5 Any individual commercial terms agreed with you in writing (price per lead, territory, exclusivity, weekly capacity, payment arrangements) form part of these terms. Where they differ, the individual terms apply.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>2. Definitions</h2>
        <table style={{ width: '100%', marginBottom: 16 }}>
          <thead>
            <tr><th style={{ textAlign: 'left', padding: '4px 8px' }}>Term</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Meaning</th></tr>
          </thead>
          <tbody>
            <tr><td style={{ padding: '4px 8px' }}>Buyer</td><td style={{ padding: '4px 8px' }}>A business whose application we have approved and activated</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Homeowner</td><td style={{ padding: '4px 8px' }}>The person who made the enquiry</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Lead</td><td style={{ padding: '4px 8px' }}>One homeowner enquiry, qualified against the agreed criteria for its service</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Delivery</td><td style={{ padding: '4px 8px' }}>Release of the Homeowner&rsquo;s full contact details to the Buyer, recorded with a timestamp</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Territory</td><td style={{ padding: '4px 8px' }}>The service areas (postcodes or counties) agreed with a Buyer at onboarding</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>Replacement</td><td style={{ padding: '4px 8px' }}>An equivalent Lead supplied at no extra charge under the Refund &amp; Replacement Policy</td></tr>
          </tbody>
        </table>
        <p className="form-note">
          This pilot phase of the Lead Exchange is operated as a direct, admin-managed process rather
          than an automated marketplace. There is no automated reservation timer, no self-service
          preview-and-purchase flow, and no prepaid credit ledger yet &mdash; a Halo administrator
          handles qualification, offer and delivery for every Lead individually. These terms describe
          that process as it actually operates today; a later version will cover any automated features
          we add.
        </p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>3. Applications, approval and activation</h2>
        <p>3.1 Submitting an application does not give you access to Leads. Every application is reviewed by a Halo administrator.</p>
        <p>3.2 We may approve or decline any application at our discretion and do not have to give reasons. We may ask for evidence of insurance, qualifications, company registration or trading history.</p>
        <p>3.3 Your account is activated only when we have approved your application and agreed your commercial terms (Territory, services, price, exclusivity and payment arrangements) in writing.</p>
        <p>3.4 You must keep your application information accurate and tell us promptly about material changes, including loss of insurance, change of ownership or insolvency.</p>
        <p>3.5 Your account is personal to your business. You must not let another business use it or buy Leads on its behalf.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>4. Leads and qualification</h2>
        <p>4.1 Each Lead is checked against criteria agreed for its service before it is offered. For Spray Foam Removal these can include homeowner status, property type and postcode, spray foam presence and location, foam type where known, reason for removal, timescale, roof access and previous inspections or quotes.</p>
        <p>4.2 Each data point is labelled as confirmed, homeowner estimate, or unknown. We do not present uncertain information as confirmed.</p>
        <p>4.3 A Lead is an expression of interest by a Homeowner. We do not guarantee that any Lead will result in a survey, quote, sale or revenue, or that the Homeowner will remain interested.</p>
        <p>4.4 We only offer you Leads inside your Territory and for services you have been approved for.</p>
        <p>4.5 You may decline any Lead offered to you before purchase. You pay only for Leads you accept.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>5. Exclusivity and allocation</h2>
        <p>5.1 Whether a Lead is sold to one Buyer only (exclusive) or to more than one (shared) is set out in your individual commercial terms.</p>
        <p>5.2 When we offer you a Lead, we will tell you how long you have to accept or decline it. If you do not respond in that time, we may offer the Lead to another Buyer.</p>
        <p>5.3 An exclusive Lead, once Delivered, will not be sold to any other Buyer.</p>
        <p>5.4 A shared Lead may be sold to more than one Buyer, as agreed in your commercial terms.</p>
        <p>5.5 Exclusivity does not stop the Homeowner from contacting other businesses independently.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>6. Price and payment</h2>
        <p>6.1 The price of each Lead is agreed with you individually as part of your commercial terms, and confirmed to you before you commit to purchase. Prices are not subject to VAT, as Halo Strategic is not currently VAT-registered.</p>
        <p>6.2 <strong>Payment before release.</strong> We never release a Homeowner&rsquo;s contact details until payment for that Lead has been received and independently verified by us. A remittance advice or your confirmation alone is not proof of payment.</p>
        <p>6.3 Your payment method and timing (for example, payment per Lead, or in agreed batches) are set out in your commercial terms, confirmed when your account is activated.</p>
        <p>6.4 We will confirm each payment and each Lead by email.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>7. Delivery</h2>
        <p>7.1 Once payment is verified, we Deliver the Homeowner&rsquo;s full contact details and qualification information to you by email to the address you provide.</p>
        <p>7.2 We record the time of Delivery. That timestamp starts the replacement window in section 9.</p>
        <p>7.3 We aim to Deliver as promptly as possible once payment is verified, but do not guarantee a fixed delivery time during this pilot phase. You may ask us to withdraw a Lead not yet Delivered.</p>
        <p>7.4 You must check each Lead on receipt and tell us within the replacement window if it appears invalid or materially inaccurate.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>8. Your responsibilities</h2>
        <p>8.1 You must contact each Homeowner promptly, professionally and only about the enquiry they made.</p>
        <p>8.2 You must not:</p>
        <ul style={{ color: 'var(--slate)', paddingLeft: 20 }}>
          <li>resell, share, publish or pass any Lead or Homeowner data to anyone else, including other trades or lead sellers</li>
          <li>add the Homeowner to marketing lists or send unrelated marketing without their separate consent</li>
          <li>use high-pressure, misleading or unfair sales practices</li>
          <li>contact a Homeowner who asks you to stop</li>
        </ul>
        <p>8.3 You must comply with all laws that apply to your contact with Homeowners, including UK GDPR, the Data Protection Act 2018, the Privacy and Electronic Communications Regulations, and consumer protection law (including cancellation rights where a contract is agreed in the home or at a distance).</p>
        <p>8.4 You must hold the insurance and qualifications you told us about, and carry out the work yourself unless we agree otherwise.</p>
        <p>8.5 You are solely responsible for any survey, quote, contract and work you agree with a Homeowner. Halo is not a party to that contract.</p>
        <p>8.6 You will tell us within 48 hours if a Homeowner complains about you or asks how you got their details.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>9. Replacements</h2>
        <p>9.1 Replacements are governed by the <Link href="/refund-policy" style={{ color: 'var(--bronze)' }}>Refund &amp; Replacement Policy</Link>. In summary, for Spray Foam Removal: an equivalent Replacement at no extra charge if you cannot reach the Homeowner despite reasonable, documented attempts within 3 calendar days of Delivery, or if the Lead is invalid or materially inaccurate. Non-conversion to a sale, or a Homeowner who changes their mind after being reached, does not on its own qualify.</p>
        <p>9.2 The remedy is a Replacement, not a cash refund, except as set out in 9.3.</p>
        <p>9.3 To claim, send us the Lead reference and your dated contact evidence within 5 calendar days of Delivery. A Halo administrator reviews every disputed claim and records the outcome against the Lead.</p>
        <p>9.4 If no equivalent Lead is available within 30 days of an accepted Replacement claim, we will refund the price you paid for that Lead instead.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>10. Data protection</h2>
        <p>10.1 When we Deliver a Lead, we share the Homeowner&rsquo;s personal data with you so you can respond to their enquiry. From Delivery, you are an independent controller of that data and responsible for your own compliance.</p>
        <p>10.2 You must use Homeowner data only to respond to that enquiry and to deliver any work agreed, keep it secure, and delete it when you no longer need it for those purposes or for your legal records.</p>
        <p>10.3 If a Homeowner asks us to stop sharing their data or to delete it, we will tell you and you must act on that request without delay.</p>
        <p>10.4 Our own handling of Homeowner and Buyer data is described in our <Link href="/privacy-policy" style={{ color: 'var(--bronze)' }}>Privacy Policy</Link>.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>11. Liability</h2>
        <p>11.1 Nothing in these terms limits liability for death or personal injury caused by negligence, fraud, or anything that cannot legally be limited.</p>
        <p>11.2 We are not liable for loss of profit, revenue, business or opportunity, or for any indirect loss, arising from any Lead.</p>
        <p>11.3 Our total liability to you in any 12-month period is limited to the amount you paid us for Leads in that period.</p>
        <p>11.4 You are responsible for, and will cover our reasonable losses from, any claim by a Homeowner or regulator arising from your misuse of Homeowner data or breach of section 8.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>12. Suspension and termination</h2>
        <p>12.1 Either of us may close your account with 14 days&rsquo; written notice.</p>
        <p>12.2 We may suspend or close your account immediately if you breach section 8 or 10, receive repeated Homeowner complaints, provide false information, or become insolvent.</p>
        <p>12.3 On closure, Leads already Delivered remain yours to work under these terms.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>13. Disputes and complaints</h2>
        <p>13.1 Raise any complaint or payment dispute by email to hello@halostrategic.com with your Buyer reference and the Lead reference.</p>
        <p>13.2 We will acknowledge within 2 working days and aim to resolve within 10 working days. A Halo administrator reviews every disputed case.</p>
        <p>13.3 Before starting any legal claim, both parties will try in good faith to settle the dispute by discussion for at least 30 days.</p>

        <h2 style={{ fontSize: '1.2rem', margin: '24px 0 10px' }}>14. General</h2>
        <p>14.1 We may change these terms by giving you 30 days&rsquo; email notice. Changes do not affect Leads already Delivered.</p>
        <p>14.2 You may not transfer your rights under these terms without our written consent.</p>
        <p>14.3 If any part of these terms is found unenforceable, the rest remains in effect.</p>
        <p>14.4 These terms are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction.</p>
      </div>
    </section>
  );
}
