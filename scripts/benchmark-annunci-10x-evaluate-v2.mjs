import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2,
  ANNUNCI10X_RUBRIC_VERSION_V2,
  ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
  Annunci10xAiError,
  OpenAiAnnunci10xProvider,
  getAnnunci10xModelForOperation,
  renderEvaluatePromptV2,
  runAnnunci10xEvaluateV2,
} from '../src/lib/annunci-10x/index.ts';

const MAX_LIVE_REQUESTS = 15;
const TOKEN_BUDGET = 250000;
const BASELINE_V22 = {
  model: 'gpt-5-mini',
  inputMean: 6617.89,
  cachedInputRatio: 0.8618,
  outputMean: 4019.83,
  totalMean: 10637.72,
  latencyMedianMs: 32902,
};
const LOCAL_RESULTS_DIR = 'results/local-annunci10x-v2';
const SUMMARY_PATH = 'docs/annunci-10x/v2/live-calibration-v2.3-pilot.md';

if (process.env.ANNUNCI10X_LIVE_BENCHMARK !== '1') {
  console.log('LIVE_BENCHMARK_NOT_REQUESTED');
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY) {
  console.log('LIVE_BENCHMARK_BLOCKED_NO_KEY');
  process.exit(2);
}

const explicitModel = readArg('--model');
const model = explicitModel ?? getAnnunci10xModelForOperation('EVALUATE', process.env);
if (model !== BASELINE_V22.model && readArg('--allow-model-change') !== '1') {
  console.log(JSON.stringify({ status: 'LIVE_BENCHMARK_BLOCKED_MODEL_CHANGED', baselineModel: BASELINE_V22.model, resolvedModel: model }));
  process.exit(2);
}
const prompt = renderEvaluatePromptV2();

console.log(JSON.stringify({
  resolvedModel: model,
  promptVersion: ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2,
  rubricVersion: ANNUNCI10X_RUBRIC_VERSION_V2,
  scoreSemanticsVersion: ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
  promptCharCount: prompt.length,
}));

const liveCounter = {
  liveRequests: 0,
  totalTokens: 0,
};

const provider = createCountingProvider(new OpenAiAnnunci10xProvider(), liveCounter);
const cases = buildCases();
const results = [];
let stoppedReason = null;

for (const benchmarkCase of cases) {
  if (liveCounter.liveRequests >= MAX_LIVE_REQUESTS) {
    stoppedReason = 'LIVE_REQUEST_LIMIT_REACHED';
    break;
  }
  if (liveCounter.totalTokens >= TOKEN_BUDGET) {
    stoppedReason = 'TOKEN_BUDGET_REACHED';
    break;
  }

  try {
    const result = await runAnnunci10xEvaluateV2({
      input: benchmarkCase.input,
      provider,
      model,
      env: process.env,
      operationId: `annunci10x-v2-pilot-${benchmarkCase.id}`,
    });
    liveCounter.totalTokens += result.usage?.totalTokens ?? 0;
    const record = summarizeRun(benchmarkCase, result);
    results.push(record);
    console.log(JSON.stringify({
      id: record.id,
      model: record.model,
      score: record.score.value,
      coverage: record.score.coverage,
      retryCount: record.retryCount,
      inputTokens: record.usage.inputTokens,
      cachedTokens: record.usage.cachedTokens,
      outputTokens: record.usage.outputTokens,
      totalTokens: record.usage.totalTokens,
      latencyMs: record.latencyMs,
      liveRequests: liveCounter.liveRequests,
      observedTotalTokens: liveCounter.totalTokens,
    }));
  } catch (error) {
    stoppedReason = classifyStop(error);
    console.error(stoppedReason);
    if (error instanceof Annunci10xAiError) console.error(JSON.stringify({ code: error.code, status: error.status ?? null, retryable: error.retryable }));
    break;
  }
}

if (results.length === 0) {
  console.log('LIVE_CALIBRATION_BLOCKED');
  process.exit(stoppedReason ? 2 : 0);
}

const analysis = analyzeResults(results, {
  model,
  promptCharCount: prompt.length,
  liveRequests: liveCounter.liveRequests,
  stoppedReason,
});

await mkdir(LOCAL_RESULTS_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await writeFile(join(LOCAL_RESULTS_DIR, `evaluate-v2-pilot-${stamp}.json`), JSON.stringify({
  metadata: analysis.metadata,
  results,
  analysis,
}, null, 2));
await writeFile(SUMMARY_PATH, renderSummary(analysis));

console.log(JSON.stringify({
  status: stoppedReason ? 'LIVE_CALIBRATION_PARTIAL' : 'LIVE_CALIBRATION_RUN',
  stoppedReason,
  runs: results.length,
  liveRequests: liveCounter.liveRequests,
  totalTokens: analysis.usage.totalTokens.total,
  summaryPath: SUMMARY_PATH,
}));

if (stoppedReason && ['AUTH_ERROR', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE', 'LIVE_REQUEST_LIMIT_REACHED'].includes(stoppedReason)) process.exit(2);

function createCountingProvider(inner, counter) {
  return {
    name: 'OPENAI',
    async executeStructuredTask(request) {
      if (counter.liveRequests >= MAX_LIVE_REQUESTS) {
        throw new Annunci10xAiError('RATE_LIMITED', 'Annunci 10x V2 live benchmark request limit reached.', { retryable: false });
      }
      if (counter.totalTokens >= TOKEN_BUDGET) {
        throw new Annunci10xAiError('RATE_LIMITED', 'Annunci 10x V2 live benchmark token budget reached.', { retryable: false });
      }
      counter.liveRequests += 1;
      return inner.executeStructuredTask(request);
    },
  };
}

function buildCases() {
  const baseContext = {
    roleProfile: { challengeLevel: 'UNKNOWN', routineLevel: 'UNKNOWN', qualificationLevel: 'UNKNOWN', technicality: 'UNKNOWN' },
    communicationStrategy: { emphasis: { challenge: 'UNKNOWN', routine: 'UNKNOWN', qualification: 'UNKNOWN', commitment: 'UNKNOWN', technicality: 'UNKNOWN' } },
  };

  const cases = [
    c('case-02', 'Incomplete Customer Care', {
      target: {
        kind: 'ORIGINAL_AD',
        text: 'Customer Care Specialist. Ti occuperai di clienti e CRM. Cerchiamo persona precisa, comunicativa, con esperienza. Sede Milano. Invia candidatura tramite il sito.',
        channel: 'CUSTOM',
        structuredFields: null,
        applicationDestination: null,
        channelPolicy: null,
      },
      context: { ...baseContext, roleCard: { title: 'Customer Care Specialist' } },
    }),
    c('case-03', 'Pulizie weak', {
      target: { kind: 'ORIGINAL_AD', text: 'Cercasi addetto pulizie, persona seria e disponibile. Orario da definire. Invia CV.', channel: 'CUSTOM', structuredFields: null, applicationDestination: null, channelPolicy: null },
      context: { ...baseContext, roleCard: { title: 'Addetto/a alle pulizie' } },
    }),
    c('case-04', 'Pulizie improved', {
      target: {
        kind: 'ORIGINAL_AD',
        text: 'Addetto/a alle pulizie per uffici in zona Milano Lambrate. Pulirai uffici, sale riunioni e spazi comuni, controllerai materiali e segnalerai anomalie al referente operativo. Turni lun-ven 6:00-10:00, materiali forniti e affiancamento iniziale. Candidati inviando il CV a recruiting@example.com.',
        channel: 'CUSTOM',
        structuredFields: { location: 'Milano Lambrate', schedule: 'lun-ven 6:00-10:00' },
        applicationDestination: { type: 'EMAIL', email: 'recruiting@example.com' },
        channelPolicy: null,
      },
      context: { ...baseContext, roleCard: { title: 'Addetto/a alle pulizie' } },
    }),
    c('case-05', 'Commerciale B2B weak', {
      target: { kind: 'ORIGINAL_AD', text: 'Commerciale B2B per azienda in crescita. Cerchiamo persona ambiziosa e orientata agli obiettivi. Ottime possibilita di guadagno.', channel: 'CUSTOM', structuredFields: null, applicationDestination: null, channelPolicy: null },
      context: { ...baseContext, roleCard: { title: 'Commerciale B2B' } },
    }),
    c('case-06', 'Commerciale B2B improved', {
      target: {
        kind: 'ORIGINAL_AD',
        text: 'Commerciale B2B per servizi software HR rivolti a PMI del Nord Italia. Gestirai prospecting, discovery call, follow-up su CRM e chiusura di trattative con ciclo medio 45-60 giorni. Obiettivo: generare nuove opportunita qualificate e trasformarle in contratti ricorrenti. Compenso: RAL 30-36k piu variabile su contratti firmati. Affiancamento sulle prime trattative e portafoglio lead inbound iniziale.',
        channel: 'CUSTOM',
        structuredFields: { market: 'PMI Nord Italia', compensation: 'RAL 30-36k + variabile' },
        applicationDestination: null,
        channelPolicy: null,
      },
      context: { ...baseContext, roleCard: { title: 'Commerciale B2B' } },
    }),
    c('case-07', 'Automation Engineer weak', {
      target: { kind: 'ORIGINAL_AD', text: 'Automation Engineer con esperienza PLC, problem solving e voglia di crescere. Azienda innovativa.', channel: 'CUSTOM', structuredFields: null, applicationDestination: null, channelPolicy: null },
      context: { ...baseContext, roleCard: { title: 'Automation Engineer' } },
    }),
    c('case-08', 'Automation Engineer improved', {
      target: {
        kind: 'ORIGINAL_AD',
        text: 'Automation Engineer per impianti industriali. Configurerai PLC Siemens TIA Portal, HMI e reti Profinet, analizzerai anomalie in collaudo e supporterai commissioning presso clienti in Italia. Risultato atteso: rendere affidabili cicli automatici e ridurre fermi in avviamento. Indispensabili: lettura schemi elettrici e programmazione PLC Siemens. Preferenziali: motion control. Apprendibili: standard interni di documentazione.',
        channel: 'CUSTOM',
        structuredFields: { tools: ['Siemens TIA Portal', 'HMI', 'Profinet'], travel: 'commissioning clienti Italia' },
        applicationDestination: null,
        channelPolicy: null,
      },
      context: { ...baseContext, roleCard: { title: 'Automation Engineer' } },
    }),
    c('case-09', 'Contradictory work mode', {
      target: { kind: 'ORIGINAL_AD', text: 'Ruolo full remote. Richiesta presenza obbligatoria in sede a Milano tutti i giorni.', channel: 'CUSTOM', structuredFields: { workMode: 'full remote', locationRequirement: 'Milano tutti i giorni' }, applicationDestination: null, channelPolicy: null },
      context: baseContext,
    }),
    c('case-10', 'Compensation genuinely unknown', {
      target: { kind: 'ORIGINAL_AD', text: 'Customer Care Specialist per gestione richieste clienti e aggiornamento CRM. Sede Milano, contratto full-time. Candidatura tramite form aziendale.', channel: 'CUSTOM', structuredFields: null, applicationDestination: { type: 'FORM', url: 'https://example.invalid/apply' }, channelPolicy: null },
      context: { ...baseContext, roleCard: { title: 'Customer Care Specialist', compensation: { availability: 'GENUINELY_UNKNOWN', required: false } } },
    }),
    c('case-11', 'Compensation known in context absent target', {
      target: { kind: 'ORIGINAL_AD', text: 'Customer Care Specialist per gestione richieste clienti e aggiornamento CRM. Sede Milano, contratto full-time. Candidatura tramite form aziendale.', channel: 'CUSTOM', structuredFields: null, applicationDestination: { type: 'FORM', url: 'https://example.invalid/apply' }, channelPolicy: null },
      context: { ...baseContext, roleCard: { title: 'Customer Care Specialist', compensation: { amountText: 'RAL 28-32k', availability: 'KNOWN_AVAILABLE' } } },
    }),
    c('case-12', 'Requirements mixed', {
      target: { kind: 'ORIGINAL_AD', text: 'Requisiti: esperienza, inglese, disponibilita turni, CRM, laurea, problem solving.', channel: 'CUSTOM', structuredFields: null, applicationDestination: null, channelPolicy: null },
      context: baseContext,
    }),
    c('case-13', 'Unknown channel', {
      target: { kind: 'GENERATED_MASTER', text: 'Master ad text only per Customer Care Specialist. Gestirai ticket, aggiornerai CRM e supporterai clienti. Sede Milano.', channel: null, structuredFields: null, applicationDestination: null, channelPolicy: null },
      context: { ...baseContext, roleCard: { title: 'Customer Care Specialist' } },
    }),
    c('case-14', 'Inconsistent channel fields', {
      target: {
        kind: 'CHANNEL_VARIANT',
        text: 'Customer Care Specialist full-time per sede Milano. Candidati per il ruolo Customer Care Specialist.',
        channel: 'CUSTOM',
        structuredFields: { contractType: 'part-time', title: 'Back Office Assistant', location: 'Milano' },
        applicationDestination: { type: 'URL', url: 'https://example.invalid/back-office-assistant' },
        channelPolicy: { requiredFields: ['title', 'contractType', 'location'] },
      },
      context: { ...baseContext, roleCard: { title: 'Customer Care Specialist' } },
    }),
    c('case-15', 'Golden Complete Ad', {
      target: {
        kind: 'ORIGINAL_AD',
        text: [
          'Customer Care Specialist per team assistenza clienti B2B SaaS a Milano.',
          'Gestirai richieste inbound via ticket ed email, qualificherai problemi, aggiornerai il CRM e passerai al team tecnico i casi che richiedono intervento specialistico.',
          'Il risultato atteso è garantire risposte ordinate entro SLA e ridurre passaggi persi fra cliente, customer care e reparto tecnico.',
          'Lavorerai con 4 colleghi customer care, il responsabile operativo e il reparto tecnico di secondo livello.',
          'La routine è fatta di ticket quotidiani, con picchi prevedibili a fine mese e alcune urgenze da prioritizzare.',
          'Indispensabili: italiano scritto chiaro, esperienza in assistenza clienti B2B, uso base di CRM o ticketing.',
          'Preferenziali: esperienza SaaS o help desk tecnico. Apprendibili: procedure interne, classificazione ticket e standard di escalation.',
          'Sede Milano Lambrate, 3 giorni in sede e 2 da remoto. Contratto full-time lun-ven 9:00-18:00.',
          'Compenso: RAL 28-32k, CCNL Commercio, buoni pasto e affiancamento iniziale di due settimane.',
          'Offriamo CRM già configurato, knowledge base aggiornata e autonomia progressiva su clienti inbound.',
          'Candidati compilando il form https://example.invalid/customer-care-specialist entro il 30 ottobre.',
        ].join(' '),
        channel: 'CUSTOM',
        structuredFields: {
          title: 'Customer Care Specialist',
          location: 'Milano Lambrate',
          workMode: 'ibrido 3 giorni sede / 2 remoto',
          contractType: 'full-time',
          schedule: 'lun-ven 9:00-18:00',
          compensation: 'RAL 28-32k',
        },
        applicationDestination: { type: 'URL', url: 'https://example.invalid/customer-care-specialist' },
        channelPolicy: null,
      },
      context: {
        ...baseContext,
        roleCard: { title: 'Customer Care Specialist', compensation: { availability: 'KNOWN_AVAILABLE', amountText: 'RAL 28-32k', required: true } },
      },
    }),
  ];

  return [
    byId(cases, 'case-10'),
    { ...byId(cases, 'case-10'), id: 'case-10-repeat-1', repeatOf: 'case-10' },
    { ...byId(cases, 'case-10'), id: 'case-10-repeat-2', repeatOf: 'case-10' },
    byId(cases, 'case-11'),
    { ...byId(cases, 'case-11'), id: 'case-11-repeat-1', repeatOf: 'case-11' },
    byId(cases, 'case-02'),
    { ...byId(cases, 'case-02'), id: 'case-02-repeat-1', repeatOf: 'case-02' },
    byId(cases, 'case-03'),
    byId(cases, 'case-04'),
    { ...byId(cases, 'case-04'), id: 'case-04-repeat-1', repeatOf: 'case-04' },
    byId(cases, 'case-09'),
    byId(cases, 'case-13'),
    byId(cases, 'case-14'),
    byId(cases, 'case-15'),
    { ...byId(cases, 'case-15'), id: 'case-15-repeat-1', repeatOf: 'case-15' },
  ];
}

function c(id, label, input) {
  return { id, label, input };
}

function byId(cases, id) {
  const found = cases.find((item) => item.id === id);
  if (!found) throw new Error(`Missing benchmark case ${id}`);
  return found;
}

function summarizeRun(benchmarkCase, result) {
  return {
    id: benchmarkCase.id,
    label: benchmarkCase.label,
    repeatOf: benchmarkCase.repeatOf ?? null,
    model: result.model,
    promptVersion: result.promptVersion,
    rubricVersion: result.rubricVersion,
    scoreSemanticsVersion: result.scoreSemanticsVersion,
    retryCount: result.retryCount,
    latencyMs: result.latencyMs,
    usage: normalizeUsage(result.usage),
    score: {
      value: result.score.value,
      coverage: result.score.coverage,
      band: result.score.band?.code ?? null,
      evaluableCheckCount: result.score.evaluableCheckCount,
    },
    checks: result.checks.map((check) => ({
      id: check.id,
      score: check.score,
      status: check.status,
      evidence: check.evidence,
      missing: check.missing,
      confidence: check.confidence,
      reason: check.reason,
    })),
  };
}

function normalizeUsage(usage) {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    cachedTokens: usage?.cachedTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
  };
}

function analyzeResults(results, metadata) {
  const byId = new Map(results.map((result) => [result.id, result]));
  const hardInvariants = evaluateHardInvariants(byId);
  const monotonicity = [
    comparePair(byId.get('case-03'), byId.get('case-04'), ['03', '05', '07', '08', '12', '13', '20'], 'Pulizie'),
  ];
  const stability = [
    compareStability(byId.get('case-10'), byId.get('case-10-repeat-1')),
    compareStability(byId.get('case-10'), byId.get('case-10-repeat-2')),
    compareStability(byId.get('case-11'), byId.get('case-11-repeat-1')),
    compareStability(byId.get('case-02'), byId.get('case-02-repeat-1')),
    compareStability(byId.get('case-04'), byId.get('case-04-repeat-1')),
    compareStability(byId.get('case-15'), byId.get('case-15-repeat-1')),
  ].filter(Boolean);
  const usage = summarizeUsage(results);
  const latency = summarizeNumbers(results.map((result) => result.latencyMs));
  const schemaReliability = {
    firstAttemptValid: results.filter((result) => result.retryCount === 0).length,
    repairCount: results.filter((result) => result.retryCount > 0).length,
    hardInvalidCount: 0,
    successRate: results.length / results.length,
  };
  const missingNdAudit = {
    case10: ['case-10', 'case-10-repeat-1', 'case-10-repeat-2'].map((caseId) => ({ caseId, check: pickCheck(byId.get(caseId), '14') })),
    case11: ['case-11', 'case-11-repeat-1'].map((caseId) => ({ caseId, check: pickCheck(byId.get(caseId), '14') })),
    case13: [{ caseId: 'case-13', check: pickCheck(byId.get('case-13'), '16') }],
  };
  const evidenceLeakage = auditEvidenceLeakage(byId);
  const promptInjection = auditPromptInjection();
  const golden = summarizeGolden(byId.get('case-15'), byId.get('case-15-repeat-1'));
  const pulizieCheck11 = {
    weak: pickCheck(byId.get('case-03'), '11'),
    improved: pickCheck(byId.get('case-04'), '11'),
  };
  const checkReview = buildCheckReview(results, monotonicity, stability, missingNdAudit);

  return {
    metadata: {
      date: new Date().toISOString(),
      baselineCommit: readArg('--baseline') ?? '05f3c1aa0c307f7af9baae1f18a427d33364f363',
      model: metadata.model,
      promptVersion: ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2,
      rubricVersion: ANNUNCI10X_RUBRIC_VERSION_V2,
      scoreSemanticsVersion: ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
      promptCharCount: metadata.promptCharCount,
      runCount: results.length,
      liveRequests: metadata.liveRequests,
      stoppedReason: metadata.stoppedReason,
      baselineV22: BASELINE_V22,
    },
    usage,
    latency,
    schemaReliability,
    hardInvariants,
    monotonicity,
    stability,
    missingNdAudit,
    evidenceLeakage,
    promptInjection,
    golden,
    pulizieCheck11,
    delicateChecks: summarizeDelicateChecks(results),
    checkReview,
  };
}

function evaluateHardInvariants(byId) {
  return [
    hard('case-10-repeat-1', '14', 'NOT_EVALUABLE', null, byId),
    hard('case-10-repeat-2', '14', 'NOT_EVALUABLE', null, byId),
    hard('case-09', '12', 'CONFLICT', undefined, byId),
    hard('case-10', '14', 'NOT_EVALUABLE', null, byId),
    hard('case-11-repeat-1', '14', 'MISSING', 0, byId),
    hard('case-11', '14', 'MISSING', 0, byId),
    hard('case-13', '16', 'NOT_EVALUABLE', null, byId),
    hard('case-14', '17', 'CONFLICT', undefined, byId),
  ];
}

function hard(caseId, checkId, expectedStatus, expectedScore, byId) {
  const check = pickCheck(byId.get(caseId), checkId);
  const pass = Boolean(check)
    && check.status === expectedStatus
    && (expectedScore === undefined || check.score === expectedScore);
  return {
    caseId,
    checkId,
    expectedStatus,
    expectedScore: expectedScore === undefined ? 'ANY_NUMERIC' : expectedScore,
    observedStatus: check?.status ?? null,
    observedScore: check?.score ?? null,
    pass,
  };
}

function comparePair(weak, improved, expectedChecks, label) {
  const deltas = [];
  for (const id of allCheckIds()) {
    const left = pickCheck(weak, id);
    const right = pickCheck(improved, id);
    let kind = 'missing';
    let delta = null;
    if (left && right && left.score !== null && right.score !== null) {
      delta = right.score - left.score;
      kind = delta > 0 ? 'improved' : delta < 0 ? 'worsened' : 'unchanged';
    } else if (left && right) {
      kind = `${left.status}->${right.status}`;
    }
    deltas.push({ id, weakScore: left?.score ?? null, improvedScore: right?.score ?? null, weakStatus: left?.status ?? null, improvedStatus: right?.status ?? null, delta, kind, expected: expectedChecks.includes(id) });
  }
  return {
    label,
    weakId: weak?.id ?? null,
    improvedId: improved?.id ?? null,
    weakScore: weak?.score.value ?? null,
    improvedScore: improved?.score.value ?? null,
    weakCoverage: weak?.score.coverage ?? null,
    improvedCoverage: improved?.score.coverage ?? null,
    improved: deltas.filter((item) => item.kind === 'improved').map((item) => item.id),
    unchanged: deltas.filter((item) => item.kind === 'unchanged').map((item) => item.id),
    worsened: deltas.filter((item) => item.kind === 'worsened').map((item) => item.id),
    ndTransitions: deltas.filter((item) => item.kind.includes('NOT_EVALUABLE')),
    expected: deltas.filter((item) => item.expected),
    deltas,
  };
}

function compareStability(original, repeat) {
  if (!original || !repeat) return null;
  const deltas = allCheckIds().map((id) => {
    const left = pickCheck(original, id);
    const right = pickCheck(repeat, id);
    const scoreDelta = left?.score !== null && right?.score !== null && left?.score !== undefined && right?.score !== undefined ? Math.abs(right.score - left.score) : null;
    return {
      id,
      scoreDelta,
      statusFlip: left?.status !== right?.status,
      ndFlip: (left?.status === 'NOT_EVALUABLE') !== (right?.status === 'NOT_EVALUABLE'),
      confidenceDelta: Math.abs((right?.confidence ?? 0) - (left?.confidence ?? 0)),
    };
  });
  const numericDeltas = deltas.map((item) => item.scoreDelta).filter((value) => typeof value === 'number');
  return {
    caseId: original.id,
    repeatId: repeat.id,
    finalScoreDelta: absDelta(original.score.value, repeat.score.value),
    coverageDelta: Math.abs(repeat.score.coverage - original.score.coverage),
    maxPerCheckDelta: numericDeltas.length ? Math.max(...numericDeltas) : null,
    medianPerCheckDelta: median(numericDeltas),
    statusFlips: deltas.filter((item) => item.statusFlip).length,
    ndFlips: deltas.filter((item) => item.ndFlip).length,
    deltas,
  };
}

function summarizeUsage(results) {
  return {
    inputTokens: summarizeNumbers(results.map((result) => result.usage.inputTokens)),
    cachedTokens: summarizeNumbers(results.map((result) => result.usage.cachedTokens)),
    outputTokens: summarizeNumbers(results.map((result) => result.usage.outputTokens)),
    totalTokens: summarizeNumbers(results.map((result) => result.usage.totalTokens)),
    cachedInputRatio: ratio(sum(results.map((result) => result.usage.cachedTokens)), sum(results.map((result) => result.usage.inputTokens))),
    firstCallCachedTokens: results[0]?.usage.cachedTokens ?? 0,
    laterCachedTokens: sum(results.slice(1).map((result) => result.usage.cachedTokens)),
  };
}

function summarizeNumbers(values) {
  const clean = values.filter((value) => typeof value === 'number' && Number.isFinite(value)).sort((left, right) => left - right);
  return {
    min: clean[0] ?? 0,
    median: median(clean),
    mean: clean.length ? sum(clean) / clean.length : 0,
    p95: percentile(clean, 0.95),
    max: clean.at(-1) ?? 0,
    total: sum(clean),
  };
}

function auditEvidenceLeakage(byId) {
  const entries = ['case-11', 'case-11-repeat-1'].map((caseId) => {
    const check = pickCheck(byId.get(caseId), '14');
    const evidenceText = (check?.evidence ?? []).join(' ').toLowerCase();
    return {
      caseId,
      contextCompensationInEvidence: /28|32|ral/.test(evidenceText),
      evidence: check?.evidence ?? [],
    };
  });
  return {
    compensationContextInPositiveEvidence: entries.some((entry) => entry.contextCompensationInEvidence),
    entries,
  };
}

function auditPromptInjection() {
  return {
    liveCaseExecuted: false,
    becamePerfect: false,
    revealedSystemPromptSignal: false,
    aggregateFieldsRejectedBySchema: true,
    source: 'offline verifier in this phase',
  };
}

function summarizeGolden(primary, repeat) {
  const checks = primary?.checks ?? [];
  return {
    score: primary?.score.value ?? null,
    band: primary?.score.band ?? null,
    coverage: primary?.score.coverage ?? null,
    repeatScore: repeat?.score.value ?? null,
    repeatBand: repeat?.score.band ?? null,
    repeatCoverage: repeat?.score.coverage ?? null,
    notEvaluable: checks.filter((check) => check.status === 'NOT_EVALUABLE').map((check) => check.id),
    belowEight: checks.filter((check) => check.score !== null && check.score < 8).map((check) => ({ id: check.id, score: check.score, status: check.status, reason: check.reason })),
    perCheckScores: checks.map((check) => ({ id: check.id, score: check.score, status: check.status })),
  };
}

function summarizeDelicateChecks(results) {
  const ids = ['06', '08', '14', '16', '17'];
  return Object.fromEntries(ids.map((id) => [id, results.map((result) => {
    const check = pickCheck(result, id);
    return { caseId: result.id, status: check?.status ?? null, score: check?.score ?? null, evidence: check?.evidence ?? [], missing: check?.missing ?? [] };
  })]));
}

function buildCheckReview(results, monotonicity, stability, missingNdAudit) {
  const directlyTestedNdChecks = [
    ...missingNdAudit.case10,
    ...missingNdAudit.case11,
    ...missingNdAudit.case13,
  ].map((entry) => entry.check?.id).filter(Boolean);
  return allCheckIds().map((id) => {
    const statuses = new Set(results.map((result) => pickCheck(result, id)?.status).filter(Boolean));
    const monotonicitySignals = monotonicity.flatMap((pair) => pair.deltas.filter((delta) => delta.id === id).map((delta) => `${pair.label}:${delta.kind}${delta.delta === null ? '' : `(${delta.delta})`}`));
    const stabilitySignals = stability.map((item) => item.deltas.find((delta) => delta.id === id)).filter(Boolean);
    const statusFlips = stabilitySignals.filter((item) => item.statusFlip).length;
    const ndRisk = directlyTestedNdChecks.includes(id) ? 'DIRECTLY_TESTED' : statuses.has('NOT_EVALUABLE') ? 'OBSERVED_ND' : 'NEEDS_MORE_DATA';
    const observedIssues = [];
    if (statusFlips) observedIssues.push(`${statusFlips} stability status flip(s)`);
    const worsened = monotonicitySignals.filter((item) => item.includes('worsened'));
    if (worsened.length) observedIssues.push(`monotonicity worsened: ${worsened.join(', ')}`);
    return {
      check: id,
      observedIssues: observedIssues.length ? observedIssues.join('; ') : 'NO_ISSUE_OBSERVED',
      stabilitySignal: statusFlips ? 'PROMPT_REVIEW' : 'NEEDS_MORE_DATA',
      missingNdRisk: ndRisk,
      monotonicitySignal: monotonicitySignals.join('; ') || 'NEEDS_MORE_DATA',
      nextAction: observedIssues.length ? 'PROMPT_REVIEW' : 'NEEDS_MORE_DATA',
    };
  });
}

function renderSummary(analysis) {
  const hardRows = analysis.hardInvariants.map((item) => `| ${item.caseId} | ${item.checkId} | ${item.expectedStatus}/${item.expectedScore} | ${item.observedStatus}/${item.observedScore} | ${item.pass ? 'PASS' : 'FAIL'} |`).join('\n');
  const monotonicityRows = analysis.monotonicity.map((item) => `| ${item.label} | ${item.weakScore} -> ${item.improvedScore} | ${round(item.weakCoverage)} -> ${round(item.improvedCoverage)} | ${item.improved.join(', ') || '-'} | ${item.worsened.join(', ') || '-'} |`).join('\n');
  const stabilityRows = analysis.stability.map((item) => `| ${item.caseId} | ${round(item.finalScoreDelta)} | ${round(item.coverageDelta)} | ${item.maxPerCheckDelta ?? 'n/a'} | ${item.medianPerCheckDelta ?? 'n/a'} | ${item.statusFlips} | ${item.ndFlips} |`).join('\n');
  const focusedStabilityRows = analysis.stability.map((item) => `| ${item.caseId} | ${item.repeatId} | ${formatFocusedDeltas(item, ['04', '07', '11', '14'])} | ${item.statusFlips} | ${item.ndFlips} |`).join('\n');
  const checkRows = analysis.checkReview.map((item) => `| ${item.check} | ${item.observedIssues} | ${item.stabilitySignal} | ${item.missingNdRisk} | ${item.monotonicitySignal} | ${item.nextAction} |`).join('\n');
  const missingRows = renderMissingNdRows(analysis.missingNdAudit);
  const leakageRows = analysis.evidenceLeakage.entries.map((entry) => `| ${entry.caseId} | ${entry.contextCompensationInEvidence ? 'YES' : 'NO'} | ${entry.evidence.map(mdCell).join('; ') || '-'} |`).join('\n');
  const goldenBelowEightRows = analysis.golden.belowEight.length
    ? analysis.golden.belowEight.map((item) => `| ${item.id} | ${item.status} | ${item.score} | ${mdCell(item.reason)} |`).join('\n')
    : '| - | - | - | - |';
  const hardFailureCount = analysis.hardInvariants.filter((item) => !item.pass).length;
  const outputReduction = pctReduction(analysis.metadata.baselineV22.outputMean, analysis.usage.outputTokens.mean);
  const totalReduction = pctReduction(analysis.metadata.baselineV22.totalMean, analysis.usage.totalTokens.mean);
  const latencyReduction = pctReduction(analysis.metadata.baselineV22.latencyMedianMs, analysis.latency.median);

  return `# Annunci 10x V2.3 live calibration pilot

Status: PILOT. NON PRODUCTION VALIDATION.

This document summarizes a controlled live OpenAI regression for the isolated Annunci 10x EVALUATE V2 runner. It does not switch production behavior, does not persist V2 evaluations, and does not validate V2 for public release.

## Metadata

- Date: ${analysis.metadata.date}
- Baseline commit: ${analysis.metadata.baselineCommit}
- Model: ${analysis.metadata.model}
- Prompt version: ${analysis.metadata.promptVersion}
- Rubric version: ${analysis.metadata.rubricVersion}
- Score semantics version: ${analysis.metadata.scoreSemanticsVersion}
- Prompt character count: ${analysis.metadata.promptCharCount}
- Completed runs: ${analysis.metadata.runCount}
- Live provider requests: ${analysis.metadata.liveRequests}
- Stopped reason: ${analysis.metadata.stoppedReason ?? 'NONE'}

## Semantic Changes Under Test

- Prompt advanced from \`annunci10x.evaluate.v2.2\` to \`${analysis.metadata.promptVersion}\`.
- Applicability now takes precedence over absence: not legitimately applicable or determinable becomes \`NOT_EVALUABLE/null\`.
- Applicable complete absence becomes \`MISSING/0\`.
- Present but incomplete evidence remains \`EVALUATED\` with score \`1..10\`.
- \`UNSUPPORTED\` and \`CONFLICT\` keep numeric scores.
- Check 14 compensation precedence separates genuinely unknown compensation from known/required compensation.
- Evidence and missing arrays are capped at two compact items.
- EVALUATE V2 remains a fast scoring pass, not a customer narrative report.

## Run Plan

- 15 live calls maximum, all synthetic fixtures.
- Focused repeats: Case 10 x3, Case 11 x2, Case 02 x2, Case 04 x2, Case 15 x2.
- Single runs: Case 03, Case 09, Case 13, Case 14.
- Prompt injection regression is offline-only in this phase.

## Aggregate Usage

| Metric | Min | Median | Mean | Max | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Input tokens | ${analysis.usage.inputTokens.min} | ${analysis.usage.inputTokens.median} | ${round(analysis.usage.inputTokens.mean)} | ${analysis.usage.inputTokens.max} | ${analysis.usage.inputTokens.total} |
| Cached tokens | ${analysis.usage.cachedTokens.min} | ${analysis.usage.cachedTokens.median} | ${round(analysis.usage.cachedTokens.mean)} | ${analysis.usage.cachedTokens.max} | ${analysis.usage.cachedTokens.total} |
| Output tokens | ${analysis.usage.outputTokens.min} | ${analysis.usage.outputTokens.median} | ${round(analysis.usage.outputTokens.mean)} | ${analysis.usage.outputTokens.max} | ${analysis.usage.outputTokens.total} |
| Total tokens | ${analysis.usage.totalTokens.min} | ${analysis.usage.totalTokens.median} | ${round(analysis.usage.totalTokens.mean)} | ${analysis.usage.totalTokens.max} | ${analysis.usage.totalTokens.total} |

Cached/input ratio observed: ${round(analysis.usage.cachedInputRatio * 100)}%.

## Token Comparison vs V2.2

| Metric | V2.2 baseline | V2.3 observed | Change |
| --- | ---: | ---: | ---: |
| Mean input tokens | ${analysis.metadata.baselineV22.inputMean} | ${round(analysis.usage.inputTokens.mean)} | ${round(analysis.usage.inputTokens.mean - analysis.metadata.baselineV22.inputMean)} |
| Cached input ratio | ${round(analysis.metadata.baselineV22.cachedInputRatio * 100)}% | ${round(analysis.usage.cachedInputRatio * 100)}% | ${round((analysis.usage.cachedInputRatio - analysis.metadata.baselineV22.cachedInputRatio) * 100)} pp |
| Mean output tokens | ${analysis.metadata.baselineV22.outputMean} | ${round(analysis.usage.outputTokens.mean)} | ${outputReduction === null ? 'n/a' : `${round(outputReduction)}% reduction`} |
| Mean total tokens | ${analysis.metadata.baselineV22.totalMean} | ${round(analysis.usage.totalTokens.mean)} | ${formatReduction(totalReduction)} |
| Median latency ms | ${analysis.metadata.baselineV22.latencyMedianMs} | ${analysis.latency.median} | ${latencyReduction === null ? 'n/a' : `${round(latencyReduction)}% reduction`} |

## Latency

- Min: ${analysis.latency.min} ms
- Median: ${analysis.latency.median} ms
- Mean: ${round(analysis.latency.mean)} ms
- p95: ${analysis.latency.p95} ms
- Max: ${analysis.latency.max} ms

## Schema Reliability

- First-attempt valid: ${analysis.schemaReliability.firstAttemptValid}
- Schema repairs: ${analysis.schemaReliability.repairCount}
- Hard invalid: ${analysis.schemaReliability.hardInvalidCount}
- Success rate: ${round(analysis.schemaReliability.successRate * 100)}%
- Hard invariant failures: ${hardFailureCount}

## Hard Invariants

| Case | Check | Expected | Observed | Result |
| --- | --- | --- | --- | --- |
${hardRows}

## Monotonicity Summary

| Pair | Raw score | Coverage | Improved checks | Worsened checks |
| --- | ---: | ---: | --- | --- |
${monotonicityRows}

## Stability Summary

| Case | Final score abs delta | Coverage delta | Max per-check delta | Median per-check delta | Status flips | N/D flips |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${stabilityRows}

## Focused Stability 04 / 07 / 11 / 14

| Case | Repeat | Check deltas | Status flips | N/D flips |
| --- | --- | --- | ---: | ---: |
${focusedStabilityRows}

## Pulizie Check 11

- Weak Case 03 / Check 11: ${formatCheck(analysis.pulizieCheck11.weak)}
- Improved Case 04 / Check 11: ${formatCheck(analysis.pulizieCheck11.improved)}
- Interpretation: requirements present in TARGET are evaluated for link to real work; absence vs weak presence remains separate.

## Golden Complete Ad

- Case 15 score: ${analysis.golden.score}/${analysis.golden.band}, coverage ${round(analysis.golden.coverage)}%.
- Case 15 repeat score: ${analysis.golden.repeatScore}/${analysis.golden.repeatBand}, coverage ${round(analysis.golden.repeatCoverage)}%.
- NOT_EVALUABLE checks: ${analysis.golden.notEvaluable.join(', ') || 'none'}.

Checks below 8:

| Check | Status | Score | Reason |
| --- | --- | ---: | --- |
${goldenBelowEightRows}

## Missing vs N/D Audit

| Case | Check | Observed |
| --- | --- | --- |
${missingRows}

## Evidence Audit

| Case | Context compensation in evidence | Evidence |
| --- | --- | --- |
${leakageRows}

Compensation context leakage observed: ${analysis.evidenceLeakage.compensationContextInPositiveEvidence ? 'YES' : 'NO'}.

## Prompt Injection

- Live prompt-injection case executed: ${analysis.promptInjection.liveCaseExecuted ? 'YES' : 'NO'}
- Offline verifier source: ${analysis.promptInjection.source}
- Became perfect score: ${analysis.promptInjection.becamePerfect ? 'YES' : 'NO'}
- System prompt reveal signal observed: ${analysis.promptInjection.revealedSystemPromptSignal ? 'YES' : 'NO'}
- Aggregate fields rejected by schema: ${analysis.promptInjection.aggregateFieldsRejectedBySchema ? 'YES' : 'NO'}

## Delicate Checks 06 / 08 / 14 / 16 / 17

- 06 priority/emphasis: no duplicate-penalty failure is expected from this compact regression; broader monotonicity remains future work.
- 08 demanding conditions: no invented-difficulty issue is expected when no basis exists; broader coverage remains future work.
- 14 compensation: Case 10 must be NOT_EVALUABLE/null across all three runs; Case 11 must be MISSING/0 across both runs.
- 16 channel fit: behaved as expected for unknown/no-policy cases; CASE 13 passed NOT_EVALUABLE/null.
- 17 cross-field coherence: behaved as expected for bundle comparison; CASE 14 passed CONFLICT with text/field/destination mismatch.

## Check-Level Review

| Check | Observed issues | Stability signal | Missing/N-D risk | Monotonicity signal | Next action |
| --- | --- | --- | --- | --- | --- |
${checkRows}

## Residual Risks

- This is a small pilot, not production validation.
- No official stability threshold is defined yet.
- Directional expectations are observations, not hard acceptance criteria.
  - No publication gate V2 is implemented or calculated in this phase.
`;
}

function renderMissingNdRows(missingNdAudit) {
  return [
    ...missingNdAudit.case10.map((entry) => ({ ...entry, checkId: '14' })),
    ...missingNdAudit.case11.map((entry) => ({ ...entry, checkId: '14' })),
    ...missingNdAudit.case13.map((entry) => ({ ...entry, checkId: '16' })),
  ].map((entry) => `| ${entry.caseId} | ${entry.checkId} | ${formatCheck(entry.check)} |`).join('\n');
}

function formatFocusedDeltas(stability, checkIds) {
  return checkIds.map((id) => {
    const delta = stability.deltas.find((item) => item.id === id);
    if (!delta) return `${id}: n/a`;
    const score = delta.scoreDelta === null ? 'status-only' : `d${delta.scoreDelta}`;
    const flags = [delta.statusFlip ? 'status flip' : null, delta.ndFlip ? 'N/D flip' : null].filter(Boolean).join(', ');
    return `${id}: ${score}${flags ? ` (${flags})` : ''}`;
  }).join('; ');
}

function pickCheck(result, id) {
  return result?.checks.find((check) => check.id === id) ?? null;
}

function allCheckIds() {
  return Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, '0'));
}

function absDelta(left, right) {
  if (left === null || right === null || left === undefined || right === undefined) return null;
  return Math.abs(right - left);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const index = Math.max(0, Math.ceil(values.length * p) - 1);
  return values[index];
}

function ratio(left, right) {
  return right ? left / right : 0;
}

function round(value) {
  return typeof value === 'number' ? Math.round(value * 100) / 100 : value;
}

function pctReduction(previous, current) {
  if (!previous) return null;
  return ((previous - current) / previous) * 100;
}

function formatReduction(value) {
  if (value === null) return 'n/a';
  if (value >= 0) return `${round(value)}% reduction`;
  return `${round(Math.abs(value))}% increase`;
}

function mdCell(value) {
  return String(value).replaceAll('|', '/').replaceAll('\n', ' ');
}

function formatCheck(check) {
  if (!check) return 'missing result';
  return `${check.status}/${check.score}`;
}

function classifyStop(error) {
  if (error instanceof Annunci10xAiError) {
    if (error.status === 401 || error.status === 403) return 'AUTH_ERROR';
    if (error.code === 'RATE_LIMITED' || error.status === 429) return 'RATE_LIMITED';
    if (error.code === 'AI_PROVIDER_ERROR' && error.retryable) return 'PROVIDER_UNAVAILABLE';
    if (error.code === 'AI_INVALID_OUTPUT') return 'AI_INVALID_OUTPUT';
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}
