import type { Metadata } from 'next';
import './globals.css';
import DraftBanner from './components/DraftBanner';

export const metadata: Metadata = {
  title: 'Halo Lead Exchange',
  description:
    'Qualified home improvement enquiries, delivered to the right businesses. A division of Halo Strategic.',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <DraftBanner />
        <div className="top-bar">
          <a href="/" className="wordmark">
            HALO STRATEGIC
          </a>
          <span className="division-tag">Lead Exchange</span>
        </div>
        <nav className="main-nav">
          <a href="/">Home</a>
          <a href="/spray-foam-removal">Spray Foam Removal</a>
          <a href="/how-it-works">How It Works</a>
          <a href="/become-a-buyer">Become a Buyer</a>
          <a href="/insights">Insights</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
        <main>{children}</main>
        <footer>
          <div className="container">
            &copy; 2026 Halo Strategic Ltd. A division of{' '}
            <a href="https://halostrategic.com">Halo Strategic</a>. &middot;{' '}
            <a href="/privacy-policy">Privacy Policy</a> &middot;{' '}
            <a href="/buyer-terms">Buyer Terms</a> &middot;{' '}
            <a href="/lead-purchase-terms">Lead Purchase &amp; Delivery Terms</a> &middot;{' '}
            <a href="/refund-policy">Refund &amp; Replacement Policy</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
