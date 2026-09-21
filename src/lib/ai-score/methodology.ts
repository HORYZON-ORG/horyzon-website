import type {
  AuditAccessLevel,
  AuditCheck,
  AuditCheckDefinition,
  AuditMetricState,
  CategoryScore,
  ConfidenceBreakdown,
  CrawlSummary,
  EvidenceConfidenceLabel,
  ExternalBrandFootprintResult,
  ReadinessCategoryDefinition,
  ReadinessCategoryId,
  VisibilityScore,
} from './types';

export const AI_READINESS_METHODOLOGY_VERSION = 'horyzon-ai-readiness-v1';
export const AI_SCORE_DISPLAY_METHODOLOGY = 'Horyzon AI Score methodology v1.0';
export const AI_SCORE_METHODOLOGY_EFFECTIVE_DATE = '2026-09-21';
export const AI_SCORE_CONFIDENCE_FORMULA_VERSION = 'horyzon-confidence-v2';
export const AI_VISIBILITY_METHODOLOGY_VERSION = 'horyzon-ai-visibility-v1';

export const readinessCategories: ReadinessCategoryDefinition[] = [
  { id: 'crawlability_indexability', label: 'Crawlability & Indexability', weight: 15, description: 'Accessibilità HTTP, indicizzazione, robot policy, redirect e contenuto machine-readable.' },
  { id: 'content_quality_citability', label: 'Content Quality & Citability', weight: 20, description: 'Chiarezza, profondità, struttura, citabilità e rapporto tra contenuto utile e boilerplate.' },
  { id: 'entity_semantic_clarity', label: 'Entity & Semantic Clarity', weight: 15, description: 'Ricostruzione di brand, attività, servizi, persone, sedi, relazioni e ambiguità.' },
  { id: 'structured_data', label: 'Structured Data', weight: 10, description: 'Presenza, pertinenza e validità del markup Schema.org utile alla comprensione.' },
  { id: 'authority_trust_evidence', label: 'Authority, Trust & Evidence', weight: 15, description: 'Segnali verificabili di responsabilità, fonti, contatti, privacy, casi e competenza.' },
  { id: 'technical_quality_ux', label: 'Technical Quality & UX', weight: 10, description: 'Qualità tecnica misurabile: metadata, semantica HTML, accessibilità, header e mobile.' },
  { id: 'freshness_maintenance', label: 'Freshness & Content Maintenance', weight: 5, description: 'Date, lastmod, segnali di manutenzione e assenza di contenuti palesemente obsoleti.' },
  { id: 'ai_agent_readiness', label: 'AI / Agent Readiness', weight: 5, description: 'Policy crawler AI, navigazione semantica, alternative machine-readable e agent readiness pertinente.' },
  { id: 'external_brand_footprint', label: 'External Brand Footprint', weight: 5, description: 'Fonti indipendenti, profili, menzioni e coerenza del brand tramite provider affidabili.' },
];

export const visibilityWeights = {
  brandMentionRate: 25,
  citationRate: 25,
  promptCoverage: 20,
  shareOfVoice: 15,
  crossEngineConsistency: 10,
  citationSourceDiversity: 5,
};

export const accessLevels: AuditAccessLevel[] = ['FREE', 'PREMIUM_AUDIT', 'OPTIMIZATION_PLAN'];

const def = (
  categoryId: ReadinessCategoryId,
  id: string,
  label: string,
  weight = 1,
  aggregation: AuditCheckDefinition['aggregation'] = 'site',
  evidenceRequirements: string[] = ['direct evidence']
): AuditCheckDefinition => ({
  id,
  categoryId,
  label,
  weight,
  aggregation,
  evidenceRequirements,
  description: label,
});

export const auditCheckDefinitions: AuditCheckDefinition[] = [
  def('crawlability_indexability', 'homepage_http_available', 'Homepage disponibile via HTTP/HTTPS'),
  def('crawlability_indexability', 'homepage_status_success', 'Status code della homepage in classe 2xx'),
  def('crawlability_indexability', 'https_enabled', 'URL finale servito in HTTPS'),
  def('crawlability_indexability', 'redirect_chain_controlled', 'Catena redirect controllata'),
  def('crawlability_indexability', 'canonical_present', 'Canonical rilevabile'),
  def('crawlability_indexability', 'canonical_same_origin', 'Canonical coerente con il dominio'),
  def('crawlability_indexability', 'meta_robots_indexable', 'Meta robots non blocca indicizzazione'),
  def('crawlability_indexability', 'x_robots_indexable', 'X-Robots-Tag non blocca indicizzazione'),
  def('crawlability_indexability', 'robots_txt_available', 'robots.txt raggiungibile'),
  def('crawlability_indexability', 'robots_allows_googlebot', 'robots.txt non blocca Googlebot'),
  def('crawlability_indexability', 'robots_allows_oai_searchbot', 'robots.txt non blocca OAI-SearchBot'),
  def('crawlability_indexability', 'sitemap_available', 'Sitemap XML rilevabile'),
  def('crawlability_indexability', 'sitemap_same_origin_urls', 'Sitemap con URL coerenti al dominio'),
  def('crawlability_indexability', 'internal_links_present', 'Link interni rilevabili'),
  def('crawlability_indexability', 'crawl_sample_accessible', 'Campione multi-pagina accessibile', 1, 'page_sample'),
  def('crawlability_indexability', 'main_content_machine_readable', 'Contenuto principale leggibile senza rendering proprietario', 1, 'page_sample'),

  def('content_quality_citability', 'title_present', 'Title presente e leggibile'),
  def('content_quality_citability', 'meta_description_present', 'Meta description presente'),
  def('content_quality_citability', 'h1_present', 'H1 presente nelle pagine principali', 1, 'page_sample'),
  def('content_quality_citability', 'heading_structure', 'Gerarchia heading comprensibile', 1, 'page_sample'),
  def('content_quality_citability', 'critical_pages_depth', 'Pagine principali con profondità informativa sufficiente', 1, 'page_sample'),
  def('content_quality_citability', 'thin_pages_limited', 'Thin content limitato nel campione', 1, 'page_sample'),
  def('content_quality_citability', 'useful_text_ratio', 'Rapporto contenuto utile/boilerplate accettabile', 1, 'derived'),
  def('content_quality_citability', 'list_or_table_structure', 'Liste o tabelle quando utili alla scansione'),
  def('content_quality_citability', 'faq_or_question_signals', 'FAQ o segnali domanda-risposta quando pertinenti'),
  def('content_quality_citability', 'definition_signals', 'Definizioni o descrizioni esplicite'),
  def('content_quality_citability', 'examples_or_cases', 'Esempi, casi o applicazioni concrete'),
  def('content_quality_citability', 'supporting_data_or_sources', 'Dati, fonti o riferimenti a supporto'),
  def('content_quality_citability', 'passage_citability', 'Passaggi citabili e specifici'),

  def('entity_semantic_clarity', 'brand_name_detected', 'Nome brand rilevabile'),
  def('entity_semantic_clarity', 'organization_description', 'Descrizione dell’attività esplicita'),
  def('entity_semantic_clarity', 'service_entity_signals', 'Servizi o offerte identificabili', 1, 'page_sample'),
  def('entity_semantic_clarity', 'product_entity_signals', 'Prodotti identificabili quando presenti', 1, 'page_sample'),
  def('entity_semantic_clarity', 'audience_signals', 'Audience o problemi serviti rilevabili'),
  def('entity_semantic_clarity', 'people_signals', 'Persone, team o autori identificabili'),
  def('entity_semantic_clarity', 'location_signals', 'Sedi o area operativa rilevabili'),
  def('entity_semantic_clarity', 'contact_signals', 'Contatti rilevabili'),
  def('entity_semantic_clarity', 'same_as_signals', 'sameAs o profili ufficiali collegati'),
  def('entity_semantic_clarity', 'brand_ambiguity_limited', 'Ambiguità del brand limitata'),

  def('structured_data', 'json_ld_parseable', 'JSON-LD parseabile'),
  def('structured_data', 'organization_schema', 'Schema Organization pertinente'),
  def('structured_data', 'website_schema', 'Schema WebSite pertinente'),
  def('structured_data', 'webpage_schema', 'Schema WebPage pertinente'),
  def('structured_data', 'breadcrumb_schema', 'BreadcrumbList quando applicabile'),
  def('structured_data', 'article_schema_alignment', 'Article schema coerente per contenuti editoriali'),
  def('structured_data', 'faq_schema_alignment', 'FAQPage coerente con FAQ visibili'),
  def('structured_data', 'schema_relevance', 'Markup pertinente, non gonfiato'),

  def('authority_trust_evidence', 'about_page_present', 'Pagina About o equivalente presente'),
  def('authority_trust_evidence', 'contact_page_present', 'Pagina Contact o equivalente presente'),
  def('authority_trust_evidence', 'privacy_page_present', 'Privacy policy presente'),
  def('authority_trust_evidence', 'legal_terms_present', 'Informazioni legali o termini presenti'),
  def('authority_trust_evidence', 'team_or_author_present', 'Team, autori o responsabilità editoriale presenti'),
  def('authority_trust_evidence', 'case_study_or_results', 'Case study, risultati o metodologia documentati'),
  def('authority_trust_evidence', 'external_sources_linked', 'Fonti o riferimenti esterni rilevabili'),
  def('authority_trust_evidence', 'claims_supported', 'Affermazioni supportate da evidenze verificabili'),

  def('technical_quality_ux', 'lang_attribute', 'Attributo lang presente'),
  def('technical_quality_ux', 'viewport_meta', 'Meta viewport presente'),
  def('technical_quality_ux', 'image_alt_coverage', 'Copertura alt text immagini sufficiente'),
  def('technical_quality_ux', 'semantic_landmarks', 'Landmark semantici presenti'),
  def('technical_quality_ux', 'security_headers', 'Header di sicurezza principali presenti'),
  def('technical_quality_ux', 'content_type_html', 'Content-Type HTML dichiarato'),
  def('technical_quality_ux', 'mixed_content_absent', 'Mixed content non rilevato nel markup'),

  def('freshness_maintenance', 'structured_dates', 'Date strutturate rilevabili'),
  def('freshness_maintenance', 'sitemap_lastmod', 'lastmod in sitemap quando disponibile'),
  def('freshness_maintenance', 'article_dates', 'Date editoriali per contenuti articolo'),
  def('freshness_maintenance', 'visible_update_signals', 'Segnali visibili di aggiornamento'),
  def('freshness_maintenance', 'stale_signals_limited', 'Segnali di obsolescenza limitati'),

  def('ai_agent_readiness', 'ai_crawler_policy', 'Policy crawler AI rilevabile'),
  def('ai_agent_readiness', 'llms_txt_minor_signal', 'llms.txt rilevato come segnale minore'),
  def('ai_agent_readiness', 'semantic_navigation', 'Navigazione semantica agent-friendly'),
  def('ai_agent_readiness', 'machine_readable_alternatives', 'Alternative machine-readable rilevabili'),
  def('ai_agent_readiness', 'agent_protocols_applicable', 'API o protocolli agentici valutati come pertinenti o N/A'),

  def('external_brand_footprint', 'external_provider_available', 'Provider affidabile per footprint esterno configurato', 1, 'provider', ['trusted external provider evidence']),
];

export const methodologyDefinition = {
  readinessVersion: AI_READINESS_METHODOLOGY_VERSION,
  visibilityVersion: AI_VISIBILITY_METHODOLOGY_VERSION,
  effectiveDate: AI_SCORE_METHODOLOGY_EFFECTIVE_DATE,
  displayName: AI_SCORE_DISPLAY_METHODOLOGY,
  categories: readinessCategories,
  checks: auditCheckDefinitions,
  confidenceFormulaVersion: AI_SCORE_CONFIDENCE_FORMULA_VERSION,
};

export function confidenceLabel(score: number): EvidenceConfidenceLabel {
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

export function calculateCategoryScores(checks: AuditCheck[]): CategoryScore[] {
  return readinessCategories.map((category) => {
    const categoryChecks = checks.filter((check) => check.categoryId === category.id);
    const applicable = categoryChecks.filter((check) => check.status !== 'not_applicable');
    const measured = applicable.filter((check) => check.measured);
    const pointsAvailable = measured.reduce((sum, check) => sum + check.pointsAvailable, 0);
    const pointsEarned = measured.reduce((sum, check) => sum + check.pointsEarned, 0);
    const state: AuditMetricState = measured.length === 0 ? 'not_measured' : measured.length < applicable.length ? 'partial' : 'measured';
    const score = pointsAvailable > 0 ? Math.round((pointsEarned / pointsAvailable) * category.weight) : null;

    return {
      id: category.id,
      label: category.label,
      weight: category.weight,
      state,
      score,
      pointsEarned,
      pointsAvailable,
      checksMeasured: measured.length,
      checksApplicable: applicable.length,
    };
  });
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
  const qualityWeights = evidenceItems.map((evidence) => {
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

  const score = Math.round((
    checksCoverage * 0.28 +
    evidenceQuality * 0.22 +
    categoryCoverage * 0.18 +
    crawlCoverage * 0.16 +
    externalCoverage * 0.08 +
    visibilityCoverage * 0.08
  ) * 100);

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
