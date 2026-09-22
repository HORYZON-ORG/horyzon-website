import { AtlasVisual } from '@/components/atlas-visual';
import { publicFaqs } from '@/content/public-faq';
import { FaqSection } from '@/components/faq-section';
import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { RadarStory } from '@/components/radar-story';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { RADAR_URL } from '@/content/product-truth';

export const metadata: Metadata = pageMetadata({ path: '/radar-impresa', title: 'Radar d’Impresa', description: 'Leggi cinque reparti, maturità dei processi, autonomia del titolare e adozione dell’AI.' });
const outputs = [['Come lavora l’impresa','Una lettura d’insieme delle aree che sostengono il lavoro quotidiano.'],['Dove si concentra il peso','I punti in cui decisioni, tempo e responsabilità tornano troppo spesso al titolare.'],['Da dove cominciare','Un primo tema su cui aprire un confronto utile e concreto.']];

export default function RadarPage() {
 return <><PageStructuredData path="/radar-impresa" name="Radar d’Impresa" description="Leggi cinque reparti, maturità dei processi, autonomia del titolare e adozione dell’AI." breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'Radar d’Impresa', path: '/radar-impresa' }]} faqs={publicFaqs['/radar-impresa']} /><SiteHeader/><main id="content" className="inside editorial-page narrative-page" data-page="radar-impresa"><nav className="editorial-breadcrumb" aria-label="Percorso di navigazione"><Link href="/">Horyzon</Link><span aria-hidden="true">/</span><span aria-current="page">Radar d’Impresa</span></nav><section className="inside-hero"><div><p className="eyebrow"><span/>Horyzon / Radar d’Impresa</p><h1>Leggi la tua impresa prima di cambiarla.</h1><p className="page-intro">Hai la sensazione che tutto passi da te? Il Radar aiuta a capire dove il lavoro rallenta e da quale reparto cominciare.</p><div className="editorial-hero-actions"><a className="button primary" href={RADAR_URL}>Inizia il Radar <span aria-hidden="true">↗</span></a><a className="text-link" href="#pagina-contenuti">Scopri che cosa misura ↓</a></div><p className="fine-print">L’assessment si apre in Horyzon Hub.</p></div><AtlasVisual kind="radar" /></section><div id="pagina-contenuti" className="editorial-body"/>
 <section className="narrative-section"><header><p className="section-kicker">Un primo sguardo</p><h2>Fermarsi. Osservare. Fare chiarezza.</h2><p className="narrative-lede">Il Radar guarda le parti dell’impresa che più spesso rallentano il lavoro. Non dà una risposta preconfezionata: aiuta a iniziare dalla domanda giusta.</p></header><RadarStory/></section>
 <section className="narrative-section"><header><p className="section-kicker">Dopo il Radar</p><h2>Che cosa ti aiuta a vedere.</h2></header><div className="output-list">{outputs.map(([title,description])=><article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div></section>
 <section className="narrative-section"><header><p className="section-kicker">Il passo successivo</p><h2>Il risultato apre una conversazione.</h2></header><p className="narrative-lede">Dopo il Radar possiamo guardare insieme ciò che emerge e capire se, e da dove, ha senso proseguire.</p><div className="narrative-actions"><a className="button primary" href={RADAR_URL}>Inizia il Radar <span aria-hidden="true">↗</span></a><Link className="text-link" href="/contatti">Parliamone ↗</Link></div></section><FaqSection items={publicFaqs['/radar-impresa']} /></main><SiteFooter/></>;
}
