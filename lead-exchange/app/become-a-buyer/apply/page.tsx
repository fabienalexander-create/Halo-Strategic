import type { Metadata } from 'next';
import BuyerApplicationForm from '../BuyerApplicationForm';

export const metadata: Metadata = {
  title: 'Apply for Access | Halo Lead Exchange',
  description:
    'Apply for access to the Halo Lead Exchange. Applications are reviewed before any account is approved.',
  robots: 'index, follow',
};

// The full buyer application, moved here from the old /become-a-buyer URL as the second stage of
// the funnel. BuyerApplicationForm itself is untouched -- same component, same API route, same
// admin review process -- only its page location changed.
export default function ApplyPage() {
  return (
    <section>
      <div className="container">
        <div className="eyebrow">Buyer Application</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 12 }}>Apply for access to the Lead Exchange.</h1>
        <p>
          Applications are reviewed by Halo Strategic before any account is approved. We don&rsquo;t
          grant lead inventory or homeowner details automatically &mdash; applying starts a review,
          not an instant sign-up. This should take around 5&ndash;7 minutes.
        </p>
        <BuyerApplicationForm />
      </div>
    </section>
  );
}
