import { AtlasVisual } from '@/components/atlas-visual';
import { PageStructuredData } from '@/components/structured-data'; import { FaqSection } from '@/components/faq-section'; import { publicFaqs } from '@/content/public-faq';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next'; import { OperatingJourney } from '@/components/operating-journey'; import { SiteFooter, SiteHeader } from '@/components/site-shell'; import { RADAR_URL } from '@/content/product-truth';
import { Cta, PageHero, Section, TextLink } from '@/components/kit';
export const metadata: Metadata = pageMetadata({ path: '/metodo', title: 'Come lavoriamo', description: 'Un percorso che parte dalla realtà dell’impresa e trasforma una priorità in lavoro concreto.' });
// Hero (ink) → nine stages in three chapters (cream) → one statement on the lime field → FAQ.
export default function MethodPage(){return <><PageStructuredData path="/metodo" name="Come lavoriamo" description="Un percorso che parte dalla realtà dell’impresa e trasforma una priorità in lavoro concreto." breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'Come lavoriamo', path: '/metodo' }]} faqs={publicFaqs['/metodo']} /><SiteHeader/><main id="content" className="rd rd-page editorial-page narrative-page site-frame" data-page="metodo">
 <PageHero crumbs={[{ name: 'Horyzon', href: '/' }, { name: 'Come lavoriamo' }]} label="Come lavoriamo" title={<>Un percorso costruito <em>sulla tua impresa.</em></>} lead="Partiamo da ciò che accade oggi, scegliamo una priorità e la trasformiamo in un cambiamento concreto." aside={<AtlasVisual kind="method" />}><Cta href="#nove-fasi" arrow="↓">Scopri il percorso</Cta><TextLink href={RADAR_URL}>Inizia il Radar ↗︎</TextLink></PageHero>
 <Section id="nove-fasi" tone="cream" label="Il percorso Horyzon" title="Capire. Scegliere. Far accadere." headingId="nove-fasi-title"><OperatingJourney/></Section>
 <Section tone="lime" label="Un passo alla volta" title={<>Quello che conta è <span className="rd-lime-chip">ciò che cambia.</span></>} lead="Ogni passo ha una responsabilità chiara e un confronto sul risultato. Il percorso si adatta alla realtà della tua impresa." headingId="metodo-cambia"><div className="rd-actions"><Cta href="/piattaforma">Scopri la Platform</Cta><TextLink href="/contatti">Parliamone ↗︎</TextLink></div></Section>
 <FaqSection items={publicFaqs['/metodo']} />
</main><SiteFooter/></>}
