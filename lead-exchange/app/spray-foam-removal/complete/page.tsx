import type { Metadata } from 'next';
import CompleteEnquiryForm from './CompleteEnquiryForm';

export const metadata: Metadata = {
  title: 'Finish Your Enquiry | Halo Lead Exchange',
  robots: 'noindex, nofollow',
};

export default function CompleteEnquiryPage() {
  return (
    <section>
      <div className="container" style={{ maxWidth: 600 }}>
        <div className="eyebrow">Spray Foam Removal</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 12 }}>Finish your enquiry.</h1>
        <CompleteEnquiryForm />
      </div>
    </section>
  );
}
