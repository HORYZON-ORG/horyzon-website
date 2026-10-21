import { Manrope, JetBrains_Mono } from 'next/font/google';
import { PatrimonialEventLanding } from '@/components/patrimonial-event-landing';
import { patrimonialEvent } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';
import { PatrimonialThemeFrame } from '@/components/patrimonial-theme-frame';

const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--event-mono', display: 'swap' });
const sans = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--event-sans', display: 'swap' });
export const metadata = { ...pageMetadata({ path: patrimonialEvent.path, title: patrimonialEvent.title, description: patrimonialEvent.description }), robots: { index: false, follow: false } };
export default function PatrimonialEventPage() {
  return <PatrimonialThemeFrame><div className={`${mono.variable} ${sans.variable}`}><PatrimonialEventLanding /></div></PatrimonialThemeFrame>;
}
