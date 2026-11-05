import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

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
        <div className="top-bar">
          <Link href="/" className="wordmark">
            HALO STRATEGIC
          </Link>
          <span className="division-tag">Lead Exchange</span>
        </div>
        <nav className="main-nav">
          <Link href="/">Home</Link>
          <Link href="/spray-foam-removal">Spray Foam Removal</Link>
          <Link href="/how-it-works">How It Works</Link>
          <Link href="/become-a-buyer">Become a Buyer</Link>
          <Link href="/insights">Insights</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <main>{children}</main>
        <footer>
          <div className="container">
            &copy; 2026 Halo Strategic Ltd. A division of{' '}
            <a href="https://halostrategic.com">Halo Strategic</a>. &middot;{' '}
            <Link href="/privacy-policy">Privacy Policy</Link> &middot;{' '}
            <Link href="/buyer-terms">Buyer Terms</Link> &middot;{' '}
            <Link href="/lead-purchase-terms">Lead Purchase &amp; Delivery Terms</Link> &middot;{' '}
            <Link href="/refund-policy">Refund &amp; Replacement Policy</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
