import { Manrope, Newsreader } from 'next/font/google';
import { PatrimonialEventLanding } from '@/components/patrimonial-event-landing';
import { patrimonialEvent } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';

const serif = Newsreader({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--event-serif', display: 'swap' });
const sans = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--event-sans', display: 'swap' });
export const metadata = { ...pageMetadata({ path: patrimonialEvent.path, title: patrimonialEvent.title, description: patrimonialEvent.description }), robots: { index: false, follow: false } };
export default function PatrimonialEventPage() {
  return <div className={`${serif.variable} ${sans.variable}`}><PatrimonialEventLanding /></div>;
}
