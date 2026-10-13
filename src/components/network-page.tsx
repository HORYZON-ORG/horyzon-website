import { PageStructuredData } from './structured-data';
import { SiteFooter, SiteHeader } from './site-shell';
import { Cta, PageHero, PageFinal, Section, Tiles, HeroIndex, TextLink } from './kit';
import { pages } from '@/data/pages';
import { patrimonialContact } from '@/content/patrimonial';

export function NetworkPage() {
  const content = pages['entra-in-horyzon'];
  return <><PageStructuredData path="/entra-in-horyzon" name={content.title} description={content.intro} breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'Entra in Horyzon', path: '/entra-in-horyzon' }]} /><SiteHeader />
    <main id="content" className="rd rd-page editorial-page site-frame" data-page="entra-in-horyzon">
      <PageHero crumbs={[{ name: 'Horyzon', href: '/' }, { name: 'Entra in Horyzon' }]} label="La rete Horyzon" title={content.title} lead={content.intro} aside={<HeroIndex caption="Un percorso da conoscere" words={['Conoscersi', 'Valutare', 'Costruire']} note="Responsabilità, competenze e relazione con le persone." />}>
        <Cta href="#percorso-consulenti" arrow="↓">Scopri il percorso consulenti</Cta><TextLink href={patrimonialContact('percorso-consulenti')}>Chiedi un primo confronto ↗︎</TextLink>
      </PageHero>
      <Section tone="cream" split label="A chi è rivolto" title="La relazione è un punto di partenza. La competenza è un percorso." headingId="rete-pubblico">
        <div className="rd-prose"><p>Per chi vuole conoscere il lavoro nella rete Horyzon e contribuire alla cultura patrimoniale. Se hai esperienza nel network marketing, nella vendita o nell’affiancamento alle persone, possiamo confrontarci su ciò che porti e su ciò che vuoi imparare.</p><p>Formazione, affiancamento e confronto sono le basi del percorso che stiamo costruendo. Modalità, contenuti, responsabilità e condizioni vengono chiariti prima di valutare l’ingresso.</p><p>Horyzon tiene insieme benessere patrimoniale, organizzativo e digitale: resta aperta anche la collaborazione con specialisti delle altre aree.</p></div>
      </Section>
      <Section id="percorso-consulenti" tone="panel" label="I passaggi" title="Prima ci conosciamo. Poi valutiamo insieme." headingId="rete-percorso"><Tiles items={[
        { tag: '01', title: 'Presentazione introduttiva', text: 'Conosci Horyzon, il progetto patrimoniale e il ruolo della rete. Il formato della presentazione verrà comunicato nel primo contatto.' },
        { tag: '02', title: 'Colloquio conoscitivo', text: 'Parliamo della tua esperienza, delle aspettative e del modo in cui vuoi lavorare con le persone. Un eventuale incontro personale si concorda insieme.' },
        { tag: '03', title: 'Valutazione e possibile ingresso', text: 'Se c’è una base comune, approfondiamo condizioni, formazione e affiancamento prima di decidere il passo successivo.' },
      ]} /><p className="rd-note">La candidatura non comporta promessa di incarichi, guadagni o rapporto di lavoro subordinato. Per la collaborazione professionale autonoma si valutano anche i requisiti, inclusa la partita IVA. La definizione di “architetto patrimoniale” esprime una direzione di lavoro, non una qualifica abilitante alla consulenza finanziaria.</p></Section>
      <PageFinal title="Raccontaci da dove parti." text="Lascia un contatto e qualche riga sulla tua esperienza. Il primo passo è capire se il percorso è adatto a te."><Cta href={patrimonialContact('percorso-consulenti')}>Chiedi informazioni sul percorso</Cta><TextLink href="/benessere-patrimoniale#evento">Cerchi informazioni come cliente? ↗︎</TextLink></PageFinal>
    </main><SiteFooter /></>;
}
