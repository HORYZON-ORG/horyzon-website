import { AtlasVisual } from '@/components/atlas-visual';
import { PageStructuredData } from '@/components/structured-data';
import { FaqSection } from '@/components/faq-section';
import { publicFaqs } from '@/content/public-faq';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { RADAR_URL } from '@/content/product-truth';
import { Cta, PageHero, Section, TextLink, Tiles } from '@/components/kit';

const wellbeingAreas = [
 { number: '01', title: 'Benessere organizzativo', text: 'Persone, ruoli e processi che sanno dove andare e come contribuire.', href: '/benessere-organizzativo' },
 { number: '02', title: 'Benessere patrimoniale', text: 'Più chiarezza per proteggere ciò che hai costruito e scegliere con lucidità.', href: '/benessere-patrimoniale' },
 { number: '03', title: 'Benessere digitale', text: 'Tecnologia e AI che semplificano il lavoro, senza togliere controllo alle persone.', href: '/benessere-digitale' },
] as const;

export const metadata: Metadata = pageMetadata({ path: '/le-tre-aree', title: 'I tre benesseri per l’impresa', description: 'Benessere organizzativo, patrimoniale e digitale: tre dimensioni che aiutano l’impresa a crescere nella stessa direzione.' });

// Hero (ink) → the three areas as cards (cream) → one statement on the lime field → FAQ.
export default function WellbeingAreasPage(){return <><PageStructuredData path="/le-tre-aree" name="I tre benesseri" description="Benessere organizzativo, patrimoniale e digitale: tre dimensioni che aiutano l’impresa a crescere nella stessa direzione." breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'I tre benesseri', path: '/le-tre-aree' }]} faqs={publicFaqs['/le-tre-aree']} /><SiteHeader/><main id="content" className="rd rd-page editorial-page narrative-page site-frame" data-page="le-tre-aree">
 <PageHero crumbs={[{ name: 'Horyzon', href: '/' }, { name: 'I tre benesseri' }]} label="Horyzon / I tre benesseri" title={<>Tre modi per far stare bene <em>un’impresa.</em></>} lead="Organizzazione, patrimonio e digitale non sono mondi separati. Insieme aiutano l’impresa a lavorare con più chiarezza, equilibrio e futuro." aside={<AtlasVisual kind="system" />}><Cta href="#tre-benesseri" arrow="↓">Scopri le tre aree</Cta><TextLink href={RADAR_URL}>Inizia il Radar ↗︎</TextLink></PageHero>
 <Section id="tre-benesseri" tone="cream" label="Scegli il tuo punto di partenza" title="Da dove vuoi cominciare?" headingId="tre-benesseri-title"><Tiles items={wellbeingAreas.map(area => ({ tag: area.number, title: area.title, text: area.text, href: area.href, more: 'Scopri l’area' }))} /></Section>
 <Section tone="lime" label="Un’unica impresa" title={<>Le parti devono <span className="rd-lime-chip">lavorare insieme.</span></>} lead="Quando persone, patrimonio e strumenti si muovono nella stessa direzione, diventa più facile decidere, lavorare e costruire continuità." headingId="tre-aree-insieme"><div className="rd-actions"><Cta href={RADAR_URL}>Inizia il Radar</Cta><TextLink href="/metodo">Scopri come lavoriamo ↗︎</TextLink></div></Section>
 <FaqSection items={publicFaqs['/le-tre-aree']} />
</main><SiteFooter/></>}
