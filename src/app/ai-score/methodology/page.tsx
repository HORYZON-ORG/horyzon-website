import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import {
  AI_SCORE_DISPLAY_METHODOLOGY,
  AI_SCORE_METHODOLOGY_EFFECTIVE_DATE,
  auditCheckDefinitions,
  methodologyDefinition,
  readinessCategories,
  visibilityWeights,
} from '@/lib/ai-score/methodology';

const description = 'Metodologia Horyzon AI Score: pesi, controlli, confidence, limiti e separazione tra AI Readiness e AI Visibility.';

export const metadata: Metadata = pageMetadata({ path: '/ai-score/methodology', title: 'Metodologia Horyzon AI Score', description });

export default function AiScoreMethodologyPage() {
  return <>
    <PageStructuredData path="/ai-score/methodology" name="Metodologia Horyzon AI Score" description={description} breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'AI Score', path: '/ai-score' }, { name: 'Metodologia', path: '/ai-score/methodology' }]} />
    <SiteHeader />
    <main id="content" className="inside editorial-page narrative-page ai-score-page" data-page="ai-score-methodology">
      <nav className="editorial-breadcrumb" aria-label="Percorso di navigazione"><Link href="/">Horyzon</Link><span aria-hidden="true">/</span><Link href="/ai-score">AI Score</Link><span aria-hidden="true">/</span><span aria-current="page">Metodologia</span></nav>
      <section className="inside-hero ai-score-hero ai-score-methodology-hero">
        <div>
          <p className="eyebrow"><span />Metodo pubblico</p>
          <h1>Metodologia Horyzon AI Score</h1>
          <p className="page-intro">{AI_SCORE_DISPLAY_METHODOLOGY} misura AI Readiness con controlli deterministici e tiene separata AI Visibility, che richiede provider verificabili.</p>
          <dl className="ai-score-methodology-meta">
            <div><dt>Versione readiness</dt><dd>{methodologyDefinition.readinessVersion}</dd></div>
            <div><dt>Formula confidence</dt><dd>{methodologyDefinition.confidenceFormulaVersion}</dd></div>
            <div><dt>Data efficacia</dt><dd>{AI_SCORE_METHODOLOGY_EFFECTIVE_DATE}</dd></div>
            <div><dt>Controlli definiti</dt><dd>{auditCheckDefinitions.length}</dd></div>
          </dl>
        </div>
      </section>

      <section className="narrative-section ai-score-method">
        <header>
          <p className="section-kicker">AI Readiness</p>
          <h2>Nove categorie, 100 punti.</h2>
          <p className="narrative-lede">Lo score Readiness è calcolato solo sulle categorie effettivamente misurate. Le categorie non misurate non ricevono punteggi fittizi e abbassano invece Evidence confidence.</p>
        </header>
        <div className="output-list ai-score-methodology-grid">
          {readinessCategories.map(category => <article key={category.id}>
            <h3>{category.label}</h3>
            <strong>{category.weight} punti</strong>
            <p>{category.description}</p>
          </article>)}
        </div>
      </section>

      <section className="narrative-section ai-score-method">
        <header>
          <p className="section-kicker">Confidence</p>
          <h2>La fiducia non è una scelta editoriale.</h2>
          <p className="narrative-lede">Evidence confidence deriva da copertura dei controlli applicabili, qualità delle evidenze, copertura categorie, profondità crawl, copertura AI Visibility e copertura External Brand Footprint.</p>
        </header>
        <div className="output-list">
          <article><h3>80-100</h3><p>HIGH: evidenze ampie e prevalentemente dirette.</p></article>
          <article><h3>50-79</h3><p>MEDIUM: audit utile ma con fonti, profondità o provider mancanti.</p></article>
          <article><h3>0-49</h3><p>LOW: evidenze insufficienti o molti controlli non misurati.</p></article>
        </div>
      </section>

      <section className="narrative-section ai-score-method">
        <header>
          <p className="section-kicker">AI Visibility</p>
          <h2>Separata dalla Readiness.</h2>
          <p className="narrative-lede">AI Visibility non deriva dall’HTML del sito. Richiede osservazioni reali su motori AI supportati: prompt, engine, brand mention, citazioni, competitor, posizione fonte, provider e timestamp.</p>
        </header>
        <div className="output-list">
          {Object.entries(visibilityWeights).map(([key, weight]) => <article key={key}>
            <h3>{labelVisibilityWeight(key)}</h3>
            <strong>{weight}%</strong>
            <p>Predisposto nel modello dati; resta Not measured finché non è configurato un provider verificabile.</p>
          </article>)}
        </div>
      </section>

      <section className="narrative-section ai-score-method">
        <header>
          <p className="section-kicker">Limiti</p>
          <h2>Misurato significa verificato.</h2>
          <p className="narrative-lede">L’audit gratuito usa una scansione controllata, limiti anti-abuso e protezioni SSRF. Non interroga servizi AI senza provider, non calcola potential score senza remediation validate e non crea profili esterni senza fonti affidabili.</p>
        </header>
      </section>
    </main>
    <SiteFooter />
  </>;
}

function labelVisibilityWeight(key: string) {
  return key
    .replace('brandMentionRate', 'Brand Mention Rate')
    .replace('citationRate', 'Citation Rate')
    .replace('promptCoverage', 'Prompt Coverage')
    .replace('shareOfVoice', 'Share of Voice')
    .replace('crossEngineConsistency', 'Cross-engine Consistency')
    .replace('citationSourceDiversity', 'Citation / Source Diversity');
}
