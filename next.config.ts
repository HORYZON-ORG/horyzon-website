import type { NextConfig } from 'next';

// Preserve static rendering: Next hydration and Motion use inline scripts/styles.
// This baseline policy is intentionally not presented as a nonce-based XSS policy.
const isDev = process.env.NODE_ENV === 'development';
const csp = [
 "default-src 'self'",
 `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
 "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
 "font-src 'self'", "media-src 'self' blob:",
 `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
 "object-src 'none'", "base-uri 'self'", "form-action 'self' mailto:",
 "frame-ancestors 'none'", ...(!isDev ? ['upgrade-insecure-requests'] : []),
].join('; ');
const nextConfig: NextConfig = {
 allowedDevOrigins: ['terminal.local'],
 poweredByHeader: false,
 async headers() {
  return [{ source: '/:path*', headers: [
   { key: 'Content-Security-Policy', value: csp },
   { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
   { key: 'X-Frame-Options', value: 'DENY' },
   { key: 'X-Content-Type-Options', value: 'nosniff' },
   { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
   { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ] }, { source: '/home.md', headers: [
   { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
   { key: 'X-Robots-Tag', value: 'noindex, follow' },
   { key: 'Link', value: '<https://horyzon.it>; rel="canonical"' },
  ] }];
 },
 async redirects() { return [
  { source: '/v/frank/Frank-Cannoletta.vcf', destination: '/v/frank/contact.vcf', permanent: true },
  { source: '/v/:person/index.php', destination: '/v/:person', permanent: true },
  { source: '/v/:person/download.php', destination: '/v/:person/contact.vcf', permanent: true },
 ]; },
};
export default nextConfig;
