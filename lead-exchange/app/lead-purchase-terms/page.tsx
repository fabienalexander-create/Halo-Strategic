import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Lead Purchase & Delivery Terms | Halo Lead Exchange',
  description:
    'How a Lead is offered, purchased, paid for, verified and delivered on the Halo Lead Exchange.',
  robots: 'index, follow',
};

const h2 = { fontSize: '1.2rem', margin: '24px 0 10px' } as const;

export default function LeadPurchaseTermsPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Legal</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>Lead Purchase &amp; Delivery Terms</h1>
        <p className="form-note" style={{ marginBottom: 24 }}>
          Version 2026-11-05-v0.1. Last updated 5 November 2026.
        </p>

        <h2 style={h2}>1. About these terms</h2>
        <p>
          1.1 These terms explain, step by step, how a Lead is offered, purchased, paid for and
          delivered on the Halo Lead Exchange, operated by Halo Strategic Ltd (company number
          17409402).
        </p>
        <p>
          1.2 They sit under our <Link href="/buyer-terms">Buyer Terms</Link>. Words with capital
          letters (such as Buyer, Lead, Homeowner, Delivery and Replacement) have the meanings given
          in the Buyer Terms. If anything here conflicts with the Buyer Terms, the Buyer Terms apply.
        </p>
        <p>
          1.3 During this pilot phase every Lead is handled individually by a Halo administrator.
          There is no automated purchasing, reservation timer or self-service checkout.
        </p>

        <h2 style={h2}>2. How a Lead is offered</h2>
        <p>
          2.1 When a qualified Lead matches your Territory and approved services, we send you an
          offer by email. The offer contains a Lead reference, a summary of the enquiry without the
          Homeowner&rsquo;s name or contact details, whether the Lead is exclusive or shared, and its
          price.
        </p>
        <p>
          2.2 Each offer states how long you have to accept or decline it. If you do not respond in
          that time, the offer lapses and we may offer the Lead to another Buyer.
        </p>
        <p>2.3 You may decline any offer. Declining costs you nothing.</p>

        <h2 style={h2}>3. Accepting and paying</h2>
        <p>3.1 To accept, reply to the offer confirming you want the Lead.</p>
        <p>
          3.2 We then send you payment details for that Lead. When you pay, include the Lead
          reference (and your Buyer reference) so we can match the payment.
        </p>
        <p>
          3.3 Accepting does not oblige us to release the Lead until payment is verified, and paying
          does not complete the purchase until we have verified it (section 4).
        </p>
        <p>
          3.4 If payment for an accepted Lead is not received within the time stated in the offer,
          the acceptance lapses and we may offer the Lead elsewhere.
        </p>

        <h2 style={h2}>4. Payment verification</h2>
        <p>
          4.1 We release a Homeowner&rsquo;s contact details only once payment for that Lead has been
          received in our business account and checked by us against the amount and reference.
        </p>
        <p>
          4.2 A remittance advice, screenshot, payment confirmation email or your word alone is not
          proof of payment.
        </p>
        <p>
          4.3 Once verified, we confirm the payment to you by email.
        </p>

        <h2 style={h2}>5. Delivery</h2>
        <p>
          5.1 &ldquo;Delivered&rdquo; means we have emailed the Homeowner&rsquo;s full contact
          details and qualification information to the email address you gave us. We record the time
          of that email as the time of Delivery.
        </p>
        <p>
          5.2 We aim to Deliver as promptly as possible after payment is verified, but do not
          guarantee a fixed delivery time during this pilot phase.
        </p>
        <p>
          5.3 If you have not received a Lead you have paid for, tell us and we will resend it. A
          resend does not change the original Delivery time unless the first email failed to send
          from our side.
        </p>
        <p>
          5.4 Before Delivery you may ask us to withdraw a Lead you have paid for, and we will refund
          that payment.
        </p>

        <h2 style={h2}>6. When a purchase is final</h2>
        <p>
          6.1 A purchase is final once the Lead has been Delivered. After that, the only remedies are
          those in section 7 and our <Link href="/refund-policy">Refund &amp; Replacement Policy</Link>.
        </p>
        <p>
          6.2 An exclusive Lead, once Delivered, will not be sold to any other Buyer. A shared Lead
          may be sold to more than one Buyer, as agreed in your commercial terms.
        </p>

        <h2 style={h2}>7. After Delivery</h2>
        <p>
          7.1 Check each Lead when you receive it. The Delivery time starts the replacement window.
        </p>
        <p>
          7.2 You may claim a Replacement if you cannot reach the Homeowner despite reasonable,
          documented attempts within 3 calendar days of Delivery, or if the Lead is invalid or
          materially inaccurate. Send us the Lead reference and your dated contact evidence within 5
          calendar days of Delivery. Full details are in the{' '}
          <Link href="/refund-policy">Refund &amp; Replacement Policy</Link> and section 9 of the{' '}
          <Link href="/buyer-terms">Buyer Terms</Link>.
        </p>
        <p>
          7.3 How you may use the Homeowner&rsquo;s details is set out in sections 8 and 10 of the
          Buyer Terms and in our <Link href="/privacy-policy">Privacy Policy</Link>.
        </p>

        <h2 style={h2}>8. Questions and disputes</h2>
        <p>
          8.1 Email hello@halostrategic.com with your Buyer reference and the Lead reference. We will
          acknowledge within 2 working days and aim to resolve within 10 working days, as set out in
          section 13 of the Buyer Terms.
        </p>
      </div>
    </section>
  );
}
