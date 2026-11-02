import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { PageStructuredData } from '@/components/structured-data';
import { DigitalLeadForm } from '@/components/digital-lead-form';
import './digital.css';

export const metadata: Metadata = {
 title: 'Benessere Digitale | AI e automazioni in azienda — Horyzon',
 description: 'Portiamo intelligenza artificiale e automazioni nel lavoro quotidiano della tua impresa. Partiamo da attività reali, realizziamo soluzioni pratiche e affianchiamo le persone.',
 alternates: { canonical: 'https://horyzon.it/benessere-digitale' },
};
const examples=[
 ['01','Email e richieste','Meno tempo a rileggere, ricopiare e preparare le stesse risposte.'],
 ['02','Documenti e preventivi','Dalle informazioni sparse a bozze ordinate e verificabili.'],
 ['03','Report e attività','Riunioni, visite e dati trasformati in azioni chiare.'],
 ['04','Software e processi','Colleghiamo gli strumenti quando serve davvero, senza aggiungere complessità inutile.'],
];
export default function DigitalWellbeingPage(){
 return <>
  <PageStructuredData path="/benessere-digitale" name="Benessere Digitale" description="AI e automazioni utili nel lavoro quotidiano delle imprese" breadcrumbs={[{name:'Horyzon',path:'/'},{name:'I tre benesseri',path:'/le-tre-aree'},{name:'Benessere Digitale',path:'/benessere-digitale'}]}/>
  <SiteHeader/>
  <main id="content" className="bd">
  <section className="bd-hero"><div className="bd-wrap bd-hero-grid"><div className="bd-intro"><p className="bd-kicker">HORYZON / BENESSERE DIGITALE</p><h1>Il tempo delle persone vale <em>più di un copia e incolla.</em></h1><p className="bd-lead">L’intelligenza artificiale diventa utile quando entra nel lavoro di tutti i giorni. Osserviamo le attività ripetitive, costruiamo soluzioni pratiche e aiutiamo il tuo team a usarle davvero.</p><div className="bd-actions"><a href="#parliamone" className="bd-button">Raccontaci cosa vuoi semplificare <span aria-hidden="true">↗</span></a><a href="#come-funziona" className="bd-textlink">Scopri come lavoriamo ↓</a></div></div><div className="bd-visual" aria-label="Visualizzazione illustrativa di attività ripetitive che diventano un flusso più semplice" role="img"><div className="bd-orbit bd-orbit-a"/><div className="bd-orbit bd-orbit-b"/><div className="bd-core"><span>AI</span><small>al servizio delle persone</small></div><span className="bd-node bd-node-a">EMAIL</span><span className="bd-node bd-node-b">DOCUMENTI</span><span className="bd-node bd-node-c">REPORT</span><span className="bd-node bd-node-d">TEMPO</span><div className="bd-pulse"/></div></div></section>
  <section className="bd-section bd-light" id="cosa-cambia"><div className="bd-wrap"><p className="bd-kicker bd-dark">01 / PARTIAMO DALLA REALTÀ</p><h2>La tecnologia migliore è quella che <em>ti toglie lavoro inutile.</em></h2><p className="bd-section-lead">Non proponiamo automazioni a caso. Partiamo da ciò che il tuo ufficio fa ogni giorno e troviamo dove strumenti, persone e informazioni possono lavorare meglio insieme.</p><div className="bd-cards">{examples.map(([n,title,body])=><article className="bd-card" key={n}><span>{n} /</span><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
  <section className="bd-section bd-steps" id="come-funziona"><div className="bd-wrap"><p className="bd-kicker">02 / IL METODO HORYZON</p><h2>Non solo consigli. <em>Ci mettiamo al lavoro.</em></h2><div className="bd-timeline"><article><b>01</b><div><h3>Osserviamo</h3><p>Ci fai vedere un’attività concreta: chi la svolge, con quali strumenti e dove perde tempo.</p></div></article><article><b>02</b><div><h3>Costruiamo</h3><p>Configuriamo l’AI o una procedura guidata, con accessi autorizzati e controlli adatti al processo.</p></div></article><article><b>03</b><div><h3>Proviamo insieme</h3><p>Il tuo team utilizza la soluzione su esempi reali e ne verifica il risultato.</p></div></article><article><b>04</b><div><h3>Verifichiamo</h3><p>Misuriamo l’utilità effettiva e capiamo cosa migliorare nel passo successivo.</p></div></article></div></div></section>
  <section className="bd-section bd-light"><div className="bd-wrap bd-split"><div><p className="bd-kicker bd-dark">03 / ARCHITETTI DIGITALI</p><h2>Persone al fianco <em>delle persone.</em></h2></div><div><p>Gli Architetti Digitali Horyzon portano competenze tecniche direttamente nei processi aziendali: dall’impostazione di strumenti AI alla progettazione di automazioni, sempre con un obiettivo comprensibile.</p><p>Partiamo dalla Puglia e lavoriamo con aziende in tutta Italia, anche da remoto quando è la scelta più efficace.</p></div></div></section>
  <section className="bd-section bd-contact" id="parliamone"><div className="bd-wrap bd-contact-inner"><p className="bd-kicker">04 / IL PRIMO PASSO</p><h2>Quale lavoro ripetitivo vorresti <em>non dover più rifare?</em></h2><p>Raccontaci il problema, anche senza conoscere gli strumenti tecnici. Partiamo da quello che succede davvero nella tua azienda.</p><DigitalLeadForm/><p className="bd-footnote">Nessun risultato automatico è garantito: fattibilità, tempi e strumenti vengono definiti sul processo reale.</p></div></section>
 </main>
  <SiteFooter/>
 </>;
}
