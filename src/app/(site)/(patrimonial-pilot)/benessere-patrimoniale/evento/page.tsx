import { localEventRadarContract } from '@/lib/patrimonial-radar-server/event-gate';
import { connection } from 'next/server';
import { Manrope } from 'next/font/google';
import localFont from 'next/font/local';
import { PatrimonialEventLanding } from '@/components/patrimonial-event-landing';
import { patrimonialEvent } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';
import { PatrimonialThemeFrame } from '@/components/patrimonial-theme-frame';

const mono = localFont({ src: '../../fonts/jetbrains-mono-latin-wght-normal.woff2', weight: '500 600', style: 'normal', variable: '--event-mono', display: 'swap' });
const sans = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--event-sans', display: 'swap' });
export const metadata = { ...pageMetadata({ path: patrimonialEvent.path, title: patrimonialEvent.title, description: patrimonialEvent.description }), robots: { index: false, follow: false } };
export default async function PatrimonialEventPage() {
  await connection(); // Evaluate the approved server runtime gates, never a build-time snapshot.
  return <PatrimonialThemeFrame><div className={`${mono.variable} ${sans.variable}`}><PatrimonialEventLanding contractVersion={localEventRadarContract(process.env)} /></div></PatrimonialThemeFrame>;
}
