import { AiScoreClient } from '@/components/ai-score-client';
import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-shell';

const description = 'Analizza quanto il tuo sito è accessibile, comprensibile e citabile dai sistemi AI con una metodologia Horyzon versionata e spiegabile.';
const heroBalanceCss = `
.ai-score-hero .page-intro {
  color: #c7d1d0;
}

@media (min-width: 851px) {
  .ai-score-hero-grid {
    display: block !important;
    max-width: 1220px !important;
  }

  .ai-score-hero-copy {
    max-width: 980px !important;
  }

  .ai-score-hero h1 {
    max-width: 980px !important;
  }

  .ai-score-hero .page-intro {
    max-width: 760px !important;
    color: #c7d1d0;
  }

  .ai-score-horizon-visual {
    position: absolute !important;
    top: 0 !important;
    right: -4vw !important;
    width: min(38vw, 470px) !important;
    min-height: 0 !important;
    aspect-ratio: 1 !important;
    opacity: .55 !important;
  }

  .ai-score-product {
    display: block !important;
    margin-top: 30px !important;
    max-width: 100% !important;
    width: 100% !important;
  }

  .ai-score-form,
  .ai-score-progress,
  .ai-score-error {
    width: 100% !important;
    max-width: 1120px !important;
    margin-inline: auto !important;
  }

  .ai-score-form {
    padding: 20px !important;
  }

  .ai-score-input-row {
    grid-template-columns: minmax(0,1fr) minmax(210px,260px) !important;
  }
}
`;

export const metadata: Metadata = pageMetadata({ path: '/ai-score', title: 'Horyzon AI Score', description });

export default function AiScorePage() {
  return <>
    <PageStructuredData path="/ai-score" name="Horyzon AI Score" description={description} breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'AI Score', path: '/ai-score' }]} />
    <style>{heroBalanceCss}</style>
    <SiteHeader />
    <main id="content" className="inside editorial-page narrative-page ai-score-page" data-page="ai-score">
      <nav className="editorial-breadcrumb" aria-label="Percorso di navigazione"><Link href="/">Horyzon</Link><span aria-hidden="true">/</span><span aria-current="page">AI Score</span></nav>
      <section className="inside-hero ai-score-hero">
        <div className="ai-score-hero-grid">
          <div className="ai-score-hero-copy">
            <p className="eyebrow"><span />Horyzon / AI Score</p>
            <h1>Quanto è pronto il tuo sito per l’AI?</h1>
            <p className="page-intro">Scopri quanto il tuo sito è pronto per essere trovato, compreso e citato dai sistemi AI.</p>
          </div>
          <div className="ai-score-horizon-visual" aria-hidden="true">
            <span />
            <i />
          </div>
          <AiScoreClient />
        </div>
      </section>
      <section className="narrative-section ai-score-method">
        <header>
          <p className="section-kicker">Metodologia</p>
          <h2>Un punteggio trasparente, non una black box.</h2>
          <p className="narrative-lede">Horyzon separa predisposizione tecnica e visibilità reale e assegna punti solo a segnali effettivamente misurati.</p>
        </header>
        <Link className="text-link" href="/ai-score/methodology">Scopri la metodologia ↗</Link>
      </section>
    </main>
    <SiteFooter />
  </>;
}
