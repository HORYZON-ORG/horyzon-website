import { pageMetadata } from '@/content/seo';
import { PatrimonialThemeFrame } from '@/components/patrimonial-architect-preview-theme-frame';
import { ArchitectStartupPresentation } from '@/components/patrimonial-architect-startup';
import { architectStartupVideoUrl } from '@/lib/public-leads/architect-startup-config';
import { indeedStartupCallbackReady } from '@/lib/public-leads/architect-indeed-callback';

export const dynamic = 'force-dynamic';

export const metadata = {
  ...pageMetadata({
    path: '/candidature/architetti-patrimoniali/startup',
    title: 'Startup Horyzon · Presentazione',
    description: 'Conosci Horyzon Consulting e conferma il tuo interesse per il percorso di Architetto Patrimoniale.',
  }),
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};

export default async function ArchitectStartupPage({
  searchParams,
}: { searchParams: Promise<{ canale?: string | string[] }> }) {
  // Solo video HTTPS MP4 o percorso pubblico locale: finché non arriva il video,
  // il pulsante finale non viene mostrato e nessuna conferma viene registrata.
  const videoUrl = architectStartupVideoUrl(process.env);
  const fromIndeed = (await searchParams).canale === 'indeed';
  return <PatrimonialThemeFrame defaultTheme="light" showBar={false} rememberChoice={false}>
    <ArchitectStartupPresentation key={fromIndeed ? 'indeed' : 'direct'} videoUrl={videoUrl} fromIndeed={fromIndeed}
      indeedCallbackEnabled={fromIndeed && indeedStartupCallbackReady(process.env)} />
  </PatrimonialThemeFrame>;
}
