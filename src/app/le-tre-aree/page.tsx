import { AtlasVisual } from '@/components/atlas-visual';
import { PageStructuredData } from '@/components/structured-data';
import { FaqSection } from '@/components/faq-section';
import { publicFaqs } from '@/content/public-faq';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { RADAR_URL } from '@/content/product-truth';

const wellbeingAreas = [
 { number: '01', title: 'Benessere organizzativo', text: 'Persone, ruoli e processi che sanno dove andare e come contribuire.', href: '/benessere-organizzativo' },
 { number: '02', title: 'Benessere patrimoniale', text: 'Più chiarezza per proteggere ciò che hai costruito e scegliere con lucidità.', href: '/benessere-patrimoniale' },
 { number: '03', title: 'Benessere digitale', text: 'Tecnologia e AI che semplificano il lavoro, senza togliere controllo alle persone.', href: '/benessere-digitale' },
] as const;

export const metadata: Metadata = pageMetadata({ path: '/le-tre-aree', title: 'I tre benesseri per l’impresa', description: 'Benessere organizzativo, patrimoniale e digitale: tre dimensioni che aiutano l’impresa a crescere nella stessa direzione.' });

export default function WellbeingAreasPage(){return <><PageStructuredData path="/le-tre-aree" name="I tre benesseri" description="Benessere organizzativo, patrimoniale e digitale: tre dimensioni che aiutano l’impresa a crescere nella stessa direzione." breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'I tre benesseri', path: '/le-tre-aree' }]} faqs={publicFaqs['/le-tre-aree']} /><SiteHeader/><main id="content" className="inside editorial-page narrative-page" data-page="le-tre-aree"><nav className="editorial-breadcrumb" aria-label="Percorso di navigazione"><Link href="/">Horyzon</Link><span aria-hidden="true">/</span><span aria-current="page">I tre benesseri</span></nav><section className="inside-hero"><div><p className="eyebrow"><span/>Horyzon / I tre benesseri</p><h1>Tre modi per far stare bene un’impresa.</h1><p className="page-intro">Organizzazione, patrimonio e digitale non sono mondi separati. Insieme aiutano l’impresa a lavorare con più chiarezza, equilibrio e futuro.</p><div className="editorial-hero-actions"><a className="button primary" href="#tre-benesseri">Scopri le tre aree ↓</a><a className="text-link" href={RADAR_URL}>Inizia il Radar ↗</a></div></div><AtlasVisual kind="system" /></section><div className="editorial-body"/><section className="narrative-section" id="tre-benesseri"><header><p className="section-kicker">Scegli il tuo punto di partenza</p><h2>Da dove vuoi cominciare?</h2></header><div className="wellbeing-area-grid">{wellbeingAreas.map(area=><Link className="wellbeing-area-card" href={area.href} key={area.href}><span>{area.number}</span><h3>{area.title}</h3><p>{area.text}</p><b>Scopri l’area <i aria-hidden="true">↗</i></b></Link>)}</div></section><section className="narrative-section wellbeing-connection"><header><p className="section-kicker">Un’unica impresa</p><h2>Le parti devono lavorare insieme.</h2></header><p className="narrative-lede">Quando persone, patrimonio e strumenti si muovono nella stessa direzione, diventa più facile decidere, lavorare e costruire continuità.</p><div className="narrative-actions"><a className="button primary" href={RADAR_URL}>Inizia il Radar ↗</a><Link className="text-link" href="/metodo">Scopri come lavoriamo ↗</Link></div></section><FaqSection items={publicFaqs['/le-tre-aree']} /></main><SiteFooter/></>}
