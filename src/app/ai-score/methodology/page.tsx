import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';

const description = 'Scopri cosa misura Horyzon AI Score e perché la valutazione distingue predisposizione, visibilità AI e solidità delle evidenze.';
const publicVersion = 'Horyzon AI Score v1.0';

const measures = [
  {
    id: '01',
    title: 'AI Readiness',
    copy: 'Misura quanto il sito è predisposto a essere correttamente scoperto, interpretato e utilizzato dai sistemi di ricerca e AI.',
  },
  {
    id: '02',
    title: 'AI Visibility',
    copy: 'Misura quanto il brand emerge e viene citato nelle diverse superfici di ricerca AI effettivamente analizzate.',
    note: 'Se una superficie non può essere realmente verificata, non viene simulato alcun risultato.',
  },
  {
    id: '03',
    title: 'Evidence Confidence',
    copy: 'Indica quanto sono complete e affidabili le evidenze disponibili per la valutazione.',
    note: 'Una confidence più bassa non significa necessariamente un sito peggiore: indica una misurazione meno completa.',
  },
];

const readinessAreas = [
  ['01', 'Accessibilità e indicizzazione', 'Verifichiamo che il sito e i suoi contenuti principali possano essere raggiunti e interpretati correttamente dai sistemi automatici.'],
  ['02', 'Qualità e citabilità dei contenuti', 'Valutiamo quanto le informazioni siano chiare, specifiche, strutturate e utilizzabili come fonte.'],
  ['03', 'Identità e chiarezza semantica', "Verifichiamo quanto sia comprensibile chi è l'organizzazione, cosa offre, a chi si rivolge e quali competenze rappresenta."],
  ['04', 'Dati strutturati', 'Analizziamo i segnali machine-readable che aiutano sistemi di ricerca e AI a interpretare correttamente informazioni ed entità.'],
  ['05', 'Autorevolezza ed evidenze', 'Cerchiamo segnali che rendano identità, informazioni e affermazioni verificabili e riconducibili a fonti chiare.'],
  ['06', 'Qualità tecnica', "Consideriamo alcuni elementi tecnici che incidono sull'accessibilità, sulla leggibilità e sulla corretta interpretazione del sito."],
  ['07', 'Aggiornamento dei contenuti', 'Valutiamo segnali che aiutano a capire se le informazioni vengono mantenute coerenti e aggiornate nel tempo.'],
  ['08', 'Predisposizione ai sistemi AI', "Verifichiamo alcuni segnali specifici che possono facilitare l'accesso e l'interpretazione dei contenuti da parte dei sistemi AI."],
  ['09', 'Presenza esterna del brand', "Quando misurabile, verifichiamo quanto l'identità e l'attività dell'organizzazione trovino riscontro anche in fonti esterne al proprio sito."],
] as const;

const supportedSurfaces = [
  ['AI Visibility', 'OpenAI Web Search', 'Not configured', 'FREE_QUICK_SCAN misura prompt brand, categoria, servizio, problema e discovery solo quando un provider reale e configurato.'],
  ['External Brand Footprint', 'Perplexity Search API', 'Not configured', 'FREE_EXTERNAL_FOOTPRINT osserva fonti esterne quando il provider e configurato; la quantita di risultati non equivale automaticamente ad autorevolezza.'],
  ['Legacy cleanup', 'Microsoft Bing', 'Not configured', 'Bing Search APIs legacy non sono piu usate: eventuali provider futuri saranno valutati con adapter e contratti aggiornati.'],
] as const;

export const metadata: Metadata = pageMetadata({ path: '/ai-score/methodology', title: 'Come funziona Horyzon AI Score', description });

export default function AiScoreMethodologyPage() {
  return <>
    <PageStructuredData path="/ai-score/methodology" name="Come funziona Horyzon AI Score" description={description} breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'AI Score', path: '/ai-score' }, { name: 'Come funziona', path: '/ai-score/methodology' }]} />
    <SiteHeader />
    <main id="content" className="rd ai-score-methodology-page" data-page="ai-score-methodology">
      <section className="rd-hero rd-hero-page ai-method-hero" aria-labelledby="ai-method-title">
        <div className="rd-hero-copy">
          <nav className="rd-crumbs" aria-label="Percorso di navigazione">
            <Link href="/">Horyzon</Link><span aria-hidden="true">/</span>
            <Link href="/ai-score">AI Score</Link><span aria-hidden="true">/</span>
            <span aria-current="page">Come funziona</span>
          </nav>
          <p className="rd-label rd-rise">AI Score <i>·</i> Metodologia <i>·</i> {publicVersion}</p>
          <h1 id="ai-method-title">
            <span className="rd-mask"><span className="rd-line">Come funziona</span></span>
            <span className="rd-mask"><span className="rd-line rd-accent">Horyzon AI Score.</span></span>
          </h1>
          <p className="rd-lead rd-rise">Analizziamo quanto un sito è predisposto a essere scoperto, compreso e utilizzato dai sistemi AI e, quando disponibile, quanto il brand emerge nelle superfici di ricerca AI.</p>
          <p className="ai-method-sublead rd-rise">La valutazione combina segnali tecnici, contenutistici, semantici e di autorevolezza attraverso una metodologia Horyzon basata su evidenze verificabili.</p>
          <div className="rd-actions rd-rise">
            <Link className="rd-cta" href="/ai-score">Analizza il tuo sito <span aria-hidden="true">→</span></Link>
            <a className="rd-link" href="#misure">Vedi cosa misuriamo</a>
          </div>
        </div>

        <aside className="rd-hero-aside">
          <figure className="rd-index ai-method-index">
            <figcaption>Metodo / tre letture</figcaption>
            <ol>
              <li><b>01</b><span>AI Readiness</span></li>
              <li><b>02</b><span>AI Visibility</span></li>
              <li><b>03</b><span>Evidence Confidence</span></li>
            </ol>
            <p>Tre misure separate per non confondere predisposizione, presenza reale e qualità delle evidenze.</p>
          </figure>
        </aside>
      </section>

      <section id="misure" className="rd-map ai-method-measures-section" aria-labelledby="ai-method-measures-title">
        <header className="ai-method-section-head rd-reveal">
          <p className="rd-label">La valutazione</p>
          <h2 id="ai-method-measures-title">Tre misure. <span>Tre significati diversi.</span></h2>
        </header>
        <ul className="rd-tiles ai-method-measure-grid">
          {measures.map((measure, index) => <li key={measure.id} className="rd-reveal" style={{ '--i': index } as React.CSSProperties}>
            <article className="rd-tile">
              <span className="rd-tile-tag">{measure.id}</span>
              <h3>{measure.title}</h3>
              <p>{measure.copy}</p>
              {measure.note && <p className="ai-method-card-note">{measure.note}</p>}
            </article>
          </li>)}
        </ul>
      </section>

      <section className="rd-section rd-tone-cream ai-method-readiness" aria-labelledby="ai-method-readiness-title">
        <header className="rd-head">
          <p className="rd-label">AI Readiness</p>
          <h2 id="ai-method-readiness-title" className="rd-h2">Cosa analizziamo</h2>
          <p className="rd-head-lead">AI Readiness considera diverse dimensioni del sito. Insieme descrivono quanto le informazioni siano accessibili, comprensibili e verificabili dai sistemi automatici.</p>
        </header>
        <div className="ai-method-areas">
          {readinessAreas.map(([number, title, copy]) => <article className="rd-tile" key={number}>
            <span className="rd-tile-tag">{number}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>)}
        </div>
      </section>

      <section className="rd-section rd-tone-ink ai-method-principle" aria-labelledby="ai-method-principle-title">
        <div className="ai-method-principle-copy">
          <p className="rd-label">Il nostro principio</p>
          <h2 id="ai-method-principle-title" className="rd-h2">Misuriamo solo ciò che possiamo <em>verificare.</em></h2>
          <p className="rd-section-lead">Quando un segnale non può essere realmente osservato, non inventiamo un risultato. La metrica viene indicata come non misurata e il livello di confidence tiene conto delle evidenze effettivamente disponibili.</p>
          <p className="ai-method-principle-extra">Questo mantiene separati ciò che sappiamo, ciò che possiamo misurare e ciò che non è ancora verificabile.</p>
        </div>
        <aside className="ai-method-principle-card" aria-label="Principio metodologico">
          <span className="rd-label">Trasparenza</span>
          <strong>Not measured</strong>
          <p>Non è un punteggio basso. È una dichiarazione di trasparenza quando una misurazione non ha evidenze sufficienti.</p>
        </aside>
      </section>

      <section className="rd-section rd-tone-sand ai-method-providers" aria-labelledby="ai-method-providers-title">
        <header className="rd-head">
          <p className="rd-label">Provider</p>
          <h2 id="ai-method-providers-title" className="rd-h2">Superfici supportate</h2>
          <p className="rd-head-lead">Le superfici esterne restano fail-closed finche non sono presenti credenziali, budget, rate limit, circuit breaker e uno store persistente.</p>
        </header>
        <div className="ai-method-provider-grid">
          {supportedSurfaces.map(([surface, provider, status, copy]) => <article className="rd-tile" key={`${surface}-${provider}`}>
            <span className="rd-tile-tag">{status}</span>
            <h3>{surface}</h3>
            <strong className="ai-method-provider-name">{provider}</strong>
            <p>{copy}</p>
          </article>)}
        </div>
      </section>

      <section className="rd-section rd-tone-panel ai-method-products-section" aria-labelledby="ai-method-products-title">
        <header className="rd-head">
          <p className="rd-label">Migliorare</p>
          <h2 id="ai-method-products-title" className="rd-h2">Due modi per andare oltre il punteggio.</h2>
          <p className="rd-head-lead">Conoscere il proprio AI Score è il primo passo. Il passo successivo è capire quali principi seguire oppure quali interventi servono nello specifico sito analizzato.</p>
        </header>
        <div className="ai-method-products">
          <article className="ai-method-product-card">
            <span className="ai-method-product-number">01</span>
            <span className="rd-label">Guida generale</span>
            <h3>Horyzon AI Optimization Guide</h3>
            <p>Una guida pratica ai principi e alle buone pratiche per costruire siti più accessibili, comprensibili e citabili dai sistemi AI.</p>
            <p>È pensata per chi vuole conoscere le regole generali dell&apos;ottimizzazione AI, indipendentemente da uno specifico audit.</p>
            <strong>Come migliorare un sito per l&apos;AI in generale.</strong>
            <span className="ai-method-status">In arrivo</span>
          </article>
          <article className="ai-method-product-card">
            <span className="ai-method-product-number">02</span>
            <span className="rd-label">Piano personalizzato</span>
            <h3>Horyzon AI Optimization Plan</h3>
            <p>Un piano costruito sui risultati reali dell&apos;audit del tuo sito, con problemi individuati, priorità e interventi specifici.</p>
            <p>Non contiene indicazioni generiche: parte dalle evidenze raccolte durante l&apos;analisi del dominio.</p>
            <strong>Come migliorare il tuo sito sulla base dell&apos;audit.</strong>
            <Link className="rd-link" href="/ai-score">Analizza il tuo sito ↗︎</Link>
          </article>
        </div>
      </section>

      <section className="rd-final rd-final-glow ai-method-final" aria-labelledby="ai-method-final-title">
        <p className="rd-label">{publicVersion}</p>
        <h2 id="ai-method-final-title">Una metodologia indipendente. <em>Un risultato spiegabile.</em></h2>
        <p>Horyzon AI Score è una metodologia proprietaria indipendente che utilizza standard web, documentazione pubblica e segnali verificabili come riferimenti tecnici.</p>
        <Link className="rd-cta" href="/ai-score">Analizza il tuo sito <span aria-hidden="true">→</span></Link>
      </section>
    </main>
    <SiteFooter />
  </>;
}
