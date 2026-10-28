import SiteDocument from '../site-document';
export { metadata, viewport } from '../site-document';
export default function EventDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SiteDocument>{children}</SiteDocument>;
}
