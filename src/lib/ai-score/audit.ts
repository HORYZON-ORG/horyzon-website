import { createHash, randomUUID } from 'node:crypto';
import {
  AI_READINESS_METHODOLOGY_VERSION,
  AI_SCORE_DISPLAY_METHODOLOGY,
  accessLevels,
  auditCheckDefinitions,
  calculateCategoryScores,
  calculateEvidenceConfidence,
  calculateReadinessScore,
  projectFreeResult,
} from './methodology';
import { AI_SCORE_LIMITS } from './limits';
import { aiVisibilityProvider, externalFootprintProvider } from './providers';
import { normalizeAuditUrl, safeFetch } from './ssrf';
import type {
  AuditCheck,
  AuditEvidence,
  AuditPipelineState,
  CheckStatus,
  CrawledPage,
  EntityAnalysis,
  FreeAuditResult,
  InternalAuditResult,
  OpportunitySeverity,
  PageClassification,
  PremiumAuditPayload,
  RemediationItem,
} from './types';

type StateCallback = (state: AuditPipelineState, label: string) => void;

type PageFacts = CrawledPage & {
  html: string;
  text: string;
  description?: string;
  canonical?: string;
  metaRobots?: string;
  xRobots?: string;
  lang?: string;
  viewport?: string;
  contentType?: string;
  headers: Headers;
  h2: string[];
  h3: string[];
  links: string[];
  externalLinks: string[];
  imageCount: number;
  imagesWithAlt: number;
  schemaTypes: string[];
  sameAs: string[];
  dates: string[];
  hasMain: boolean;
  hasNav: boolean;
  hasArticle: boolean;
  hasLists: boolean;
  hasTables: boolean;
  hasFaqSignals: boolean;
  hasDefinitionSignals: boolean;
  hasExampleSignals: boolean;
  hasSourceSignals: boolean;
  hasDataSignals: boolean;
  mixedContent: boolean;
};

type OptionalFetch = { status: 'measured'; url: string; body: string; headers: Headers } | { status: 'not_measured'; reason: string };

type AuditContext = {
  auditId: string;
  startedAt: string;
  inputUrl: URL;
  home: PageFacts;
  pages: PageFacts[];
  robots: OptionalFetch;
  sitemap: OptionalFetch;
  llms: OptionalFetch;
  duplicateUrlsSkipped: number;
};

const CHECK_COPY: Partial<Record<string, { why: string; fix: string; verification: string; severity: OpportunitySeverity }>> = {
  https_enabled: { why: 'HTTPS è un prerequisito di fiducia e accessibilità per crawler e sistemi AI.', fix: 'Servi il dominio finale in HTTPS e reindirizza HTTP verso HTTPS.', verification: 'Ripeti l’audit e verifica che l’URL finale usi https://.', severity: 'critical' },
  robots_allows_googlebot: { why: 'Bloccare crawler search limita discovery e citabilità.', fix: 'Rivedi robots.txt e consenti le aree pubbliche che devono essere indicizzate.', verification: 'Controlla robots.txt e ripeti la scansione.', severity: 'critical' },
  robots_allows_oai_searchbot: { why: 'Una policy AI troppo restrittiva può ridurre la disponibilità del contenuto per sistemi supportati.', fix: 'Definisci una policy esplicita per crawler AI compatibile con la strategia editoriale.', verification: 'Verifica robots.txt con user-agent OAI-SearchBot.', severity: 'important' },
  main_content_machine_readable: { why: 'Il contenuto importante deve essere disponibile nel markup ricevuto dai crawler.', fix: 'Assicurati che headline, testo principale e link siano presenti nell’HTML iniziale o in output renderizzato accessibile.', verification: 'Ripeti l’audit e confronta word count e contenuto principale.', severity: 'critical' },
  critical_pages_depth: { why: 'Pagine troppo sottili offrono poche evidenze citabili.', fix: 'Arricchisci le pagine principali con descrizioni specifiche, casi, dettagli e risposte concrete.', verification: 'Verifica che le pagine principali superino la soglia di contenuto utile.', severity: 'important' },
  organization_description: { why: 'I sistemi AI devono poter capire rapidamente chi è l’organizzazione e cosa fa.', fix: 'Aggiungi una descrizione esplicita dell’attività in homepage e nella pagina About.', verification: 'Ripeti l’audit e verifica la ricostruzione dell’entità.', severity: 'important' },
  organization_schema: { why: 'Schema Organization aiuta a disambiguare brand e relazioni ufficiali.', fix: 'Aggiungi JSON-LD Organization coerente con contenuto visibile, URL e profili ufficiali.', verification: 'Valida il JSON-LD e ripeti l’audit.', severity: 'important' },
  about_page_present: { why: 'Una pagina About rafforza identità, expertise e fiducia.', fix: 'Pubblica o collega chiaramente una pagina Chi siamo/About.', verification: 'La pagina deve essere raggiungibile da link interni.', severity: 'important' },
  contact_page_present: { why: 'Contatti verificabili aumentano fiducia e responsabilità.', fix: 'Rendi raggiungibile una pagina contatti o una sezione equivalente.', verification: 'La pagina deve essere nel campione o tra i link principali.', severity: 'important' },
  image_alt_coverage: { why: 'Alt text aiuta accessibilità e interpretazione del contenuto visivo.', fix: 'Aggiungi alt descrittivi alle immagini informative.', verification: 'Ripeti l’audit e controlla la copertura alt.', severity: 'optimization' },
  structured_dates: { why: 'Date strutturate aiutano a valutare freschezza e manutenzione.', fix: 'Aggiungi datePublished/dateModified dove pertinenti.', verification: 'Valida structured data e ripeti l’audit.', severity: 'optimization' },
};

export async function runAiScoreAudit(rawUrl: string, onState?: StateCallback): Promise<InternalAuditResult> {
  const startedAt = new Date().toISOString();
  const auditId = randomUUID();
  onState?.('queued', 'Preparazione analisi');

  const inputUrl = normalizeAuditUrl(rawUrl);
  onState?.('crawling', 'Verifica accessibilità');

  const homeResponse = await safeFetch(inputUrl, { maxBytes: AI_SCORE_LIMITS.maxBytesPerPage });
  const home = analyzePage(homeResponse.url, homeResponse.status, homeResponse.headers, homeResponse.body, 0);

  const [robots, sitemap, llms] = await Promise.all([
    fetchOptional(new URL('/robots.txt', home.finalUrl).toString()),
    fetchOptional(new URL('/sitemap.xml', home.finalUrl).toString()),
    fetchOptional(new URL('/llms.txt', home.finalUrl).toString()),
  ]);

  onState?.('crawling', 'Analisi pagine rappresentative');
  const candidates = selectCrawlCandidates(home, sitemap, AI_SCORE_LIMITS.maxPages - 1);
  const pages = [home];
  const seen = new Set([home.finalUrl.replace(/\/$/, '')]);
  let duplicateUrlsSkipped = 0;

  for (const candidate of candidates) {
    if (pages.length >= AI_SCORE_LIMITS.maxPages) break;
    try {
      const response = await safeFetch(candidate, { maxBytes: AI_SCORE_LIMITS.maxBytesPerPage });
      const key = response.url.replace(/\/$/, '');
      if (seen.has(key)) {
        duplicateUrlsSkipped += 1;
        continue;
      }
      seen.add(key);
      pages.push(analyzePage(response.url, response.status, response.headers, response.body, 1));
    } catch {
      // Candidate failures are reflected by crawl coverage/confidence, not exposed as proxy errors.
    }
  }

  onState?.('analyzing', 'Analisi struttura, contenuti e segnali AI');
  const context: AuditContext = { auditId, startedAt, inputUrl, home, pages, robots, sitemap, llms, duplicateUrlsSkipped };
  const entityAnalysis = buildEntityAnalysis(context);
  const externalBrandFootprint = await externalFootprintProvider.measure({ auditId, domain: inputUrl.hostname, entity: entityAnalysis });
  const checks = buildChecks(context, entityAnalysis);
  const categoryScores = calculateCategoryScores(checks);
  const readinessScore = calculateReadinessScore(categoryScores);

  onState?.('visibility_check', 'Verifica visibilità AI');
  const visibility = await aiVisibilityProvider.measure({ auditId, domain: inputUrl.hostname, entity: entityAnalysis });

  onState?.('scoring', 'Calcolo risultati');
  const crawlSummary = buildCrawlSummary(context);
  const confidence = calculateEvidenceConfidence({ checks, crawlSummary, visibility, externalBrandFootprint });
  const remediationSummary = buildRemediationSummary(checks);
  const opportunities = countOpportunities(remediationSummary);
  const status = visibility.state === 'measured' && externalBrandFootprint.state === 'measured' ? 'completed' : 'partial';
  const readinessState = readinessScore === null ? 'not_measured' : status === 'completed' ? 'measured' : 'partial';

  const premium: PremiumAuditPayload = {
    categoryScores,
    checks,
    crawlSummary,
    entityAnalysis,
    externalBrandFootprint,
    visibilityDetail: visibility,
    potentialScore: {
      state: 'not_calculated',
      score: null,
      blocker: 'Il potential score richiede simulazioni di remediation verificate. Non viene calcolato in assenza di interventi realmente validati.',
      calculatedFromFindingIds: [],
    },
    remediationSummary,
  };

  const audit: InternalAuditResult = {
    auditId,
    accessLevel: 'FREE',
    domain: inputUrl.hostname,
    finalUrl: home.finalUrl,
    analyzedAt: startedAt,
    methodologyVersion: AI_SCORE_DISPLAY_METHODOLOGY,
    readiness: { state: readinessState, score: readinessScore },
    visibility,
    confidence,
    interpretation: buildInterpretation(readinessScore, visibility.state, opportunities.total),
    opportunities,
    signalsAnalyzed: checks.filter((check) => check.measured).length,
    pagesAnalyzed: pages.length,
    status,
    notice: status === 'partial' ? 'Audit completato con misurazioni parziali: AI Visibility ed External Brand Footprint richiedono provider esterni configurati.' : undefined,
    locked: {
      premiumAudit: true,
      optimizationPlan: true,
      availableLevels: accessLevels,
      priceConfigured: false,
    },
    premium,
  };

  onState?.(status, status === 'completed' ? 'Analisi completata' : 'Analisi completata con evidenze parziali');
  return audit;
}

export function toFreeAudit(audit: InternalAuditResult): FreeAuditResult {
  return projectFreeResult(audit);
}

async function fetchOptional(url: string): Promise<OptionalFetch> {
  try {
    const response = await safeFetch(url, { maxBytes: 250_000 });
    if (response.status >= 200 && response.status < 400) {
      return { status: 'measured', url: response.url, body: response.body, headers: response.headers };
    }
    return { status: 'not_measured', reason: `HTTP ${response.status}` };
  } catch (error) {
    return { status: 'not_measured', reason: error instanceof Error ? error.message : 'Fetch non riuscito' };
  }
}

function optionalFetchLabel(fetch: OptionalFetch): string {
  return fetch.status === 'measured' ? fetch.url : fetch.reason;
}

function analyzePage(url: string, status: number, headers: Headers, html: string, depth: number): PageFacts {
  const text = extractVisibleText(html);
  const links = extractAttributes(html, 'a', 'href').map((href) => absolutize(url, href)).filter(Boolean) as string[];
  const current = new URL(url);
  const internalLinks = unique(links.filter((link) => isSameOrigin(current, link) && isLikelyHtmlUrl(link)));
  const externalLinks = unique(links.filter((link) => !isSameOrigin(current, link)));
  const images = extractImageAlts(html);
  const schemaObjects = extractJsonLd(html);
  const schemaTypes = unique(schemaObjects.flatMap((item) => normalizeSchemaTypes(item['@type'])));
  const sameAs = unique(schemaObjects.flatMap((item) => normalizeStringArray(item.sameAs)));
  const h1 = extractTagText(html, 'h1');
  const h2 = extractTagText(html, 'h2');
  const h3 = extractTagText(html, 'h3');
  const classification = classifyPageType(url, `${h1.join(' ')} ${h2.join(' ')} ${text.slice(0, 500)}`);

  return {
    url,
    finalUrl: url,
    statusCode: status,
    depth,
    classification,
    classificationConfidence: classification === 'other' ? 45 : 80,
    title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: metaContent(html, 'description'),
    canonical: extractAttributes(html, 'link', 'href', /rel=["'][^"']*canonical/i)[0],
    metaRobots: metaContent(html, 'robots'),
    xRobots: headers.get('x-robots-tag') ?? undefined,
    lang: firstMatch(html, /<html[^>]+lang=["']([^"']+)["']/i),
    viewport: metaContent(html, 'viewport'),
    contentType: headers.get('content-type') ?? undefined,
    headers,
    h1,
    h2,
    h3,
    html,
    text,
    wordCount: countWords(text),
    links,
    internalLinks,
    externalLinks,
    imageCount: images.length,
    imagesWithAlt: images.filter(Boolean).length,
    schemaTypes,
    sameAs,
    dates: extractDates(html),
    fetchedAt: new Date().toISOString(),
    hasMain: /<main[\s>]/i.test(html),
    hasNav: /<nav[\s>]/i.test(html),
    hasArticle: /<article[\s>]/i.test(html),
    hasLists: /<(ul|ol|dl)[\s>]/i.test(html),
    hasTables: /<table[\s>]/i.test(html),
    hasFaqSignals: /\b(faq|domande frequenti|questions?|q&a)\b/i.test(text),
    hasDefinitionSignals: /\b(cos'è|che cos.?è|what is|definizione|significa)\b/i.test(text),
    hasExampleSignals: /\b(esempio|case study|caso|portfolio|risultato|example)\b/i.test(text),
    hasSourceSignals: /\b(fonte|source|bibliografia|riferimenti|references)\b/i.test(text) || externalLinks.length >= 2,
    hasDataSignals: /\b\d{2,}%|\b\d+[,.]?\d*\s?(€|k|m|ore|giorni|clienti|progetti)\b/i.test(text),
    mixedContent: /http:\/\//i.test(html) && url.startsWith('https://'),
  };
}

export function classifyPageType(url: string, text = ''): PageClassification {
  const haystack = `${new URL(url).pathname} ${text}`.toLowerCase();
  if (/^\/?$/.test(new URL(url).pathname)) return 'home';
  if (/\b(about|chi-siamo|azienda|studio|team)\b/.test(haystack)) return 'about';
  if (/\b(contact|contatti|contatto|preventivo)\b/.test(haystack)) return 'contact';
  if (/\b(service|servizi|consulenza|solutions|soluzioni)\b/.test(haystack)) return 'service';
  if (/\b(product|prodotti|pricing|shop|store)\b/.test(haystack)) return 'product';
  if (/\b(blog|news|article|articolo|insight|guide|guida)\b/.test(haystack)) return 'article';
  if (/\b(privacy|cookie|legal|terms|termini)\b/.test(haystack)) return 'legal';
  return 'other';
}

function selectCrawlCandidates(home: PageFacts, sitemap: OptionalFetch, limit: number): string[] {
  const candidates = new Set<string>();
  for (const type of ['about', 'contact', 'service', 'product', 'article', 'legal'] as PageClassification[]) {
    const match = home.internalLinks.find((link) => classifyPageType(link) === type);
    if (match) candidates.add(stripHash(match));
  }
  if (sitemap.status === 'measured') {
    for (const loc of [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim())) {
      if (isSameOrigin(new URL(home.finalUrl), loc) && isLikelyHtmlUrl(loc)) candidates.add(stripHash(loc));
      if (candidates.size >= limit) break;
    }
  }
  for (const link of home.internalLinks) {
    candidates.add(stripHash(link));
    if (candidates.size >= limit) break;
  }
  return [...candidates].filter((url) => url !== home.finalUrl).slice(0, limit);
}

function buildChecks(context: AuditContext, entity: EntityAnalysis): AuditCheck[] {
  const checks: AuditCheck[] = [];
  const measuredPages = context.pages.filter((page) => page.statusCode >= 200 && page.statusCode < 400);
  const averageWords = measuredPages.length ? measuredPages.reduce((sum, page) => sum + page.wordCount, 0) / measuredPages.length : 0;
  const robotsFetch = context.robots.status === 'measured' ? context.robots : null;
  const sitemapFetch = context.sitemap.status === 'measured' ? context.sitemap : null;
  const llmsFetch = context.llms.status === 'measured' ? context.llms : null;
  const hasRobots = robotsFetch !== null;
  const robotsBody = robotsFetch?.body ?? '';
  const hasSitemap = sitemapFetch !== null;
  const sitemapBody = sitemapFetch?.body ?? '';
  const hasLlms = llmsFetch !== null;

  const add = (id: string, status: CheckStatus, evidence: AuditEvidence[], measured = status !== 'unknown' && status !== 'not_applicable') => {
    const definition = auditCheckDefinitions.find((item) => item.id === id);
    if (!definition) throw new Error(`Missing check definition: ${id}`);
    checks.push({
      id,
      label: definition.label,
      categoryId: definition.categoryId,
      status,
      pointsAvailable: definition.weight,
      pointsEarned: status === 'pass' ? definition.weight : status === 'partial' ? definition.weight * 0.5 : 0,
      measured,
      evidence,
      definitionVersion: AI_READINESS_METHODOLOGY_VERSION,
      aggregation: definition.aggregation,
    });
  };

  const ev = (checkId: string, label: string, value: string, sourceUrl = context.home.finalUrl, level: AuditEvidence['verificationLevel'] = 'direct', category?: PageClassification): AuditEvidence => ({
    id: createHash('sha1').update(`${context.auditId}:${checkId}:${label}:${value}`).digest('hex').slice(0, 12),
    checkId,
    label,
    value,
    sourceUrl,
    sourceType: level === 'derived' || level === 'heuristic' ? 'derived' : 'html',
    pageType: category,
    collectedAt: context.startedAt,
    confidence: level === 'direct' ? 90 : level === 'derived' ? 70 : level === 'heuristic' ? 45 : 60,
    verification: level === 'direct' ? 'verified' : level === 'derived' ? 'present' : 'inferred',
    verificationLevel: level,
  });

  const sampleEv = (checkId: string, label: string, value: string) => context.pages.slice(0, 3).map((page) => ev(checkId, label, valueForPage(page, value), page.finalUrl, 'direct', page.classification));

  add('homepage_http_available', context.home.statusCode > 0 ? 'pass' : 'fail', [ev('homepage_http_available', 'HTTP status', String(context.home.statusCode), context.home.finalUrl, 'direct')]);
  add('homepage_status_success', context.home.statusCode >= 200 && context.home.statusCode < 300 ? 'pass' : context.home.statusCode < 400 ? 'partial' : 'fail', [ev('homepage_status_success', 'HTTP status', String(context.home.statusCode))]);
  add('https_enabled', context.home.finalUrl.startsWith('https://') ? 'pass' : 'fail', [ev('https_enabled', 'Final URL', context.home.finalUrl)]);
  add('redirect_chain_controlled', 'pass', [ev('redirect_chain_controlled', 'Fetch policy', `Redirect limit ${AI_SCORE_LIMITS.maxRedirects}`, context.home.finalUrl, 'derived')]);
  add('canonical_present', context.home.canonical ? 'pass' : 'fail', [ev('canonical_present', 'Canonical', context.home.canonical ?? 'Not found')]);
  add('canonical_same_origin', context.home.canonical ? (isSameOrigin(new URL(context.home.finalUrl), absolutize(context.home.finalUrl, context.home.canonical) ?? '') ? 'pass' : 'fail') : 'unknown', [ev('canonical_same_origin', 'Canonical', context.home.canonical ?? 'Not found')], Boolean(context.home.canonical));
  add('meta_robots_indexable', blocksIndexing(context.home.metaRobots) ? 'fail' : context.home.metaRobots ? 'pass' : 'partial', [ev('meta_robots_indexable', 'Meta robots', context.home.metaRobots ?? 'Not declared')]);
  add('x_robots_indexable', blocksIndexing(context.home.xRobots) ? 'fail' : context.home.xRobots ? 'pass' : 'partial', [ev('x_robots_indexable', 'X-Robots-Tag', context.home.xRobots ?? 'Not declared')]);
  add('robots_txt_available', hasRobots ? 'pass' : 'partial', [ev('robots_txt_available', 'robots.txt', optionalFetchLabel(context.robots), robotsFetch?.url ?? context.home.finalUrl)]);
  add('robots_allows_googlebot', hasRobots ? (robotsDisallows(robotsBody, 'googlebot') ? 'fail' : 'pass') : 'unknown', [ev('robots_allows_googlebot', 'Googlebot policy', hasRobots ? summarizeRobots(robotsBody, 'googlebot') : 'Not measured', context.home.finalUrl, 'derived')], hasRobots);
  add('robots_allows_oai_searchbot', hasRobots ? (robotsDisallows(robotsBody, 'oai-searchbot') ? 'fail' : 'pass') : 'unknown', [ev('robots_allows_oai_searchbot', 'OAI-SearchBot policy', hasRobots ? summarizeRobots(robotsBody, 'oai-searchbot') : 'Not measured', context.home.finalUrl, 'derived')], hasRobots);
  add('sitemap_available', hasSitemap ? 'pass' : 'partial', [ev('sitemap_available', 'sitemap.xml', optionalFetchLabel(context.sitemap), sitemapFetch?.url ?? context.home.finalUrl)]);
  add('sitemap_same_origin_urls', hasSitemap ? (sitemapSameOrigin(sitemapBody, context.home.finalUrl) ? 'pass' : 'partial') : 'unknown', [ev('sitemap_same_origin_urls', 'Sitemap loc count', String(countSitemapUrls(sitemapBody)), context.home.finalUrl, 'derived')], hasSitemap);
  add('internal_links_present', context.home.internalLinks.length >= 5 ? 'pass' : context.home.internalLinks.length > 0 ? 'partial' : 'fail', [ev('internal_links_present', 'Internal links', String(context.home.internalLinks.length))]);
  add('crawl_sample_accessible', context.pages.length >= 4 ? 'pass' : context.pages.length >= 2 ? 'partial' : 'fail', [ev('crawl_sample_accessible', 'Pages fetched', String(context.pages.length), context.home.finalUrl, 'derived')]);
  add('main_content_machine_readable', averageWords >= 250 ? 'pass' : averageWords >= 120 ? 'partial' : 'fail', [ev('main_content_machine_readable', 'Average words', String(Math.round(averageWords)), context.home.finalUrl, 'derived')]);

  add('title_present', context.home.title && context.home.title.length >= 8 ? 'pass' : context.home.title ? 'partial' : 'fail', [ev('title_present', 'Title', context.home.title ?? 'Not found')]);
  add('meta_description_present', context.home.description && context.home.description.length >= 50 ? 'pass' : context.home.description ? 'partial' : 'fail', [ev('meta_description_present', 'Meta description', context.home.description ?? 'Not found')]);
  add('h1_present', measuredPages.every((page) => page.h1.length > 0) ? 'pass' : measuredPages.some((page) => page.h1.length > 0) ? 'partial' : 'fail', sampleEv('h1_present', 'H1', 'h1'));
  add('heading_structure', measuredPages.some((page) => page.h2.length + page.h3.length >= 3) ? 'pass' : measuredPages.some((page) => page.h2.length > 0) ? 'partial' : 'fail', [ev('heading_structure', 'Heading count', String(measuredPages.reduce((sum, page) => sum + page.h2.length + page.h3.length, 0)), context.home.finalUrl, 'derived')]);
  add('critical_pages_depth', averageWords >= 550 ? 'pass' : averageWords >= 250 ? 'partial' : 'fail', [ev('critical_pages_depth', 'Average words', String(Math.round(averageWords)), context.home.finalUrl, 'derived')]);
  add('thin_pages_limited', measuredPages.filter((page) => page.wordCount < 180).length === 0 ? 'pass' : measuredPages.filter((page) => page.wordCount < 180).length <= 1 ? 'partial' : 'fail', [ev('thin_pages_limited', 'Thin pages', String(measuredPages.filter((page) => page.wordCount < 180).length), context.home.finalUrl, 'derived')]);
  add('useful_text_ratio', context.home.wordCount >= 300 ? 'pass' : context.home.wordCount >= 150 ? 'partial' : 'fail', [ev('useful_text_ratio', 'Homepage words', String(context.home.wordCount), context.home.finalUrl, 'derived')]);
  add('list_or_table_structure', measuredPages.some((page) => page.hasLists || page.hasTables) ? 'pass' : 'partial', [ev('list_or_table_structure', 'Structured sections', String(measuredPages.filter((page) => page.hasLists || page.hasTables).length), context.home.finalUrl, 'derived')]);
  add('faq_or_question_signals', measuredPages.some((page) => page.hasFaqSignals) ? 'pass' : 'not_applicable', [ev('faq_or_question_signals', 'FAQ signals', measuredPages.some((page) => page.hasFaqSignals) ? 'present' : 'N/A')], measuredPages.some((page) => page.hasFaqSignals));
  add('definition_signals', measuredPages.some((page) => page.hasDefinitionSignals) ? 'pass' : 'partial', [ev('definition_signals', 'Definition signals', String(measuredPages.some((page) => page.hasDefinitionSignals)), context.home.finalUrl, 'derived')]);
  add('examples_or_cases', measuredPages.some((page) => page.hasExampleSignals) ? 'pass' : 'partial', [ev('examples_or_cases', 'Example/case signals', String(measuredPages.some((page) => page.hasExampleSignals)), context.home.finalUrl, 'derived')]);
  add('supporting_data_or_sources', measuredPages.some((page) => page.hasSourceSignals || page.hasDataSignals) ? 'pass' : 'partial', [ev('supporting_data_or_sources', 'Sources/data signals', String(measuredPages.some((page) => page.hasSourceSignals || page.hasDataSignals)), context.home.finalUrl, 'derived')]);
  add('passage_citability', averageWords >= 450 && measuredPages.some((page) => page.hasExampleSignals || page.hasDataSignals) ? 'pass' : averageWords >= 220 ? 'partial' : 'fail', [ev('passage_citability', 'Citability heuristic', `${Math.round(averageWords)} average words plus evidence signals`, context.home.finalUrl, 'heuristic')]);

  add('brand_name_detected', entity.brandName ? 'pass' : 'fail', [ev('brand_name_detected', 'Brand', entity.brandName ?? 'Not detected', context.home.finalUrl, 'derived')]);
  add('organization_description', entity.description && entity.description.length > 40 ? 'pass' : entity.description ? 'partial' : 'fail', [ev('organization_description', 'Description', entity.description ?? 'Not detected', context.home.finalUrl, 'derived')]);
  add('service_entity_signals', entity.services.length > 0 ? 'pass' : 'partial', [ev('service_entity_signals', 'Services', entity.services.slice(0, 5).join(', ') || 'Not detected', context.home.finalUrl, 'derived')]);
  add('product_entity_signals', entity.products.length > 0 ? 'pass' : 'not_applicable', [ev('product_entity_signals', 'Products', entity.products.join(', ') || 'N/A', context.home.finalUrl, 'derived')], entity.products.length > 0);
  add('audience_signals', entity.audience.length > 0 ? 'pass' : 'partial', [ev('audience_signals', 'Audience', entity.audience.join(', ') || 'Not detected', context.home.finalUrl, 'derived')]);
  add('people_signals', entity.people.length > 0 ? 'pass' : 'partial', [ev('people_signals', 'People/team signals', String(entity.people.length), context.home.finalUrl, 'derived')]);
  add('location_signals', entity.locations.length > 0 ? 'pass' : 'partial', [ev('location_signals', 'Locations', entity.locations.join(', ') || 'Not detected', context.home.finalUrl, 'derived')]);
  add('contact_signals', /\b(email|telefono|phone|contatti|contact|@)\b/i.test(context.pages.map((page) => page.text).join(' ')) ? 'pass' : 'partial', [ev('contact_signals', 'Contact terms', 'Derived from visible text', context.home.finalUrl, 'heuristic')]);
  add('same_as_signals', entity.sameAs.length > 0 ? 'pass' : 'partial', [ev('same_as_signals', 'sameAs/profiles', entity.sameAs.join(', ') || 'Not detected', context.home.finalUrl, 'derived')]);
  add('brand_ambiguity_limited', entity.ambiguitySignals.length === 0 ? 'pass' : 'partial', [ev('brand_ambiguity_limited', 'Ambiguity signals', entity.ambiguitySignals.join(', ') || 'None', context.home.finalUrl, 'heuristic')]);

  add('json_ld_parseable', context.pages.some((page) => page.schemaTypes.length > 0) ? 'pass' : 'partial', [ev('json_ld_parseable', 'Schema types', unique(context.pages.flatMap((page) => page.schemaTypes)).join(', ') || 'Not found')]);
  add('organization_schema', hasSchema(context.pages, 'Organization') || hasSchema(context.pages, 'LocalBusiness') ? 'pass' : 'fail', [ev('organization_schema', 'Organization schema', String(hasSchema(context.pages, 'Organization') || hasSchema(context.pages, 'LocalBusiness')))]);
  add('website_schema', hasSchema(context.pages, 'WebSite') ? 'pass' : 'partial', [ev('website_schema', 'WebSite schema', String(hasSchema(context.pages, 'WebSite')))]);
  add('webpage_schema', hasSchema(context.pages, 'WebPage') ? 'pass' : 'partial', [ev('webpage_schema', 'WebPage schema', String(hasSchema(context.pages, 'WebPage')))]);
  add('breadcrumb_schema', hasSchema(context.pages, 'BreadcrumbList') ? 'pass' : 'not_applicable', [ev('breadcrumb_schema', 'Breadcrumb schema', String(hasSchema(context.pages, 'BreadcrumbList')))], hasSchema(context.pages, 'BreadcrumbList'));
  const hasArticlePages = context.pages.some((page) => page.classification === 'article');
  add('article_schema_alignment', hasArticlePages ? (hasSchema(context.pages, 'Article') ? 'pass' : 'partial') : 'not_applicable', [ev('article_schema_alignment', 'Article pages/schema', `${hasArticlePages}/${hasSchema(context.pages, 'Article')}`)], hasArticlePages);
  add('faq_schema_alignment', context.pages.some((page) => page.hasFaqSignals) ? (hasSchema(context.pages, 'FAQPage') ? 'pass' : 'partial') : 'not_applicable', [ev('faq_schema_alignment', 'FAQ signals/schema', String(hasSchema(context.pages, 'FAQPage')))], context.pages.some((page) => page.hasFaqSignals));
  add('schema_relevance', unique(context.pages.flatMap((page) => page.schemaTypes)).length <= 10 ? 'pass' : 'partial', [ev('schema_relevance', 'Unique schema types', String(unique(context.pages.flatMap((page) => page.schemaTypes)).length), context.home.finalUrl, 'derived')]);

  add('about_page_present', context.pages.some((page) => page.classification === 'about') || context.home.internalLinks.some((link) => classifyPageType(link) === 'about') ? 'pass' : 'fail', [ev('about_page_present', 'About page', String(context.pages.some((page) => page.classification === 'about')), context.home.finalUrl, 'derived')]);
  add('contact_page_present', context.pages.some((page) => page.classification === 'contact') || context.home.internalLinks.some((link) => classifyPageType(link) === 'contact') ? 'pass' : 'fail', [ev('contact_page_present', 'Contact page', String(context.pages.some((page) => page.classification === 'contact')), context.home.finalUrl, 'derived')]);
  add('privacy_page_present', context.pages.some((page) => page.classification === 'legal' && /privacy/i.test(page.finalUrl + page.text)) || context.home.internalLinks.some((link) => /privacy/i.test(link)) ? 'pass' : 'partial', [ev('privacy_page_present', 'Privacy signal', String(context.home.internalLinks.some((link) => /privacy/i.test(link))), context.home.finalUrl, 'derived')]);
  add('legal_terms_present', context.pages.some((page) => page.classification === 'legal') || context.home.internalLinks.some((link) => /terms|termini|legal|cookie/i.test(link)) ? 'pass' : 'partial', [ev('legal_terms_present', 'Legal links', String(context.home.internalLinks.filter((link) => /terms|termini|legal|cookie|privacy/i.test(link)).length), context.home.finalUrl, 'derived')]);
  add('team_or_author_present', entity.people.length > 0 || /\b(team|autore|author|fondatore|founder)\b/i.test(context.pages.map((page) => page.text).join(' ')) ? 'pass' : 'partial', [ev('team_or_author_present', 'Team/author signals', String(entity.people.length), context.home.finalUrl, 'derived')]);
  add('case_study_or_results', measuredPages.some((page) => /\b(case study|risultati|portfolio|clienti|metodologia|successo)\b/i.test(page.text)) ? 'pass' : 'partial', [ev('case_study_or_results', 'Case/results terms', 'Derived from visible text', context.home.finalUrl, 'heuristic')]);
  add('external_sources_linked', measuredPages.some((page) => page.externalLinks.length >= 2) ? 'pass' : 'partial', [ev('external_sources_linked', 'External links', String(measuredPages.reduce((sum, page) => sum + page.externalLinks.length, 0)), context.home.finalUrl, 'derived')]);
  add('claims_supported', measuredPages.some((page) => page.hasDataSignals && page.hasSourceSignals) ? 'pass' : measuredPages.some((page) => page.hasDataSignals || page.hasSourceSignals) ? 'partial' : 'fail', [ev('claims_supported', 'Data/source signals', 'Derived from content patterns', context.home.finalUrl, 'heuristic')]);

  add('lang_attribute', context.home.lang ? 'pass' : 'fail', [ev('lang_attribute', 'HTML lang', context.home.lang ?? 'Not found')]);
  add('viewport_meta', context.home.viewport ? 'pass' : 'fail', [ev('viewport_meta', 'Viewport', context.home.viewport ?? 'Not found')]);
  const totalImages = measuredPages.reduce((sum, page) => sum + page.imageCount, 0);
  const totalAlt = measuredPages.reduce((sum, page) => sum + page.imagesWithAlt, 0);
  add('image_alt_coverage', totalImages === 0 ? 'not_applicable' : totalAlt / totalImages >= 0.8 ? 'pass' : totalAlt / totalImages >= 0.5 ? 'partial' : 'fail', [ev('image_alt_coverage', 'Alt coverage', totalImages === 0 ? 'N/A' : `${totalAlt}/${totalImages}`, context.home.finalUrl, 'derived')], totalImages > 0);
  add('semantic_landmarks', context.pages.some((page) => page.hasMain && page.hasNav) ? 'pass' : context.pages.some((page) => page.hasMain || page.hasNav || page.hasArticle) ? 'partial' : 'fail', [ev('semantic_landmarks', 'Landmarks', `main=${context.home.hasMain}, nav=${context.home.hasNav}, article=${context.home.hasArticle}`)]);
  const securityHeaderCount = ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'referrer-policy'].filter((header) => Boolean(context.home.headers.get(header))).length;
  add('security_headers', securityHeaderCount >= 3 ? 'pass' : securityHeaderCount >= 1 ? 'partial' : 'fail', [ev('security_headers', 'Security headers', String(securityHeaderCount), context.home.finalUrl, 'direct')]);
  add('content_type_html', /html/i.test(context.home.contentType ?? '') ? 'pass' : 'partial', [ev('content_type_html', 'Content-Type', context.home.contentType ?? 'Not declared')]);
  add('mixed_content_absent', context.pages.some((page) => page.mixedContent) ? 'fail' : 'pass', [ev('mixed_content_absent', 'Mixed content signal', String(context.pages.some((page) => page.mixedContent)), context.home.finalUrl, 'derived')]);

  add('structured_dates', measuredPages.some((page) => page.dates.length > 0) ? 'pass' : 'partial', [ev('structured_dates', 'Dates found', String(measuredPages.reduce((sum, page) => sum + page.dates.length, 0)), context.home.finalUrl, 'derived')]);
  add('sitemap_lastmod', hasSitemap ? (/<lastmod>/i.test(sitemapBody) ? 'pass' : 'partial') : 'unknown', [ev('sitemap_lastmod', 'lastmod', hasSitemap ? String(/<lastmod>/i.test(sitemapBody)) : 'Not measured', context.home.finalUrl, 'derived')], hasSitemap);
  add('article_dates', hasArticlePages ? (context.pages.some((page) => page.classification === 'article' && page.dates.length > 0) ? 'pass' : 'partial') : 'not_applicable', [ev('article_dates', 'Article dates', String(context.pages.filter((page) => page.classification === 'article' && page.dates.length > 0).length), context.home.finalUrl, 'derived')], hasArticlePages);
  add('visible_update_signals', measuredPages.some((page) => /\b(aggiornato|updated|202[4-6])\b/i.test(page.text)) ? 'pass' : 'partial', [ev('visible_update_signals', 'Update terms', 'Derived from visible text', context.home.finalUrl, 'heuristic')]);
  add('stale_signals_limited', measuredPages.some((page) => /\b(201[0-9]|2020|2021)\b/i.test(page.text)) ? 'partial' : 'pass', [ev('stale_signals_limited', 'Old year signals', 'Derived from visible text', context.home.finalUrl, 'heuristic')]);

  add('ai_crawler_policy', hasRobots && /oai-searchbot|gptbot|claudebot|perplexitybot|google-extended/i.test(robotsBody) ? 'pass' : 'partial', [ev('ai_crawler_policy', 'AI crawler policy', hasRobots ? String(/oai-searchbot|gptbot|claudebot|perplexitybot|google-extended/i.test(robotsBody)) : 'robots not measured', context.home.finalUrl, 'derived')]);
  add('llms_txt_minor_signal', hasLlms ? 'pass' : 'not_applicable', [ev('llms_txt_minor_signal', 'llms.txt', llmsFetch?.url ?? 'N/A', llmsFetch?.url ?? context.home.finalUrl)], hasLlms);
  add('semantic_navigation', context.home.hasNav && context.home.internalLinks.length >= 5 ? 'pass' : context.home.hasNav ? 'partial' : 'fail', [ev('semantic_navigation', 'Navigation/internal links', `${context.home.hasNav}/${context.home.internalLinks.length}`)]);
  add('machine_readable_alternatives', /\.md\b|application\/json|rss|atom/i.test(context.home.html) ? 'pass' : 'not_applicable', [ev('machine_readable_alternatives', 'Alternatives', 'N/A unless explicit feeds, markdown or API links are detected')], /\.md\b|application\/json|rss|atom/i.test(context.home.html));
  add('agent_protocols_applicable', 'not_applicable', [ev('agent_protocols_applicable', 'Agent protocols', 'N/A: no commerce/API/MCP requirement inferred')], false);

  add('external_provider_available', 'unknown', [ev('external_provider_available', 'External provider', 'Not configured', context.home.finalUrl, 'not_measured')], false);

  return checks;
}

function buildEntityAnalysis(context: AuditContext): EntityAnalysis {
  const allText = context.pages.map((page) => page.text).join(' ');
  const schemaTypes = unique(context.pages.flatMap((page) => page.schemaTypes));
  const sameAs = unique(context.pages.flatMap((page) => page.sameAs));
  const brandName = context.home.title?.split(/[|–—-]/)[0]?.trim() || context.inputUrl.hostname.replace(/^www\./, '');
  const description = context.home.description ?? context.pages.find((page) => page.classification === 'about')?.text.slice(0, 220);

  return {
    brandName,
    organizationType: schemaTypes.find((type) => /Organization|LocalBusiness|Corporation|ProfessionalService/i.test(type)),
    description,
    services: extractTerms(allText, /\b(servizi|services?|consulenza|strategy|marketing|ai|automation|sviluppo|design|seo|content)\b/gi),
    products: extractTerms(allText, /\b(prodotti|products?|piattaforma|software|tool|app)\b/gi),
    audience: extractTerms(allText, /\b(aziende|imprese|startup|brand|team|clienti|professionisti|b2b|ecommerce)\b/gi),
    people: extractTerms(allText, /\b(founder|fondatore|ceo|team|autore|author|consulente)\b/gi),
    locations: extractTerms(allText, /\b(italia|milano|roma|torino|napoli|bologna|europe|europa)\b/gi),
    sameAs,
    ambiguitySignals: brandName && brandName.length < 3 ? ['brand name too short'] : [],
    sourcePages: context.pages.map((page) => page.finalUrl),
  };
}

function buildCrawlSummary(context: AuditContext) {
  const classifications: Partial<Record<PageClassification, number>> = {};
  for (const page of context.pages) classifications[page.classification] = (classifications[page.classification] ?? 0) + 1;
  return {
    requestedLimit: AI_SCORE_LIMITS.maxPages,
    pagesFetched: context.pages.length,
    pagesFailed: Math.max(0, AI_SCORE_LIMITS.maxPages - context.pages.length),
    duplicateUrlsSkipped: context.duplicateUrlsSkipped,
    classifications,
    pages: context.pages.map(({ html: _html, text: _text, description: _description, canonical: _canonical, metaRobots: _metaRobots, xRobots: _xRobots, lang: _lang, viewport: _viewport, contentType: _contentType, headers: _headers, h2: _h2, h3: _h3, links: _links, externalLinks: _externalLinks, imageCount: _imageCount, imagesWithAlt: _imagesWithAlt, schemaTypes: _schemaTypes, sameAs: _sameAs, dates: _dates, hasMain: _hasMain, hasNav: _hasNav, hasArticle: _hasArticle, hasLists: _hasLists, hasTables: _hasTables, hasFaqSignals: _hasFaqSignals, hasDefinitionSignals: _hasDefinitionSignals, hasExampleSignals: _hasExampleSignals, hasSourceSignals: _hasSourceSignals, hasDataSignals: _hasDataSignals, mixedContent: _mixedContent, ...page }) => page),
  };
}

function buildRemediationSummary(checks: AuditCheck[]): RemediationItem[] {
  return checks
    .filter((check) => check.measured && ['fail', 'partial'].includes(check.status))
    .slice(0, 18)
    .map((check) => {
      const copy = CHECK_COPY[check.id];
      const scoreImpact = Math.round((check.pointsAvailable - check.pointsEarned) * 10) / 10;
      const severity = copy?.severity ?? (check.status === 'fail' && scoreImpact >= 1 ? 'important' : 'optimization');
      return {
        checkId: check.id,
        title: check.label,
        whyItMatters: copy?.why ?? 'Questo controllo incide sulla chiarezza, accessibilità o affidabilità delle evidenze usate dai sistemi AI.',
        howToFix: copy?.fix,
        verification: copy?.verification,
        priority: severity,
        effort: severity === 'critical' ? 'high' : severity === 'important' ? 'medium' : 'low',
        expectedImpact: severity === 'critical' ? 'high' : severity === 'important' ? 'medium' : 'low',
        evidenceIds: check.evidence.map((item) => item.id).filter(Boolean) as string[],
        confidence: Math.round((check.evidence.reduce((sum, item) => sum + (item.confidence ?? 50), 0) / Math.max(1, check.evidence.length))),
        scoreImpact,
      };
    });
}

function countOpportunities(items: RemediationItem[]) {
  return {
    total: items.length,
    critical: items.filter((item) => item.priority === 'critical').length,
    important: items.filter((item) => item.priority === 'important').length,
    optimization: items.filter((item) => item.priority === 'optimization').length,
  };
}

function buildInterpretation(readinessScore: number | null, visibilityState: string, opportunities: number): string {
  if (readinessScore === null) return 'Non sono state raccolte evidenze sufficienti per calcolare AI Readiness.';
  const base = readinessScore >= 75
    ? 'Il sito presenta una base solida per essere letto e interpretato dai sistemi AI.'
    : readinessScore >= 50
      ? 'Il sito presenta una base utilizzabile, ma diverse evidenze possono essere rese più chiare e citabili.'
      : 'Il sito mostra limiti rilevanti nella disponibilità o chiarezza delle evidenze leggibili dai sistemi AI.';
  const visibility = visibilityState === 'measured' ? ' La visibilità AI è stata misurata separatamente.' : ' La visibilità AI non è ancora misurata perché manca un provider verificabile.';
  return `${base} Sono state individuate ${opportunities} opportunità basate sui controlli misurati.${visibility}`;
}

function extractVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTagText(html: string, tag: string): string[] {
  return [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))]
    .map((match) => extractVisibleText(match[1]))
    .filter(Boolean)
    .slice(0, 20);
}

function extractAttributes(html: string, tag: string, attribute: string, tagFilter?: RegExp): string[] {
  const matches = [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))];
  return matches
    .filter((match) => !tagFilter || tagFilter.test(match[0]))
    .map((match) => firstMatch(match[0], new RegExp(`${attribute}=["']([^"']+)["']`, 'i')))
    .filter(Boolean) as string[];
}

function extractImageAlts(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => firstMatch(match[0], /alt=["']([^"']*)["']/i) ?? '');
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) return parsed.filter(isRecord);
        if (isRecord(parsed['@graph'])) return [];
        if (Array.isArray(parsed['@graph'])) return parsed['@graph'].filter(isRecord);
        return isRecord(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    });
}

function normalizeSchemaTypes(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

function normalizeStringArray(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

function extractDates(html: string): string[] {
  const dateTimes = extractAttributes(html, 'time', 'datetime');
  const isoDates = [...html.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)].map((match) => match[0]);
  return unique([...dateTimes, ...isoDates]).slice(0, 20);
}

function metaContent(html: string, name: string): string | undefined {
  return firstMatch(html, new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
    ?? firstMatch(html, new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i'));
}

function firstMatch(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  return match?.[1]?.replace(/\s+/g, ' ').trim();
}

function absolutize(base: string, href: string): string | null {
  if (!href || /^(mailto|tel|javascript):/i.test(href)) return null;
  try {
    const url = new URL(href, base);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function stripHash(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.toString();
}

function isSameOrigin(base: URL, target: string): boolean {
  try {
    return new URL(target).origin === base.origin;
  } catch {
    return false;
  }
}

function isLikelyHtmlUrl(url: string): boolean {
  return !/\.(pdf|jpg|jpeg|png|webp|gif|svg|zip|mp4|mov|mp3|css|js)(\?|$)/i.test(new URL(url).pathname);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 1).length;
}

function blocksIndexing(value?: string): boolean {
  return Boolean(value && /\b(noindex|none)\b/i.test(value));
}

function robotsDisallows(body: string, agent: string): boolean {
  const lower = body.toLowerCase();
  const blocks = lower.split(/user-agent:/).slice(1);
  return blocks.some((block) => {
    const [header, ...rules] = block.split('\n');
    return (header.includes(agent) || header.includes('*')) && rules.some((line) => /^\s*disallow:\s*\/\s*$/i.test(line));
  });
}

function summarizeRobots(body: string, agent: string): string {
  return robotsDisallows(body, agent) ? `${agent} blocked` : `${agent} not fully blocked`;
}

function sitemapSameOrigin(body: string, base: string): boolean {
  const origin = new URL(base).origin;
  const urls = [...body.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim());
  if (urls.length === 0) return false;
  return urls.slice(0, 50).every((url) => {
    try { return new URL(url).origin === origin; } catch { return false; }
  });
}

function countSitemapUrls(body: string): number {
  return [...body.matchAll(/<loc>/gi)].length;
}

function hasSchema(pages: PageFacts[], type: string): boolean {
  return pages.some((page) => page.schemaTypes.some((schemaType) => schemaType.toLowerCase() === type.toLowerCase()));
}

function extractTerms(text: string, regex: RegExp): string[] {
  return unique([...text.matchAll(regex)].map((match) => match[0].toLowerCase())).slice(0, 8);
}

function valueForPage(page: PageFacts, value: string): string {
  if (value === 'h1') return page.h1.join(' | ') || 'Not found';
  return value;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
