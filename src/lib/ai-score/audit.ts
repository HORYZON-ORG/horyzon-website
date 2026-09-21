import { createHash, randomUUID } from 'node:crypto';
import { AI_READINESS_METHODOLOGY_VERSION, AI_SCORE_DISPLAY_METHODOLOGY, AI_VISIBILITY_METHODOLOGY_VERSION, accessLevels, calculateCategoryScores, calculateEvidenceConfidence, calculateReadinessScore, projectFreeResult, visibilityWeights } from './methodology';
import { SafeFetchError, normalizeAuditUrl, safeFetch } from './ssrf';
import type { AuditCheck, AuditPipelineState, CheckStatus, EntityAnalysis, FreeAuditResult, InternalAuditResult, ReadinessCategoryId, RemediationItem, StructuredDataStatus, VisibilityScore } from './types';

interface HtmlFacts {
  title: string | null;
  description: string | null;
  canonical: string | null;
  metaRobots: string | null;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  text: string;
  links: string[];
  images: { alt: string | null }[];
  jsonLdTypes: string[];
  jsonLdStatus: StructuredDataStatus;
  sameAs: string[];
  dates: string[];
  lang: string | null;
  hasMain: boolean;
  hasNav: boolean;
  hasArticle: boolean;
}

interface AuditContext {
  requestedUrl: URL;
  finalUrl: string;
  domain: string;
  status: number;
  headers: Headers;
  html: string;
  redirects: string[];
  robots?: string;
  sitemap?: string;
  llms?: string;
  facts: HtmlFacts;
}

export async function runAiScoreAudit(rawUrl: string, onState: (state: AuditPipelineState, label: string) => void): Promise<FreeAuditResult> {
  onState('queued', 'Preparazione analisi');
  const requestedUrl = normalizeAuditUrl(rawUrl);
  onState('crawling', 'Verifica accessibilita');
  const page = await safeFetch(requestedUrl);
  const final = new URL(page.url);
  const [robots, sitemap, llms] = await Promise.all([
    fetchOptionalAsset(new URL('/robots.txt', final)),
    fetchOptionalAsset(new URL('/sitemap.xml', final)),
    fetchOptionalAsset(new URL('/llms.txt', final)),
  ]);
  onState('analyzing', 'Analisi struttura e contenuti');
  const facts = analyzeHtml(page.body);
  const context: AuditContext = { requestedUrl, finalUrl: page.url, domain: final.hostname, status: page.status, headers: page.headers, html: page.body, redirects: page.redirects, robots, sitemap, llms, facts };
  const checks = buildChecks(context);
  const entityAnalysis = buildEntityAnalysis(context);
  onState('visibility_check', 'Verifica visibilita AI');
  const visibility = buildUnmeasuredVisibility(context.domain);
  onState('scoring', 'Calcolo risultati');
  const categoryScores = calculateCategoryScores(checks);
  const readiness = calculateReadinessScore(categoryScores);
  const confidence = calculateEvidenceConfidence(checks, categoryScores.filter(category => category.state !== 'not_measured').length);
  const opportunities = countOpportunities(checks);
  const premium = buildPremiumPayload(checks, categoryScores, entityAnalysis, visibility, readiness.score);
  const status = readiness.state === 'measured' && confidence.value >= 50 ? 'completed' : 'partial';
  const audit: InternalAuditResult = {
    auditId: randomUUID(),
    accessLevel: 'FREE',
    domain: context.domain,
    finalUrl: context.finalUrl,
    analyzedAt: new Date().toISOString(),
    methodologyVersion: AI_SCORE_DISPLAY_METHODOLOGY,
    readiness,
    visibility,
    confidence,
    interpretation: interpretResult(readiness.score, confidence.value, opportunities.total, visibility.state),
    opportunities,
    status,
    notice: status === 'partial' ? 'Alcune aree non sono state misurate con provider indipendenti in questa versione gratuita.' : undefined,
    locked: { premiumAudit: true, optimizationPlan: true, availableLevels: [...accessLevels], priceConfigured: false },
    premium,
  };
  onState(status, status === 'completed' ? 'Analisi completata' : 'Analisi parziale completata');
  return projectFreeResult(audit);
}

async function fetchOptionalAsset(url: URL) {
  try {
    const response = await safeFetch(url, { timeoutMs: 4500, maxBytes: 180_000, maxRedirects: 2 });
    return response.status >= 200 && response.status < 400 ? response.body : undefined;
  } catch {
    return undefined;
  }
}

function buildChecks(context: AuditContext): AuditCheck[] {
  const facts = context.facts;
  const textLength = facts.text.length;
  const wordCount = countWords(facts.text);
  const aboutOrContact = hasLinkLike(facts.links, ['about', 'chi-siamo', 'contatti', 'contact']);
  const privacyOrLegal = hasLinkLike(facts.links, ['privacy', 'cookie', 'legal', 'terms']);
  const crawlPolicy = parseCrawlerPolicy(context.robots);
  const usefulLinks = facts.links.filter(link => !link.startsWith('#')).length;
  const checks: AuditCheck[] = [];

  add(checks, 'http_availability', 'Disponibilita HTTP', 'crawlability_indexability', context.status < 400 ? 'pass' : 'fail', 3, context.status < 400 ? 3 : 0, true, [`Status ${context.status}`], context.finalUrl);
  add(checks, 'https', 'HTTPS', 'crawlability_indexability', context.finalUrl.startsWith('https://') ? 'pass' : 'fail', 2, context.finalUrl.startsWith('https://') ? 2 : 0, true, [new URL(context.finalUrl).protocol.replace(':', '').toUpperCase()], context.finalUrl);
  add(checks, 'redirects', 'Redirect rivalidati', 'crawlability_indexability', context.redirects.length <= 1 ? 'pass' : 'partial', 1, context.redirects.length <= 1 ? 1 : 0.5, true, [`${context.redirects.length} redirect`], context.finalUrl);
  add(checks, 'robots_txt', 'robots.txt', 'crawlability_indexability', context.robots ? 'pass' : 'partial', 2, context.robots ? 2 : 0.8, true, [context.robots ? 'robots.txt trovato' : 'robots.txt non trovato'], new URL('/robots.txt', context.finalUrl).toString());
  add(checks, 'sitemap_xml', 'sitemap.xml', 'crawlability_indexability', context.sitemap ? 'pass' : 'partial', 2, context.sitemap ? 2 : 0.8, true, [context.sitemap ? 'sitemap.xml trovata' : 'sitemap.xml non trovata'], new URL('/sitemap.xml', context.finalUrl).toString());
  add(checks, 'canonical', 'Canonical', 'crawlability_indexability', facts.canonical ? 'pass' : 'partial', 2, facts.canonical ? 2 : 0.7, true, [facts.canonical ?? 'Canonical non rilevato'], context.finalUrl);
  add(checks, 'meta_robots', 'Meta robots', 'crawlability_indexability', facts.metaRobots?.includes('noindex') ? 'fail' : facts.metaRobots ? 'pass' : 'partial', 1, facts.metaRobots?.includes('noindex') ? 0 : facts.metaRobots ? 1 : 0.7, true, [facts.metaRobots ?? 'Meta robots non rilevato'], context.finalUrl);
  add(checks, 'internal_links', 'Internal linking', 'crawlability_indexability', usefulLinks >= 8 ? 'pass' : usefulLinks >= 3 ? 'partial' : 'fail', 2, usefulLinks >= 8 ? 2 : usefulLinks >= 3 ? 1 : 0, true, [`${usefulLinks} link rilevati nella pagina`], context.finalUrl);

  add(checks, 'page_purpose', 'Intento della pagina', 'content_quality_citability', facts.title && facts.description ? 'pass' : 'partial', 3, facts.title && facts.description ? 3 : 1.5, true, [facts.title ?? 'Title assente', facts.description ?? 'Meta description assente'], context.finalUrl);
  add(checks, 'heading_structure', 'Struttura H1/H2/H3', 'content_quality_citability', facts.headings.h1.length === 1 && facts.headings.h2.length >= 2 ? 'pass' : facts.headings.h1.length >= 1 ? 'partial' : 'fail', 3, facts.headings.h1.length === 1 && facts.headings.h2.length >= 2 ? 3 : facts.headings.h1.length >= 1 ? 1.5 : 0, true, [`H1: ${facts.headings.h1.length}`, `H2: ${facts.headings.h2.length}`], context.finalUrl);
  add(checks, 'content_depth', 'Profondita del contenuto', 'content_quality_citability', wordCount >= 700 ? 'pass' : wordCount >= 250 ? 'partial' : 'fail', 4, wordCount >= 700 ? 4 : wordCount >= 250 ? 2 : 0.5, true, [`Circa ${wordCount} parole leggibili`], context.finalUrl);
  add(checks, 'specificity', 'Informazioni specifiche e verificabili', 'content_quality_citability', hasEvidenceLanguage(facts.text) ? 'pass' : 'partial', 3, hasEvidenceLanguage(facts.text) ? 3 : 1.4, true, [hasEvidenceLanguage(facts.text) ? 'Sono presenti segnali di dati, date, casi o riferimenti' : 'Pochi segnali di dati, date, casi o riferimenti'], context.finalUrl);
  add(checks, 'faq_lists_tables', 'Sezioni scansionabili', 'content_quality_citability', hasScannableStructure(context.html) ? 'pass' : 'partial', 2, hasScannableStructure(context.html) ? 2 : 0.9, true, [hasScannableStructure(context.html) ? 'Liste, FAQ o tabelle rilevate' : 'Struttura scansionabile limitata'], context.finalUrl);
  add(checks, 'useful_content_ratio', 'Contenuto utile rispetto al markup', 'content_quality_citability', textLength > 1200 ? 'pass' : textLength > 500 ? 'partial' : 'fail', 3, textLength > 1200 ? 3 : textLength > 500 ? 1.5 : 0.5, true, [`${textLength} caratteri testuali estratti`], context.finalUrl);
  add(checks, 'citability', 'Citabilita dei passaggi', 'content_quality_citability', facts.headings.h2.length >= 3 && wordCount >= 500 ? 'pass' : 'partial', 2, facts.headings.h2.length >= 3 && wordCount >= 500 ? 2 : 0.8, true, ['Valutazione euristica su heading e profondita del testo'], context.finalUrl);

  add(checks, 'brand_clarity', 'Chiarezza del brand', 'entity_semantic_clarity', facts.title || entityFromStructuredData(context.html).brandName ? 'pass' : 'partial', 3, facts.title || entityFromStructuredData(context.html).brandName ? 3 : 1, true, [entityFromStructuredData(context.html).brandName ?? facts.title ?? 'Brand non ricostruito'], context.finalUrl);
  add(checks, 'organization_description', 'Descrizione esplicita attivita', 'entity_semantic_clarity', facts.description ? 'pass' : 'partial', 3, facts.description ? 3 : 1.2, true, [facts.description ?? 'Descrizione non rilevata'], context.finalUrl);
  add(checks, 'services_clarity', 'Chiarezza servizi/prodotti', 'entity_semantic_clarity', findServiceSignals(facts.text).length >= 2 ? 'pass' : 'partial', 3, findServiceSignals(facts.text).length >= 2 ? 3 : 1.4, true, findServiceSignals(facts.text).slice(0, 3), context.finalUrl);
  add(checks, 'about_contact', 'About e contatti', 'entity_semantic_clarity', aboutOrContact ? 'pass' : 'partial', 2, aboutOrContact ? 2 : 0.7, true, [aboutOrContact ? 'Link istituzionali rilevati' : 'Link About/Contact non evidenti'], context.finalUrl);
  add(checks, 'semantic_relations', 'Relazioni sameAs', 'entity_semantic_clarity', facts.sameAs.length > 0 ? 'pass' : 'partial', 2, facts.sameAs.length > 0 ? 2 : 0.6, true, facts.sameAs.length ? facts.sameAs.slice(0, 4) : ['sameAs non rilevato'], context.finalUrl);
  add(checks, 'semantic_html', 'HTML semantico', 'entity_semantic_clarity', facts.hasMain && facts.hasNav ? 'pass' : 'partial', 2, facts.hasMain && facts.hasNav ? 2 : 0.8, true, [`main: ${facts.hasMain}`, `nav: ${facts.hasNav}`, `article: ${facts.hasArticle}`], context.finalUrl);

  add(checks, 'json_ld_presence', 'JSON-LD pertinente', 'structured_data', facts.jsonLdTypes.length > 0 ? 'pass' : 'partial', 4, facts.jsonLdTypes.length > 0 ? 4 : 1, true, facts.jsonLdTypes.length ? facts.jsonLdTypes : ['Nessun JSON-LD rilevato'], context.finalUrl);
  add(checks, 'json_ld_validity', 'Validita JSON-LD', 'structured_data', facts.jsonLdStatus === 'valid' ? 'pass' : facts.jsonLdStatus === 'invalid' ? 'fail' : 'partial', 3, facts.jsonLdStatus === 'valid' ? 3 : facts.jsonLdStatus === 'invalid' ? 0 : 1, true, [`Stato: ${facts.jsonLdStatus}`], context.finalUrl);
  add(checks, 'schema_relevance', 'Coerenza structured data', 'structured_data', hasRelevantSchema(facts.jsonLdTypes) ? 'pass' : 'partial', 3, hasRelevantSchema(facts.jsonLdTypes) ? 3 : 1, true, facts.jsonLdTypes.length ? facts.jsonLdTypes : ['Schema non valutabile'], context.finalUrl);

  add(checks, 'company_trust_pages', 'Pagine fiducia e informazioni aziendali', 'authority_trust_evidence', aboutOrContact && privacyOrLegal ? 'pass' : aboutOrContact || privacyOrLegal ? 'partial' : 'fail', 4, aboutOrContact && privacyOrLegal ? 4 : aboutOrContact || privacyOrLegal ? 2 : 0, true, [`About/Contact: ${aboutOrContact}`, `Legal/Privacy: ${privacyOrLegal}`], context.finalUrl);
  add(checks, 'sources_references', 'Fonti e riferimenti', 'authority_trust_evidence', hasEvidenceLanguage(facts.text) ? 'pass' : 'partial', 3, hasEvidenceLanguage(facts.text) ? 3 : 1, true, [hasEvidenceLanguage(facts.text) ? 'Segnali di evidenze presenti' : 'Evidenze esplicite limitate'], context.finalUrl);
  add(checks, 'editorial_responsibility', 'Responsabilita editoriale', 'authority_trust_evidence', /autore|author|team|founder|consulente|responsabile|metodo/i.test(facts.text) ? 'pass' : 'partial', 3, /autore|author|team|founder|consulente|responsabile|metodo/i.test(facts.text) ? 3 : 1.2, true, ['Ricerca di autore, team, metodo o responsabilita dichiarata'], context.finalUrl);
  add(checks, 'case_studies_results', 'Risultati documentati', 'authority_trust_evidence', /case study|caso studio|risultat|client|progett|metodolog/i.test(facts.text) ? 'pass' : 'partial', 3, /case study|caso studio|risultat|client|progett|metodolog/i.test(facts.text) ? 3 : 1, true, ['Ricerca di casi, risultati, progetti o metodologia'], context.finalUrl);
  add(checks, 'contactability', 'Contattabilita', 'authority_trust_evidence', /mailto:|tel:|contatti|contact/i.test(context.html) ? 'pass' : 'partial', 2, /mailto:|tel:|contatti|contact/i.test(context.html) ? 2 : 0.7, true, ['Email, telefono o pagina contatti'], context.finalUrl);

  add(checks, 'technical_metadata', 'Title, description e viewport', 'technical_quality_ux', facts.title && facts.description && /<meta[^>]+name=["']viewport["']/i.test(context.html) ? 'pass' : 'partial', 3, facts.title && facts.description && /<meta[^>]+name=["']viewport["']/i.test(context.html) ? 3 : 1.2, true, ['Metadata tecnici osservati'], context.finalUrl);
  add(checks, 'security_headers', 'Security headers', 'technical_quality_ux', scoreSecurityHeaders(context.headers) >= 3 ? 'pass' : 'partial', 2, Math.min(2, scoreSecurityHeaders(context.headers) / 2), true, [`${scoreSecurityHeaders(context.headers)} security header rilevati`], context.finalUrl);
  add(checks, 'image_alt', 'Alt text immagini', 'technical_quality_ux', imageAltRatio(facts.images) >= 0.8 ? 'pass' : imageAltRatio(facts.images) >= 0.4 ? 'partial' : 'fail', 2, imageAltRatio(facts.images) >= 0.8 ? 2 : imageAltRatio(facts.images) >= 0.4 ? 1 : 0, true, [`Alt ratio ${Math.round(imageAltRatio(facts.images) * 100)}%`], context.finalUrl);
  add(checks, 'rendered_text_available', 'Contenuto machine-readable', 'technical_quality_ux', textLength > 900 ? 'pass' : textLength > 300 ? 'partial' : 'fail', 3, textLength > 900 ? 3 : textLength > 300 ? 1.5 : 0, true, [`${textLength} caratteri leggibili senza rendering browser`], context.finalUrl);

  add(checks, 'dates', 'Date pubblicate o modificate', 'freshness_maintenance', facts.dates.length > 0 ? 'pass' : 'partial', 2, facts.dates.length > 0 ? 2 : 0.6, true, facts.dates.length ? facts.dates.slice(0, 3) : ['Date non rilevate'], context.finalUrl);
  add(checks, 'sitemap_lastmod', 'Sitemap lastmod', 'freshness_maintenance', context.sitemap?.includes('<lastmod>') ? 'pass' : context.sitemap ? 'partial' : 'unknown', 2, context.sitemap?.includes('<lastmod>') ? 2 : context.sitemap ? 0.8 : 0, Boolean(context.sitemap), [context.sitemap ? 'Sitemap ispezionata' : 'Sitemap non disponibile'], new URL('/sitemap.xml', context.finalUrl).toString());
  add(checks, 'maintenance_signals', 'Segnali di manutenzione', 'freshness_maintenance', /aggiornat|updated|202[4-6]|lastmod|news|blog|insight/i.test(context.html) ? 'pass' : 'partial', 1, /aggiornat|updated|202[4-6]|lastmod|news|blog|insight/i.test(context.html) ? 1 : 0.3, true, ['Ricerca di aggiornamenti, news, insight o date recenti'], context.finalUrl);

  add(checks, 'ai_crawler_policy', 'Policy crawler AI', 'ai_agent_readiness', crawlPolicy ? 'pass' : context.robots ? 'partial' : 'unknown', 1.5, crawlPolicy ? 1.5 : context.robots ? 0.5 : 0, Boolean(context.robots), [crawlPolicy ?? 'Policy AI crawler non misurabile senza robots.txt'], new URL('/robots.txt', context.finalUrl).toString());
  add(checks, 'semantic_navigation', 'Navigazione semantica', 'ai_agent_readiness', facts.hasNav && usefulLinks >= 6 ? 'pass' : 'partial', 1.5, facts.hasNav && usefulLinks >= 6 ? 1.5 : 0.6, true, [`nav: ${facts.hasNav}`, `${usefulLinks} link`], context.finalUrl);
  add(checks, 'llms_txt', 'llms.txt', 'ai_agent_readiness', context.llms ? 'pass' : 'not_applicable', 1, context.llms ? 1 : 0, true, [context.llms ? 'llms.txt trovato' : 'N/A: segnale sperimentale, non fattore ufficiale'], new URL('/llms.txt', context.finalUrl).toString());
  add(checks, 'agent_protocols', 'API, MCP o protocolli agentici', 'ai_agent_readiness', 'not_applicable', 1, 0, true, ['N/A se non pertinente al modello del sito'], context.finalUrl);

  add(checks, 'external_brand_provider', 'External brand footprint', 'external_brand_footprint', 'unknown', 5, 0, false, ['Provider esterno non configurato: nessun dato inventato'], undefined);
  return checks;
}

function add(checks: AuditCheck[], id: string, label: string, categoryId: ReadinessCategoryId, status: CheckStatus, pointsAvailable: number, pointsEarned: number, measured: boolean, evidenceValues: string[], sourceUrl?: string) {
  checks.push({
    id,
    label,
    categoryId,
    status,
    pointsAvailable,
    pointsEarned: Math.max(0, Math.min(pointsAvailable, pointsEarned)),
    measured,
    evidence: evidenceValues.map(value => ({ label, value, sourceUrl, verification: measured ? 'verified' : 'present' })),
  });
}

function analyzeHtml(html: string): HtmlFacts {
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  return {
    title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: metaContent(html, 'description'),
    canonical: firstMatch(html, /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/i) ?? firstMatch(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["']/i),
    metaRobots: metaContent(html, 'robots'),
    headings: { h1: tagTexts(html, 'h1'), h2: tagTexts(html, 'h2'), h3: tagTexts(html, 'h3') },
    text: decodeEntities(clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
    links: [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)].map(match => match[1]),
    images: [...html.matchAll(/<img\b[^>]*>/gi)].map(match => ({ alt: firstMatch(match[0], /\salt=["']([^"']*)["']/i) })),
    jsonLdTypes: jsonLdTypes(html),
    jsonLdStatus: jsonLdStatus(html),
    sameAs: sameAsValues(html),
    dates: [...html.matchAll(/(?:datePublished|dateModified|datetime)=["']([^"']+)["']/gi)].map(match => match[1]),
    lang: firstMatch(html, /<html[^>]+lang=["']([^"']+)["']/i),
    hasMain: /<main[\s>]/i.test(html),
    hasNav: /<nav[\s>]/i.test(html),
    hasArticle: /<article[\s>]/i.test(html),
  };
}

function buildEntityAnalysis(context: AuditContext): EntityAnalysis {
  const structured = entityFromStructuredData(context.html);
  return {
    brandName: structured.brandName ?? context.facts.title?.split(/[|—-]/)[0]?.trim(),
    organizationType: structured.organizationType,
    description: context.facts.description ?? undefined,
    services: findServiceSignals(context.facts.text),
    people: [...new Set([...context.facts.text.matchAll(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g)].map(match => match[0]).slice(0, 8))],
    locations: [...new Set([...context.facts.text.matchAll(/\b(Milano|Roma|Torino|Bologna|Napoli|Italia|Italy)\b/gi)].map(match => match[0]).slice(0, 8))],
    sameAs: context.facts.sameAs,
    ambiguitySignals: context.facts.title ? [] : ['Title assente: ricostruzione del brand meno affidabile'],
  };
}

function buildUnmeasuredVisibility(domain: string): VisibilityScore {
  return {
    state: 'not_measured',
    score: null,
    methodologyVersion: AI_VISIBILITY_METHODOLOGY_VERSION,
    blocker: `Nessun provider AI Visibility affidabile configurato per verificare menzioni e citazioni di ${domain}.`,
    weights: visibilityWeights,
    prompts: [],
    evidence: [],
  };
}

function buildPremiumPayload(checks: AuditCheck[], categoryScores: InternalAuditResult['premium']['categoryScores'], entityAnalysis: EntityAnalysis, visibilityDetail: VisibilityScore, readinessScore: number | null) {
  const remediationSummary = checks.filter(check => check.measured && ['fail', 'partial'].includes(check.status)).map<RemediationItem>(check => ({
    checkId: check.id,
    title: check.label,
    whyItMatters: 'Questo controllo contribuisce alla capacita del sito di essere letto, compreso o citato da crawler e sistemi AI.',
    priority: check.status === 'fail' ? 'critical' : 'optimization',
    effort: check.pointsAvailable >= 3 ? 'medium' : 'low',
    expectedImpact: check.pointsAvailable >= 3 ? 'medium' : 'low',
  }));
  return { categoryScores, checks, entityAnalysis, visibilityDetail, potentialScore: readinessScore === null ? null : Math.min(100, readinessScore + Math.min(18, remediationSummary.length * 2)), remediationSummary };
}

function countOpportunities(checks: AuditCheck[]) {
  const open = checks.filter(check => check.measured && (check.status === 'fail' || check.status === 'partial'));
  const critical = open.filter(check => check.status === 'fail').length;
  const important = open.filter(check => check.status === 'partial' && check.pointsAvailable >= 3).length;
  const optimization = Math.max(0, open.length - critical - important);
  return { total: open.length, critical, important, optimization };
}

function interpretResult(score: number | null, confidence: number, opportunities: number, visibilityState: VisibilityScore['state']) {
  if (score === null) return 'Non sono disponibili evidenze sufficienti per misurare la predisposizione AI del sito senza rischiare una stima arbitraria.';
  const base = score >= 80 ? 'Il sito presenta una base solida per accessibilita, comprensione e citabilita da parte dei sistemi AI.' : score >= 55 ? 'Il sito mostra una base utile, ma ci sono margini concreti per renderlo piu chiaro, leggibile e citabile dai sistemi AI.' : 'Il sito ha segnali insufficienti o discontinui per essere interpretato con affidabilita dai sistemi AI.';
  const confidenceNote = confidence < 50 ? ' Le evidenze disponibili sono limitate, quindi la lettura va considerata prudente.' : '';
  const visibilityNote = visibilityState === 'not_measured' ? ' La visibilita AI reale non e stata misurata per assenza di un provider verificabile.' : '';
  const opportunityNote = opportunities > 0 ? ` Sono state rilevate ${opportunities} opportunita di miglioramento.` : ' Non sono emerse opportunita deterministiche nella scansione gratuita.';
  return `${base}${opportunityNote}${confidenceNote}${visibilityNote}`;
}

function firstMatch(input: string, pattern: RegExp) {
  const match = input.match(pattern)?.[1]?.trim();
  return match ? decodeEntities(match) : null;
}

function metaContent(html: string, name: string) {
  return firstMatch(html, new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')) ?? firstMatch(html, new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'));
}

function tagTexts(html: string, tag: string) {
  return [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))].map(match => decodeEntities(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())).filter(Boolean);
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function jsonLdTypes(html: string) {
  const types = new Set<string>();
  for (const block of jsonLdBlocks(html)) collectJsonLdTypes(block, types);
  return [...types];
}

function jsonLdStatus(html: string): StructuredDataStatus {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1].trim());
  if (!blocks.length) return 'unknown';
  return blocks.every(block => {
    try { JSON.parse(block); return true; } catch { return false; }
  }) ? 'valid' : 'invalid';
}

function jsonLdBlocks(html: string): unknown[] {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(match => {
    try { return [JSON.parse(match[1]) as unknown]; } catch { return []; }
  });
}

function collectJsonLdTypes(value: unknown, types: Set<string>) {
  if (Array.isArray(value)) return value.forEach(item => collectJsonLdTypes(item, types));
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const type = record['@type'];
  if (typeof type === 'string') types.add(type);
  if (Array.isArray(type)) type.filter((item): item is string => typeof item === 'string').forEach(item => types.add(item));
  Object.values(record).forEach(child => collectJsonLdTypes(child, types));
}

function sameAsValues(html: string) {
  const values = new Set<string>();
  for (const block of jsonLdBlocks(html)) collectSameAs(block, values);
  return [...values];
}

function collectSameAs(value: unknown, values: Set<string>) {
  if (Array.isArray(value)) return value.forEach(item => collectSameAs(item, values));
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const sameAs = record.sameAs;
  if (typeof sameAs === 'string') values.add(sameAs);
  if (Array.isArray(sameAs)) sameAs.filter((item): item is string => typeof item === 'string').forEach(item => values.add(item));
  Object.values(record).forEach(child => collectSameAs(child, values));
}

function entityFromStructuredData(html: string) {
  const result: { brandName?: string; organizationType?: string } = {};
  for (const block of jsonLdBlocks(html)) {
    const stack = [block];
    while (stack.length) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') continue;
      if (Array.isArray(current)) { stack.push(...current); continue; }
      const record = current as Record<string, unknown>;
      const type = record['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (types.some(item => item === 'Organization' || item === 'LocalBusiness')) {
        if (typeof record.name === 'string') result.brandName = record.name;
        if (typeof type === 'string') result.organizationType = type;
      }
      stack.push(...Object.values(record));
    }
  }
  return result;
}

function hasRelevantSchema(types: string[]) {
  return types.some(type => ['Organization', 'WebSite', 'WebPage', 'BreadcrumbList', 'Person', 'Service', 'Article', 'LocalBusiness', 'FAQPage'].includes(type));
}

function hasLinkLike(links: string[], needles: string[]) {
  return links.some(link => needles.some(needle => link.toLowerCase().includes(needle)));
}

function hasEvidenceLanguage(text: string) {
  return /\b(20\d{2}|\d+%|case study|fonte|source|dati|risultati|metodo|ricerca|studio|report|clienti)\b/i.test(text);
}

function hasScannableStructure(html: string) {
  return /<(ul|ol|table)\b/i.test(html) || /faq|domande frequenti|question/i.test(html);
}

function findServiceSignals(text: string) {
  const candidates = ['consulenza', 'audit', 'analisi', 'piattaforma', 'formazione', 'strategia', 'automazione', 'ai', 'organizzazione', 'marketing', 'sviluppo'];
  return candidates.filter(candidate => new RegExp(`\\b${candidate}\\b`, 'i').test(text));
}

function parseCrawlerPolicy(robots?: string) {
  if (!robots) return null;
  const relevant = ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'ChatGPT-User', 'Claude-User', 'Perplexity-User'];
  const found = relevant.filter(bot => new RegExp(`user-agent:\\s*${bot}`, 'i').test(robots));
  return found.length ? `Policy rilevate per ${found.join(', ')}` : null;
}

function imageAltRatio(images: { alt: string | null }[]) {
  if (!images.length) return 1;
  return images.filter(image => image.alt && image.alt.trim().length > 0).length / images.length;
}

function scoreSecurityHeaders(headers: Headers) {
  return ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy'].filter(header => headers.has(header)).length;
}

function decodeEntities(value: string) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

export function stableAuditCacheKey(input: string) {
  return createHash('sha256').update(input.trim().toLowerCase()).digest('hex');
}

export { SafeFetchError };
