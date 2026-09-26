import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  MemoryAnnunci10xPersistenceAdapter,
  MockAnnunci10xProvider,
  buildFreeAnnunci10xResult,
  createAnonymousAnalyzeSession,
  createAnnunci10xAiIdempotencyKey,
  getAnnunci10xModelForOperation,
  getAnnunci10xPrompt,
  runAnnunci10xAnalysisRun,
  startAnnunci10xAnalysisRun,
} from '../src/lib/annunci-10x/index.ts';

const VALID_AD = [
  'Customer Care Specialist per azienda SaaS B2B a Milano.',
  'Gestirai richieste inbound via ticket ed email, aggiornerai il CRM e passerai al team tecnico i casi complessi.',
  'Il risultato atteso e mantenere tempi di risposta ordinati e ridurre passaggi persi tra cliente e reparto tecnico.',
  'Richiediamo italiano scritto chiaro, esperienza in assistenza clienti B2B e uso base di strumenti CRM.',
  'Contratto full-time, sede Milano Lambrate, lavoro ibrido, RAL 28-32k.',
  'Candidati compilando il form aziendale indicato nell annuncio.',
].join(' ');

async function verifyV2StepByStep() {
  const { context, session, run } = await startRun('V2_PUBLIC');
  const expected = [
    ['EXTRACT', 1],
    ['PROFILE', 2],
    ['STRATEGY', 3],
    ['EVALUATE', 4],
    ['COMPLETE', 5],
  ];
  let current = null;
  for (const [stage, calls] of expected) {
    current = await runAnnunci10xAnalysisRun({ analysisRunId: run.id, session, context });
    assert.equal(current?.stage, stage);
    assert.equal(context.provider.calls.length, calls);
  }
  assert.equal(current?.status, 'READY');
  assert.equal(current?.evaluationMode, 'V2_PUBLIC');
  assert.equal('CLARIFY' in current.operationRefs, false);
  assert.ok(current.operationRefs.ROLE_SNAPSHOT);
  assert.ok(current.operationRefs.CONTEXT_SNAPSHOT);

  const roleSnapshot = await context.persistence.getSnapshotById(current.operationRefs.ROLE_SNAPSHOT, session.sessionId, session.sessionSecret);
  const contextSnapshot = await context.persistence.getSnapshotById(current.operationRefs.CONTEXT_SNAPSHOT, session.sessionId, session.sessionSecret);
  assert.ok(roleSnapshot);
  assert.ok(contextSnapshot);
  await assert.rejects(() => context.persistence.getSnapshotById(current.operationRefs.ROLE_SNAPSHOT, session.sessionId, 'wrong-secret'));
  assert.equal(context.persistence.snapshots.filter((row) => row.session_id === session.sessionId).length, 2);

  const afterTerminal = await runAnnunci10xAnalysisRun({ analysisRunId: run.id, session, context });
  assert.equal(afterTerminal, null);
  assert.equal(context.provider.calls.length, 5);

  const evaluation = await context.persistence.getLatestEvaluation(session.sessionId, session.sessionSecret);
  assert.equal(evaluation?.score.rubricVersion, 'annunci10x-rubric-v2');
  assert.equal(evaluation?.gate, null);
}

async function verifyV1StepByStep() {
  const { context, session, run } = await startRun('V1');
  const expected = [
    ['EXTRACT', 1],
    ['PROFILE', 2],
    ['STRATEGY', 3],
    ['EVALUATE', 4],
    ['CLARIFY', 5],
    ['COMPLETE', 6],
  ];
  let current = null;
  for (const [stage, calls] of expected) {
    current = await runAnnunci10xAnalysisRun({ analysisRunId: run.id, session, context });
    assert.equal(current?.stage, stage);
    assert.equal(context.provider.calls.length, calls);
  }
  assert.equal(current?.status, 'READY');
  assert.ok('CLARIFY' in current.operationRefs);
  assert.equal(context.persistence.snapshots.filter((row) => row.session_id === session.sessionId).length, 2);

  const evaluation = await context.persistence.getLatestEvaluation(session.sessionId, session.sessionSecret);
  const result = buildFreeAnnunci10xResult({ analysisRun: current, evaluation });
  assert.equal(result.resultVersion, 'V1_COMPAT');
  assert.doesNotMatch(result.interpretation, /\bV1\b|\bV2\b|semantica|gate/i);
}

async function verifyConcurrencyLease() {
  const persistence = new MemoryAnnunci10xPersistenceAdapter();
  const provider = new BlockingProvider();
  const context = makeContext(persistence, provider);
  const created = await createAnonymousAnalyzeSession(context);
  const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  const started = await startAnnunci10xAnalysisRun({
    session,
    source: { kind: 'PASTED_TEXT', text: VALID_AD, declaredChannel: 'LINKEDIN' },
    context,
    evaluationMode: 'V2_PUBLIC',
  });

  const first = runAnnunci10xAnalysisRun({ analysisRunId: started.run.id, session, context });
  await provider.waitUntilCalled();
  const second = await runAnnunci10xAnalysisRun({ analysisRunId: started.run.id, session, context });
  assert.equal(second, null);
  assert.equal(provider.calls.length, 1);
  provider.release();
  const completedStage = await first;
  assert.equal(completedStage?.stage, 'EXTRACT');
  assert.equal(provider.calls.length, 1);
}

async function verifyRestartResume() {
  const persistence = new MemoryAnnunci10xPersistenceAdapter();
  const firstProvider = new MockAnnunci10xProvider('success');
  const firstContext = makeContext(persistence, firstProvider);
  const created = await createAnonymousAnalyzeSession(firstContext);
  const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  const started = await startAnnunci10xAnalysisRun({
    session,
    source: { kind: 'PASTED_TEXT', text: VALID_AD, declaredChannel: 'LINKEDIN' },
    context: firstContext,
    evaluationMode: 'V2_PUBLIC',
  });
  await runAnnunci10xAnalysisRun({ analysisRunId: started.run.id, session, context: firstContext });
  await runAnnunci10xAnalysisRun({ analysisRunId: started.run.id, session, context: firstContext });
  assert.deepEqual(firstProvider.calls.map((call) => call.operationType), ['PRECHECK', 'EXTRACT']);

  const secondProvider = new MockAnnunci10xProvider('success');
  const secondContext = makeContext(persistence, secondProvider);
  await runAnnunci10xAnalysisRun({ analysisRunId: started.run.id, session, context: secondContext });
  await runAnnunci10xAnalysisRun({ analysisRunId: started.run.id, session, context: secondContext });
  const completed = await runAnnunci10xAnalysisRun({ analysisRunId: started.run.id, session, context: secondContext });
  assert.equal(completed?.status, 'READY');
  assert.deepEqual(secondProvider.calls.map((call) => call.operationType), ['PROFILE', 'STRATEGY', 'EVALUATE']);
  assert.equal(persistence.snapshots.filter((row) => row.session_id === session.sessionId).length, 2);
}

async function verifyFailedStages() {
  for (const [evaluationMode, modes, expectedCalls] of [
    ['V2_PUBLIC', ['provider_error'], 1],
    ['V2_PUBLIC', ['success', 'provider_error'], 2],
    ['V2_PUBLIC', ['success', 'success', 'provider_error'], 3],
    ['V2_PUBLIC', ['success', 'success', 'success', 'provider_error'], 4],
    ['V2_PUBLIC', ['success', 'success', 'success', 'success', 'provider_error'], 5],
    ['V1', ['success', 'success', 'success', 'success', 'success', 'provider_error'], 6],
  ]) {
    const { context, session, run } = await startRun(evaluationMode, new MockAnnunci10xProvider(modes));
    let current = null;
    while (!current || (current.status !== 'FAILED' && current.status !== 'READY')) {
      current = await runAnnunci10xAnalysisRun({ analysisRunId: run.id, session, context });
    }
    assert.equal(current.status, 'FAILED');
    assert.equal(context.provider.calls.length, expectedCalls);
    assert.equal(current.leaseExpiresAt, null);
    assert.equal(current.evaluationMode, evaluationMode);
    if (evaluationMode === 'V2_PUBLIC') assert.equal('CLARIFY' in current.operationRefs, false);
  }
}

async function verifyRunningOperationPolicy() {
  const recent = await startRun('V2_PUBLIC');
  await registerPrecheckOperation(recent, Date.now() - 10_000);
  const recentResult = await runAnnunci10xAnalysisRun({ analysisRunId: recent.run.id, session: recent.session, context: recent.context });
  assert.equal(recentResult?.status, 'RUNNING');
  assert.equal(recent.context.provider.calls.length, 0);

  const stale = await startRun('V2_PUBLIC');
  await registerPrecheckOperation(stale, Date.now() - 130_000);
  const staleResult = await runAnnunci10xAnalysisRun({ analysisRunId: stale.run.id, session: stale.session, context: stale.context });
  assert.equal(staleResult?.status, 'FAILED');
  assert.equal(stale.context.provider.calls.length, 0);
}

function verifyRouteAndCopyContracts() {
  const postRoute = readFileSync('src/app/api/annunci-10x/analysis/route.ts', 'utf8');
  const getRoute = readFileSync('src/app/api/annunci-10x/analysis/[id]/route.ts', 'utf8');
  assert.match(postRoute, /export const maxDuration = 120/);
  assert.match(getRoute, /export const maxDuration = 120/);
  assert.match(postRoute, /after\(async \(\) =>/);
  assert.match(getRoute, /after\(async \(\) =>/);
}

async function startRun(evaluationMode, provider = new MockAnnunci10xProvider('success')) {
  const context = makeContext(new MemoryAnnunci10xPersistenceAdapter(), provider);
  const created = await createAnonymousAnalyzeSession(context);
  const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  const started = await startAnnunci10xAnalysisRun({
    session,
    source: { kind: 'PASTED_TEXT', text: VALID_AD, declaredChannel: 'LINKEDIN' },
    context,
    evaluationMode,
  });
  return { context, session, run: started.run };
}

async function registerPrecheckOperation(state, startedAtMs) {
  const prompt = getAnnunci10xPrompt('PRECHECK');
  const model = getAnnunci10xModelForOperation('PRECHECK', { ANNUNCI10X_AI_PROVIDER: 'MOCK' });
  const idempotencyKey = createAnnunci10xAiIdempotencyKey({
    sessionId: state.session.sessionId,
    operationType: 'PRECHECK',
    inputIdentity: stageIdentity(state.run, 'PRECHECK'),
    promptVersion: prompt.version,
    model,
  });
  await state.context.persistence.startAiOperation({
    sessionId: state.session.sessionId,
    sessionSecret: state.session.sessionSecret,
    operationType: 'PRECHECK',
    inputSnapshotId: null,
    promptVersion: prompt.version,
    idempotencyKey,
    model,
  });
  for (const row of state.context.persistence.operations.values()) {
    row.started_at = new Date(startedAtMs).toISOString();
  }
}

function makeContext(persistence, provider) {
  return {
    persistence,
    provider,
    configuredProvider: 'MOCK',
  };
}

function stageIdentity(run, operationType) {
  return stableHash({
    analysisRunIdentity: run.inputIdentity,
    operationType,
    evaluationMode: run.evaluationMode,
    methodVersion: run.methodVersion,
    rubricVersion: run.rubricVersion,
    promptVersion: run.promptVersion,
    scoreSemanticsVersion: run.scoreSemanticsVersion,
    model: run.model,
  });
}

function stableHash(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

class BlockingProvider extends MockAnnunci10xProvider {
  constructor() {
    super('success');
    this.blocker = deferred();
    this.called = deferred();
  }

  async executeStructuredTask(request) {
    this.calls.push(request);
    this.called.resolve();
    await this.blocker.promise;
    const provider = new MockAnnunci10xProvider('success');
    return provider.executeStructuredTask(request);
  }

  waitUntilCalled() {
    return this.called.promise;
  }

  release() {
    this.blocker.resolve();
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

await verifyV2StepByStep();
await verifyV1StepByStep();
await verifyConcurrencyLease();
await verifyRestartResume();
await verifyFailedStages();
await verifyRunningOperationPolicy();
verifyRouteAndCopyContracts();

console.log('Annunci 10x durable runner verifier passed');
