import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const build = await mkdtemp(resolve(tmpdir(), 'horyzon-ai-report-'));
for (const file of await readdir('src/lib/ai-score')) if (file.endsWith('.ts')) {
  const output = ts.transpileModule(await readFile(`src/lib/ai-score/${file}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/(from\s+['"])(\.\/[^'"]+)(['"])/g, (_, a, b, c) => `${a}${b.replace(/\.ts$/, '')}.mjs${c}`);
  await writeFile(`${build}/${file.replace(/\.ts$/, '.mjs')}`, output);
}
const { runAiScoreAudit, toDetailedAudit } = await import(pathToFileURL(`${build}/audit.mjs`));
const { handleAiScoreRequest } = await import(pathToFileURL(`${build}/handler.mjs`));
const { isReport, saveReport, readReports, writeReports, exportReport, importReport, MAX_REPORTS, REPORT_ARCHIVE_KEY } = await import(pathToFileURL(`${build}/report-archive.mjs`));
const { reportLimits, priorityItems, safeSourceUrl } = await import(pathToFileURL(`${build}/report.mjs`));
let providerCalls = 0;
const html = '<html lang="it"><head><title>Report fixture</title></head><body><main><h1>Report fixture</h1><p>' + 'Servizi per le imprese e organizzazione del lavoro. '.repeat(50) + '</p></main></body></html>';
const internal = await runAiScoreAudit('https://report.example.test/', undefined, {
  fetchImpl: async url => ({ url: String(url), status: String(url).endsWith('/') ? 200 : 404, body: String(url).endsWith('/') ? html : '', headers: new Headers({ 'content-type': 'text/html' }), redirects: [] }),
  visibilityProvider: { measure: async () => { providerCalls++; return { state: 'not_measured', score: null, coverage: 0, methodologyVersion: 'fixture', blocker: 'Nessuna osservazione disponibile', weights: {}, prompts: [], evidence: [], observations: [] }; } },
  footprintProvider: { measure: async () => { providerCalls++; return { state: 'not_measured', score: null, coverage: 0, provider: 'fixture', brandMentions: null, independentSources: null, officialProfiles: [], evidence: [], blocker: 'Fonti esterne non disponibili' }; } },
});
const report = toDetailedAudit(internal);
assert(isReport(report), 'Real engine output must survive the archive validator');
assert.equal(report.locked.premiumAudit, false);
assert.deepEqual(report.details.checks, internal.premium.checks, 'Expose existing evidence without another scan');
assert.equal(report.readiness.score, internal.readiness.score, 'Unlock must not change scores');
assert.equal(providerCalls, 2);
let auditCalls = 0;
const request = () => new Request('http://localhost/api/ai-score', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': 'report-test' }, body: JSON.stringify({ url: 'https://report.example.test/' }) });
const options = { runAudit: async () => { auditCalls++; return internal; } };
for (let index = 0; index < 2; index++) {
  const events = (await (await handleAiScoreRequest(request(), options)).text()).trim().split('\n').map(JSON.parse);
  assert(isReport(events.at(-1).audit));
  assert.equal(events.at(-1).audit.details.checks.length, internal.premium.checks.length, 'Fresh and cached result both include details');
}
assert.equal(auditCalls, 1, 'Cached detail report must not rerun the engine');
const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
assert.equal(saveReport(storage, report).error, undefined);
const serializedReport = JSON.parse(JSON.stringify(report));
assert.deepEqual(readReports(storage).reports[0], serializedReport, 'Reopen every evidence and limitation after a fresh storage read');
assert.deepEqual(importReport(exportReport(report)), serializedReport, 'Portable report round trip');
saveReport(storage, report);
assert.equal(readReports(storage).reports.length, 1, 'Same audit is not duplicated');
for (let index = 0; index < MAX_REPORTS + 3; index++) saveReport(storage, { ...report, auditId: `audit-${index}` });
assert.equal(readReports(storage).reports.length, MAX_REPORTS);
assert.equal(readReports(storage).reports[0].auditId, `audit-${MAX_REPORTS + 2}`);
const limits = reportLimits(report);
assert(limits.some(item => item.title === 'Visibilità AI non misurata'));
assert(limits.some(item => item.title === 'Presenza esterna non misurata'));
assert(limits.some(item => item.title.includes('non calcolato')));
assert(limits.some(item => item.title.includes('controlli non misurati')));
const sampleObservation = { promptId: 'fixture-query', engine: 'Test AI', model: 'test-only', timestamp: report.analyzedAt, providerId: 'openai_web_search', provider: 'fixture', status: 'SUCCESS', query: 'Ricerca simulata per verifica UI', brandMentioned: true, domainCited: true, evidence: 'Risposta simulata: il brand è menzionato e il dominio è citato.', sources: [{ url: 'https://report.example.test/', normalizedUrl: 'https://report.example.test/', domain: 'report.example.test', title: 'Fonte di prova' }], competitorsMentioned: [], confidence: 90 };
const sampleVisibility = { ...report.visibility, state: 'partial', score: 75, coverage: 62, coverageDetail: { value: 62, plannedPrompts: 5, generatedPrompts: 3, executedPrompts: 3, successfulObservations: 2, plannedProviders: 1, measuredProviders: 1, metricAvailability: 80 }, evidence: [sampleObservation], observations: [sampleObservation, { ...sampleObservation, promptId: 'fixture-negative', query: 'Ricerca simulata senza menzione', brandMentioned: false, domainCited: false, evidence: 'Risposta simulata senza menzioni del brand.', sources: [] }, { ...sampleObservation, promptId: 'fixture-failed', query: 'Ricerca simulata non riuscita', status: 'FAILED', brandMentioned: false, domainCited: false, evidence: undefined, sources: [] }], providerCandidates: [{ id: 'openai_web_search', label: 'OpenAI Web Search' }, { id: 'google_search_grounding', label: 'Google Search grounding' }] };
const visibilityReport = { ...report, auditId: 'visibility-ui-fixture', visibility: sampleVisibility, details: { ...report.details, visibilityDetail: sampleVisibility } };
assert(isReport(visibilityReport));
assert(reportLimits(visibilityReport).some(item => item.title === 'Visibilità AI parziale' && item.description.includes('2 osservazioni valide')));
assert(reportLimits(visibilityReport).some(item => item.title === 'Servizi AI non osservati' && item.description.includes('Google') && !item.description.includes('OpenAI')));
assert(reportLimits({ ...report, details: undefined })[0].description.includes('scansione precedente'));
assert.deepEqual(priorityItems({ ...report, details: { ...report.details, remediationSummary: [{ checkId: 'a', priority: 'optimization', scoreImpact: 20 }, { checkId: 'b', priority: 'critical', scoreImpact: 1 }, { checkId: 'c', priority: 'important', scoreImpact: 2 }] } }).map(item => item.checkId), ['b', 'c', 'a']);
for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'file:///etc/passwd', 'https://user:secret@example.com', 'broken']) assert.equal(safeSourceUrl(url), undefined);
assert.equal(safeSourceUrl('https://example.com/'), 'https://example.com/');
const beforeQuota = storage.getItem(REPORT_ARCHIVE_KEY);
const quota = { getItem: storage.getItem, setItem: () => { throw new Error('quota'); } };
assert(saveReport(quota, report).error);
assert.equal(storage.getItem(REPORT_ARCHIVE_KEY), beforeQuota, 'Failed writes must preserve stored reports');
writeReports(storage, []);
assert.equal(readReports(storage).reports.length, 0);
values.set(REPORT_ARCHIVE_KEY, '{broken');
assert(readReports(storage).error);
assert(saveReport(storage, report).error, 'Corrupt archive is not silently overwritten');
for (const invalid of ['{}', '{bad', JSON.stringify({ format: 'horyzon-ai-score-report', version: 1, audit: { ...report, analyzedAt: 'invalid' } }), 'x'.repeat(1_500_001)]) assert.throws(() => importReport(invalid));
const corruptDetail = structuredClone(report); corruptDetail.details.checks[0].evidence = [{ label: 'Bad', value: { bad: true } }];
assert.equal(isReport(corruptDetail), false);
assert.equal(providerCalls, 2, 'Persistence/import/detail operations never invoke providers');
if (process.env.AI_SCORE_REPORT_QA_FILE) {
  await writeFile(process.env.AI_SCORE_REPORT_QA_FILE, exportReport(report));
  await writeFile(process.env.AI_SCORE_REPORT_QA_FILE.replace(/\.json$/, '-visibility.json'), exportReport(visibilityReport));
}
console.log('AI Score report: engine and cached details, archive/reopen/export/import, limits, priority order, unsafe URLs, corrupt files and quota failures verified with fixtures. No network/provider calls.');
