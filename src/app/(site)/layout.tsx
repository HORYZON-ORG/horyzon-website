import type { ReactNode } from 'react';
import SiteDocument from '../site-document';
// Only supported route props cross the Next layout boundary. The shared document
// also accepts an isolation option used by the separate patrimonial route.
export { metadata, viewport } from '../site-document';
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteDocument>{children}</SiteDocument>;
}
