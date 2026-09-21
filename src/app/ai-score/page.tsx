import { AiScoreClient } from '@/components/ai-score-client';
import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-shell';

const description = 'Analizza quanto il tuo sito e accessibile, comprensibile e citabile dai sistemi AI con una metodologia Horyzon versionata e spiegabile.';

export const metadata: Metadata = pageMetadata({ path: '/ai-score', title: 'Horyzon AI Score', description });

export default function AiScorePage() {
  return <>
    <PageStructuredData path="/ai-score" name="Horyzon AI Score" description={description} breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'AI Score', path: '/ai-score' }]} />
    <SiteHeader />
    <main id="content" className="inside editorial-page narrative-page ai-score-page" data-page="ai-score">
      <nav className="editorial-breadcrumb" aria-label="Percorso di navigazione"><Link href="/">Horyzon</Link><span aria-hidden="true">/</span><span aria-current="page">AI Score</span></nav>
      <section className="inside-hero ai-score-hero">
        <div>
          <p className="eyebrow"><span />Horyzon / AI Score</p>
          <h1>Quanto e pronto il tuo sito per l’AI?</h1>
          <p className="page-intro">Analizza quanto il tuo sito e accessibile, comprensibile e citabile dai sistemi AI e verifica quanto il tuo brand e visibile nelle loro risposte.</p>
          <AiScoreClient />
          <p className="fine-print ai-score-disclaimer">Horyzon analizza struttura, contenuti, accessibilita AI, autorevolezza e segnali utili alla comprensione del sito da parte dei sistemi AI. Il punteggio e una metodologia Horyzon, non uno score ufficiale OpenAI, Google, Microsoft, Anthropic o Perplexity.</p>
        </div>
      </section>
      <section className="narrative-section ai-score-method">
        <header>
          <p className="section-kicker">Metodo</p>
          <h2>Readiness e Visibility restano separate.</h2>
          <p className="narrative-lede">AI Readiness misura quanto il sito e predisposto a essere scoperto, interpretato e citato. AI Visibility misura solo la presenza reale nelle risposte dei sistemi AI supportati: se il provider non e disponibile, resta Not measured.</p>
        </header>
        <div className="output-list">
          <article><h3>Metodologia versionata</h3><p>La prima versione usa nove categorie Readiness con pesi espliciti per un totale di 100 punti.</p></article>
          <article><h3>Evidenze verificabili</h3><p>Ogni controllo gratuito deriva da segnali osservabili nella scansione server-side, non da numeri simulati.</p></article>
          <article><h3>Accesso progressivo</h3><p>L’audit completo viene predisposto prima del paywall; il livello FREE mostra solo sintesi, confidence e opportunita aggregate.</p></article>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
