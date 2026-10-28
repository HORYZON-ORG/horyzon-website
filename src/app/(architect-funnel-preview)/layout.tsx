import type { Metadata } from 'next';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function ArchitectPreviewLayout({ children }: { children: React.ReactNode }) {
  return <><a className="skip-link" href="#content">Vai al contenuto</a><main id="content">{children}</main></>;
}
