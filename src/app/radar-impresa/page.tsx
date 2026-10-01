import { AtlasVisual } from '@/components/atlas-visual';
import { publicFaqs } from '@/content/public-faq';
import { FaqSection } from '@/components/faq-section';
import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import { RadarStory } from '@/components/radar-story';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { RADAR_URL } from '@/content/product-truth';
import { Cta, PageFinal, PageHero, Section, TextLink, Tiles } from '@/components/kit';

export const metadata: Metadata = pageMetadata({ path: '/radar-impresa', title: 'Radar d’Impresa', description: 'Leggi cinque reparti, maturità dei processi, autonomia del titolare e adozione dell’AI.' });
const outputs = [['Come lavora l’impresa','Una lettura d’insieme delle aree che sostengono il lavoro quotidiano.'],['Dove si concentra il peso','I punti in cui decisioni, tempo e responsabilità tornano troppo spesso al titolare.'],['Da dove cominciare','Un primo tema su cui aprire un confronto utile e concreto.']];

// Hero with the live radar (ink) → the five departments on cream → what it shows on the lime field → FAQ → final call.
export default function RadarPage() {
 return <><PageStructuredData path="/radar-impresa" name="Radar d’Impresa" description="Leggi cinque reparti, maturità dei processi, autonomia del titolare e adozione dell’AI." breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'Radar d’Impresa', path: '/radar-impresa' }]} faqs={publicFaqs['/radar-impresa']} /><SiteHeader/><main id="content" className="rd rd-page editorial-page narrative-page" data-page="radar-impresa">
  <PageHero crumbs={[{ name: 'Horyzon', href: '/' }, { name: 'Radar d’Impresa' }]} label="Horyzon / Radar d’Impresa" title={<>Leggi la tua impresa <em>prima di cambiarla.</em></>} lead="Hai la sensazione che tutto passi da te? Il Radar aiuta a capire dove il lavoro rallenta e da quale reparto cominciare." aside={<AtlasVisual kind="radar" />}><Cta href={RADAR_URL}>Inizia il Radar</Cta><TextLink href="#pagina-contenuti">Scopri che cosa misura ↓</TextLink><p className="rd-note" style={{ flexBasis: '100%', margin: 0 }}>L’assessment si apre in Horyzon Hub.</p></PageHero>
  <Section id="pagina-contenuti" tone="cream" split label="Un primo sguardo" title="Fermarsi. Osservare. Fare chiarezza." lead="Il Radar guarda le parti dell’impresa che più spesso rallentano il lavoro. Non dà una risposta preconfezionata: aiuta a iniziare dalla domanda giusta." headingId="radar-sguardo"><RadarStory/></Section>
  <section className="rd-map" aria-labelledby="radar-dopo"><header className="rd-reveal"><p className="rd-label">Dopo il Radar</p><h2 id="radar-dopo">Che cosa ti aiuta <span>a vedere.</span></h2></header><Tiles items={outputs.map(([title, description], index) => ({ tag: `0${index + 1}`, title, text: description }))} /></section>
  <FaqSection items={publicFaqs['/radar-impresa']} />
  <PageFinal label="Il passo successivo" title={<>Il risultato apre <em>una conversazione.</em></>} text="Dopo il Radar possiamo guardare insieme ciò che emerge e capire se, e da dove, ha senso proseguire."><Cta href={RADAR_URL}>Inizia il Radar</Cta><TextLink href="/contatti">Parliamone ↗︎</TextLink></PageFinal>
 </main><SiteFooter/></>;
}
