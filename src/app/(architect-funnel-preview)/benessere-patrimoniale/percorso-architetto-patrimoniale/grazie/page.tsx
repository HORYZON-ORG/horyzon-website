import { PageHero, Rows, Section } from '@/components/kit';
import { architectPath, patrimonialBrand } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';
import { notFound } from 'next/navigation';

export const metadata = { ...pageMetadata({ path: `${architectPath.path}/grazie`, title: 'Candidatura ricevuta.', description: 'Abbiamo registrato la tua candidatura al Percorso Architetto Patrimoniale.' }), robots: { index: false, follow: false } };

// Deliberately static: visiting this URL never records a lead or a conversion.
export default function ArchitectPathThanksPage() {
  if (!(process.env.PATRIMONIAL_ARCHITECT_PREVIEW_PAGE_ENABLED === 'true' && (process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development'))) notFound();
  return <><PageHero label={patrimonialBrand.path} title="Candidatura ricevuta." lead="Abbiamo registrato i dati che ci hai inviato. L’ingresso nel percorso non è automatico: il team valuterà la candidatura e, se ci sono i presupposti, ti indicherà i passaggi successivi." /><Section tone="cream" title="Cosa succede adesso" headingId="prossimi-passi-title"><Rows items={architectPath.thanks.map(text => ({ text }))} /></Section></>;
}
