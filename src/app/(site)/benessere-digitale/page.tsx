import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { PageStructuredData } from '@/components/structured-data';
import { DigitalLeadForm } from '@/components/digital-lead-form';
import { DigitalJourney, DigitalStoryboard } from '@/components/digital-storyboard';
import './digital.css';
import './premium.css';

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
    <Image src="/digital-story/tempo-ritrovato.webp" alt="Due colleghi si confrontano serenamente in ufficio, con il portatile chiuso sulla scrivania." fill priority sizes="100vw" className="bd-hero-photo"/>
    <div className="bd-hero-overlay"/>
    <div className="bd-wrap bd-hero-story-inner">
      <div className="bd-hero-eyebrow"><span className="bd-hero-dot"/> HORYZON / BENESSERE DIGITALE</div>
      <div className="bd-intro">
        <p className="bd-hero-pretitle">IL TUO TEMPO MERITA DI PIÙ.</p>
        <h1 id="digital-hero-title">Meno lavoro<br/>ripetitivo.<br/><em>Più tempo per<br/>ciò che conta.</em></h1>
        <p className="bd-lead">Le email da smistare. I dati da ricopiare. I preventivi da ricostruire. Semplifichiamo il lavoro che si ripete, per dare più spazio a quello che conta.</p>
        <div className="bd-actions"><a href="#attivita" className="bd-button">Scegli cosa semplificare <span aria-hidden="true">↓</span></a><a href="#parliamone" className="bd-textlink">Ho già un’esigenza ↗</a></div><ul className="bd-hero-assurance" aria-label="Il nostro approccio"><li>Partiamo dal tuo lavoro</li><li>Soluzioni su misura</li><li>Persone al centro</li></ul>
      </div>
      <div className="bd-hero-bottom"><p><span>IL PERCORSO È TUO</span>Scorri. Riconosciti. Scegli.</p><a href="#attivita" aria-label="Scopri le cinque attività"><span>5 situazioni quotidiane.<br/>Una richiesta costruita da te.</span><b aria-hidden="true">↓</b></a></div>
    </div>
  </section>
  <DigitalStoryboard/>
  <section className="bd-section bd-steps" id="come-funziona"><div className="bd-wrap"><p className="bd-kicker">02 / IL METODO HORYZON</p><h2>Dal lavoro di ogni giorno.<br/><em>A un modo migliore di farlo.</em></h2><p className="bd-method-lead">Una buona automazione nasce da un’attività concreta. La osserviamo, la semplifichiamo e la mettiamo alla prova con te.</p><div className="bd-timeline"><article><b>01</b><div><h3>Osserviamo</h3><p>Partiamo da una tua attività: chi la svolge, quali strumenti usa e dove il lavoro si inceppa.</p></div></article><article><b>02</b><div><h3>Costruiamo</h3><p>Progettiamo una soluzione adatta al processo, con accessi autorizzati e controlli chiari.</p></div></article><article><b>03</b><div><h3>Proviamo insieme</h3><p>La provi con il tuo team su casi reali. Le persone che la useranno partecipano fin dall’inizio.</p></div></article><article><b>04</b><div><h3>Verifichiamo</h3><p>Verifichiamo tempi, qualità e utilità. Poi decidiamo insieme cosa migliorare.</p></div></article></div></div></section>
  <section className="bd-section bd-light bd-people"><div className="bd-wrap bd-split"><div><p className="bd-kicker bd-dark">03 / ARCHITETTI DIGITALI</p><h2>La tecnologia aiuta.<br/><em>Le persone fanno<br/>la differenza.</em></h2><span className="bd-human-note">COMPETENZA TECNICA. ATTENZIONE UMANA.</span></div><div><p>Gli Architetti Digitali Horyzon affiancano il tuo team per trasformare un’esigenza in una soluzione pratica. Dalla scelta degli strumenti al loro utilizzo quotidiano, con qualcuno con cui confrontarsi.</p><p>Partiamo dalla Puglia e lavoriamo con aziende in tutta Italia, anche da remoto quando è la scelta più efficace.</p></div></div></section>
  <section className="bd-section bd-contact" id="parliamone"><div className="bd-wrap bd-contact-inner"><p className="bd-kicker">04 / IL PRIMO PASSO</p><h2>Da quale attività<br/><em>vuoi cominciare?</em></h2><p>Scegli un’attività o raccontaci la tua esigenza. Capiremo insieme dove intervenire per primo.</p><DigitalLeadForm/><Link href="/benessere-digitale/radar" className="bd-textlink">Preferisci approfondire? Compila il Radar Benessere Digitale ↗</Link><p className="bd-footnote">Nessun risultato automatico è garantito: fattibilità, tempi e strumenti vengono definiti sul processo reale.</p></div></section>
 </main></DigitalJourney>
  <SiteFooter/>
 </>;
}
