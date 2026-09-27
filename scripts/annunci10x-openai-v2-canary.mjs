import { randomUUID } from 'node:crypto';

import {
  ANNUNCI10X_METHOD_VERSION_V2,
  ANNUNCI10X_RUBRIC_VERSION_V2,
  ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
  ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2,
  Annunci10xAiError,
  OpenAiAnnunci10xProvider,
  buildFreeAnnunci10xResult,
  createAnonymousAnalyzeSession,
  createAnnunci10xPersistenceAdapter,
  getAnnunci10xAiTimeoutMs,
  runAnnunci10xAnalysisRun,
  startAnnunci10xAnalysisRun,
  validateScoreResultV2,
} from '../src/lib/annunci-10x/index.ts';

const SUPABASE_PROJECT_REF = 'pmkyeqrfkunypfkbjnyg';
const EXPECTED_OPERATIONS = ['PRECHECK', 'EXTRACT', 'PROFILE', 'STRATEGY', 'EVALUATE'];
const EXPECTED_OPERATION_REF_KEYS = [...EXPECTED_OPERATIONS, 'ROLE_SNAPSHOT', 'CONTEXT_SNAPSHOT'];
const SYNTHETIC_AD = [
  'Horyzon Canary Srl ricerca un Account Executive B2B per la sede di Firenze, con lavoro ibrido tre giorni in ufficio e due da remoto.',
  'La persona gestira un portafoglio di aziende mid-market, qualifichera opportunita inbound, condurra discovery call e preparera proposte commerciali con CRM aggiornato.',
  'Obiettivo dei primi sei mesi: aumentare pipeline qualificata e chiudere nuovi contratti annuali nel segmento servizi professionali.',
  'Richiediamo almeno tre anni di esperienza in vendita B2B, uso quotidiano di CRM, capacita di negoziazione e italiano fluente.',
  'Offriamo tempo indeterminato, RAL 38.000-45.000 euro piu variabile, onboarding strutturato, budget formazione e colloquio con il Sales Lead.',
].join('\n');

main().catch((error) => {
  const report = {
    run: 'BLOCKED',
    blocker: classifyBlocker(error),
    error: sanitizeError(error),
    cleanup: error?.cleanupReport ?? null,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = blockerExitCode(report.blocker);
});

async function main() {
  if (process.env.ANNUNCI10X_RUN_LIVE_CANARY !== '1') {
    throw blocked('OPENAI_CANARY_BLOCKED_MANUAL_GUARD', 'Set ANNUNCI10X_RUN_LIVE_CANARY=1 to run this manual canary.');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw blocked('OPENAI_CANARY_BLOCKED_KEY_MISSING', 'OPENAI_API_KEY is not available in the server environment.');
  }
  const supabase = supabaseConfig();
  await assertCleanupPermission(supabase);

  const startedAt = Date.now();
  const timeoutMs = getAnnunci10xAiTimeoutMs(process.env);
  const context = {
    configuredProvider: 'OPENAI',
    provider: new OpenAiAnnunci10xProvider(),
    persistence: createAnnunci10xPersistenceAdapter(),
  };
  let sessionCookie = null;
  let analysisRunId = null;
  const stageRuns = [];

  try {
    const created = await createAnonymousAnalyzeSession(context);
    sessionCookie = {
      sessionId: created.session.id,
      sessionSecret: created.sessionSecret,
    };

    const start = await startAnnunci10xAnalysisRun({
      session: sessionCookie,
      source: {
        kind: 'PASTED_TEXT',
        text: SYNTHETIC_AD,
        declaredChannel: 'LINKEDIN',
      },
      context,
      evaluationMode: 'V2_PUBLIC',
    });
    analysisRunId = start.run.id;

    let run = start.run;
    for (const expectedStage of EXPECTED_OPERATIONS) {
      if (run.stage !== expectedStage && !(expectedStage === 'PRECHECK' && run.stage === 'SOURCE_VALIDATION')) {
        throw blocked('OPENAI_CANARY_UNEXPECTED_STAGE', `Expected ${expectedStage}, found ${run.stage}.`);
      }
      const stageStartedAt = Date.now();
      run = await runAnnunci10xAnalysisRun({
        analysisRunId,
        session: sessionCookie,
        context,
      });
      const durationMs = Date.now() - stageStartedAt;
      if (!run) throw blocked('OPENAI_CANARY_RUN_NOT_CLAIMED', `Durable runner did not claim stage ${expectedStage}.`);
      stageRuns.push({ stage: expectedStage, durationMs, statusAfter: run.status, nextStage: run.stage });
      if (run.status === 'FAILED') throw blocked('OPENAI_CANARY_RUN_FAILED', `Durable runner failed at ${expectedStage}.`, { analysisRun: summarizeRun(run) });
    }

    const finalRun = await context.persistence.getAnalysisRun(analysisRunId, sessionCookie.sessionSecret);
    if (!finalRun) throw blocked('OPENAI_CANARY_RUN_NOT_FOUND', 'Final analysis run was not readable.');
    const operations = await loadOperations(context, sessionCookie, finalRun);
    const evaluation = await requireEvaluation(context, sessionCookie, finalRun);
    const scoreValidation = validateScoreResultV2(evaluation.score);
    if (!scoreValidation.ok) {
      throw blocked('OPENAI_CANARY_V2_SCORE_INVALID', 'Persisted V2 score failed runtime validation.', { errors: scoreValidation.errors });
    }

    const freeResult = buildFreeAnnunci10xResult({ analysisRun: finalRun, evaluation });
    const dbState = await collectDbState(supabase, sessionCookie.sessionId);
    const assertions = validateCanaryResult({ finalRun, operations, evaluation, freeResult, dbState, stageRuns, timeoutMs });
    if (!assertions.ok) {
      throw blocked('OPENAI_CANARY_ASSERTION_FAILED', 'Canary assertions failed.', { assertions: assertions.failures });
    }

    const cleanup = await cleanupCanaryRows(supabase, sessionCookie.sessionId);
    const residual = await collectDbState(supabase, sessionCookie.sessionId);
    assertCleanupComplete(residual);

    const report = {
      run: 'RUN',
      blocker: null,
      canaryExecuted: true,
      providerInjected: 'OPENAI',
      configuredProviderInjected: context.configuredProvider,
      supabaseProjectRef: SUPABASE_PROJECT_REF,
      timeoutMs,
      durationMs: Date.now() - startedAt,
      analysis: summarizeRun(finalRun),
      operations: summarizeOperations(operations),
      stageRuns,
      providerCalls: {
        logicalOperations: operations.length,
        physicalCallsEstimated: operations.length + operations.reduce((sum, operation) => sum + operation.retryCount, 0),
        retries: operations.reduce((sum, operation) => sum + operation.retryCount, 0),
      },
      snapshots: {
        count: dbState.annunci10x_snapshots,
        expected: 2,
      },
      evaluation: summarizeEvaluation(evaluation),
      freeResult: {
        resultVersion: freeResult.resultVersion,
        hasRange: Boolean(freeResult.score.range),
        value: freeResult.score.value,
        max: freeResult.score.max,
        coverage: freeResult.score.coverage,
        band: freeResult.band?.code ?? null,
        interpretationPresent: Boolean(freeResult.interpretation),
      },
      safety: {
        noMockFallback: operations.every((operation) => operation.provider === 'OPENAI') && finalRun.provider === 'OPENAI',
        noV1Fallback: finalRun.evaluationMode === 'V2_PUBLIC' && evaluation.score.rubricVersion === ANNUNCI10X_RUBRIC_VERSION_V2,
        noGenerateValidateReviseOrChannelAdapter: operations.every((operation) => EXPECTED_OPERATIONS.includes(operation.type)),
        noProviderOwnedAggregateFields: !operations.find((operation) => operation.type === 'EVALUATE')?.providerAggregateFieldsPresent,
      },
      cleanup,
      residualAfterCleanup: residual,
    };
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (sessionCookie) {
      const cleanup = await cleanupCanaryRows(supabase, sessionCookie.sessionId).catch((cleanupError) => ({
        ok: false,
        error: sanitizeError(cleanupError),
      }));
      error.cleanupReport = cleanup;
    }
    throw error;
  }
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw blocked('OPENAI_CANARY_BLOCKED_SUPABASE_ENV_MISSING', 'Supabase server-side environment is not configured.');
  if (!url.includes(SUPABASE_PROJECT_REF)) {
    throw blocked('OPENAI_CANARY_BLOCKED_SUPABASE_PROJECT_MISMATCH', 'Supabase URL does not match the canonical production project ref.');
  }
  return { url: url.replace(/\/$/, ''), serviceRoleKey };
}

async function assertCleanupPermission(config) {
  const id = randomUUID();
  for (const table of cleanupTables()) {
    await supabaseDelete(config, table.name, table.filter(id));
  }
}

async function cleanupCanaryRows(config, sessionId) {
  const deleted = {};
  for (const table of cleanupTables()) {
    const result = await supabaseDelete(config, table.name, table.filter(sessionId));
    deleted[table.name] = result.count;
  }
  return { ok: true, deleted };
}

function cleanupTables() {
  return [
    { name: 'annunci10x_email_verifications', filter: (sessionId) => `session_id=eq.${encodeURIComponent(sessionId)}` },
    { name: 'annunci10x_leads', filter: (sessionId) => `session_id=eq.${encodeURIComponent(sessionId)}` },
    { name: 'annunci10x_events', filter: (sessionId) => `session_id=eq.${encodeURIComponent(sessionId)}` },
    { name: 'annunci10x_outputs', filter: (sessionId) => `session_id=eq.${encodeURIComponent(sessionId)}` },
    { name: 'annunci10x_analysis_runs', filter: (sessionId) => `session_id=eq.${encodeURIComponent(sessionId)}` },
    { name: 'annunci10x_evaluations', filter: (sessionId) => `session_id=eq.${encodeURIComponent(sessionId)}` },
    { name: 'annunci10x_ai_operations', filter: (sessionId) => `session_id=eq.${encodeURIComponent(sessionId)}` },
    { name: 'annunci10x_answers', filter: (sessionId) => `session_id=eq.${encodeURIComponent(sessionId)}` },
    { name: 'annunci10x_snapshots', filter: (sessionId) => `session_id=eq.${encodeURIComponent(sessionId)}` },
    { name: 'annunci10x_sessions', filter: (sessionId) => `id=eq.${encodeURIComponent(sessionId)}` },
  ];
}

async function supabaseDelete(config, table, filter) {
  const response = await fetch(`${config.url}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      prefer: 'count=exact,return=minimal',
    },
  });
  if (!response.ok) {
    throw blocked('OPENAI_CANARY_BLOCKED_CLEANUP_PERMISSION', `Cleanup preflight/delete failed for ${table}.`, {
      status: response.status,
      table,
    });
  }
  return { count: parseContentRangeCount(response.headers.get('content-range')) };
}

async function collectDbState(config, sessionId) {
  const tables = [
    'annunci10x_sessions',
    'annunci10x_events',
    'annunci10x_analysis_runs',
    'annunci10x_evaluations',
    'annunci10x_ai_operations',
    'annunci10x_snapshots',
    'annunci10x_answers',
    'annunci10x_outputs',
    'annunci10x_leads',
    'annunci10x_email_verifications',
  ];
  const counts = {};
  for (const table of tables) {
    const filter = table === 'annunci10x_sessions'
      ? `id=eq.${encodeURIComponent(sessionId)}`
      : `session_id=eq.${encodeURIComponent(sessionId)}`;
    counts[table] = await supabaseCount(config, table, filter);
  }
  return counts;
}

async function supabaseCount(config, table, filter) {
  const response = await fetch(`${config.url}/rest/v1/${table}?${filter}&select=id`, {
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      prefer: 'count=exact',
      range: '0-0',
    },
  });
  if (!response.ok) {
    throw blocked('OPENAI_CANARY_DB_COUNT_FAILED', `Count failed for ${table}.`, { status: response.status, table });
  }
  return parseContentRangeCount(response.headers.get('content-range'));
}

async function loadOperations(context, session, run) {
  const refs = run.operationRefs ?? {};
  const operations = [];
  for (const type of EXPECTED_OPERATIONS) {
    const id = refs[type];
    if (typeof id !== 'string') throw blocked('OPENAI_CANARY_MISSING_OPERATION_REF', `Missing operation ref ${type}.`);
    const operation = await context.persistence.getAiOperation(id, session.sessionSecret);
    if (!operation) throw blocked('OPENAI_CANARY_MISSING_OPERATION', `Persisted operation ${type} was not readable.`);
    operations.push(normalizeOperation(type, operation));
  }
  return operations;
}

function normalizeOperation(type, operation) {
  const payload = operation.outputPayload ?? {};
  const output = payload.output && typeof payload.output === 'object' ? payload.output : {};
  return {
    type,
    id: operation.id,
    status: operation.status,
    promptVersion: operation.promptVersion,
    provider: payload.provider === 'OPENAI' ? 'OPENAI' : payload.provider === 'MOCK' ? 'MOCK' : 'UNKNOWN',
    model: typeof payload.model === 'string' ? payload.model : operation.model,
    schemaRuntimeValid: operation.status === 'SUCCEEDED' && payload.output !== undefined,
    latencyMs: typeof payload.latencyMs === 'number' ? payload.latencyMs : null,
    usage: sanitizeUsage(payload.usage),
    retryCount: payload.retryCount === 1 ? 1 : 0,
    providerRequestIdPresent: typeof payload.providerRequestId === 'string' && payload.providerRequestId.length > 0,
    providerAggregateFieldsPresent: ['finalScore', 'totalScore', 'coverage', 'band', 'gate', 'publicationStatus', 'minScore', 'maxScore', 'interval'].some((key) => key in output),
    evaluateCheckCount: type === 'EVALUATE' && Array.isArray(output.checks) ? output.checks.length : null,
    evaluateCheckIdsOk: type === 'EVALUATE' && Array.isArray(output.checks)
      ? output.checks.map((check) => check.id).join(',') === expectedCheckIds().join(',')
      : null,
  };
}

async function requireEvaluation(context, session, run) {
  if (!run.evaluationId) throw blocked('OPENAI_CANARY_MISSING_EVALUATION_REF', 'Final run has no evaluationId.');
  const evaluation = await context.persistence.getEvaluationById(run.evaluationId, run.sessionId, session.sessionSecret);
  if (!evaluation) throw blocked('OPENAI_CANARY_MISSING_EVALUATION', 'Final persisted evaluation was not readable.');
  return evaluation;
}

function validateCanaryResult({ finalRun, operations, evaluation, freeResult, dbState, stageRuns, timeoutMs }) {
  const failures = [];
  const refs = finalRun.operationRefs ?? {};
  if (finalRun.status !== 'READY') failures.push('final run status must be READY');
  if (finalRun.stage !== 'COMPLETE') failures.push('final run stage must be COMPLETE');
  if (finalRun.provider !== 'OPENAI') failures.push('analysis run provider must be OPENAI');
  if (finalRun.evaluationMode !== 'V2_PUBLIC') failures.push('analysis run evaluationMode must be V2_PUBLIC');
  if (finalRun.methodVersion !== ANNUNCI10X_METHOD_VERSION_V2) failures.push('method version mismatch');
  if (finalRun.rubricVersion !== ANNUNCI10X_RUBRIC_VERSION_V2) failures.push('rubric version mismatch');
  if (finalRun.promptVersion !== ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2) failures.push('prompt version mismatch');
  if (finalRun.scoreSemanticsVersion !== ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2) failures.push('score semantics mismatch');
  if (Object.keys(refs).sort().join(',') !== EXPECTED_OPERATION_REF_KEYS.sort().join(',')) failures.push('operation refs must contain only five operations plus two snapshots');
  if (operations.length !== EXPECTED_OPERATIONS.length) failures.push('must persist exactly five operations');
  if (operations.some((operation) => operation.provider !== 'OPENAI')) failures.push('all operations must persist provider OPENAI');
  if (operations.some((operation) => operation.status !== 'SUCCEEDED')) failures.push('all operations must succeed');
  if (operations.some((operation) => operation.type !== 'EVALUATE' && operation.providerAggregateFieldsPresent)) failures.push('non-evaluate operation unexpectedly contains provider aggregate fields');
  const evaluate = operations.find((operation) => operation.type === 'EVALUATE');
  if (!evaluate) failures.push('evaluate operation missing');
  if (evaluate?.promptVersion !== ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2) failures.push('evaluate prompt v2.3 mismatch');
  if (evaluate?.evaluateCheckCount !== 20) failures.push('evaluate provider output must contain 20 checks');
  if (evaluate?.evaluateCheckIdsOk !== true) failures.push('evaluate check ids must be 01..20');
  if (evaluate?.providerAggregateFieldsPresent) failures.push('provider output must not contain aggregate fields');
  if (dbState.annunci10x_snapshots !== 2) failures.push('snapshot count must be exactly 2');
  if (dbState.annunci10x_analysis_runs !== 1) failures.push('analysis run count must be exactly 1');
  if (dbState.annunci10x_ai_operations !== 5) failures.push('ai operation count must be exactly 5');
  if (evaluation.gate !== null) failures.push('V2 evaluation gate must be null in parsed persistence object');
  if (evaluation.score.rubricVersion !== ANNUNCI10X_RUBRIC_VERSION_V2) failures.push('persisted evaluation rubric must be V2');
  if (evaluation.score.scoreSemanticsVersion !== ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2) failures.push('persisted evaluation semantics must be V2');
  if (evaluation.score.max !== 100) failures.push('score max must be 100');
  if (!(evaluation.score.value === null || (typeof evaluation.score.value === 'number' && evaluation.score.value >= 0 && evaluation.score.value <= 100))) failures.push('score value must be null or 0..100');
  if (!(typeof evaluation.score.coverage === 'number' && evaluation.score.coverage >= 0 && evaluation.score.coverage <= 100)) failures.push('coverage must be 0..100');
  if ('interval' in evaluation.score) failures.push('V2 score must not include interval/range');
  if (freeResult.resultVersion !== 'V2') failures.push('free result must be V2');
  if (freeResult.score.range) failures.push('free result must not expose V1 range');
  if (stageRuns.some((stage) => stage.durationMs > timeoutMs + 30_000)) failures.push('stage duration exceeded timeout plus stale grace');
  return { ok: failures.length === 0, failures };
}

function summarizeRun(run) {
  return {
    idPresent: Boolean(run.id),
    status: run.status,
    stage: run.stage,
    provider: run.provider,
    evaluationMode: run.evaluationMode,
    methodVersion: run.methodVersion,
    rubricVersion: run.rubricVersion,
    promptVersion: run.promptVersion,
    scoreSemanticsVersion: run.scoreSemanticsVersion,
    model: run.model,
    operationRefKeys: Object.keys(run.operationRefs ?? {}).sort(),
    attemptCount: run.attemptCount,
    hasEvaluationId: Boolean(run.evaluationId),
  };
}

function summarizeOperations(operations) {
  return operations.map((operation) => ({
    type: operation.type,
    promptVersion: operation.promptVersion,
    provider: operation.provider,
    model: operation.model,
    schemaRuntimeValid: operation.schemaRuntimeValid,
    latencyMs: operation.latencyMs,
    usage: operation.usage,
    retryCount: operation.retryCount,
    providerRequestIdPresent: operation.providerRequestIdPresent,
    providerAggregateFieldsPresent: operation.providerAggregateFieldsPresent,
    evaluateCheckCount: operation.evaluateCheckCount,
    evaluateCheckIdsOk: operation.evaluateCheckIdsOk,
  }));
}

function summarizeEvaluation(evaluation) {
  return {
    idPresent: Boolean(evaluation.id),
    target: evaluation.target,
    score: {
      value: evaluation.score.value,
      max: evaluation.score.max,
      coverage: evaluation.score.coverage,
      evaluableCheckCount: evaluation.score.evaluableCheckCount,
      totalCheckCount: evaluation.score.totalCheckCount,
      band: evaluation.score.band?.code ?? null,
      rubricVersion: evaluation.score.rubricVersion,
      scoreSemanticsVersion: evaluation.score.scoreSemanticsVersion,
      checksCount: evaluation.score.checks.length,
      checkIdsOk: evaluation.score.checks.map((check) => check.id).join(',') === expectedCheckIds().join(','),
      hasRange: 'interval' in evaluation.score,
    },
    gateParsedAsNull: evaluation.gate === null,
  };
}

function sanitizeUsage(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    inputTokens: numberOrNull(value.inputTokens),
    outputTokens: numberOrNull(value.outputTokens),
    totalTokens: numberOrNull(value.totalTokens),
    cachedTokens: numberOrNull(value.cachedTokens),
  };
}

function expectedCheckIds() {
  return Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, '0'));
}

function assertCleanupComplete(counts) {
  const residue = Object.entries(counts).filter(([, count]) => count !== 0);
  if (residue.length) {
    throw blocked('OPENAI_CANARY_CLEANUP_INCOMPLETE', 'Synthetic canary cleanup left residual rows.', { residual: Object.fromEntries(residue) });
  }
}

function parseContentRangeCount(value) {
  if (!value) return 0;
  const match = value.match(/\/(\d+|\*)$/);
  if (!match || match[1] === '*') return 0;
  return Number(match[1]);
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function blocked(code, message, details = {}) {
  const error = new Error(message);
  error.canaryCode = code;
  error.details = details;
  return error;
}

function classifyBlocker(error) {
  if (error?.canaryCode) return error.canaryCode;
  if (error instanceof Annunci10xAiError && (error.code === 'RATE_LIMITED' || error.status === 429)) return 'OPENAI_CANARY_BLOCKED_QUOTA';
  if (error instanceof Annunci10xAiError && error.status === 401) return 'OPENAI_CANARY_BLOCKED_OPENAI_AUTH';
  if (typeof error?.message === 'string' && /quota|billing|rate limit|429/i.test(error.message)) return 'OPENAI_CANARY_BLOCKED_QUOTA';
  return 'OPENAI_CANARY_FAILED';
}

function blockerExitCode(blocker) {
  return blocker?.startsWith('OPENAI_CANARY_BLOCKED_') ? 2 : 1;
}

function sanitizeError(error) {
  return {
    code: error?.canaryCode ?? (error instanceof Annunci10xAiError ? error.code : 'INTERNAL'),
    status: error?.status ?? null,
    retryable: error?.retryable ?? false,
    message: error?.message ?? 'Unknown error',
    details: error?.details ?? null,
  };
}
