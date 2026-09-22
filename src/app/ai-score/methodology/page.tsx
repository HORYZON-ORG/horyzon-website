import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';

const description = 'Scopri cosa misura Horyzon AI Score e perche la valutazione distingue predisposizione, visibilita AI e solidita delle evidenze.';
const publicVersion = 'Horyzon AI Score v1.0';

const methodologyPageCss = `
.ai-score-methodology-hero {
  display: block !important;
  padding-top: 70px;
  padding-bottom: 78px;
}

.ai-method-hero-shell,
.ai-method-section,
.ai-method-principle,
.ai-method-closing {
  position: relative;
  z-index: 1;
  width: min(100%, 1120px);
  margin-inline: auto;
}

.ai-method-hero-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
  gap: clamp(34px, 7vw, 88px);
  align-items: end;
}

.ai-method-hero-copy h1 {
  max-width: 920px;
  margin: 24px 0 24px;
  font-size: clamp(58px, 7.2vw, 106px);
  line-height: .9;
}

.ai-method-hero-copy .page-intro,
.ai-method-hero-copy .ai-method-subintro {
  max-width: 760px;
  color: #c7d1d0;
}

.ai-method-subintro {
  margin: 18px 0 0;
  font-size: clamp(16px, 1.35vw, 19px);
  line-height: 1.75;
}

.ai-method-hero-panel {
  border: 1px solid #d7ff3f45;
  background: #ffffff08;
  padding: 28px;
  color: #edf1e6;
  box-shadow: 0 28px 80px #00000022;
}

.ai-method-hero-panel p {
  margin: 0 0 28px;
  color: #b8c8c3;
  line-height: 1.7;
}

.ai-method-hero-panel strong {
  display: block;
  margin-bottom: 10px;
  font: 400 34px/1 var(--font-serif);
  color: #f5f4eb;
}

.ai-method-hero-panel .button {
  width: 100%;
  margin-top: 2px;
}

.ai-method-section {
  padding: 86px 0;
}

.ai-method-section + .ai-method-section,
.ai-method-principle + .ai-method-section,
.ai-method-section + .ai-method-principle {
  border-top: 1px solid #c3cab9;
}

.ai-method-section header {
  max-width: 820px;
  margin-bottom: 36px;
}

.ai-method-section h2,
.ai-method-principle h2,
.ai-method-closing h2 {
  margin: 12px 0 0;
  font: 400 clamp(38px, 5vw, 76px)/1.02 var(--font-serif);
  letter-spacing: -.025em;
}

.ai-method-section .narrative-lede,
.ai-method-principle p,
.ai-method-closing p {
  max-width: 760px;
  color: #47564f;
  line-height: 1.75;
}

.ai-method-measures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: #b9c3ac;
  border: 1px solid #b9c3ac;
}

.ai-method-measures article {
  min-width: 0;
  background: #eef1e7;
  padding: 30px;
}

.ai-method-measures span,
.ai-method-areas span,
.ai-method-product-label,
.ai-method-version {
  display: inline-block;
  margin-bottom: 18px;
  font-size: 11px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: #64713b;
  font-weight: 800;
}

.ai-method-measures h3,
.ai-method-products h3 {
  margin: 0 0 16px;
  font: 400 clamp(29px, 3vw, 42px)/1.05 var(--font-serif);
  letter-spacing: -.015em;
}

.ai-method-measures p,
.ai-method-areas p,
.ai-method-products p {
  margin: 0;
  color: #455650;
  line-height: 1.7;
}

.ai-method-measures p + p,
.ai-method-products p + p {
  margin-top: 14px;
}

.ai-method-areas {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: #b9c3ac;
  border: 1px solid #b9c3ac;
}

.ai-method-areas article {
  min-width: 0;
  background: #f4f3ea;
  padding: 24px;
}

.ai-method-areas h3 {
  margin: 0 0 12px;
  font-size: 19px;
  line-height: 1.25;
  color: #122226;
}

.ai-method-principle {
  display: grid;
  grid-template-columns: minmax(0, .78fr) minmax(280px, .42fr);
  gap: clamp(30px, 6vw, 76px);
  align-items: center;
  padding: 86px 0;
}

.ai-method-principle-card {
  border: 1px solid #d7ff3f55;
  background: #081521;
  color: #f5f4eb;
  padding: 34px;
}

.ai-method-principle-card strong {
  display: block;
  font: 400 clamp(46px, 7vw, 86px)/.86 var(--font-serif);
  color: #d7ff3f;
}

.ai-method-principle-card span {
  display: block;
  margin-top: 18px;
  color: #c7d1d0;
  line-height: 1.7;
}

.ai-method-products {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  background: #b9c3ac;
  border: 1px solid #b9c3ac;
}

.ai-method-products article {
  min-width: 0;
  background: #e8ecdc;
  padding: clamp(28px, 4vw, 44px);
}

.ai-method-products article:last-child {
  background: #f4f3ea;
}

.ai-method-product-number {
  display: block;
  margin-bottom: 34px;
  font: 400 clamp(56px, 7vw, 92px)/.8 var(--font-serif);
  color: #667333;
}

.ai-method-product-meaning {
  display: block;
  margin: 22px 0 24px;
  color: #122226;
  font-weight: 800;
  line-height: 1.45;
}

.ai-method-status {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  border: 1px solid #9eac91;
  padding: 0 18px;
  color: #47564f;
  font-size: 13px;
  font-weight: 800;
}

.ai-method-closing {
  padding: 78px 0 92px;
  border-top: 1px solid #c3cab9;
}

.ai-method-closing-inner {
  display: flex;
  gap: 28px;
  align-items: end;
  justify-content: space-between;
}

.ai-method-closing-copy {
  max-width: 780px;
}

.ai-method-closing .button {
  white-space: nowrap;
}

@media (max-width: 1000px) {
  .ai-method-hero-shell,
  .ai-method-principle,
  .ai-method-closing-inner {
    grid-template-columns: 1fr;
    display: grid;
  }

  .ai-method-hero-panel {
    max-width: 560px;
  }

  .ai-method-measures,
  .ai-method-areas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .ai-score-methodology-hero {
    padding-top: 48px;
    padding-bottom: 58px;
  }

  .ai-method-hero-copy h1 {
    font-size: clamp(48px, 13vw, 76px);
  }

  .ai-method-section,
  .ai-method-principle,
  .ai-method-closing {
    padding: 62px 0;
  }

  .ai-method-measures,
  .ai-method-areas,
  .ai-method-products {
    grid-template-columns: 1fr;
  }

  .ai-method-measures article,
  .ai-method-areas article,
  .ai-method-products article,
  .ai-method-hero-panel,
  .ai-method-principle-card {
    padding: 24px;
  }

  .ai-method-closing .button {
    width: 100%;
  }
}
`;

const measures = [
  {
    id: '01',
    title: 'AI Readiness',
    copy: 'Misura quanto il sito e predisposto a essere correttamente scoperto, interpretato e utilizzato dai sistemi di ricerca e AI.',
  },
  {
    id: '02',
    title: 'AI Visibility',
    copy: 'Misura quanto il brand emerge e viene citato nelle diverse superfici di ricerca AI effettivamente analizzate.',
    note: 'Se una superficie non puo essere realmente verificata, non viene simulato alcun risultato.',
  },
  {
    id: '03',
    title: 'Evidence Confidence',
    copy: 'Indica quanto sono complete e affidabili le evidenze disponibili per la valutazione.',
    note: 'Una confidence piu bassa non significa necessariamente un sito peggiore: indica una misurazione meno completa.',
  },
];

const readinessAreas = [
  ['01', 'Accessibilita e indicizzazione', 'Verifichiamo che il sito e i suoi contenuti principali possano essere raggiunti e interpretati correttamente dai sistemi automatici.'],
  ['02', 'Qualita e citabilita dei contenuti', 'Valutiamo quanto le informazioni siano chiare, specifiche, strutturate e utilizzabili come fonte.'],
  ['03', 'Identita e chiarezza semantica', "Verifichiamo quanto sia comprensibile chi e l'organizzazione, cosa offre, a chi si rivolge e quali competenze rappresenta."],
  ['04', 'Dati strutturati', 'Analizziamo i segnali machine-readable che aiutano sistemi di ricerca e AI a interpretare correttamente informazioni ed entita.'],
  ['05', 'Autorevolezza ed evidenze', 'Cerchiamo segnali che rendano identita, informazioni e affermazioni verificabili e riconducibili a fonti chiare.'],
  ['06', 'Qualita tecnica', "Consideriamo alcuni elementi tecnici che incidono sull'accessibilita, sulla leggibilita e sulla corretta interpretazione del sito."],
  ['07', 'Aggiornamento dei contenuti', 'Valutiamo segnali che aiutano a capire se le informazioni vengono mantenute coerenti e aggiornate nel tempo.'],
  ['08', 'Predisposizione ai sistemi AI', "Verifichiamo alcuni segnali specifici che possono facilitare l'accesso e l'interpretazione dei contenuti da parte dei sistemi AI."],
  ['09', 'Presenza esterna del brand', "Quando misurabile, verifichiamo quanto l'identita e l'attivita dell'organizzazione trovino riscontro anche in fonti esterne al proprio sito."],
] as const;

export const metadata: Metadata = pageMetadata({ path: '/ai-score/methodology', title: 'Come funziona Horyzon AI Score', description });

export default function AiScoreMethodologyPage() {
  return <>
    <PageStructuredData path="/ai-score/methodology" name="Come funziona Horyzon AI Score" description={description} breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'AI Score', path: '/ai-score' }, { name: 'Come funziona', path: '/ai-score/methodology' }]} />
    <style>{methodologyPageCss}</style>
    <SiteHeader />
    <main id="content" className="inside editorial-page narrative-page ai-score-page" data-page="ai-score-methodology">
      <nav className="editorial-breadcrumb" aria-label="Percorso di navigazione"><Link href="/">Horyzon</Link><span aria-hidden="true">/</span><Link href="/ai-score">AI Score</Link><span aria-hidden="true">/</span><span aria-current="page">Come funziona</span></nav>

      <section className="inside-hero ai-score-hero ai-score-methodology-hero">
        <div className="ai-method-hero-shell">
          <div className="ai-method-hero-copy">
            <p className="eyebrow"><span />Horyzon / AI Score</p>
            <h1>Come funziona Horyzon AI Score</h1>
            <p className="page-intro">Analizziamo quanto un sito e predisposto a essere scoperto, compreso e utilizzato dai sistemi AI e, quando disponibile, quanto il brand emerge nelle superfici di ricerca AI.</p>
            <p className="ai-method-subintro">La valutazione combina segnali tecnici, contenutistici, semantici e di autorevolezza attraverso una metodologia Horyzon basata su evidenze verificabili.</p>
          </div>
          <aside className="ai-method-hero-panel" aria-label="Avvia AI Score">
            <strong>Parti dal tuo dominio.</strong>
            <p>Il risultato gratuito mostra le tre misure principali e indica quando una metrica non puo essere realmente osservata.</p>
            <Link className="button primary" href="/ai-score">Analizza il tuo sito <span aria-hidden="true">→</span></Link>
          </aside>
        </div>
      </section>

      <section className="narrative-section ai-method-section">
        <header>
          <p className="section-kicker">La valutazione</p>
          <h2>Tre misure, tre significati diversi.</h2>
        </header>
        <div className="ai-method-measures">
          {measures.map((measure) => <article key={measure.id}>
            <span>{measure.id}</span>
            <h3>{measure.title}</h3>
            <p>{measure.copy}</p>
            {measure.note && <p>{measure.note}</p>}
          </article>)}
        </div>
      </section>

      <section className="narrative-section ai-method-section">
        <header>
          <p className="section-kicker">AI Readiness</p>
          <h2>Cosa analizziamo</h2>
          <p className="narrative-lede">AI Readiness considera diverse dimensioni del sito. Insieme descrivono quanto le informazioni siano accessibili, comprensibili e verificabili dai sistemi automatici.</p>
        </header>
        <div className="ai-method-areas">
          {readinessAreas.map(([number, title, copy]) => <article key={number}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>)}
        </div>
      </section>

      <section className="narrative-section ai-method-principle">
        <div>
          <p className="section-kicker">Il nostro principio</p>
          <h2>Misuriamo solo cio che possiamo verificare.</h2>
          <p>Quando un segnale non puo essere realmente osservato, non inventiamo un risultato. La metrica viene indicata come non misurata e il livello di confidence tiene conto delle evidenze effettivamente disponibili.</p>
          <p>Questo mantiene separati cio che sappiamo, cio che possiamo misurare e cio che non e ancora verificabile.</p>
        </div>
        <aside className="ai-method-principle-card" aria-label="Principio metodologico">
          <strong>Not measured</strong>
          <span>Non e un punteggio basso. E una dichiarazione di trasparenza quando una misurazione non ha evidenze sufficienti.</span>
        </aside>
      </section>

      <section className="narrative-section ai-method-section">
        <header>
          <p className="section-kicker">Migliorare</p>
          <h2>Due modi per andare oltre il punteggio.</h2>
          <p className="narrative-lede">Conoscere il proprio AI Score e il primo passo. Il passo successivo e capire quali principi seguire oppure quali interventi servono nello specifico sito analizzato.</p>
        </header>
        <div className="ai-method-products">
          <article>
            <span className="ai-method-product-number">01</span>
            <span className="ai-method-product-label">Guida generale</span>
            <h3>Horyzon AI Optimization Guide</h3>
            <p>Una guida pratica ai principi e alle buone pratiche per costruire siti piu accessibili, comprensibili e citabili dai sistemi AI.</p>
            <p>E pensata per chi vuole conoscere le regole generali dell'ottimizzazione AI, indipendentemente da uno specifico audit.</p>
            <strong className="ai-method-product-meaning">Come migliorare un sito per l'AI in generale.</strong>
            <span className="ai-method-status">In arrivo</span>
          </article>
          <article>
            <span className="ai-method-product-number">02</span>
            <span className="ai-method-product-label">Piano personalizzato</span>
            <h3>Horyzon AI Optimization Plan</h3>
            <p>Un piano costruito sui risultati reali dell'audit del tuo sito, con problemi individuati, priorita e interventi specifici.</p>
            <p>Non contiene indicazioni generiche: parte dalle evidenze raccolte durante l'analisi del dominio.</p>
            <strong className="ai-method-product-meaning">Come migliorare il tuo sito sulla base dell'audit.</strong>
            <Link className="button ghost-dark" href="/ai-score">Analizza il tuo sito <span aria-hidden="true">→</span></Link>
          </article>
        </div>
      </section>

      <section className="narrative-section ai-method-closing">
        <div className="ai-method-closing-inner">
          <div className="ai-method-closing-copy">
            <span className="ai-method-version">{publicVersion}</span>
            <h2>Una metodologia indipendente.</h2>
            <p>Horyzon AI Score e una metodologia proprietaria indipendente che utilizza standard web, documentazione pubblica e segnali verificabili come riferimenti tecnici.</p>
          </div>
          <Link className="button primary" href="/ai-score">Analizza il tuo sito <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
