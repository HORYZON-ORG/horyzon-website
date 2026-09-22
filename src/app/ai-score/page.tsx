import { AiScoreClient } from '@/components/ai-score-client';
import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-shell';

const description = 'Analizza quanto il tuo sito è accessibile, comprensibile e citabile dai sistemi AI con una metodologia Horyzon versionata e spiegabile.';
const heroBalanceCss = `
@media (min-width: 851px) {
  .ai-score-hero-grid {
    display: block;
    max-width: 1220px;
  }

  .ai-score-hero-copy {
    max-width: 980px;
  }

  .ai-score-hero h1 {
    max-width: 980px;
  }

  .ai-score-hero .page-intro {
    max-width: 720px;
  }

  .ai-score-horizon-visual {
    position: absolute;
    top: 0;
    right: -4vw;
    width: min(38vw, 470px);
    min-height: 0;
    aspect-ratio: 1;
    opacity: .55;
  }

  .ai-score-product {
    margin-top: 30px;
    max-width: 100%;
  }

  .ai-score-form,
  .ai-score-progress,
  .ai-score-error {
    width: 100%;
    max-width: 1120px;
    margin-inline: auto;
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
