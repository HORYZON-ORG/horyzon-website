import { pageMetadata } from '@/content/seo';
import { PatrimonialThemeFrame } from '@/components/patrimonial-architect-preview-theme-frame';
import { ArchitectStartupPresentation } from '@/components/patrimonial-architect-startup';
import { architectStartupVideoUrl } from '@/lib/public-leads/architect-startup-config';

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

export default function ArchitectStartupPage() {
  // Solo video HTTPS MP4 o percorso pubblico locale: finché non arriva il video,
  // il pulsante finale non viene mostrato e nessuna conferma viene registrata.
  const videoUrl = architectStartupVideoUrl(process.env);
  return <PatrimonialThemeFrame defaultTheme="light" showBar={false} rememberChoice={false}>
    <ArchitectStartupPresentation videoUrl={videoUrl} />
  </PatrimonialThemeFrame>;
}
