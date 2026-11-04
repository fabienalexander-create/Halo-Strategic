'use client';

import { usePathname } from 'next/navigation';

// The whole app is sitewide noindex (unverified Phase 2/3 build), but /insights articles are
// real public SEO content and get an explicit robots override per-page (see each article's
// metadata export). Showing "DRAFT -- not approved for live traffic" on genuine public content
// would be confusing to an actual visitor, so this banner hides itself there specifically.
export default function DraftBanner() {
  const pathname = usePathname();
  if (pathname?.startsWith('/insights')) return null;

  return (
    <div
      style={{
        background: 'var(--navy-deep)',
        color: '#edeef0',
        textAlign: 'center',
        padding: '10px 16px',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.75rem',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      Draft — Phase 2 build, not approved for live traffic or real buyers
    </div>
  );
}
