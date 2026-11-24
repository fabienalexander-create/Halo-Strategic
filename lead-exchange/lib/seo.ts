import type { Metadata } from 'next';
import { BASE_PATH } from './basePath';

// The public address of the Lead Exchange. The app is also reachable on its Netlify subdomain
// (halo-lead-exchange.netlify.app) because halostrategic.com proxies /leads-exchange/* to it, so
// every indexable page must name this origin as canonical or Google may index the duplicate.
export const SITE_ORIGIN = 'https://halostrategic.com';

export function canonicalUrl(path: string): string {
  const clean = path === '/' ? '' : path;
  return `${SITE_ORIGIN}${BASE_PATH}${clean}`;
}

// Metadata for a page that has been approved for search. The root layout keeps the app noindex
// by default, so a page only becomes indexable by opting in through this helper.
export function indexablePage({ path, title, description }: { path: string; title: string; description: string }): Metadata {
  const url = canonicalUrl(path);
  return {
    title,
    description,
    robots: 'index, follow',
    alternates: { canonical: url },
    openGraph: { url, title, description, siteName: 'Halo Lead Exchange', locale: 'en_GB', type: 'website' },
  };
}
