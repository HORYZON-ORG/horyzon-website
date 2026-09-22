import { AiScoreClient } from '@/components/ai-score-client';
import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-shell';

const description = 'Analizza quanto il tuo sito è accessibile, comprensibile e citabile dai sistemi AI con una metodologia Horyzon versionata e spiegabile.';

export const metadata: Metadata = pageMetadata({ path: '/ai-score', title: 'Horyzon AI Score', description });

export default function AiScorePage() {
  return <>
    <PageStructuredData path="/ai-score" name="Horyzon AI Score" description={description} breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'AI Score', path: '/ai-score' }]} />
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
