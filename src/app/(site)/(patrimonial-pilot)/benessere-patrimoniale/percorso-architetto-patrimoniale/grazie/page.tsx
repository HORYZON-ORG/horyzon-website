import { PageHero, Rows, Section } from '@/components/kit';
import { architectPath, patrimonialBrand } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';

export const metadata = pageMetadata({ path: `${architectPath.path}/grazie`, title: 'La tua richiesta è arrivata.', description: 'Grazie per averci raccontato qualcosa di te.' });

// Deliberately static: visiting this URL never records a lead or a conversion.
export default function ArchitectPathThanksPage() {
  return <><PageHero label={patrimonialBrand.path} title="La tua richiesta è arrivata." lead="Grazie per averci raccontato qualcosa di te." /><Section tone="cream" title="Cosa succede adesso" headingId="prossimi-passi-title"><Rows items={architectPath.thanks.map(text => ({ text }))} /></Section></>;
}
