import type {
  AuditAccessLevel,
  AuditCheck,
  AuditCheckDefinition,
  AuditMetricState,
  CategoryScore,
  CheckWeightClass,
  ConfidenceBreakdown,
  CrawlSummary,
  EvidenceConfidenceLabel,
  ExternalBrandFootprintResult,
  ReadinessCategoryDefinition,
  ReadinessCategoryId,
  ReadinessCoverage,
  VisibilityScore,
} from './types.ts';

export const AI_READINESS_METHODOLOGY_VERSION = 'horyzon-ai-readiness-v1';
export const AI_SCORE_DISPLAY_METHODOLOGY = 'Horyzon AI Score v1.0';
export const AI_SCORE_METHODOLOGY_EFFECTIVE_DATE = '2026-09-21';
export const AI_SCORE_CONFIDENCE_FORMULA_VERSION = 'horyzon-confidence-v2.1';
export const AI_VISIBILITY_METHODOLOGY_VERSION = 'horyzon-ai-visibility-v1';
export const AI_EXTERNAL_FOOTPRINT_METHODOLOGY_VERSION = 'horyzon-external-footprint-v1';

export const readinessCategories: ReadinessCategoryDefinition[] = [
  { id: 'crawlability_indexability', label: 'Crawlability & Indexability', weight: 15, description: 'Accessibilità HTTP, indicizzazione, robot policy, redirect e contenuto machine-readable.' },
  { id: 'content_quality_citability', label: 'Content Quality & Citability', weight: 20, description: 'Chiarezza, profondità, struttura, citabilità e rapporto tra contenuto utile e boilerplate.' },
  { id: 'entity_semantic_clarity', label: 'Entity & Semantic Clarity', weight: 15, description: 'Ricostruzione di brand, attività, servizi, persone, sedi, relazioni e ambiguità.' },
  { id: 'structured_data', label: 'Structured Data', weight: 10, description: 'Presenza, pertinenza e validità del markup Schema.org utile alla comprensione.' },
  { id: 'authority_trust_evidence', label: 'Authority, Trust & Evidence', weight: 15, description: 'Segnali verificabili di responsabilità, fonti, contatti, privacy, casi e competenza.' },
  { id: 'technical_quality_ux', label: 'Technical Quality & UX', weight: 10, description: 'Qualità tecnica misurabile: metadata, semantica HTML, accessibilità, header e mobile.' },
  { id: 'freshness_maintenance', label: 'Freshness & Content Maintenance', weight: 5, description: 'Date, lastmod, segnali di manutenzione e assenza di contenuti palesemente obsoleti.' },
  { id: 'ai_agent_readiness', label: 'AI / Agent Readiness', weight: 5, description: 'Policy crawler AI, navigazione semantica, alternative machine-readable e agent readiness pertinente.' },
  { id: 'external_brand_footprint', label: 'External Brand Footprint', weight: 5, description: 'Corroborazione esterna dell’identità, attività e autorevolezza del brand tramite provider affidabili.' },
];

export const checkWeightValues: Record<CheckWeightClass, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const visibilityWeights = {
  brandMentionRate: 25,
  citationRate: 25,
  promptCoverage: 20,
  shareOfVoice: 15,
  crossEngineConsistency: 10,
  citationSourceDiversity: 5,
};

export const externalFootprintWeights = {
  externalPresence: 25,
  independentSourceCoverage: 30,
  entityConsistency: 20,
  categoryExpertiseAssociation: 15,
  sourceDiversity: 10,
};

export const methodologyReferences = [
  { label: 'Google Search Central: crawling and indexing', url: 'https://developers.google.com/search/docs/crawling-indexing', scope: 'Crawlability, indexability, robots, sitemap e canonical.' },
  { label: 'Google Search Central: structured data', url: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data', scope: 'Schema markup, pertinenza e dati strutturati.' },
  { label: 'Schema.org documentation', url: 'https://schema.org/docs/documents.html', scope: 'Vocabolario Schema.org e tipi Organization/WebSite/WebPage/Article.' },
  { label: 'Chrome Lighthouse overview', url: 'https://developer.chrome.com/docs/lighthouse/overview/', scope: 'Segnali tecnici, accessibilità e best practice senza usare Lighthouse come media dello score.' },
  { label: 'OpenAI Responses API web search', url: 'https://developers.openai.com/api/docs/guides/tools-web-search', scope: 'Provider candidate per verifiche AI Visibility con fonti/citazioni quando configurato.' },
  { label: 'Gemini API grounding with Google Search', url: 'https://ai.google.dev/gemini-api/docs/google-search', scope: 'Provider candidate per risposte grounded con citazioni e metadata.' },
  { label: 'Perplexity Search API', url: 'https://docs.perplexity.ai/docs/search/quickstart', scope: 'Provider tecnico candidato per risultati web esterni strutturati; non è un’autorità metodologica Horyzon.' },
];

export const accessLevels: AuditAccessLevel[] = ['FREE', 'PREMIUM_AUDIT', 'OPTIMIZATION_PLAN'];

const def = (
  categoryId: ReadinessCategoryId,
  id: string,
  label: string,
  weightClass: CheckWeightClass = 'MEDIUM',
  aggregation: AuditCheckDefinition['aggregation'] = 'site',
  evidenceRequirements: string[] = ['direct evidence']
): AuditCheckDefinition => ({
  id,
  categoryId,
  label,
  weight: checkWeightValues[weightClass],
  weightClass,
  aggregation,
  evidenceRequirements,
  description: label,
});

export const auditCheckDefinitions: AuditCheckDefinition[] = [
  def('crawlability_indexability', 'homepage_http_available', 'Homepage disponibile via HTTP/HTTPS', 'CRITICAL'),
  def('crawlability_indexability', 'homepage_status_success', 'Status code della homepage in classe 2xx', 'CRITICAL'),
  def('crawlability_indexability', 'https_enabled', 'URL finale servito in HTTPS', 'HIGH'),
  def('crawlability_indexability', 'redirect_chain_controlled', 'Catena redirect controllata', 'HIGH'),
  def('crawlability_indexability', 'canonical_present', 'Canonical rilevabile', 'LOW'),
  def('crawlability_indexability', 'canonical_same_origin', 'Canonical coerente con il dominio', 'MEDIUM'),
  def('crawlability_indexability', 'meta_robots_indexable', 'Meta robots non blocca indicizzazione', 'CRITICAL'),
  def('crawlability_indexability', 'x_robots_indexable', 'X-Robots-Tag non blocca indicizzazione', 'HIGH'),
  def('crawlability_indexability', 'robots_txt_available', 'robots.txt raggiungibile', 'MEDIUM'),
  def('crawlability_indexability', 'robots_allows_googlebot', 'robots.txt non blocca Googlebot', 'CRITICAL'),
  def('crawlability_indexability', 'robots_allows_oai_searchbot', 'robots.txt non blocca OAI-SearchBot', 'HIGH'),
  def('crawlability_indexability', 'sitemap_available', 'Sitemap XML rilevabile', 'MEDIUM'),
  def('crawlability_indexability', 'sitemap_same_origin_urls', 'Sitemap con URL coerenti al dominio', 'LOW'),
  def('crawlability_indexability', 'internal_links_present', 'Link interni rilevabili', 'MEDIUM'),
  def('crawlability_indexability', 'crawl_sample_accessible', 'Campione multi-pagina accessibile', 'HIGH', 'page_sample'),
  def('crawlability_indexability', 'main_content_machine_readable', 'Contenuto principale leggibile senza rendering proprietario', 'CRITICAL', 'page_sample'),

  def('content_quality_citability', 'title_present', 'Title presente e leggibile', 'MEDIUM'),
  def('content_quality_citability', 'meta_description_present', 'Meta description presente', 'LOW'),
  def('content_quality_citability', 'h1_present', 'H1 presente nelle pagine principali', 'MEDIUM', 'page_sample'),
  def('content_quality_citability', 'heading_structure', 'Gerarchia heading comprensibile', 'MEDIUM', 'page_sample'),
  def('content_quality_citability', 'critical_pages_depth', 'Pagine principali con profondità informativa sufficiente', 'CRITICAL', 'page_sample'),
  def('content_quality_citability', 'thin_pages_limited', 'Thin content limitato nel campione', 'HIGH', 'page_sample'),
  def('content_quality_citability', 'useful_text_ratio', 'Rapporto contenuto utile/boilerplate accettabile', 'HIGH', 'derived'),
  def('content_quality_citability', 'list_or_table_structure', 'Liste o tabelle quando utili alla scansione', 'LOW'),
  def('content_quality_citability', 'faq_or_question_signals', 'FAQ o segnali domanda-risposta quando pertinenti', 'LOW'),
  def('content_quality_citability', 'definition_signals', 'Definizioni o descrizioni esplicite', 'MEDIUM'),
  def('content_quality_citability', 'examples_or_cases', 'Esempi, casi o applicazioni concrete', 'HIGH'),
  def('content_quality_citability', 'supporting_data_or_sources', 'Dati, fonti o riferimenti a supporto', 'CRITICAL'),
  def('content_quality_citability', 'passage_citability', 'Passaggi citabili e specifici', 'CRITICAL'),

  def('entity_semantic_clarity', 'brand_name_detected', 'Nome brand rilevabile', 'CRITICAL'),
  def('entity_semantic_clarity', 'organization_description', 'Descrizione dell’attività esplicita', 'CRITICAL'),
  def('entity_semantic_clarity', 'service_entity_signals', 'Servizi o offerte identificabili', 'HIGH', 'page_sample'),
  def('entity_semantic_clarity', 'product_entity_signals', 'Prodotti identificabili quando presenti', 'LOW', 'page_sample'),
  def('entity_semantic_clarity', 'audience_signals', 'Audience o problemi serviti rilevabili', 'MEDIUM'),
  def('entity_semantic_clarity', 'people_signals', 'Persone, team o autori identificabili', 'MEDIUM'),
  def('entity_semantic_clarity', 'location_signals', 'Sedi o area operativa rilevabili', 'MEDIUM'),
  def('entity_semantic_clarity', 'contact_signals', 'Contatti rilevabili', 'MEDIUM'),
  def('entity_semantic_clarity', 'same_as_signals', 'sameAs o profili ufficiali collegati', 'MEDIUM'),
  def('entity_semantic_clarity', 'brand_ambiguity_limited', 'Ambiguità del brand limitata', 'HIGH'),

  def('structured_data', 'json_ld_parseable', 'JSON-LD parseabile', 'HIGH'),
  def('structured_data', 'organization_schema', 'Schema Organization pertinente', 'HIGH'),
  def('structured_data', 'website_schema', 'Schema WebSite pertinente', 'MEDIUM'),
  def('structured_data', 'webpage_schema', 'Schema WebPage pertinente', 'LOW'),
  def('structured_data', 'breadcrumb_schema', 'BreadcrumbList quando applicabile', 'LOW'),
  def('structured_data', 'article_schema_alignment', 'Article schema coerente per contenuti editoriali', 'MEDIUM'),
  def('structured_data', 'faq_schema_alignment', 'FAQPage coerente con FAQ visibili', 'LOW'),
  def('structured_data', 'schema_relevance', 'Markup pertinente, non gonfiato', 'CRITICAL'),

  def('authority_trust_evidence', 'about_page_present', 'Pagina About o equivalente presente', 'HIGH'),
  def('authority_trust_evidence', 'contact_page_present', 'Pagina Contact o equivalente presente', 'HIGH'),
  def('authority_trust_evidence', 'privacy_page_present', 'Privacy policy presente', 'MEDIUM'),
  def('authority_trust_evidence', 'legal_terms_present', 'Informazioni legali o termini presenti', 'MEDIUM'),
  def('authority_trust_evidence', 'team_or_author_present', 'Team, autori o responsabilità editoriale presenti', 'HIGH'),
  def('authority_trust_evidence', 'case_study_or_results', 'Case study, risultati o metodologia documentati', 'MEDIUM'),
  def('authority_trust_evidence', 'external_sources_linked', 'Fonti o riferimenti esterni rilevabili', 'HIGH'),
  def('authority_trust_evidence', 'claims_supported', 'Affermazioni supportate da evidenze verificabili', 'CRITICAL'),

  def('technical_quality_ux', 'lang_attribute', 'Attributo lang presente', 'LOW'),
  def('technical_quality_ux', 'viewport_meta', 'Meta viewport presente', 'MEDIUM'),
  def('technical_quality_ux', 'image_alt_coverage', 'Copertura alt text immagini sufficiente', 'MEDIUM'),
  def('technical_quality_ux', 'semantic_landmarks', 'Landmark semantici presenti', 'HIGH'),
  def('technical_quality_ux', 'security_headers', 'Header di sicurezza principali presenti', 'HIGH'),
  def('technical_quality_ux', 'content_type_html', 'Content-Type HTML dichiarato', 'LOW'),
  def('technical_quality_ux', 'mixed_content_absent', 'Mixed content non rilevato nel markup', 'HIGH'),

  def('freshness_maintenance', 'structured_dates', 'Date strutturate rilevabili', 'MEDIUM'),
  def('freshness_maintenance', 'sitemap_lastmod', 'lastmod in sitemap quando disponibile', 'MEDIUM'),
  def('freshness_maintenance', 'article_dates', 'Date editoriali per contenuti articolo', 'MEDIUM'),
  def('freshness_maintenance', 'visible_update_signals', 'Segnali visibili di aggiornamento', 'LOW'),
  def('freshness_maintenance', 'stale_signals_limited', 'Segnali di obsolescenza limitati', 'HIGH'),

  def('ai_agent_readiness', 'ai_crawler_policy', 'Policy crawler AI rilevabile', 'HIGH'),
  def('ai_agent_readiness', 'llms_txt_minor_signal', 'llms.txt rilevato come segnale minore', 'LOW'),
  def('ai_agent_readiness', 'semantic_navigation', 'Navigazione semantica agent-friendly', 'MEDIUM'),
  def('ai_agent_readiness', 'machine_readable_alternatives', 'Alternative machine-readable rilevabili', 'LOW'),
  def('ai_agent_readiness', 'agent_protocols_applicable', 'API o protocolli agentici valutati come pertinenti o N/A', 'LOW'),

  def('external_brand_footprint', 'external_provider_available', 'Provider affidabile per footprint esterno configurato', 'HIGH', 'provider', ['trusted external provider evidence']),
];

export const methodologyDefinition = {
  readinessVersion: AI_READINESS_METHODOLOGY_VERSION,
  visibilityVersion: AI_VISIBILITY_METHODOLOGY_VERSION,
  externalFootprintVersion: AI_EXTERNAL_FOOTPRINT_METHODOLOGY_VERSION,
  effectiveDate: AI_SCORE_METHODOLOGY_EFFECTIVE_DATE,
  displayName: AI_SCORE_DISPLAY_METHODOLOGY,
  categories: readinessCategories,
  checks: auditCheckDefinitions,
  checkWeightValues,
  visibilityWeights,
  externalFootprintWeights,
  references: methodologyReferences,
  confidenceFormulaVersion: AI_SCORE_CONFIDENCE_FORMULA_VERSION,
};

export function confidenceLabel(score: number): EvidenceConfidenceLabel {
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

export function readinessCoverageLabel(value: number): ReadinessCoverage['label'] {
  if (value >= 90) return 'complete';
  if (value >= 60) return 'partial';
  return 'limited';
}

export function calculateCategoryScores(checks: AuditCheck[]): CategoryScore[] {
  return readinessCategories.map((category) => {
    const categoryChecks = checks.filter((check) => check.categoryId === category.id);
    const applicable = categoryChecks.filter((check) => check.status !== 'not_applicable');
    const measured = applicable.filter((check) => check.measured);
    const applicableWeight = applicable.reduce((sum, check) => sum + check.pointsAvailable, 0);
    const pointsAvailable = measured.reduce((sum, check) => sum + check.pointsAvailable, 0);
    const pointsEarned = measured.reduce((sum, check) => sum + check.pointsEarned, 0);
    const coverage = applicableWeight > 0 ? Math.round((pointsAvailable / applicableWeight) * 100) : 100;
    const state: AuditMetricState = measured.length === 0 ? 'not_measured' : coverage < 100 ? 'partial' : 'measured';
    const score = pointsAvailable > 0 ? Math.round((pointsEarned / pointsAvailable) * category.weight) : null;

    return {
      id: category.id,
      label: category.label,
      weight: category.weight,
      state,
      score,
      pointsEarned,
      pointsAvailable,
      coverage,
      checksMeasured: measured.length,
      checksApplicable: applicable.length,
    };
  });
}

export function calculateReadinessCoverage(checks: AuditCheck[]): ReadinessCoverage {
  const applicable = checks.filter((check) => check.status !== 'not_applicable');
  const measured = applicable.filter((check) => check.measured);
  const applicableWeight = applicable.reduce((sum, check) => sum + check.pointsAvailable, 0);
  const measuredWeight = measured.reduce((sum, check) => sum + check.pointsAvailable, 0);
  const value = applicableWeight > 0 ? Math.round((measuredWeight / applicableWeight) * 100) : 0;

  return {
    value,
    label: readinessCoverageLabel(value),
    measuredWeight,
    applicableWeight,
    measuredChecks: measured.length,
    applicableChecks: applicable.length,
  };
}

export function calculateReadinessScore(categoryScores: CategoryScore[]): number | null {
  const measured = categoryScores.filter((category) => category.state !== 'not_measured' && category.score !== null);
  if (measured.length === 0) return null;

  const measuredWeight = measured.reduce((sum, category) => sum + category.weight, 0);
  const weightedScore = measured.reduce((sum, category) => sum + (category.score ?? 0), 0);

  return Math.round((weightedScore / measuredWeight) * 100);
}

export function calculateEvidenceConfidence(input: {
  checks: AuditCheck[];
  crawlSummary: CrawlSummary;
  visibility: VisibilityScore;
  externalBrandFootprint: ExternalBrandFootprintResult;
}): ConfidenceBreakdown & { value: number } {
  const applicable = input.checks.filter((check) => check.status !== 'not_applicable');
  const measured = applicable.filter((check) => check.measured);
  const checksCoverage = applicable.length > 0 ? measured.length / applicable.length : 0;
  const measuredCategories = new Set(measured.map((check) => check.categoryId));
  const categoryCoverage = measuredCategories.size / readinessCategories.length;

  const evidenceItems = measured.flatMap((check) => check.evidence);
  const qualityWeights: number[] = evidenceItems.map((evidence) => {
    switch (evidence.verificationLevel) {
      case 'direct': return 0.9;
      case 'external': return 1;
      case 'derived': return 0.7;
      case 'heuristic': return 0.45;
      case 'provider': return 0.85;
      case 'not_measured': return 0;
      default: return evidence.verification === 'verified' ? 0.75 : evidence.verification === 'present' ? 0.6 : 0.45;
    }
  });
  const evidenceQuality = qualityWeights.length > 0 ? qualityWeights.reduce((sum, item) => sum + item, 0) / qualityWeights.length : 0;

  const expectedPages = Math.min(input.crawlSummary.requestedLimit, 5);
  const crawlCoverage = expectedPages > 0 ? Math.min(1, input.crawlSummary.pagesFetched / expectedPages) : 0;
  const visibilityCoverage = input.visibility.state === 'measured' ? 1 : input.visibility.state === 'partial' ? 0.5 : 0;
  const externalCoverage = input.externalBrandFootprint.state === 'measured' ? 1 : input.externalBrandFootprint.state === 'partial' ? 0.5 : 0;

  const uncappedScore = Math.round((
    checksCoverage * 0.28 +
    evidenceQuality * 0.22 +
    categoryCoverage * 0.18 +
    crawlCoverage * 0.16 +
    externalCoverage * 0.08 +
    visibilityCoverage * 0.08
  ) * 100);
  const providerGapCap = visibilityCoverage === 0 && externalCoverage === 0 ? 79 : 100;
  const score = Math.min(uncappedScore, providerGapCap);

  return {
    value: score,
    score,
    label: confidenceLabel(score),
    checksCoverage: Math.round(checksCoverage * 100),
    evidenceQuality: Math.round(evidenceQuality * 100),
    categoryCoverage: Math.round(categoryCoverage * 100),
    crawlCoverage: Math.round(crawlCoverage * 100),
    visibilityCoverage: Math.round(visibilityCoverage * 100),
    externalCoverage: Math.round(externalCoverage * 100),
    appliedFormulaVersion: AI_SCORE_CONFIDENCE_FORMULA_VERSION,
  };
}

export function projectFreeResult<T extends { premium?: unknown }>(audit: T): Omit<T, 'premium'> {
  const { premium: _premium, ...freeAudit } = audit;
  return freeAudit;
}
