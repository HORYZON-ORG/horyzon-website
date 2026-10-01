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
  buildCustomerFacingCheckV2,
  buildCustomerFacingPriorityV2,
  buildResendScoreReportPayload,
  calculateAnnunci10xScoreReportAreas,
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

  assert.equal(report.analysisRunId, run.id);
  assert.equal(report.roleTitle, 'Responsabile Customer Success');
  assert.equal(report.score, evaluation.score.value);
  assert.equal(report.band, evaluation.score.band.label);
  assert.equal(report.coverage, 90);
  assert.equal(report.evaluableCheckCount, 18);
  assert.deepEqual(report.areaScores.map((area) => area.label), [
    'Identità del ruolo',
    'Lavoro reale e risultati',
    'Coerenza con il ruolo',
    'Requisiti',
    'Offerta e condizioni',
    'Comunicazione e candidatura',
  ]);
  assertAreaScore(report.areaScores[0], 20, 1, 2);
  assertAreaScore(report.areaScores[1], 100 * 2 / 30, 3, 3);
  assertAreaScore(report.areaScores[2], 65, 4, 4);
  assertAreaScore(report.areaScores[3], 80, 2, 2);
  assertAreaScore(report.areaScores[4], 80, 4, 4);
  assertAreaScore(report.areaScores[5], 80, 4, 5);
  assert.match(report.interpretation, /annuncio/i);
  assert.equal(report.checks.length, 20);
  assert.deepEqual(report.checks.map((item) => item.checkId), ANNUNCI10X_RUBRIC_CHECKS_V2.map((item) => item.id));
  assert.equal(report.checks.find((item) => item.checkId === '01').score, 2);
  assert.equal(report.checks.find((item) => item.checkId === '02').statusLabel, 'N/D');
  assert.match(report.checks.find((item) => item.checkId === '03').improvement, /attività/i);
  assert.deepEqual(report.priorities.map((item) => item.checkId), ['03', '04', '05']);
  assert.deepEqual(report.priorities.map((item) => item.label), [
    'Concretezza delle attività',
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
  assert.equal(email.analysisRunId, run.id);
  assert.equal(email.evaluableCheckCount, 18);
  assert.equal(email.coverage, 90);
  assert.equal(email.areaScores.length, 6);
  assert.equal(email.checks.length, 20);
  assert.ok(email.interpretation.length > 20);

  const checksWithNdCommunication = checksFixtureV2().map((check) => (
    ['16', '17', '18', '19', '20'].includes(check.id)
      ? { ...check, score: null, status: 'NOT_EVALUABLE', evidence: [], reason: `Non valutabile sintetico ${check.id}.` }
      : check
  ));
  const ndAreas = calculateAnnunci10xScoreReportAreas(checksWithNdCommunication);
  assert.equal(ndAreas[5].score, null);
  assert.equal(ndAreas[5].evaluatedCheckCount, 0);
}

function assertCustomerFacingPriorityPresentation() {
  const score = calculateAnnunci10xScoreV2(providerLeakChecksFixtureV2());
  const report = buildAnnunci10xScoreReport({
    lead: {},
    analysisRun: {},
    evaluation: { score },
    snapshot: { roleCard: roleCardFixture() },
  });

  assert.deepEqual(report.priorities.map((item) => item.checkId), ['10', '04', '02']);
  assert.deepEqual(report.priorities.map((item) => item.label), [
    'Classificazione dei requisiti',
    'Risultato osservabile del ruolo',
    'Livello, perimetro e responsabilità',
  ]);
  assert.equal(
    report.priorities.find((item) => item.checkId === '04').reason,
    'Il risultato del ruolo non è ancora espresso in modo sufficientemente chiaro: il candidato deve ricostruirlo dalle attività descritte.',
  );
  assert.deepEqual(report.priorities.find((item) => item.checkId === '04').missing, [
    'Esplicita quale risultato concreto deve produrre la persona nel ruolo.',
  ]);
  assert.equal(
    report.priorities.find((item) => item.checkId === '10').reason,
    'I requisiti non sono ancora separati con sufficiente chiarezza tra indispensabili, preferenziali e apprendibili.',
  );
  assert.deepEqual(report.priorities.find((item) => item.checkId === '10').missing, [
    'Separa chiaramente ciò che è indispensabile da ciò che è preferenziale o apprendibile.',
  ]);
  assert.equal(
    report.priorities.find((item) => item.checkId === '02').reason,
    'Alcune responsabilità sono comprensibili, ma livello, autonomia o confini del ruolo richiedono ancora interpretazione.',
  );
  assert.deepEqual(report.priorities.find((item) => item.checkId === '02').missing, [
    'Chiarisci livello, responsabilità principali, autonomia e perimetro operativo.',
  ]);

  const rendered = buildResendScoreReportPayload({
    ...payloadInputFromPayload('44444444-4444-4444-8444-444444444444'),
    areaScores: report.areaScores,
    priorities: report.priorities,
    interpretation: report.interpretation,
  });
  for (const forbidden of providerFacingFixtureStrings()) {
    assert.doesNotMatch(JSON.stringify(report.checks), new RegExp(escapeRegExp(forbidden), 'i'));
    assert.doesNotMatch(JSON.stringify(report.priorities), new RegExp(escapeRegExp(forbidden), 'i'));
    assert.doesNotMatch(rendered.text, new RegExp(escapeRegExp(forbidden), 'i'));
    assert.doesNotMatch(rendered.html, new RegExp(escapeRegExp(forbidden), 'i'));
  }
  for (const forbidden of ['target evidence', 'unsupported claim', 'provider', 'target', 'rubric', 'score semantics']) {
    assert.doesNotMatch(JSON.stringify(report.priorities), new RegExp(escapeRegExp(forbidden), 'i'));
  }
  assert.doesNotMatch(rendered.html, /<strong>\s*1\./i);
  assert.doesNotMatch(rendered.html, /1\.\s*1\./);
  assert.match(rendered.html, /<li style="margin-bottom:14px"><strong>Classificazione dei requisiti<\/strong>/);
  assert.match(rendered.text, /1\. Classificazione dei requisiti/);

  const missingPriority = buildCustomerFacingPriorityV2(priorityCheckFixture('05', null, 'MISSING'));
  assert.equal(missingPriority.reason, 'Il contesto operativo non è ancora abbastanza comprensibile per chi legge.');
  assert.deepEqual(missingPriority.missing, ['Indica contesto operativo, interlocutori principali e ambiente di lavoro.']);

  const conflictPriority = buildCustomerFacingPriorityV2(priorityCheckFixture('06', 1, 'CONFLICT'));
  assert.equal(conflictPriority.reason, 'Nel testo emergono informazioni non completamente coerenti su questo punto.');

  const unsupportedPriority = buildCustomerFacingPriorityV2(priorityCheckFixture('07', 1, 'UNSUPPORTED'));
  assert.equal(unsupportedPriority.reason, "Questa informazione non risulta sufficientemente supportata dai fatti presenti nell'annuncio.");

  for (const definition of ANNUNCI10X_RUBRIC_CHECKS_V2) {
    const priority = buildCustomerFacingPriorityV2(priorityCheckFixture(definition.id, null, 'MISSING'));
    assert.ok(priority.missing.length >= 1, `check ${definition.id} must have a customer-facing suggestion`);
    assert.doesNotMatch(JSON.stringify(priority), /missing target evidence|target evidence|provider|rubric|score semantics/i);
  }
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
  assert.equal(payload.subject, 'Il tuo Score Annunci 10X: 67/100 — ecco cosa migliorare');
  assert.match(payload.text, /18 controlli su 20/);
  assert.doesNotMatch(payload.text, /Copertura 90%/i);
  assert.doesNotMatch(payload.html, /<Ada>/);
  assert.match(payload.html, /Ciao Ada,/);
  assert.match(payload.text, /Punteggi per area/);
  assert.match(payload.text, /Identità del ruolo: 20\/100 \(1\/2 controlli valutabili\)/);
  assert.match(payload.text, /Lavoro reale e risultati: 6\.7\/100 \(3\/3 controlli valutabili\)/);
  assert.match(payload.text, /I 20 controlli/);
  assert.match(payload.text, /01\. Riconoscibilità del titolo — 2\/10 — Valutato/);
  assert.match(payload.text, /02\. Livello, perimetro e responsabilità — N\/D — N\/D/);
  assert.match(payload.text, /Come migliorare:/);
  assert.match(payload.text, /Le 3 priorità su cui intervenire/);
  assert.match(payload.text, /Il punteggio valuta la chiarezza e la completezza/);
  assert.match(payload.text, /Annuncio 10x — 7 €/);
  assert.match(payload.text, /1 annuncio · 1 versione · 1 canale/);
  assert.match(payload.text, /Migliora questo annuncio — 7 €/);
  assert.match(payload.text, /annunci-10x\?analysis=analysis-run-123#valuta/);
  assert.match(payload.text, /Guida Annunci 10x/);
  assert.match(payload.text, /Scopri la Guida Annunci 10X/);
  assert.match(payload.text, /La guida non ha ancora un prezzo pubblicato o acquisto diretto attivo\./);
  assert.match(payload.text, /https:\/\/horyzon\.test\/annunci-10x/);
  assert.match(payload.html, /Score Annunci 10X/);
  assert.match(payload.html, /Punteggi per area/);
  assert.match(payload.html, /I 20 controlli/);
  assert.match(payload.html, /Come migliorare:/);
  assert.match(payload.html, /Migliora questo annuncio/);
  assert.match(payload.html, /Scopri la Guida Annunci 10X/);
  for (const forbidden of ['9 €', '49 €', 'checkout', 'Stripe', 'newsletter', 'marketing']) {
    assert.doesNotMatch(payload.text, new RegExp(escapeRegExp(forbidden), 'i'));
    assert.doesNotMatch(payload.html, new RegExp(escapeRegExp(forbidden), 'i'));
  }
  assertResendPayloadEdgeCases();

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
  assert.equal(body.subject, 'Il tuo Score Annunci 10X: 67/100 — ecco cosa migliorare');
}

function assertResendPayloadEdgeCases() {
  const previousPublicBaseUrl = process.env.ANNUNCI10X_PUBLIC_BASE_URL;
  delete process.env.ANNUNCI10X_PUBLIC_BASE_URL;
  const payload = buildResendScoreReportPayload({
    ...payloadInputFromPayload('33333333-3333-4333-8333-333333333333'),
    firstName: '<script>alert(1)</script>',
    roleTitle: 'Ruolo <critico>',
    score: null,
    band: null,
    coverage: 100,
    evaluableCheckCount: 20,
    priorities: [],
    areaScores: [
      { id: 'ROLE_IDENTITY', label: 'Identita <ruolo>', score: null, evaluatedCheckCount: 0, totalCheckCount: 2 },
    ],
    interpretation: 'Interpretazione <sicura> senza promesse.',
  });
  if (previousPublicBaseUrl === undefined) {
    delete process.env.ANNUNCI10X_PUBLIC_BASE_URL;
  } else {
    process.env.ANNUNCI10X_PUBLIC_BASE_URL = previousPublicBaseUrl;
  }

  assert.equal(payload.subject, 'Il tuo report Annunci 10X è pronto');
  assert.match(payload.text, /N\/D/);
  assert.match(payload.text, /Non emergono priorità specifiche/);
  assert.match(payload.text, /Riapri Annunci 10X dal sito Horyzon/);
  assert.doesNotMatch(payload.text, /https?:\/\//);
  assert.doesNotMatch(payload.html, /<script>/i);
  assert.doesNotMatch(payload.html, /Ruolo <critico>/);
  assert.match(payload.html, /Identita &lt;ruolo&gt;/);
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

function providerLeakChecksFixtureV2() {
  return ANNUNCI10X_RUBRIC_CHECKS_V2.map((definition) => {
    const base = {
      id: definition.id,
      score: 8,
      status: 'EVALUATED',
      evidence: [`Evidenza sintetica ${definition.id}`],
      reason: `Motivo sintetico per il controllo ${definition.id}.`,
      missing: [],
      confidence: 80,
    };
    if (definition.id === '02') {
      return {
        ...base,
        score: 5,
        reason: 'Role perimeter is partly visible.',
        missing: ['provider should not leak this target evidence'],
      };
    }
    if (definition.id === '04') {
      return {
        ...base,
        score: 4,
        reason: 'Observable expected result is checked from target evidence.',
        missing: ['missing target evidence for check 04'],
      };
    }
    if (definition.id === '10') {
      return {
        ...base,
        score: 2,
        reason: 'Requirement classes are checked from target text.',
        missing: ['missing target evidence for check 10'],
      };
    }
    return base;
  });
}

function providerFacingFixtureStrings() {
  return [
    'Observable expected result is checked from target evidence.',
    'missing target evidence for check 04',
    'Requirement classes are checked from target text.',
    'missing target evidence for check 10',
    'Role perimeter is partly visible.',
  ];
}

function priorityCheckFixture(id, score, status) {
  return {
    id,
    score,
    status,
    evidence: [],
    reason: 'Raw provider target evidence reason.',
    missing: ['missing target evidence from provider'],
    confidence: 80,
  };
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
    analysisRunId: 'analysis-run-123',
    recipient: 'ada@example.com',
    firstName: 'Ada',
    roleTitle: 'Responsabile Customer Success',
    score: 67,
    band: 'Debole',
    coverage: 90,
    evaluableCheckCount: 18,
    areaScores: [
      { id: 'ROLE_IDENTITY', label: 'Identità del ruolo', score: 20, evaluatedCheckCount: 1, totalCheckCount: 2 },
      { id: 'REAL_WORK', label: 'Lavoro reale e risultati', score: 100 * 2 / 30, evaluatedCheckCount: 3, totalCheckCount: 3 },
      { id: 'ROLE_COHERENCE', label: 'Coerenza con il ruolo', score: 65, evaluatedCheckCount: 4, totalCheckCount: 4 },
      { id: 'REQUIREMENTS', label: 'Requisiti', score: 80, evaluatedCheckCount: 2, totalCheckCount: 2 },
      { id: 'OFFER_CONDITIONS', label: 'Offerta e condizioni', score: 80, evaluatedCheckCount: 4, totalCheckCount: 4 },
      { id: 'COMMUNICATION_APPLICATION', label: 'Comunicazione e candidatura', score: 80, evaluatedCheckCount: 4, totalCheckCount: 5 },
    ],
    checks: checksFixtureV2().map(buildCustomerFacingCheckV2),
    interpretation: 'La struttura di base c’è, ma alcune informazioni decisive sono ancora troppo generiche o implicite.',
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

function assertAreaScore(area, expectedScore, expectedEvaluated, expectedTotal) {
  assert.ok(Math.abs(area.score - expectedScore) < 0.000_001, `${area.label} score mismatch`);
  assert.equal(area.evaluatedCheckCount, expectedEvaluated);
  assert.equal(area.totalCheckCount, expectedTotal);
}

async function main() {
  await assertFeatureFlagFirst();
  await assertReportContent();
  await assertCustomerFacingPriorityPresentation();
  await assertResendPayload();
  await assertMarketingConsentDoesNotGate();
  await assertConcurrency();
  await assertFailureRetry();
  await assertUnsupportedV1();
  await assertMigration();
  console.log('Annunci 10x score report email verifier passed');
}

await main();
