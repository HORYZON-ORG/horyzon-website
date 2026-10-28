import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import SiteDocument from '../site-document';
import { patrimonialRadarMode } from '@/lib/patrimonial-radar-ui/public-mode';

export { metadata, viewport } from '../site-document';

// This root is independent of (site). Cross-root navigation creates a new document.
export default async function RadarDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  const anonymous = patrimonialRadarMode(process.env) === 'PUBLIC_ANONYMOUS';
  const identified = patrimonialRadarMode(process.env) === 'VERIFIED_PERSISTENT';
  // Only the Proxy may confer isolation; never accept a browser-supplied marker.
  if (anonymous && (await headers()).get('x-horyzon-radar-document') !== 'anonymous') notFound();
  if (identified && (await headers()).get('x-horyzon-radar-document') !== 'identified') notFound();
  return <SiteDocument isolated={anonymous || identified}>{children}</SiteDocument>;
}
