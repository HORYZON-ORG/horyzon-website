import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { PageStructuredData } from '@/components/structured-data';
import { DigitalLeadForm } from '@/components/digital-lead-form';
import { DigitalJourney, DigitalStoryboard } from '@/components/digital-storyboard';
import '../benessere-digitale/digital.css';
import '../benessere-digitale/premium.css';
import './funnel.css';

export const metadata: Metadata = {
 title: 'Architetti Digitali Horyzon | Semplifica il lavoro della tua azienda',
 description: 'Portiamo intelligenza artificiale e automazioni nel lavoro quotidiano della tua impresa. Partiamo da attività reali, realizziamo soluzioni pratiche e affianchiamo le persone.',
 alternates: { canonical: 'https://horyzon.it/architetti-digitali' },
};
export default function DigitalArchitectsPage(){
 return <>
  <PageStructuredData path="/architetti-digitali" name="Architetti Digitali Horyzon" description="AI e automazioni utili nel lavoro quotidiano delle imprese" breadcrumbs={[{name:'Horyzon',path:'/'},{name:'I tre benesseri',path:'/le-tre-aree'},{name:'Benessere Digitale',path:'/benessere-digitale'},{name:'Architetti Digitali',path:'/architetti-digitali'}]}/>
  <header className="ad-header"><div><Link href="/benessere-digitale" aria-label="Horyzon, Benessere Digitale"><Image src="/horyzon-logo-canonical.png" alt="Horyzon Consulting" width={1670} height={390} sizes="165px"/></Link><span>ARCHITETTI DIGITALI</span><a href="#parliamone">Richiedi un confronto <span aria-hidden="true">↗</span></a></div></header>
  <DigitalJourney><main id="content" className="bd ad-funnel">
  <section className="bd-hero bd-hero-story" aria-labelledby="digital-hero-title">
    <Image src="/digital-story/tempo-ritrovato.webp" alt="Due colleghi si confrontano serenamente in ufficio, con il portatile chiuso sulla scrivania." fill priority sizes="100vw" className="bd-hero-photo"/>
    <div className="bd-hero-overlay"/>
    <div className="bd-wrap bd-hero-story-inner">
      <div className="bd-hero-eyebrow"><span className="bd-hero-dot"/> HORYZON / ARCHITETTI DIGITALI</div>
      <div className="bd-intro">
        <p className="bd-hero-pretitle">AI E AUTOMAZIONI PER LA TUA AZIENDA.</p>
        <h1 id="digital-hero-title">Meno lavoro<br/>ripetitivo.<br/><em>Più tempo per<br/>ciò che conta.</em></h1>
        <p className="bd-lead">Gli Architetti Digitali Horyzon affiancano la tua azienda per semplificare email, documenti e attività ripetitive. Scegli un processo: iniziamo da quello che ti porta via tempo.</p>
        <div className="bd-actions"><a href="#attivita" className="bd-button">Scegli cosa semplificare <span aria-hidden="true">↓</span></a><a href="#parliamone" className="bd-textlink">Ho già un’esigenza ↗</a></div><ul className="bd-hero-assurance" aria-label="Il nostro approccio"><li>Partiamo dal tuo lavoro</li><li>Soluzioni su misura</li><li>Persone al centro</li></ul>
      </div>
      <div className="bd-hero-bottom"><p><span>IL PERCORSO È TUO</span>Scorri. Riconosciti. Scegli.</p><a href="#attivita" aria-label="Scopri le cinque attività"><span>5 situazioni quotidiane.<br/>Una richiesta costruita da te.</span><b aria-hidden="true">↓</b></a></div>
    </div>
  </section>
  <DigitalStoryboard/>
  <section className="bd-section bd-steps" id="come-funziona"><div className="bd-wrap"><p className="bd-kicker">02 / IL METODO HORYZON</p><h2>Dal lavoro di ogni giorno.<br/><em>A un modo migliore di farlo.</em></h2><p className="bd-method-lead">Una buona automazione nasce da un’attività concreta. La osserviamo, la semplifichiamo e la mettiamo alla prova con te.</p><div className="bd-timeline"><article><b>01</b><div><h3>Osserviamo</h3><p>Partiamo da una tua attività: chi la svolge, quali strumenti usa e dove il lavoro si inceppa.</p></div></article><article><b>02</b><div><h3>Costruiamo</h3><p>Progettiamo una soluzione adatta al processo, con accessi autorizzati e controlli chiari.</p></div></article><article><b>03</b><div><h3>Proviamo insieme</h3><p>La provi con il tuo team su casi reali. Le persone che la useranno partecipano fin dall’inizio.</p></div></article><article><b>04</b><div><h3>Verifichiamo</h3><p>Verifichiamo tempi, qualità e utilità. Poi decidiamo insieme cosa migliorare.</p></div></article></div></div></section>
  <section className="bd-section bd-light bd-people"><div className="bd-wrap bd-split"><div><p className="bd-kicker bd-dark">03 / ARCHITETTI DIGITALI</p><h2>La tecnologia aiuta.<br/><em>Le persone fanno<br/>la differenza.</em></h2><span className="bd-human-note">COMPETENZA TECNICA. ATTENZIONE UMANA.</span></div><div><p>Gli Architetti Digitali Horyzon affiancano il tuo team per trasformare un’esigenza in una soluzione pratica. Dalla scelta degli strumenti al loro utilizzo quotidiano, con qualcuno con cui confrontarsi.</p><p>Partiamo dalla Puglia e lavoriamo con aziende in tutta Italia, anche da remoto quando è la scelta più efficace.</p></div></div></section>
  <section className="bd-section ad-expect"><div className="bd-wrap"><p className="bd-kicker">IL PRIMO CONFRONTO</p><h2>Una tua attività.<br/><em>Un punto di partenza concreto.</em></h2><div className="ad-expect-grid"><p>Ci racconti come funziona oggi, quali strumenti usi e dove incontri difficoltà. Valutiamo insieme se e come possiamo aiutarti.</p><ul><li>Mettiamo a fuoco il processo e le priorità.</li><li>Individuiamo informazioni e strumenti da approfondire.</li><li>Se c’è un intervento utile, definiamo una proposta con ambito, tempi e costi.</li></ul></div></div></section>
  <section className="bd-section ad-faq"><div className="bd-wrap"><p className="bd-kicker">PRIMA DI COMINCIARE</p><h2>Le domande più semplici.<br/><em>Le risposte che servono.</em></h2><details><summary>Devo conoscere l’intelligenza artificiale?</summary><p>No. Parti da un’attività concreta. Ti aiutiamo a capire quali strumenti possono essere utili e come usarli nel tuo lavoro.</p></details><details><summary>Dobbiamo cambiare i programmi che usiamo?</summary><p>Valutiamo prima quelli che avete già. Collegamenti e automazioni dipendono dalle possibilità offerte dagli strumenti e dagli accessi autorizzati.</p></details><details><summary>Quanto costa un intervento?</summary><p>Dipende dal processo, dalle integrazioni e dall’affiancamento necessario. La proposta viene definita prima di avviare il lavoro; eventuali licenze sono indicate separatamente.</p></details><details><summary>Possiamo partire da una sola attività?</summary><p>Sì. Un processo circoscritto permette di provare la soluzione su casi reali e verificarne l’utilità prima di valutare altri interventi.</p></details></div></section>
  <section className="bd-section bd-contact" id="parliamone"><div className="bd-wrap bd-contact-inner"><p className="bd-kicker">PARLIAMO DELLA TUA AZIENDA</p><h2>Da quale attività<br/><em>vuoi cominciare?</em></h2><p>Scegli un’attività o raccontaci la tua esigenza. Capiremo insieme dove intervenire per primo.</p><DigitalLeadForm/><Link href="/benessere-digitale/radar" className="bd-textlink">Preferisci approfondire? Compila il Radar Benessere Digitale ↗</Link><p className="bd-footnote">Nessun risultato automatico è garantito: fattibilità, tempi e strumenti vengono definiti sul processo reale.</p></div></section>
 </main></DigitalJourney>
  <footer className="ad-footer"><div><Link href="/benessere-digitale">Scopri il Benessere Digitale Horyzon ↗</Link><p>Horyzon Consulting · FELICITÀ srl · P. IVA 05120660757</p><nav aria-label="Informazioni legali"><a href="https://www.iubenda.com/privacy-policy/64704330">Privacy</a><a href="https://www.iubenda.com/privacy-policy/64704330/cookie-policy">Cookie</a><Link href="/termini-condizioni">Termini e condizioni</Link></nav></div></footer>
 </>;
}
