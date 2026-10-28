import { PageHero } from '@/components/kit';
import { patrimonialEvent } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';

export const metadata = pageMetadata({ path: `${patrimonialEvent.path}/grazie`, title: 'Richiesta di partecipazione ricevuta', description: "Abbiamo ricevuto la tua richiesta di partecipazione all'evento." });

// No analytics, registration side effects, calendar or meeting URL.
export default function PatrimonialEventThanksPage() {
  return <PageHero title="Abbiamo ricevuto la tua richiesta di partecipazione all'evento." />;
}
