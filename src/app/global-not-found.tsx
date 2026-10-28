import SiteDocument from './site-document';
import NotFound from './(site)/not-found';

export { metadata, viewport } from './site-document';

// Multiple roots need an explicit complete fallback document.
export default function GlobalNotFound() {
  return <SiteDocument><NotFound /></SiteDocument>;
}
