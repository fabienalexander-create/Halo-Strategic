// Must stay in sync with the `basePath` value in next.config.js. Next.js config files are plain
// Node (no TS/bundler step), so it can't import this constant directly -- kept as a literal in
// both places instead. Used by client-side fetch() calls, which (unlike next/link, next/image and
// the framework's own asset URLs) are NOT automatically prefixed by Next's basePath feature.
export const BASE_PATH = '/leads-exchange';

export function apiPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
