import type { FreeAuditResult } from './types';

export const REPORT_ARCHIVE_KEY = 'horyzon.ai-score.reports.v1';
export const MAX_REPORTS = 20;
const MAX_BYTES = 3_500_000;
const MAX_FILE_BYTES = 1_500_000;
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown) => typeof value === 'string';
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const date = (value: unknown) => string(value) && Number.isFinite(Date.parse(value as string));
const array = (value: unknown, test: (item: unknown) => boolean, max = 300) => Array.isArray(value) && value.length <= max && value.every(test);
const optionalString = (value: unknown) => value === undefined || string(value);
const evidence = (value: unknown) => object(value) && string(value.label) && string(value.value) && optionalString(value.excerpt) && optionalString(value.sourceUrl) && ['present', 'verified', 'inferred'].includes(String(value.verification)) && (value.verificationLevel === undefined || ['direct', 'derived', 'heuristic', 'external', 'provider', 'not_measured'].includes(String(value.verificationLevel)));
const observation = (value: unknown) => object(value) && string(value.promptId) && string(value.engine) && date(value.timestamp) && typeof value.brandMentioned === 'boolean' && typeof value.domainCited === 'boolean' && optionalString(value.model) && optionalString(value.query) && optionalString(value.evidence) && (value.sources === undefined || array(value.sources, source => object(source) && string(source.url) && string(source.normalizedUrl) && optionalString(source.title)));

/** Untrusted imported files and stored JSON must not reach renderers unchecked. */
export function isReport(value: unknown): value is FreeAuditResult {
  if (!object(value) || !string(value.auditId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.auditId as string) || !string(value.domain) || !date(value.analyzedAt) || !string(value.methodologyVersion) || !string(value.interpretation) || !finite(value.pagesAnalyzed) || !finite(value.signalsAnalyzed) || !optionalString(value.notice) || !['completed', 'partial', 'failed'].includes(String(value.status))) return false;
  if (!object(value.readiness) || !['measured', 'not_measured', 'partial', 'failed'].includes(String(value.readiness.state)) || !(value.readiness.score === null || finite(value.readiness.score)) || !object(value.confidence) || !finite(value.confidence.value) || !['HIGH', 'MEDIUM', 'LOW'].includes(String(value.confidence.label))) return false;
  if (value.readinessCoverage !== undefined && (!object(value.readinessCoverage) || !finite(value.readinessCoverage.value))) return false;
  if (!object(value.opportunities) || !['total', 'critical', 'important', 'optimization'].every(key => finite((value.opportunities as RecordValue)[key]))) return false;
  const visibility = value.visibility;
  if (!object(visibility) || !['measured', 'not_measured', 'partial', 'failed'].includes(String(visibility.state)) || !(visibility.score === null || finite(visibility.score)) || !optionalString(visibility.blocker) || !array(visibility.prompts, item => object(item) && string(item.id) && string(item.query)) || !array(visibility.evidence, observation) || (visibility.observations !== undefined && !array(visibility.observations, observation))) return false;
  if (visibility.coverageDetail !== undefined && (!object(visibility.coverageDetail) || !['value', 'successfulObservations', 'plannedPrompts'].every(key => finite((visibility.coverageDetail as RecordValue)[key])))) return false;
  if (visibility.providerCandidates !== undefined && !array(visibility.providerCandidates, item => object(item) && string(item.id) && string(item.label))) return false;
  if (value.details === undefined) return true; // Older summaries are explicitly labelled as lacking details.
  const details = value.details;
  if (!object(details) || !array(details.checks, item => object(item) && string(item.id) && string(item.label) && string(item.categoryId) && typeof item.measured === 'boolean' && finite(item.pointsEarned) && finite(item.pointsAvailable) && ['pass', 'partial', 'fail', 'unknown', 'not_applicable'].includes(String(item.status)) && array(item.evidence, evidence))) return false;
  if (!array(details.categoryScores, item => object(item) && string(item.id) && string(item.label) && finite(item.coverage) && finite(item.weight) && (item.score === null || finite(item.score)))) return false;
  if (!array(details.remediationSummary, item => object(item) && string(item.checkId) && string(item.title) && string(item.whyItMatters) && optionalString(item.howToFix) && optionalString(item.verification) && ['critical', 'important', 'optimization'].includes(String(item.priority)) && finite(item.scoreImpact))) return false;
  if (!object(details.crawlSummary) || !['pagesFetched', 'requestedLimit', 'pagesFailed'].every(key => finite((details.crawlSummary as RecordValue)[key])) || !array(details.crawlSummary.pages, item => object(item) && string(item.finalUrl) && optionalString(item.title) && finite(item.statusCode) && finite(item.wordCount))) return false;
  return object(details.externalBrandFootprint) && string(details.externalBrandFootprint.state) && optionalString(details.externalBrandFootprint.blocker) && object(details.potentialScore) && string(details.potentialScore.state) && optionalString(details.potentialScore.blocker);
}

export function readReports(storage: StoragePort): { reports: FreeAuditResult[]; error?: string } {
  try {
    const raw = storage.getItem(REPORT_ARCHIVE_KEY);
    if (!raw) return { reports: [] };
    if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('oversize');
    const data: unknown = JSON.parse(raw);
    if (!object(data) || data.version !== 1 || !array(data.reports, isReport, MAX_REPORTS)) throw new Error('invalid');
    return { reports: data.reports as FreeAuditResult[] };
  } catch { return { reports: [], error: 'Archivio non disponibile o non leggibile. Il risultato corrente resta consultabile; puoi esportarlo come file.' }; }
}

export function writeReports(storage: StoragePort, reports: FreeAuditResult[]): { reports: FreeAuditResult[]; error?: string } {
  const retained = reports.slice(0, MAX_REPORTS);
  try {
    if (!retained.every(isReport)) throw new Error('invalid');
    const serialized = () => JSON.stringify({ version: 1, reports: retained });
    while (retained.length > 1 && new TextEncoder().encode(serialized()).length > MAX_BYTES) retained.pop();
    if (new TextEncoder().encode(serialized()).length > MAX_BYTES) throw new Error('oversize');
    storage.setItem(REPORT_ARCHIVE_KEY, serialized());
    return { reports: retained };
  } catch { return { reports, error: 'Salvataggio non riuscito: lo spazio del browser è pieno o non disponibile. Esporta il report per conservarlo.' }; }
}

export function saveReport(storage: StoragePort, report: FreeAuditResult) {
  const existing = readReports(storage);
  if (existing.error) return existing;
  return writeReports(storage, [report, ...existing.reports.filter(item => item.auditId !== report.auditId)]);
}

export function exportReport(report: FreeAuditResult): string {
  return JSON.stringify({ format: 'horyzon-ai-score-report', version: 1, audit: report });
}

export function importReport(text: string): FreeAuditResult {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw new Error('File troppo grande. Il limite è 1,5 MB.');
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('Il file non contiene un report JSON leggibile.'); }
  if (!object(data) || data.format !== 'horyzon-ai-score-report' || data.version !== 1 || !isReport(data.audit)) throw new Error('Il file non è un report Horyzon AI Score supportato.');
  return data.audit;
}
