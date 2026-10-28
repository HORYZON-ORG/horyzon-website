import type { Metadata } from 'next';
import SiteDocument from '../site-document';
export { viewport } from '../site-document';
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Isolated preview is a separate root route group: it must render the same
 * SiteDocument as the approved funnel to receive original site CSS variables,
 * font definitions, HTML/body shell and global brand styles. Without this,
 * the lime and ink tokens are unresolved and original CSS colors vanish.
 * 'isolated' suppresses unrelated cookie scripts without touching brand CSS.
 */
export default function ArchitectPreviewLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument isolated><a className="skip-link" href="#content">Vai al contenuto</a><main id="content">{children}</main></SiteDocument>;
}
