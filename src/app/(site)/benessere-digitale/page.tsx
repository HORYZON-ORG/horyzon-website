import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { PageStructuredData } from '@/components/structured-data';
import { DigitalLeadForm } from '@/components/digital-lead-form';
import { DigitalJourney, DigitalStoryboard, SceneVideo } from '@/components/digital-storyboard';
import './digital.css';

export const metadata: Metadata = {
 title: 'Benessere Digitale | AI e automazioni in azienda — Horyzon',
 description: 'Portiamo intelligenza artificiale e automazioni nel lavoro quotidiano della tua impresa. Partiamo da attività reali, realizziamo soluzioni pratiche e affianchiamo le persone.',
 alternates: { canonical: 'https://horyzon.it/benessere-digitale' },
};
export default function DigitalWellbeingPage(){
 return <>
  <PageStructuredData path="/benessere-digitale" name="Benessere Digitale" description="AI e automazioni utili nel lavoro quotidiano delle imprese" breadcrumbs={[{name:'Horyzon',path:'/'},{name:'I tre benesseri',path:'/le-tre-aree'},{name:'Benessere Digitale',path:'/benessere-digitale'}]}/>
  <SiteHeader/>
  <DigitalJourney><main id="content" className="bd">
  <section className="bd-hero bd-hero-story" aria-labelledby="digital-hero-title">
    <SceneVideo id="hero" label="Il lavoro quotidiano in azienda"/>
    <div className="bd-hero-overlay"/>
    <div className="bd-wrap bd-hero-story-inner">
      <div className="bd-hero-eyebrow"><span className="bd-hero-dot"/> HORYZON / BENESSERE DIGITALE</div>
      <div className="bd-intro">
        <p className="bd-hero-pretitle">AI E AUTOMAZIONI, NEL TUO LAVORO.</p>
        <h1 id="digital-hero-title">Meno lavoro<br/>ripetitivo.<br/><em>Più tempo per<br/>ciò che conta.</em></h1>
        <p className="bd-lead">Email, documenti, preventivi. Le attività si ripetono. Il tuo tempo no. Scopri cosa possiamo semplificare e scegli da dove partire.</p>
        <div className="bd-actions"><a href="#attivita" className="bd-button">Scegli cosa semplificare <span aria-hidden="true">↓</span></a><a href="#parliamone" className="bd-textlink">Ho già un’esigenza ↗</a></div>
      </div>
      <div className="bd-hero-bottom"><p><span>IL PERCORSO È TUO</span>Scorri. Riconosciti. Scegli.</p><a href="#attivita" aria-label="Scopri le cinque attività"><span>5 situazioni quotidiane.<br/>Una richiesta costruita da te.</span><b aria-hidden="true">↓</b></a></div>
    </div>
  </section>
  <DigitalStoryboard/>
  <section className="bd-section bd-steps" id="come-funziona"><div className="bd-wrap"><p className="bd-kicker">02 / IL METODO HORYZON</p><h2>Non solo consigli. <em>Ci mettiamo al lavoro.</em></h2><div className="bd-timeline"><article><b>01</b><div><h3>Osserviamo</h3><p>Ci fai vedere un’attività concreta: chi la svolge, con quali strumenti e dove perde tempo.</p></div></article><article><b>02</b><div><h3>Costruiamo</h3><p>Configuriamo l’AI o una procedura guidata, con accessi autorizzati e controlli adatti al processo.</p></div></article><article><b>03</b><div><h3>Proviamo insieme</h3><p>Il tuo team utilizza la soluzione su esempi reali e ne verifica il risultato.</p></div></article><article><b>04</b><div><h3>Verifichiamo</h3><p>Misuriamo l’utilità effettiva e capiamo cosa migliorare nel passo successivo.</p></div></article></div></div></section>
  <section className="bd-section bd-light"><div className="bd-wrap bd-split"><div><p className="bd-kicker bd-dark">03 / ARCHITETTI DIGITALI</p><h2>Persone al fianco <em>delle persone.</em></h2></div><div><p>Gli Architetti Digitali Horyzon portano competenze tecniche direttamente nei processi aziendali: dall’impostazione di strumenti AI alla progettazione di automazioni, sempre con un obiettivo comprensibile.</p><p>Partiamo dalla Puglia e lavoriamo con aziende in tutta Italia, anche da remoto quando è la scelta più efficace.</p></div></div></section>
  <section className="bd-section bd-contact" id="parliamone"><div className="bd-wrap bd-contact-inner"><p className="bd-kicker">04 / IL PRIMO PASSO</p><h2>Quale lavoro ripetitivo vorresti <em>non dover più rifare?</em></h2><p>Raccontaci il problema, anche senza conoscere gli strumenti tecnici. Partiamo da quello che succede davvero nella tua azienda.</p><DigitalLeadForm/><Link href="/benessere-digitale/radar" className="bd-textlink">Preferisci approfondire? Compila il Radar Benessere Digitale ↗</Link><p className="bd-footnote">Nessun risultato automatico è garantito: fattibilità, tempi e strumenti vengono definiti sul processo reale.</p></div></section>
 </main></DigitalJourney>
  <SiteFooter/>
 </>;
}
