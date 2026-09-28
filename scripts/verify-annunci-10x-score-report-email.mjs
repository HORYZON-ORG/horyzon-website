import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER = `${randomUUID()}${randomUUID()}`;

const {
  ANNUNCI10X_RUBRIC_CHECKS_V2,
  ANNUNCI10X_RUBRIC_VERSION_V2,
  ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
  MemoryAnnunci10xPersistenceAdapter,
  MockAnnunci10xEmailProvider,
  ResendAnnunci10xEmailProvider,
  buildAnnunci10xScoreReport,
  buildResendScoreReportPayload,
  calculateAnnunci10xScoreV2,
  createAnonymousAnalyzeSession,
  hashEmailVerificationCode,
  maybeSendAnnunci10xScoreReport,
  resendScoreReportIdempotencyKey,
  saveAnnunci10xLeadContact,
  verifyAnnunci10xEmailCode,
} = await import('../src/lib/annunci-10x/index.ts');

async function assertFeatureFlagFirst() {
  const throwingContext = {
    persistence: new Proxy({}, {
      get() {
        throw new Error('persistence must not be touched while score report email is disabled');
      },
    }),
  };
  const result = await maybeSendAnnunci10xScoreReport({
    session: { sessionId: randomUUID(), sessionSecret: `${randomUUID()}${randomUUID()}` },
    analysisRunId: randomUUID(),
    context: throwingContext,
    env: {},
  });
  assert.equal(result.status, 'DISABLED');
}

async function assertReportContent() {
  const { context, session, run, evaluation } = await readyV2Fixture({ marketingConsent: false });
  const snapshot = await context.persistence.getLatestSnapshot(session.sessionId, session.sessionSecret);
  const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
  const report = buildAnnunci10xScoreReport({ lead, analysisRun: run, evaluation, snapshot });

  assert.equal(report.roleTitle, 'Responsabile Customer Success');
  assert.equal(report.score, evaluation.score.value);
  assert.equal(report.band, evaluation.score.band.label);
  assert.equal(report.coverage, 90);
  assert.equal(report.evaluableCheckCount, 18);
  assert.deepEqual(report.priorities.map((item) => item.checkId), ['03', '04', '05']);
  assert.deepEqual(report.priorities.map((item) => item.label), [
    'Concretezza delle attivita',
    'Risultato osservabile del ruolo',
    'Contesto operativo',
  ]);
  assert.ok(report.priorities.every((item) => item.reason.length <= 600));
  assert.ok(report.priorities.every((item) => item.missing.length <= 3));
  assert.ok(report.priorities.every((item) => item.missing.every((missing) => missing.length <= 300)));
  assert.ok(!report.priorities.some((item) => item.checkId === '02' || item.checkId === '20'), 'NOT_EVALUABLE checks are excluded');

  const serialized = JSON.stringify(report);
  for (const forbidden of ['confidence', 'provider', 'promptVersion', 'rubricVersion', 'scoreSemanticsVersion', 'operation', 'accelerator']) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, 'i'), `report leaks ${forbidden}`);
  }

  const sent = await maybeSendAnnunci10xScoreReport({
    session,
    analysisRunId: run.id,
    context,
    provider: context.emailProvider,
    env: { ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED: '1' },
  });
  assert.equal(sent.status, 'SENT');
  assert.equal(context.emailProvider.sentScoreReports.length, 1);
  const email = context.emailProvider.sentScoreReports[0];
  assert.equal(email.evaluableCheckCount, 18);
  assert.equal(email.coverage, 90);
}

async function assertResendPayload() {
  const deliveryId = '11111111-1111-4111-8111-111111111111';
  assert.equal(resendScoreReportIdempotencyKey(deliveryId), `annunci10x-score-report/${deliveryId}`);
  assert.equal(resendScoreReportIdempotencyKey(deliveryId), resendScoreReportIdempotencyKey(deliveryId));
  assert.notEqual(resendScoreReportIdempotencyKey(deliveryId), resendScoreReportIdempotencyKey('22222222-2222-4222-8222-222222222222'));

  const previousPublicBaseUrl = process.env.ANNUNCI10X_PUBLIC_BASE_URL;
  process.env.ANNUNCI10X_PUBLIC_BASE_URL = 'https://horyzon.test/';
  const payload = buildResendScoreReportPayload(payloadInputFromPayload(deliveryId));
  if (previousPublicBaseUrl === undefined) {
    delete process.env.ANNUNCI10X_PUBLIC_BASE_URL;
  } else {
    process.env.ANNUNCI10X_PUBLIC_BASE_URL = previousPublicBaseUrl;
  }
  assert.equal(payload.from, 'Horyzon <noreply@example.com>');
  assert.deepEqual(payload.to, ['ada@example.com']);
  assert.equal(payload.reply_to, 'info@example.com');
  assert.equal(payload.subject, 'Il tuo Score di chiarezza Annunci 10x: 67/100 — ecco cosa lo frena');
  assert.match(payload.text, /18 controlli su 20/);
  assert.doesNotMatch(payload.text, /Copertura 90%/i);
  assert.doesNotMatch(payload.html, /<Ada>/);
  assert.match(payload.html, /Ciao Ada,/);
  assert.match(payload.text, /Il punteggio valuta la chiarezza e la completezza/);
  assert.match(payload.text, /Vuoi trasformarlo in un Annuncio 10x\? 7 € per un annuncio, una versione e un canale\./);
  assert.match(payload.text, /https:\/\/horyzon\.test\/annunci-10x/);
  assert.match(payload.html, /Score di chiarezza/);
  assert.match(payload.html, /Vuoi trasformarlo in un Annuncio 10x\?/);
  for (const forbidden of ['9 €', '49 €', 'checkout', 'Stripe', 'newsletter', 'marketing']) {
    assert.doesNotMatch(payload.text, new RegExp(escapeRegExp(forbidden), 'i'));
    assert.doesNotMatch(payload.html, new RegExp(escapeRegExp(forbidden), 'i'));
  }

  const captured = [];
  const provider = new ResendAnnunci10xEmailProvider({
    apiKey: 're_synthetic_secret',
    from: 'Horyzon <noreply@example.com>',
    replyTo: 'info@example.com',
    fetchImpl: async (url, init) => {
      captured.push({ url, init });
      return Response.json({ id: 'resend-score-id' }, { status: 200 });
    },
    timeoutMs: 50,
  });
  const sent = await provider.sendScoreReport({ ...payloadInputFromPayload(deliveryId), recipient: 'ada@example.com' });
  assert.equal(sent.providerRequestId, 'resend-score-id');
  assert.equal(captured[0].url, 'https://api.resend.com/emails');
  assert.equal(captured[0].init.method, 'POST');
  assert.equal(captured[0].init.headers['Idempotency-Key'], `annunci10x-score-report/${deliveryId}`);
  const body = JSON.parse(captured[0].init.body);
  assert.equal(body.subject, 'Il tuo Score di chiarezza Annunci 10x: 67/100 — ecco cosa lo frena');
}

async function assertMarketingConsentDoesNotGate() {
  for (const marketingConsent of [false, true]) {
    const { context, session, run } = await readyV2Fixture({ marketingConsent });
    const result = await maybeSendAnnunci10xScoreReport({
      session,
      analysisRunId: run.id,
      context,
      provider: context.emailProvider,
      env: { ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED: 'yes' },
    });
    assert.equal(result.status, 'SENT', `marketingConsent ${marketingConsent} must not gate service email`);
  }
}

async function assertConcurrency() {
  const { context, session, run } = await readyV2Fixture({ marketingConsent: false });
  const provider = new DelayedProvider();
  const [left, right] = await Promise.all([
    maybeSendAnnunci10xScoreReport({ session, analysisRunId: run.id, context, provider, env: { ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED: 'true' } }),
    maybeSendAnnunci10xScoreReport({ session, analysisRunId: run.id, context, provider, env: { ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED: 'true' } }),
  ]);
  assert.equal(provider.sentScoreReports.length, 1);
  assert.deepEqual([left.status, right.status].sort(), ['ALREADY_SENT_OR_IN_FLIGHT_OR_EXHAUSTED', 'SENT'].sort());
}

async function assertFailureRetry() {
  const { context, session, run } = await readyV2Fixture({ marketingConsent: false });
  const provider = new FailsOnceProvider();
  const first = await maybeSendAnnunci10xScoreReport({
    session,
    analysisRunId: run.id,
    context,
    provider,
    env: { ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED: '1' },
  });
  assert.equal(first.status, 'FAILED');
  const second = await maybeSendAnnunci10xScoreReport({
    session,
    analysisRunId: run.id,
    context,
    provider,
    env: { ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED: '1' },
  });
  assert.equal(second.status, 'SENT');
  assert.equal(second.attemptCount, 2);
  assert.equal(provider.sentScoreReports.length, 2);
}

async function assertUnsupportedV1() {
  const readyRun = {
    id: randomUUID(),
    sessionId: randomUUID(),
    status: 'READY',
    sourceStatus: 'READY',
    evaluationId: randomUUID(),
    resultReference: randomUUID(),
  };
  const context = {
    persistence: {
      getAnalysisRun: async () => readyRun,
      getLead: async () => ({ emailVerifiedAt: new Date().toISOString(), emailNormalized: 'ada@example.com' }),
      getEvaluationById: async () => ({ id: readyRun.evaluationId, score: { rubricVersion: 'annunci10x-rubric-v1', coverage: 100, checks: [] } }),
      claimEmailDelivery: async () => {
        throw new Error('V1 must not claim delivery');
      },
    },
  };
  const result = await maybeSendAnnunci10xScoreReport({
    session: { sessionId: readyRun.sessionId, sessionSecret: `${randomUUID()}${randomUUID()}` },
    analysisRunId: readyRun.id,
    context,
    env: { ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED: '1' },
  });
  assert.equal(result.status, 'UNSUPPORTED_RESULT_VERSION');
}

async function assertMigration() {
  const sql = await readFile('supabase/migrations/20260928113000_annunci10x_score_report_email_deliveries.sql', 'utf8');
  for (const required of [
    'create table if not exists public.annunci10x_email_deliveries',
    'constraint annunci10x_email_deliveries_unique unique (kind, analysis_run_id, recipient_normalized)',
    "status in ('PENDING', 'SENDING', 'SENT', 'FAILED')",
    "kind in ('SCORE_REPORT')",
    'alter table public.annunci10x_email_deliveries enable row level security',
    'annunci10x_claim_email_delivery',
    'annunci10x_mark_email_delivery_sent',
    'annunci10x_mark_email_delivery_failed',
    'grant select, insert, update on table public.annunci10x_email_deliveries to service_role',
  ]) {
    assert.match(sql, new RegExp(escapeRegExp(required), 'i'), `migration missing ${required}`);
  }
  assert.doesNotMatch(sql, /grant\s+delete\s+on\s+table\s+public\.annunci10x_email_deliveries/i, 'service_role must not receive DELETE');
  assert.match(sql, /attempt_count\s*>=\s*5/i, 'claim enforces max attempts');
}

async function readyV2Fixture({ marketingConsent }) {
  const context = {
    persistence: new MemoryAnnunci10xPersistenceAdapter(),
    provider: { run: async () => { throw new Error('not used'); } },
    configuredProvider: 'MOCK',
    emailProvider: new MockAnnunci10xEmailProvider(),
  };
  const created = await createAnonymousAnalyzeSession(context);
  const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  await context.persistence.appendSnapshot({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    roleCard: roleCardFixture(),
    reason: 'INITIAL_EXTRACTION',
  });
  await saveAnnunci10xLeadContact({
    session,
    context,
    firstName: '<Ada>',
    lastName: 'Lovelace',
    companyName: 'Horyzon Test',
    businessRole: 'HR',
    email: `ada.${randomUUID()}@example.com`,
    marketingConsent,
  });
  const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
  await verifyWithSyntheticOtp(context, session, lead.emailNormalized);
  const score = calculateAnnunci10xScoreV2(checksFixtureV2());
  assert.equal(score.coverage, 90);
  const evaluation = await context.persistence.saveEvaluation({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    target: { kind: 'ORIGINAL_AD', originalAdId: 'original-score-report' },
    targetRef: 'original-score-report',
    score,
    gate: null,
  });
  const run = await context.persistence.createOrGetAnalysisRun({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    sourceKind: 'PASTED_TEXT',
    sourceStatus: 'READY',
    originalInput: `Annuncio sintetico ${randomUUID()}`,
    targetText: 'Annuncio sintetico valido per test score report.',
    targetKind: 'ORIGINAL_AD',
    sourceHash: randomUUID().replaceAll('-', '').padEnd(64, 'a').slice(0, 64),
    inputIdentity: `identity-${randomUUID()}`,
    methodVersion: 'annunci10x-method-v2',
    rubricVersion: ANNUNCI10X_RUBRIC_VERSION_V2,
    promptVersion: 'annunci10x-evaluate-v2',
    scoreSemanticsVersion: ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
    model: 'mock-model',
    provider: 'MOCK',
    evaluationMode: 'V2_PUBLIC',
  });
  const readyRun = await context.persistence.updateAnalysisRun({
    analysisRunId: run.id,
    sessionSecret: session.sessionSecret,
    status: 'READY',
    stage: 'COMPLETE',
    sourceStatus: 'READY',
    evaluationId: evaluation.id,
    resultReference: evaluation.id,
    completedAt: new Date().toISOString(),
    errorPayload: null,
  });
  return { context, session, run: readyRun, evaluation };
}

function roleCardFixture() {
  return {
    title: fact('Responsabile Customer Success'),
    mission: fact('Rendere stabile la relazione con i clienti attivi.'),
    outcomes: [fact('Ridurre le richieste ricorrenti e migliorare adozione.')],
    responsibilities: [fact('Gestire onboarding, follow-up e priorita clienti.')],
    requirements: [{ id: 'req-1', label: fact('Esperienza customer success'), classification: 'REQUIRED' }],
    attractionContext: { attractivenessEvidence: [] },
  };
}

function fact(value) {
  return { value, source: 'USER_DECLARED', status: 'CONFIRMED', publishable: true };
}

function checksFixtureV2() {
  return ANNUNCI10X_RUBRIC_CHECKS_V2.map((definition) => {
    const base = {
      id: definition.id,
      evidence: [`Evidenza sintetica ${definition.id}`],
      reason: `Motivo sintetico per il controllo ${definition.id}.`,
      missing: [],
      confidence: 80,
    };
    if (definition.id === '02' || definition.id === '20') {
      return { ...base, score: null, status: 'NOT_EVALUABLE', evidence: [], reason: `Non valutabile sintetico ${definition.id}.` };
    }
    if (definition.id === '03') {
      return { ...base, score: 0, status: 'MISSING', reason: 'Le attivita quotidiane non sono descritte in modo concreto.', missing: ['Attivita settimanali', 'Strumenti usati', 'Interlocutori principali', 'Elemento eccedente'] };
    }
    if (definition.id === '04') {
      return { ...base, score: 0, status: 'MISSING', reason: 'Il risultato atteso del ruolo non e espresso chiaramente.', missing: ['Risultato misurabile'] };
    }
    if (definition.id === '05') {
      return { ...base, score: 2, status: 'CONFLICT', reason: 'Il contesto operativo presenta informazioni poco coerenti.', missing: ['Team di riferimento'] };
    }
    if (definition.id === '06') {
      return { ...base, score: 2, status: 'UNSUPPORTED', reason: 'Alcune priorita sono dichiarate senza evidenza nel testo.' };
    }
    if (definition.id === '01') {
      return { ...base, score: 2, status: 'EVALUATED', reason: 'Il titolo e riconoscibile solo in parte.' };
    }
    return { ...base, score: 8, status: 'EVALUATED' };
  });
}

async function verifyWithSyntheticOtp(context, session, email) {
  const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
  const id = randomUUID();
  await context.persistence.createEmailVerification({
    id,
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    leadId: lead.id,
    emailNormalized: email,
    codeHash: hashEmailVerificationCode(process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER, id, email, '042019'),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    maxAttempts: 5,
    pendingGraceSeconds: 15,
  });
  await context.persistence.markEmailVerificationSent(id, session.sessionSecret);
  await verifyAnnunci10xEmailCode({ session, context, code: '042019', analysisRunId: null, requestFingerprint: 'score-report-test', env: process.env });
}

function payloadInputFromPayload(deliveryId) {
  return {
    from: 'Horyzon <noreply@example.com>',
    replyTo: 'info@example.com',
    deliveryId,
    recipient: 'ada@example.com',
    firstName: 'Ada',
    roleTitle: 'Responsabile Customer Success',
    score: 67,
    band: 'Debole',
    coverage: 90,
    evaluableCheckCount: 18,
    priorities: [
      { checkId: '03', label: 'Concretezza delle attivita', reason: 'Le attivita sono ancora troppo generiche.', missing: ['Esempi di attivita settimanali'] },
      { checkId: '04', label: 'Risultato osservabile del ruolo', reason: 'Il risultato atteso non e esplicito.', missing: [] },
      { checkId: '05', label: 'Contesto operativo', reason: 'Il contesto e poco chiaro.', missing: ['Team', 'Interlocutori'] },
    ],
  };
}

class DelayedProvider {
  kind = 'MOCK';
  sentScoreReports = [];
  async sendScoreReport(input) {
    this.sentScoreReports.push(input);
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { providerRequestId: 'delayed-provider-id' };
  }
  async sendVerificationCode() {
    throw new Error('not used');
  }
}

class FailsOnceProvider {
  kind = 'MOCK';
  sentScoreReports = [];
  failures = 0;
  async sendScoreReport(input) {
    this.sentScoreReports.push(input);
    if (this.failures === 0) {
      this.failures += 1;
      throw new Error('synthetic provider failure');
    }
    return { providerRequestId: 'retry-provider-id' };
  }
  async sendVerificationCode() {
    throw new Error('not used');
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  await assertFeatureFlagFirst();
  await assertReportContent();
  await assertResendPayload();
  await assertMarketingConsentDoesNotGate();
  await assertConcurrency();
  await assertFailureRetry();
  await assertUnsupportedV1();
  await assertMigration();
  console.log('Annunci 10x score report email verifier passed');
}

await main();
