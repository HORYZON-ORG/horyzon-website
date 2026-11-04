import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { PageStructuredData } from '@/components/structured-data';
import './digital.css';
import './premium.css';
import './showcase.css';

export const metadata: Metadata = {
  title: 'Benessere Digitale | Persone, strumenti e lavoro — Horyzon',
  description: 'Il Benessere Digitale Horyzon unisce persone, competenze e tecnologia per rendere il lavoro più semplice, consapevole e sostenibile.',
  alternates: { canonical: 'https://horyzon.it/benessere-digitale' },
};
const pillars = [
  ['01', 'Persone', 'Strumenti che aiutano a lavorare meglio.', 'La tecnologia è utile quando le persone la comprendono e riescono a usarla con fiducia. Ascolto e affiancamento fanno parte del cambiamento.'],
  ['02', 'Processi', 'Meno passaggi. Più chiarezza.', 'Osserviamo come circolano attività e informazioni: dove si ripetono i compiti, dove si interrompe il flusso e cosa può diventare più semplice.'],
  ['03', 'Competenze', 'Conoscere per scegliere.', 'L’uso consapevole degli strumenti digitali e dell’AI aiuta a riconoscerne possibilità e limiti, con attenzione ai dati e alla qualità del lavoro.'],
];
const areas = [
  ['AI nel lavoro quotidiano', 'Dare ordine alle informazioni, preparare bozze e affiancare le persone nelle attività di ogni giorno.'],
  ['Automazioni e collegamenti', 'Ridurre i passaggi ripetitivi e collegare gli strumenti quando il processo e gli accessi lo permettono.'],
  ['Informazioni e organizzazione', 'Rendere documenti, dati e attività più facili da trovare, condividere e utilizzare.'],
  ['Formazione e affiancamento', 'Accompagnare il team nell’utilizzo degli strumenti, con esempi reali e un linguaggio comprensibile.'],
];
export default function DigitalWellbeingPage() {
  return <>
    <PageStructuredData path="/benessere-digitale" name="Benessere Digitale Horyzon" description="Persone, competenze e tecnologia per lavorare meglio" breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'I tre benesseri', path: '/le-tre-aree' }, { name: 'Benessere Digitale', path: '/benessere-digitale' }]} />
    <SiteHeader />
    <main id="content" className="bd bd-showcase">
      <section className="bd-hero bd-hero-story bs-hero" aria-labelledby="showcase-title">
        <Image src="/digital-story/tempo-ritrovato.webp" alt="Due colleghi si confrontano in un ufficio luminoso, con il portatile chiuso." fill priority sizes="100vw" className="bd-hero-photo" />
        <div className="bd-hero-overlay" />
        <div className="bd-wrap bd-hero-story-inner">
          <p className="bd-hero-eyebrow"><span className="bd-hero-dot" /> HORYZON / BENESSERE DIGITALE</p>
          <div><p className="bd-hero-pretitle">UNO DEI TRE BENESSERI DELL’IMPRESA</p><h1 id="showcase-title">Più umanità.<br/><em>Anche nel<br/>mondo digitale.</em></h1><p className="bd-lead">Persone, strumenti e competenze che lavorano bene insieme. Per Horyzon, il benessere digitale comincia da qui.</p><div className="bd-actions"><a href="#visione" className="bd-button">Scopri la nostra visione <span aria-hidden="true">↓</span></a><Link href="/le-tre-aree" className="bd-textlink">I tre benesseri Horyzon ↗</Link></div></div>
          <div className="bd-hero-bottom"><p><span>IL DIGITALE AL SERVIZIO DELLE PERSONE</span>Più spazio per lavorare bene.</p><a href="#visione" aria-label="Scopri il Benessere Digitale"><b aria-hidden="true">↓</b></a></div>
        </div>
      </section>
      <section className="bd-section bs-vision" id="visione"><div className="bd-wrap bs-editorial"><p className="bd-kicker">LA NOSTRA VISIONE</p><div><h2>Stare meglio nel digitale.<br/><em>Per lavorare meglio, insieme.</em></h2><p>Il benessere digitale riguarda il rapporto tra le persone e la tecnologia. Entra nel modo in cui comunichiamo, troviamo le informazioni, prendiamo decisioni e organizziamo il lavoro.</p><p>Quando strumenti e processi sono comprensibili, le persone possono dedicare più attenzione al proprio contributo. Il nostro impegno è costruire queste condizioni, un passo alla volta.</p></div></div></section>
      <section className="bd-section bs-pillars"><div className="bd-wrap"><p className="bd-kicker">TRE ELEMENTI, UN EQUILIBRIO</p><div className="bs-pillar-grid">{pillars.map(([n, name, title, text]) => <article key={n}><span className="bs-number">{n}</span><p className="bs-label">{name}</p><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
      <section className="bd-section bs-areas" id="ambiti"><div className="bd-wrap bs-editorial"><div><p className="bd-kicker">DOVE PRENDE FORMA</p><h2>La tecnologia incontra<br/><em>il lavoro reale.</em></h2><p className="bs-aside">Ogni impresa ha una storia, strumenti e abitudini propri. Partiamo da questi per capire quali interventi possono essere utili.</p></div><div className="bs-area-list">{areas.map(([title, text], i) => <article key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>
      <section className="bd-section bd-light bd-people"><div className="bd-wrap bd-split"><div><p className="bd-kicker bd-dark">GLI ARCHITETTI DIGITALI HORYZON</p><h2>Un volto umano.<br/><em>Una competenza<br/>concreta.</em></h2></div><div><p>Gli Architetti Digitali affiancano le aziende nel passaggio dalla comprensione di un’esigenza all’utilizzo quotidiano di una soluzione. Ascoltano, progettano e accompagnano le persone nel cambiamento.</p><p>La relazione continua nella prova sul lavoro reale: verificare l’utilità, raccogliere il riscontro del team e capire cosa migliorare.</p><Link className="bs-inline-link" href="/architetti-digitali">Scopri come possono aiutare la tua azienda ↗</Link></div></div></section>
      <section className="bd-section bs-next" id="parliamone"><div className="bd-wrap"><p className="bd-kicker">DALLA VISIONE AL TUO LAVORO</p><h2>Conosci il nostro approccio.<br/><em>Trova il tuo punto di partenza.</em></h2><div className="bs-next-grid" id="attivita"><article><span className="bs-label">PER LA TUA AZIENDA</span><h3>C’è un’attività che vorresti semplificare?</h3><p>Esplora i casi di lavoro quotidiano e costruisci una richiesta da approfondire con gli Architetti Digitali.</p><Link href="/architetti-digitali" className="bd-button">Scopri cosa possiamo fare <span aria-hidden="true">↗</span></Link></article><article><span className="bs-label">PER ORIENTARTI</span><h3>Vuoi osservare il tuo equilibrio digitale?</h3><p>Il Radar Benessere Digitale ti aiuta a riflettere su abitudini, strumenti e organizzazione del lavoro.</p><Link href="/benessere-digitale/radar" className="bd-textlink">Esplora il Radar Benessere Digitale ↗</Link></article></div></div></section>
    </main>
    <SiteFooter />
  </>;
}
