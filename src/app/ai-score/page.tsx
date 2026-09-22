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

@media (min-width: 851px) and (max-width: 1100px) {
  .ai-score-hero-grid {
    display: block !important;
    max-width: 860px !important;
  }

  .ai-score-hero-copy,
  .ai-score-hero h1,
  .ai-score-hero .page-intro {
    max-width: 760px !important;
  }

  .ai-score-horizon-visual {
    position: absolute !important;
    top: 40px !important;
    right: -16vw !important;
    width: min(58vw, 560px) !important;
    min-height: 0 !important;
    aspect-ratio: 1 !important;
    opacity: .38 !important;
  }

  .ai-score-product {
    display: block !important;
    margin-top: 30px !important;
    max-width: 760px !important;
    width: 100% !important;
  }

  .ai-score-form,
  .ai-score-progress,
  .ai-score-error {
    width: 100% !important;
    max-width: 760px !important;
    margin-inline: 0 !important;
  }

  .ai-score-input-row {
    grid-template-columns: minmax(0,1fr) minmax(210px,260px) !important;
  }
}

@media (min-width: 1101px) {
  .ai-score-hero-grid {
    display: grid !important;
    grid-template-columns: minmax(0, .98fr) minmax(430px, .72fr) !important;
    column-gap: clamp(44px, 7vw, 96px) !important;
    row-gap: 32px !important;
    align-items: center !important;
    max-width: 1180px !important;
  }

  .ai-score-hero-copy {
    max-width: 660px !important;
  }

  .ai-score-hero h1 {
    max-width: 660px !important;
    font-size: clamp(58px, 6.4vw, 92px) !important;
  }

  .ai-score-hero .page-intro {
    max-width: 610px !important;
    color: #c7d1d0;
  }

  .ai-score-horizon-visual {
    grid-column: 1 / -1 !important;
    grid-row: 1 !important;
    position: absolute !important;
    top: 18px !important;
    right: 28% !important;
    width: min(36vw, 500px) !important;
    min-height: 0 !important;
    aspect-ratio: 1 !important;
    opacity: .42 !important;
  }

  .ai-score-product {
    grid-column: 2 !important;
    grid-row: 1 !important;
    align-self: end !important;
    justify-self: stretch !important;
    display: grid !important;
    gap: 24px !important;
    margin-top: 168px !important;
    max-width: 520px !important;
    width: 100% !important;
  }

  .ai-score-form,
  .ai-score-progress,
  .ai-score-error {
    width: 100% !important;
    max-width: none !important;
    margin-inline: 0 !important;
  }

  .ai-score-form {
    padding: 20px !important;
  }

  .ai-score-input-row {
    grid-template-columns: minmax(0,1fr) minmax(185px,220px) !important;
  }

  .ai-score-product:has(.ai-score-results) {
    grid-column: 1 / -1 !important;
    grid-row: auto !important;
    align-self: auto !important;
    max-width: 100% !important;
    margin-top: 34px !important;
  }

  .ai-score-product:has(.ai-score-results) .ai-score-form,
  .ai-score-product:has(.ai-score-results) .ai-score-progress,
  .ai-score-product:has(.ai-score-results) .ai-score-error {
    max-width: 1120px !important;
    margin-inline: auto !important;
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
