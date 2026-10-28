import { AiScoreClient } from '@/components/ai-score-client';
import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { FaqSection } from '@/components/faq-section';
import { publicFaqs } from '@/content/public-faq';

const description = 'Analizza quanto il tuo sito è accessibile, comprensibile e citabile dai sistemi AI con una metodologia Horyzon versionata e spiegabile.';

const scoreSignals = [
  {
    tag: 'Readiness',
    heading: 'Predisposizione',
    text: 'Quanto il sito è pronto per essere scoperto, interpretato e citato dai sistemi AI.',
  },
  {
    tag: 'Visibility',
    heading: 'Presenza reale',
    text: 'La visibilità nelle risposte AI resta separata e viene mostrata solo quando è realmente misurata.',
  },
  {
    tag: 'Confidence',
    heading: 'Evidenze',
    text: 'Il risultato indica anche quanto sono solide le evidenze disponibili per leggere correttamente lo Score.',
  },
] as const;

export const metadata: Metadata = pageMetadata({ path: '/ai-score', title: 'Horyzon AI Score', description });

export default function AiScorePage() {
  return <>
    <PageStructuredData path="/ai-score" name="Horyzon AI Score" description={description} breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'AI Score', path: '/ai-score' }]} faqs={publicFaqs['/ai-score']} />
    <SiteHeader />
    <main id="content" className="rd ai-score-page ai-score-revamp" data-page="ai-score">
      <section className="rd-hero rd-hero-page ai-score-hero" aria-labelledby="ai-score-title">
        <div className="rd-hero-copy ai-score-hero-copy">
          <nav className="rd-crumbs" aria-label="Percorso di navigazione">
            <Link href="/">Horyzon</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">AI Score</span>
          </nav>
          <p className="rd-label rd-rise">AI Score <i>·</i> Analisi gratuita <i>·</i> Nessuna carta</p>
          <h1 id="ai-score-title">
            <span className="rd-mask"><span className="rd-line">Quanto è pronto il tuo sito</span></span>
            <span className="rd-mask"><span className="rd-line rd-accent">per farsi capire dall’AI?</span></span>
          </h1>
          <p className="rd-lead rd-rise">Scopri quanto il tuo sito è pronto per essere trovato, compreso e citato dai sistemi AI.</p>
        </div>

        <figure className="rd-hero-aside ai-score-scan-visual" aria-hidden="true">
          <div className="ai-score-scan-orbit">
            <span className="ai-score-ring ai-score-ring-outer" />
            <span className="ai-score-ring ai-score-ring-mid" />
            <span className="ai-score-ring ai-score-ring-inner" />
            <i className="ai-score-scan-beam" />
            <b className="ai-score-scan-dot ai-score-scan-dot-a" />
            <b className="ai-score-scan-dot ai-score-scan-dot-b" />
            <b className="ai-score-scan-dot ai-score-scan-dot-c" />
            <div className="ai-score-scan-core">
              <small>Horyzon</small>
              <strong>AI</strong>
              <span>Scan</span>
            </div>
          </div>
          <figcaption>
            <span>Accessibilità</span>
            <span>Contenuti</span>
            <span>Citabilità</span>
          </figcaption>
        </figure>

        <AiScoreClient />
      </section>

      <section className="rd-map ai-score-method" aria-labelledby="ai-score-method-title">
        <header className="rd-reveal">
          <p className="rd-label">Metodologia</p>
          <h2 id="ai-score-method-title">Un punteggio trasparente. <span>Non una black box.</span></h2>
          <p className="ai-score-method-lede">Horyzon separa predisposizione tecnica, visibilità reale e qualità delle evidenze. Ogni risultato dichiara ciò che è stato misurato e ciò che non lo è.</p>
        </header>
        <ul className="rd-tiles">
          {scoreSignals.map(({ tag, heading, text }, index) => <li key={tag} className="rd-reveal" style={{ '--i': index } as React.CSSProperties}>
            <article className="rd-tile">
              <span className="rd-tile-tag">{tag}</span>
              <h3>{heading}</h3>
              <p>{text}</p>
            </article>
          </li>)}
        </ul>
        <Link className="rd-link ai-score-method-link" href="/ai-score/methodology">Scopri la metodologia ↗︎</Link>
      </section>

      <FaqSection items={publicFaqs['/ai-score']} variant="dark" />

      <section className="rd-final rd-final-glow ai-score-final" aria-labelledby="ai-score-final-title">
        <p className="rd-label">Il prossimo passo</p>
        <h2 id="ai-score-final-title">Parti dal tuo dominio. <em>Guarda cosa vede davvero l’AI.</em></h2>
        <p>L’analisi gratuita distingue i segnali misurati da quelli non ancora disponibili e ti restituisce una lettura più chiara del punto di partenza.</p>
        <a className="rd-cta" href="#ai-score-audit">Analizza il mio sito <span aria-hidden="true">↑</span></a>
      </section>
    </main>
    <SiteFooter />
  </>;
}
