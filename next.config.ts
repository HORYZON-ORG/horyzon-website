import type { NextConfig } from 'next';

// Preserve static rendering: Next hydration and Motion use inline scripts/styles.
// This baseline policy is intentionally not presented as a nonce-based XSS policy.
const isDev = process.env.NODE_ENV === 'development';
const csp = [
 "default-src 'self'",
 `script-src 'self' 'unsafe-inline' *.iubenda.com${isDev ? " 'unsafe-eval'" : ''}`,
 "style-src 'self' 'unsafe-inline' *.iubenda.com", "img-src 'self' data: blob: *.iubenda.com",
 "font-src 'self' *.iubenda.com", "media-src 'self' blob:",
 `connect-src 'self' *.iubenda.com${isDev ? ' ws: wss:' : ''}`,
 "frame-src *.iubenda.com",
 "object-src 'none'", "base-uri 'self'", "form-action 'self' mailto:",
 "frame-ancestors 'none'", ...(!isDev ? ['upgrade-insecure-requests'] : []),
].join('; ');
// Both representations of / must bypass HTTP caches while Next overwrites Vary.
// This affects response caching only: the real home remains prerendered for Readable.
const readableCacheHeaders = [
 { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
 { key: 'CDN-Cache-Control', value: 'no-store' },
 { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
];
const nextConfig: NextConfig = {
 experimental: { globalNotFound: true },
 allowedDevOrigins: ['terminal.local'],
 images: { qualities: [75, 100] },
 poweredByHeader: false,
 // The Radar report PDF reads its fonts and logos from disk.
 outputFileTracingIncludes: { '/api/radar/**': ['./src/lib/radar/fonts/**', './src/lib/radar/assets/**'] },
 async headers() {
  return [{ source: '/:path*', headers: [
   { key: 'Content-Security-Policy', value: csp },
   { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
   { key: 'X-Frame-Options', value: 'DENY' },
   { key: 'X-Content-Type-Options', value: 'nosniff' },
   { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
   { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ] }, { source: '/internal/radar-patrimoniale/advisor-preview', headers: [
   { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
   { key: 'Cache-Control', value: 'no-store, private' },
   { key: 'Referrer-Policy', value: 'no-referrer' },
   { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'${isDev ? ' ws: wss:' : ''}; form-action 'none'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'` },
  ] }, { source: '/radar-patrimoniale', headers: [
   { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
   { key: 'Referrer-Policy', value: 'no-referrer' },
   // Keep inherited third-party consent scripts away from this in-memory demo.
   { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'${isDev ? ' ws: wss:' : ''}; form-action 'none'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'` },
  ] }, { source: '/annunci-10x', headers: [
   { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  ] }, ...['percorso-architetto-patrimoniale', 'evento'].map(slug => ({
   source: `/benessere-patrimoniale/${slug}/:path*`,
   headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
  })), { source: '/', headers: [
   ...readableCacheHeaders,
   { key: 'Vary', value: 'Accept, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch' },
  ] }, { source: '/home.md', headers: [
   ...readableCacheHeaders,
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
