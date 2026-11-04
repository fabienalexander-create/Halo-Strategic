import BuyerApplicationForm from './BuyerApplicationForm';

export default function BecomeABuyerPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Become a Buyer</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 12 }}>Apply for access to the Lead Exchange.</h1>
        <p>
          Applications are reviewed by Halo Strategic before any account is approved. We don&rsquo;t
          grant lead inventory or homeowner details automatically &mdash; registering starts a review,
          not an instant sign-up. This should take around 5&ndash;7 minutes.
        </p>
        <BuyerApplicationForm />
      </div>
    </section>
  );
}
