import { PageHero, Section } from '@/components/kit';
import { patrimonialEvent } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';

export const metadata = pageMetadata({ path: `${patrimonialEvent.path}/grazie`, title: 'Richiesta di partecipazione ricevuta', description: 'Ti invieremo le informazioni necessarie per partecipare al prossimo incontro.' });

// No analytics, registration side effects, calendar or meeting URL.
export default function PatrimonialEventThanksPage() {
  return <><PageHero label={patrimonialEvent.title} title="Abbiamo ricevuto la tua richiesta di partecipazione." lead="Ti invieremo le informazioni necessarie per partecipare al prossimo incontro." /><Section tone="cream" title="Prima dell'evento" headingId="prima-evento-title"><div className="rd-prose"><p>Se vuoi, puoi già indicarci la domanda che più ti interessa sul tema del patrimonio.</p><a className="rd-link" href="mailto:info@horyzon.it?subject=Domanda%20Benessere%20Patrimoniale">info@horyzon.it ↗︎</a></div></Section></>;
}
