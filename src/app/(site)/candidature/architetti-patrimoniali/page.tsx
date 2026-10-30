import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { ArchitectLanding } from '@/components/patrimonial-architect-preview-landing';
import { architectPath, patrimonialBrand } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';
import { PatrimonialThemeFrame } from '@/components/patrimonial-architect-preview-theme-frame';
const display = Space_Grotesk({ subsets: ['latin'], variable: '--architect-display', display: 'swap' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--architect-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--architect-mono', display: 'swap' });
export const metadata = { ...pageMetadata({ path: architectPath.path, title: 'Candidati come Architetto Patrimoniale', description: architectPath.description }), robots: { index: false, follow: false } };
export default function ArchitectPathPage() {
  // Hub-first intake is gated server-side. The client never contains service credentials.
  const previewSubmissionsEnabled = true;
  const durableCandidateIntake = false;
  return <PatrimonialThemeFrame defaultTheme="light" showBar={false} rememberChoice={false}><div className={`${display.variable} ${sans.variable} ${mono.variable}`}><ArchitectLanding durableCandidateIntake={durableCandidateIntake} previewSubmissionsEnabled={previewSubmissionsEnabled} /></div></PatrimonialThemeFrame>;
}
