import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import {
  AI_SCORE_DISPLAY_METHODOLOGY,
  AI_SCORE_METHODOLOGY_EFFECTIVE_DATE,
  auditCheckDefinitions,
  checkWeightValues,
  methodologyDefinition,
  methodologyReferences,
  readinessCategories,
  visibilityWeights,
} from '@/lib/ai-score/methodology';
import { createVisibilityProviderRegistry, visibilityProviderCandidates, visibilityScanProfiles } from '@/lib/ai-score/visibility';

const description = 'Metodologia Horyzon AI Score: pesi, controlli, confidence, limiti e separazione tra AI Readiness e AI Visibility.';

export const metadata: Metadata = pageMetadata({ path: '/ai-score/methodology', title: 'Metodologia Horyzon AI Score', description });

export default function AiScoreMethodologyPage() {
  const providerStatuses = createVisibilityProviderRegistry().map((provider) => ({
    id: provider.id,
    label: provider.label,
    surface: provider.surface,
    configured: provider.isConfigured(),
    enabled: provider.enabled,
  }));
  const publicReferences = methodologyReferences.filter((reference) => !/bing web search api/i.test(reference.label));

  return <>
    <PageStructuredData path="/ai-score/methodology" name="Metodologia Horyzon AI Score" description={description} breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'AI Score', path: '/ai-score' }, { name: 'Metodologia', path: '/ai-score/methodology' }]} />
    <SiteHeader />
    <main id="content" className="inside editorial-page narrative-page ai-score-page" data-page="ai-score-methodology">
      <nav className="editorial-breadcrumb" aria-label="Percorso di navigazione"><Link href="/">Horyzon</Link><span aria-hidden="true">/</span><Link href="/ai-score">AI Score</Link><span aria-hidden="true">/</span><span aria-current="page">Metodologia</span></nav>
      <section className="inside-hero ai-score-hero ai-score-methodology-hero">
        <div>
          <p className="eyebrow"><span />Metodo pubblico</p>
          <h1>Metodologia Horyzon AI Score</h1>
          <p className="page-intro">{AI_SCORE_DISPLAY_METHODOLOGY} misura AI Readiness con controlli deterministici e tiene separata AI Visibility, che richiede observation reali raccolte da provider verificabili.</p>
          <dl className="ai-score-methodology-meta">
            <div><dt>Versione pubblica</dt><dd>{AI_SCORE_DISPLAY_METHODOLOGY}</dd></div>
            <div><dt>ID tecnico</dt><dd>{methodologyDefinition.readinessVersion}</dd></div>
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
          <p className="narrative-lede">Lo score Readiness e calcolato solo sulle categorie effettivamente misurate. Le categorie non misurate non ricevono punteggi fittizi e abbassano invece Evidence confidence.</p>
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
          <p className="section-kicker">Pesi interni</p>
          <h2>Non tutti i controlli valgono allo stesso modo.</h2>
          <p className="narrative-lede">Dentro ogni categoria, i controlli sono ponderati per impatto: un blocco di indicizzazione pesa piu di un segnale opzionale come llms.txt. I pesi macro restano quelli pubblicati sopra.</p>
        </header>
        <div className="output-list">
          {Object.entries(checkWeightValues).map(([label, weight]) => <article key={label}>
            <h3>{label}</h3>
            <strong>{weight} unita</strong>
            <p>{label === 'CRITICAL' ? 'Controlli che possono impedire discovery, crawling, interpretazione o fiducia di base.' : label === 'HIGH' ? 'Segnali importanti per qualita, autorevolezza o accessibilita machine-readable.' : label === 'MEDIUM' ? 'Controlli utili ma non sempre decisivi singolarmente.' : 'Segnali minori o contestuali: contribuiscono poco e non sono trattati come ranking factor ufficiali.'}</p>
          </article>)}
        </div>
      </section>

      <section className="narrative-section ai-score-method">
        <header>
          <p className="section-kicker">Confidence</p>
          <h2>La fiducia non e una scelta editoriale.</h2>
          <p className="narrative-lede">Evidence confidence deriva da copertura dei controlli applicabili, qualita delle evidenze, copertura categorie, profondita crawl, copertura AI Visibility e copertura External Brand Footprint. Se mancano provider esterni per Visibility e Footprint, la confidence non puo salire a HIGH.</p>
        </header>
        <div className="output-list">
          <article><h3>80-100</h3><p>HIGH: evidenze ampie, prevalentemente dirette e provider esterni disponibili dove necessari.</p></article>
          <article><h3>50-79</h3><p>MEDIUM: audit utile ma con fonti, profondita o provider mancanti.</p></article>
          <article><h3>0-49</h3><p>LOW: evidenze insufficienti o molti controlli non misurati.</p></article>
        </div>
      </section>

      <section className="narrative-section ai-score-method">
        <header>
          <p className="section-kicker">AI Visibility</p>
          <h2>Presenza reale, pipeline separata.</h2>
          <p className="narrative-lede">AI Visibility misura quanto il brand emerge e viene citato nelle risposte generate da diverse superfici di ricerca AI. Analizziamo la presenza del brand su diverse superfici di ricerca AI.</p>
          <p className="narrative-lede">Questa metrica non usa robots.txt, sitemap, Schema.org, Lighthouse, AI Readiness, content score o llms.txt per calcolare lo score. Usa solo observation reali raccolte dai provider configurati.</p>
        </header>
        <div className="output-list">
          {Object.entries(visibilityWeights).map(([key, weight]) => <article key={key}>
            <h3>{labelVisibilityWeight(key)}</h3>
            <strong>{weight}%</strong>
            <p>{visibilityMetricCopy(key)}</p>
          </article>)}
        </div>
      </section>

      <section className="narrative-section ai-score-method">
        <header>
          <p className="section-kicker">Superfici supportate</p>
          <h2>Provider predisposti, non configurati.</h2>
          <p className="narrative-lede">Lo stato mostra solo disponibilita operativa, non segreti o valori di configurazione. Nessuna chiamata live viene eseguita finche il provider non e configurato e abilitato server-side.</p>
        </header>
        <div className="output-list ai-score-methodology-grid">
          {providerStatuses.map(provider => <article key={provider.id}>
            <h3>{provider.label}</h3>
            <strong>{provider.configured && provider.enabled ? 'Supported' : 'Not configured'}</strong>
            <p>{provider.surface}</p>
          </article>)}
        </div>
      </section>

      <section className="narrative-section ai-score-method">
        <header>
          <p className="section-kicker">Scan profile</p>
          <h2>Quick scan ora, premium dopo.</h2>
          <p className="narrative-lede">Il profilo gratuito pianifica 5 prompt e 1 provider. Il profilo premium e predisposto per 15 prompt e fino a 3 superfici, ma resta disabilitato finche non saranno definiti accesso e provider reali.</p>
        </header>
        <div className="output-list">
          <article><h3>FREE_QUICK_SCAN</h3><p>{visibilityScanProfiles.FREE_QUICK_SCAN.promptCount} prompt · {visibilityScanProfiles.FREE_QUICK_SCAN.providerIds.length} provider previsto · budget massimo configurabile.</p></article>
          <article><h3>PREMIUM_COMPREHENSIVE</h3><p>{visibilityScanProfiles.PREMIUM_COMPREHENSIVE.promptCount} prompt · fino a {visibilityScanProfiles.PREMIUM_COMPREHENSIVE.providerIds.length} provider · non eseguito nel livello gratuito.</p></article>
        </div>
      </section>

      <section className="narrative-section ai-score-method">
        <header>
          <p className="section-kicker">Riferimenti</p>
          <h2>Fonti e standard usati come base.</h2>
          <p className="narrative-lede">Questi riferimenti guidano controlli e provider candidati. Horyzon AI Score resta una metodologia indipendente, non uno score ufficiale di OpenAI, Google, Microsoft, Anthropic o Perplexity. Le Bing Search APIs legacy non sono piu usate come provider candidato attivo.</p>
        </header>
        <div className="output-list ai-score-methodology-grid">
          {publicReferences.map(reference => <article key={reference.url}>
            <h3><a href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a></h3>
            <p>{reference.scope}</p>
          </article>)}
          {visibilityProviderCandidates.filter(candidate => candidate.surface === 'future_candidate').map(candidate => <article key={candidate.id}>
            <h3>{candidate.label}</h3>
            <p>{candidate.blocker}</p>
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

function visibilityMetricCopy(key: string) {
  if (key === 'brandMentionRate') return 'Observation valide con menzione del brand divise per observation valide.';
  if (key === 'citationRate') return 'Observation valide con citazione reale del dominio divise per observation valide.';
  if (key === 'promptCoverage') return 'Categorie di prompt in cui il brand emerge, non una duplicazione del mention rate.';
  if (key === 'shareOfVoice') return 'N/A finche non esistono competitor affidabili osservati o configurati.';
  if (key === 'crossEngineConsistency') return 'N/A nel quick scan con una sola superficie; misurabile con almeno due provider.';
  return 'Diversita delle pagine del dominio citate, deduplicate e normalizzate.';
}
