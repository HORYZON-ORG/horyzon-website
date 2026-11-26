import { notFound } from 'next/navigation';
import { pageMetadata } from '@/content/seo';
import { PatrimonialThemeFrame } from '@/components/patrimonial-architect-preview-theme-frame';
import { ArchitectStartupPresentation } from '@/components/patrimonial-architect-startup';
import { architectStartupVideoUrl } from '@/lib/public-leads/architect-startup-config';
import { indeedStartupCallbackReady } from '@/lib/public-leads/architect-indeed-callback';
import { indeedProvinceIsEnabled, parseIndeedProvince } from '@/lib/public-leads/architect-indeed-provinces';

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
}: { searchParams: Promise<{ canale?: string | string[]; provincia?: string | string[] }> }) {
  // Solo video HTTPS MP4 o percorso pubblico locale: finché non arriva il video,
  // il pulsante finale non viene mostrato e nessuna conferma viene registrata.
  const videoUrl = architectStartupVideoUrl(process.env);
  const query = await searchParams;
  const fromIndeed = query.canale === 'indeed';
  const province = parseIndeedProvince(fromIndeed ? query.provincia : undefined);
  if (!province || (fromIndeed && !indeedProvinceIsEnabled(province, process.env.ARCHITECT_INDEED_CALLBACK_EXTRA_PROVINCES))) notFound();
  return <PatrimonialThemeFrame defaultTheme="light" showBar={false} rememberChoice={false}>
    <ArchitectStartupPresentation key={fromIndeed ? province : 'direct'} videoUrl={videoUrl} fromIndeed={fromIndeed} indeedProvince={province}
      indeedCallbackEnabled={fromIndeed && indeedStartupCallbackReady(process.env, province)} />
  </PatrimonialThemeFrame>;
}
