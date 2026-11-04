/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Must stay in sync with BASE_PATH in lib/basePath.ts -- see that file for why it's duplicated
  // rather than imported.
  basePath: '/leads-exchange',
};

module.exports = nextConfig;
