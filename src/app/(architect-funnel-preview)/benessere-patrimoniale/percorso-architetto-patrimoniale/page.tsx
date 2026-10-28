import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { ArchitectLanding } from '@/components/patrimonial-architect-preview-landing';
import { architectPath, patrimonialBrand } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';
import { PatrimonialThemeFrame } from '@/components/patrimonial-architect-preview-theme-frame';
import { notFound } from 'next/navigation';
const display = Space_Grotesk({ subsets: ['latin'], variable: '--architect-display', display: 'swap' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--architect-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--architect-mono', display: 'swap' });
export const metadata = { ...pageMetadata({ path: architectPath.path, title: patrimonialBrand.path, description: architectPath.description }), robots: { index: false, follow: false } };
export default function ArchitectPathPage() {
  if (!(process.env.PATRIMONIAL_ARCHITECT_PREVIEW_PAGE_ENABLED === 'true' && (process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development'))) notFound();
  // No client-facing submissions until explicitly enabled for this preview.
  const previewSubmissionsEnabled = process.env.PATRIMONIAL_ARCHITECT_PREVIEW_SUBMISSIONS_ENABLED === 'true';
  const durableCandidateIntake = false;
  return <PatrimonialThemeFrame defaultTheme="dark" showBar={false} rememberChoice={false}><div className={`${display.variable} ${sans.variable} ${mono.variable}`}><ArchitectLanding durableCandidateIntake={durableCandidateIntake} previewSubmissionsEnabled={previewSubmissionsEnabled} /></div></PatrimonialThemeFrame>;
}
