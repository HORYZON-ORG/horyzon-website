import { Manrope, JetBrains_Mono } from 'next/font/google';
import { PatrimonialEventLanding } from '@/components/patrimonial-event-landing';
import { patrimonialEvent } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';
import { publishedEventSession } from '@/lib/public-leads/patrimonial-event-public-schedule';

const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--event-mono', display: 'swap' });
const sans = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--event-sans', display: 'swap' });
export const metadata = pageMetadata({ path: patrimonialEvent.path, title: patrimonialEvent.title, description: patrimonialEvent.description });
export const dynamic = 'force-dynamic';
export default async function EventPage() {
  // Server-side opt-in; the API separately validates the same switch and the Hub bridge.
  // Requests made before dates are known remain PENDING_EDITION, never confirmed seats.
  const registrationEnabled = process.env.PATRIMONIAL_EVENT_SIGNUP_ENABLED === 'true' &&
    process.env.HORYZON_HUB_EVENT_INGRESS_ENABLED === 'true';
  const session = await publishedEventSession();
  return <div className={`${mono.variable} ${sans.variable}`}><PatrimonialEventLanding registrationEnabled={registrationEnabled} session={session} /></div>;
}
