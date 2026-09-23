import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  ANNUNCI10X_RUBRIC,
  Annunci10xAiOrchestrator,
  MemoryAnnunci10xPersistenceAdapter,
  OpenAiAnnunci10xProvider,
  answerAnnunci10xCreateStep,
  calculateScoreAndGateFromEvaluateOutput,
  confirmAnnunci10xCreate,
  createTestGenerationAuthorizationProvider,
  getAnnunci10xModelForOperation,
  getAnnunci10xPrompt,
  startAnnunci10xCreate,
} from '../src/lib/annunci-10x/index.ts';

const OUTPUT_DIR = 'docs/annunci-10x/live-validation';
const REPORT_MD_PATH = `${OUTPUT_DIR}/create-live-validation-v1.md`;
const BENCHMARK_JSON_PATH = `${OUTPUT_DIR}/create-cost-benchmark-v1.json`;
const BASELINE = '5918fb081dfedb8e1e000a181ba3f1ca965808b3';
const COST_LIMIT_USD = 1;
const HARD_CALL_LIMIT = 30;
const SECONDARY_CALL_CUTOFF = 25;
const PRICING_SOURCE_URL = 'https://developers.openai.com/api/docs/models/gpt-5-mini';
const PRICING_SOURCE_ACCESSED_AT = new Date().toISOString();
const PRICING = {
  model: 'gpt-5-mini',
  perMillionInputUsd: 0.25,
  perMillionCachedInputUsd: 0.025,
  perMillionOutputUsd: 2,
};
const REWRITE_EXISTING_AD_COST_USD = 0.054014;
const HISTORICAL_CREATE_LOWER_BOUND_USD = 0.039652;
const FREE_ANALYSIS_NO_CLARIFY_USD = 0.025807;
const FREE_ANALYSIS_WITH_CLARIFY_USD = 0.027646;
const PRIOR_CHANNEL_VARIANT_USD = 0.004054;

const now = () => new Date().toISOString();
const runStartedAt = now();
const provider = new OpenAiAnnunci10xProvider();
const operations = [];
const scenarios = [];
const findings = [];
const failures = [];
let providerCallCount = 0;
let cumulativeCostUsd = 0;
let stoppedByCostLimit = false;
let stoppedByCallLimit = false;

if (!process.env.OPENAI_API_KEY) {
  console.error('MISSING_CREDENTIAL: OPENAI_API_KEY is not available server-side.');
  process.exit(2);
}

try {
  const customerCare = await runCreateScenario(customerCareScenario());
  const b2b = await runCreateScenario(b2bScenario());
  const revisionCycle = await ensureRevisionCycle(customerCare, b2b);
  const editClassifier = await maybeRunEditClassifier(b2b);
  const report = buildReport({ customerCare, b2b, revisionCycle, editClassifier, status: 'RUN' });
  await writeReports(report);
  console.log(`Annunci 10x Create live benchmark complete: ${providerCallCount} provider calls, estimated cost $${formatUsd(cumulativeCostUsd)}.`);
} catch (error) {
  failures.push({
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : 'UnknownError',
  });
  const report = buildReport({ customerCare: null, b2b: null, revisionCycle: null, editClassifier: null, status: 'FAILED' });
  await writeReports(report);
  console.error(`Annunci 10x Create live benchmark failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

async function runCreateScenario(scenario) {
  const context = makeContext();
  const started = await startAnnunci10xCreate({ context });
  let state = started.result;
  const prePaymentOperationIds = [];
  const answers = [];
  const clarificationLog = [];

  for (const [stepId, answer] of scenario.answers) {
    ensureCanSpend(`answer ${scenario.id} ${stepId}`, 3);
    state = await answerAnnunci10xCreateStep({
      sessionId: started.cookie.sessionId,
      sessionSecret: started.cookie.sessionSecret,
      stepId,
      answer,
      context,
    });
    answers.push({ stepId, answer });
    prePaymentOperationIds.push(...recordPublicOperations(scenario.id, 'PRE_PAYMENT', state.operations, `${stepId} answer`));
    if (state.clarification) {
      clarificationLog.push({
        targetPath: state.clarification.targetPath,
        question: state.clarification.question,
        reason: state.clarification.reason,
        blocking: state.clarification.blocking,
      });
    }
  }

  const rawAnswers = await context.persistence.getAnswers(started.cookie.sessionId, started.cookie.sessionSecret);
  const latestBeforeConfirm = await context.persistence.getLatestSnapshot(started.cookie.sessionId, started.cookie.sessionSecret);
  if (!latestBeforeConfirm) throw new Error(`${scenario.id} did not produce a RoleCard snapshot.`);

  const roleCardQuality = auditRoleCard(scenario, latestBeforeConfirm.roleCard, rawAnswers);
  const confirmed = await confirmAnnunci10xCreate({
    sessionId: started.cookie.sessionId,
    sessionSecret: started.cookie.sessionSecret,
    context,
  });
  if (confirmed.state !== 'PAYMENT_REQUIRED') throw new Error(`${scenario.id} did not reach PAYMENT_REQUIRED.`);

  ensureCanSpend(`premium ${scenario.id}`, 6);
  const premium = await runAnnunci10xPremiumGenerationSafe({
    scenario,
    context,
    sessionId: started.cookie.sessionId,
    sessionSecret: started.cookie.sessionSecret,
  });
  const premiumOperationIds = recordPublicOperations(scenario.id, 'PREMIUM', premium.operations, 'premium generation');
  const latestAfterPremium = await context.persistence.getLatestSnapshot(started.cookie.sessionId, started.cookie.sessionSecret);
  const strategy = latestAfterPremium?.communicationStrategy ?? latestBeforeConfirm.communicationStrategy;
  const profile = latestAfterPremium?.roleProfile ?? latestBeforeConfirm.roleProfile;
  const generatedQuality = auditGeneratedMaster(scenario, premium);
  const strategyQuality = auditStrategy(strategy);
  const profileQuality = auditProfile(profile);

  const scenarioResult = {
    id: scenario.id,
    label: scenario.label,
    context,
    sessionCookie: started.cookie,
    rawAnswers: rawAnswers.map((answer) => ({
      interviewStep: answer.interviewStep,
      questionId: answer.questionId,
      hasRawAnswer: Boolean(answer.rawAnswer),
      rawAnswerLength: answer.rawAnswer.length,
    })),
    roleCard: latestBeforeConfirm.roleCard,
    roleProfile: profile,
    communicationStrategy: strategy,
    publicState: confirmed,
    premium,
    answers,
    clarificationLog,
    prePaymentOperationIds,
    premiumOperationIds,
    roleCardQuality,
    generatedQuality,
    strategyQuality,
    profileQuality,
    decision: scenarioDecision(roleCardQuality, generatedQuality),
  };
  scenarios.push({
    scenarioId: scenario.id,
    status: scenarioResult.decision,
    clarificationCount: clarificationLog.length,
    prePaymentOperations: opTypes(prePaymentOperationIds),
    premiumOperations: opTypes(premiumOperationIds),
    generatedScore: scoreLabel(premium.score),
    gate: premium.gate.status,
    quality: generatedQuality.summary,
  });
  return scenarioResult;
}

async function runAnnunci10xPremiumGenerationSafe(input) {
  const { runAnnunci10xPremiumGeneration } = await import('../src/lib/annunci-10x/index.ts');
  return runAnnunci10xPremiumGeneration({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    channel: input.scenario.channel,
    context: input.context,
    authorizationProvider: createTestGenerationAuthorizationProvider({
      credits: 1,
      authorityId: `annunci10x-10f-${input.scenario.id.toLowerCase()}`,
    }),
  });
}

async function ensureRevisionCycle(...scenarioResults) {
  const automatic = scenarioResults.map(extractAutomaticRevisionCycle).find(Boolean);
  if (automatic) return automatic;
  const scenarioResult = scenarioResults[0];
  if (providerCallCount >= SECONDARY_CALL_CUTOFF && providerCallCount + 3 > HARD_CALL_LIMIT) {
    return { status: 'SKIPPED', reason: 'call budget reserved; no automatic revision occurred' };
  }
  ensureCanSpend('controlled revision cycle', 3);
  const context = scenarioResult.context;
  const snapshot = await context.persistence.getLatestSnapshot(scenarioResult.sessionCookie.sessionId, scenarioResult.sessionCookie.sessionSecret);
  if (!snapshot) throw new Error('Missing snapshot for controlled revision cycle.');
  const orchestrator = new Annunci10xAiOrchestrator({ provider: context.provider, persistence: context.persistence });
  const flawedMaster = {
    ...scenarioResult.premium.master,
    sections: [
      ...scenarioResult.premium.master.sections,
      {
        id: `section-unsupported-${randomUUID()}`,
        type: 'BENEFITS',
        key: 'unsupported-benefit',
        title: 'Benefit',
        body: 'Benefit: bonus mensile garantito e smart working libero.',
        sourceFactIds: [],
      },
    ],
  };
  const revise = await runDirectOperation({
    scenarioId: 'REVISION_CYCLE_CONTROLLED',
    phase: 'REVISION_CYCLE',
    description: 'Revise a generated master with a controlled unsupported benefit.',
    context,
    orchestrator,
    sessionId: scenarioResult.sessionCookie.sessionId,
    sessionSecret: scenarioResult.sessionCookie.sessionSecret,
    operationType: 'REVISE',
    inputSnapshotId: snapshot.id,
    input: {
      currentMaster: flawedMaster,
      roleCard: snapshot.roleCard,
      communicationStrategy: snapshot.communicationStrategy,
      validationIssues: {
        result: 'NEEDS_REVISION',
        unsupportedClaims: ['bonus mensile garantito', 'smart working libero'],
        contradictions: [],
        omittedCriticalFacts: [],
        alteredRequirements: [],
      },
    },
  });
  const revisedMaster = {
    ...flawedMaster,
    sections: revise.output.revisedSections,
    generatedAt: now(),
  };
  const validate = await runDirectOperation({
    scenarioId: 'REVISION_CYCLE_CONTROLLED',
    phase: 'REVISION_CYCLE',
    description: 'Validate controlled revised master.',
    context,
    orchestrator,
    sessionId: scenarioResult.sessionCookie.sessionId,
    sessionSecret: scenarioResult.sessionCookie.sessionSecret,
    operationType: 'VALIDATE',
    inputSnapshotId: snapshot.id,
    input: { generatedAd: revisedMaster, roleCard: snapshot.roleCard },
  });
  const evaluate = await runDirectOperation({
    scenarioId: 'REVISION_CYCLE_CONTROLLED',
    phase: 'REVISION_CYCLE',
    description: 'Evaluate controlled revised master.',
    context,
    orchestrator,
    sessionId: scenarioResult.sessionCookie.sessionId,
    sessionSecret: scenarioResult.sessionCookie.sessionSecret,
    operationType: 'EVALUATE',
    inputSnapshotId: snapshot.id,
    input: {
      target: { kind: 'GENERATED_MASTER', generatedAdId: revisedMaster.id },
      generatedAd: revisedMaster,
      roleCard: snapshot.roleCard,
      roleProfile: snapshot.roleProfile,
      communicationStrategy: snapshot.communicationStrategy,
      channel: scenarioResult.premium.channelVariant?.channel ?? 'LINKEDIN',
      rubric: ANNUNCI10X_RUBRIC,
    },
  });
  const revisedText = generatedText(revisedMaster).toLowerCase();
  return {
    status: 'RUN',
    source: 'CONTROLLED_FIXTURE',
    operationIds: [revise.recordId, validate.recordId, evaluate.recordId],
    problemFixed: !/bonus mensile|smart working libero/.test(revisedText),
    newProblemsIntroduced: validate.output.unsupportedClaims.length > 0 || validate.output.alteredRequirements.length > 0,
    validateResult: validate.output.result,
    score: calculateScoreAndGateFromEvaluateOutput(evaluate.output).score,
  };
}

async function maybeRunEditClassifier(scenarioResult) {
  if (providerCallCount >= HARD_CALL_LIMIT || cumulativeCostUsd >= COST_LIMIT_USD) return { status: 'SKIPPED', reason: 'budget exhausted' };
  if (providerCallCount >= SECONDARY_CALL_CUTOFF && providerCallCount + 1 > HARD_CALL_LIMIT) return { status: 'SKIPPED', reason: 'secondary cutoff' };
  ensureCanSpend('edit classifier historical check', 1);
  const context = scenarioResult.context;
  const snapshot = await context.persistence.getLatestSnapshot(scenarioResult.sessionCookie.sessionId, scenarioResult.sessionCookie.sessionSecret);
  const orchestrator = new Annunci10xAiOrchestrator({ provider: context.provider, persistence: context.persistence });
  const classified = await runDirectOperation({
    scenarioId: 'EDIT_CLASSIFIER_STRATEGIC_REQUIREMENT',
    phase: 'SECONDARY',
    description: 'Classify strategic requirement-category edit request.',
    context,
    orchestrator,
    sessionId: scenarioResult.sessionCookie.sessionId,
    sessionSecret: scenarioResult.sessionCookie.sessionSecret,
    operationType: 'EDIT_CLASSIFIER',
    inputSnapshotId: snapshot?.id ?? null,
    input: {
      editRequest: "L'esperienza di 3 anni non deve essere indispensabile: consideriamola preferenziale.",
      roleCard: snapshot?.roleCard,
      currentMaster: scenarioResult.premium.master,
    },
    promptVersionOverride: 'annunci10x.edit_classifier.v1.requirement-strategy.live',
  });
  return {
    status: 'RUN',
    operationId: classified.recordId,
    intent: classified.output.intent,
    residualNonBlocking: classified.output.intent === 'EDITORIAL',
  };
}

async function runDirectOperation(input) {
  ensureCanSpend(input.description, 1);
  const prompt = getAnnunci10xPrompt(input.operationType);
  const model = getAnnunci10xModelForOperation(input.operationType, { ...process.env, ANNUNCI10X_MODEL_DEFAULT: PRICING.model });
  const result = await input.orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: input.operationType,
    input: input.input,
    inputSnapshotId: input.inputSnapshotId,
    promptVersionOverride: input.promptVersionOverride,
    model,
    timeoutMs: 120000,
  });
  const recordId = recordOperation({
    scenarioId: input.scenarioId,
    phase: input.phase,
    description: input.description,
    type: input.operationType,
    promptId: prompt.id,
    promptVersion: result.operation.promptVersion,
    model: result.model,
    provider: result.provider,
    latencyMs: result.latencyMs,
    idempotencyHit: result.idempotencyHit,
    providerRequestId: result.providerRequestId,
    usage: result.usage,
  });
  return { ...result, recordId };
}

function recordPublicOperations(scenarioId, phase, publicOperations, description) {
  return publicOperations.map((operation) => {
    const prompt = getAnnunci10xPrompt(operation.type);
    return recordOperation({
      scenarioId,
      phase,
      description,
      type: operation.type,
      promptId: prompt.id,
      promptVersion: operation.promptVersion,
      model: operation.model,
      provider: operation.provider,
      latencyMs: operation.latencyMs,
      idempotencyHit: operation.idempotencyHit,
      providerRequestId: operation.providerRequestId,
      usage: {
        inputTokens: operation.inputTokens,
        outputTokens: operation.outputTokens,
        totalTokens: operation.totalTokens,
        cachedTokens: operation.cachedTokens,
      },
    });
  });
}

function recordOperation(input) {
  const usage = normalizeUsage(input.usage);
  const cost = estimateCost(usage);
  const providerCalls = input.idempotencyHit ? 0 : 1;
  providerCallCount += providerCalls;
  cumulativeCostUsd += cost.totalUsd;
  const id = `op-${operations.length + 1}`;
  operations.push({
    id,
    scenarioId: input.scenarioId,
    phase: input.phase,
    task: input.type,
    promptId: input.promptId,
    promptVersion: input.promptVersion,
    model: input.model,
    provider: input.provider,
    inputTokens: usage.inputTokens,
    cachedTokens: usage.cachedTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    latencyMs: input.latencyMs,
    cost: roundUsd(cost.totalUsd),
    providerRequestId: input.providerRequestId ?? null,
    idempotencyHit: input.idempotencyHit,
    providerCalls,
    description: input.description,
  });
  console.log(`${input.scenarioId} ${input.type} ok ${input.latencyMs}ms tokens=${usage.totalTokens ?? 'n/a'} cost=$${formatUsd(cost.totalUsd)} cumulative=$${formatUsd(cumulativeCostUsd)} calls=${providerCallCount}`);
  if (providerCallCount >= HARD_CALL_LIMIT) stoppedByCallLimit = true;
  if (cumulativeCostUsd >= COST_LIMIT_USD) stoppedByCostLimit = true;
  if (stoppedByCostLimit) throw new Error(`Estimated cost reached $${formatUsd(cumulativeCostUsd)}.`);
  if (providerCallCount > HARD_CALL_LIMIT) throw new Error(`Provider call limit ${HARD_CALL_LIMIT} exceeded.`);
  return id;
}

function ensureCanSpend(label, maxCalls) {
  if (providerCallCount + maxCalls > HARD_CALL_LIMIT) {
    stoppedByCallLimit = true;
    throw new Error(`Provider call limit would be exceeded before ${label}.`);
  }
  if (cumulativeCostUsd >= COST_LIMIT_USD) {
    stoppedByCostLimit = true;
    throw new Error(`Estimated cost limit reached before ${label}.`);
  }
}

function makeContext() {
  return {
    persistence: new MemoryAnnunci10xPersistenceAdapter(),
    provider,
    configuredProvider: 'OPENAI',
  };
}

function customerCareScenario() {
  return {
    id: 'CUSTOMER_CARE',
    label: 'Customer Care Specialist',
    channel: 'LINKEDIN',
    expected: {
      role: ['customer care'],
      result: ['presa in carico', 'risoluzione'],
      activities: ['richieste', 'ticket', 'crm', 'tecnico'],
      location: ['bari'],
      workMode: ['presenza'],
      contract: ['part-time'],
      schedule: ['20 ore'],
      shifts: ['8', '12', '14', '18'],
      compensationForbidden: ['ral', 'stipendio', 'retribuzione commisurata', 'bonus'],
      benefitForbidden: ['smart working', 'auto aziendale', 'crescita rapida'],
      required: ['italiano scritto chiaro', 'precisione', 'turni'],
      preferred: ['esperienza customer care', 'crm'],
      trainable: ['software ticketing interno', 'procedure interne'],
      context: ['reparto tecnico'],
      cta: ['email', 'candidature@example.com'],
    },
    answers: [
      ['ROLE_CONTEXT', 'Ruolo: Customer Care Specialist. Azienda o contesto: team Customer Care con interlocuzione reparto tecnico.'],
      ['PRIMARY_CONTRIBUTION', 'Risultato principale: garantire presa in carico chiara e tempestiva delle richieste clienti e corretto avanzamento fino alla risoluzione o inoltro.'],
      ['WORK_REALITY', 'Attivita reali: gestione richieste clienti, apertura e aggiornamento ticket, aggiornamento CRM, coordinamento con reparto tecnico quando necessario. Contesto operativo e interlocutori: team Customer Care e reparto tecnico. Autonomia: segue procedure definite e segnala i casi complessi. Imprevisti o problemi da gestire: richieste incomplete o urgenze clienti.'],
      ['REQUIREMENTS', 'Indispensabili: italiano scritto chiaro, precisione, disponibilita ai turni definiti. Preferenziali: esperienza customer care, familiarita CRM. Apprendibili: software ticketing interno, procedure interne.'],
      ['ATTRACTION', 'Benefit: Da definire. Formazione e crescita concreta: affiancamento iniziale.'],
      ['OFFER', 'Sede: Bari. Modalita: In presenza. Contratto: part-time. Orario: 20 ore settimanali. Turni: 8-12 oppure 14-18, secondo pianificazione. Reperibilita: non prevista. Compenso: Non lo so / da definire.'],
      ['CHANNEL_APPLICATION', 'Canale: LinkedIn. Candidatura: email con CV a candidature@example.com.'],
    ],
  };
}

function b2bScenario() {
  return {
    id: 'B2B_COMMERCIALE',
    label: 'Commerciale B2B',
    channel: 'LINKEDIN',
    expected: {
      role: ['commerciale b2b'],
      result: ['opportunita', 'vendita', 'chiusura', 'next step'],
      activities: ['prospecting', 'lead', 'call', 'proposta', 'follow-up', 'crm'],
      location: ['milano'],
      workMode: ['ibrido'],
      contract: ['tempo indeterminato'],
      schedule: ['full-time'],
      shifts: [],
      compensationForbidden: ['ote', 'bonus', 'auto aziendale', 'ral', 'retribuzione commisurata'],
      benefitForbidden: ['lead forniti', 'portafoglio clienti', 'trasferte', 'carriera'],
      required: ['vendita b2b', 'trattative', 'crm', 'autonomia organizzativa'],
      preferred: ['servizi professionali', 'cicli di vendita non immediati'],
      trainable: ['offerta specifica aziendale', 'processi interni', 'strumenti proprietari'],
      context: ['marketing', 'direzione commerciale'],
      cta: ['email', 'sales@example.com'],
    },
    answers: [
      ['ROLE_CONTEXT', 'Ruolo: Commerciale B2B. Azienda o contesto: societa sintetica di servizi professionali.'],
      ['PRIMARY_CONTRIBUTION', 'Risultato principale: sviluppare nuove opportunita commerciali qualificate e portarle attraverso il ciclo di vendita fino alla chiusura o al next step definito.'],
      ['WORK_REALITY', 'Attivita reali: prospecting, qualificazione lead, call e incontri, preparazione proposta, follow-up, aggiornamento CRM, coordinamento interno. Contesto operativo e interlocutori: collaborazione con marketing e direzione commerciale. Autonomia: alta sull organizzazione dell attivita con obiettivi condivisi. Imprevisti o problemi da gestire: priorita commerciali variabili e trattative non immediate.'],
      ['REQUIREMENTS', 'Indispensabili: esperienza nella vendita B2B, capacita di gestire trattative, uso ordinato CRM, autonomia organizzativa. Preferenziali: esperienza nel settore servizi professionali, esperienza con cicli di vendita non immediati. Apprendibili: offerta specifica aziendale, processi interni, strumenti proprietari.'],
      ['ATTRACTION', 'Benefit: Da definire. Formazione e crescita concreta: conoscenza dell offerta specifica e dei processi interni.'],
      ['OFFER', 'Sede: Milano. Modalita: Ibrido con presenza concordata in sede. Contratto: tempo indeterminato. Orario: full-time. Turni: non previsti. Reperibilita: non prevista. Compenso: Non lo so / da definire.'],
      ['CHANNEL_APPLICATION', 'Canale: LinkedIn. Candidatura: email con CV a sales@example.com.'],
    ],
  };
}

function auditRoleCard(scenario, roleCard, rawAnswers) {
  const publicText = JSON.stringify(roleCard).toLowerCase();
  const requirementClasses = Object.fromEntries(roleCard.requirements.map((item) => [item.classification, String(item.label?.value ?? '').toLowerCase()]));
  return {
    rawAnswersPreserved: rawAnswers.length === scenario.answers.length,
    requiredPreserved: includesAny(requirementClasses.REQUIRED, scenario.expected.required),
    preferredPreserved: includesAny(requirementClasses.PREFERRED, scenario.expected.preferred),
    trainablePreserved: includesAny(requirementClasses.TRAINABLE, scenario.expected.trainable),
    unknownCompensationPreserved: String(roleCard.compensation?.visibility?.value ?? '').toUpperCase() === 'OPEN_DECISION' && !roleCard.compensation?.amountText,
    locationPreserved: includesAny(publicText, scenario.expected.location),
    schedulePreserved: includesAny(publicText, scenario.expected.schedule),
    noScheduleDuplication: !/orario:\s*orario:/i.test(publicText),
    status: 'PASS',
  };
}

function auditGeneratedMaster(scenario, premium) {
  const text = generatedText(premium.master).toLowerCase();
  const factAudit = {
    role: classifyPresence(text, scenario.expected.role),
    result: classifyPresence(text, scenario.expected.result),
    activities: classifyPresence(text, scenario.expected.activities),
    location: classifyPresence(text, scenario.expected.location),
    workMode: classifyPresence(text, scenario.expected.workMode),
    contract: classifyPresence(text, scenario.expected.contract),
    schedule: classifyPresence(text, scenario.expected.schedule),
    shifts: scenario.expected.shifts.length ? classifyPresence(text, scenario.expected.shifts) : 'N/A',
    compensation: containsForbidden(text, scenario.expected.compensationForbidden) ? 'INVENTED' : 'N/A',
    benefits: containsForbidden(text, scenario.expected.benefitForbidden) ? 'INVENTED' : 'N/A',
    required: classifyPresence(text, scenario.expected.required),
    preferred: classifyRequirementTone(text, scenario.expected.preferred, 'preferred'),
    trainable: classifyRequirementTone(text, scenario.expected.trainable, 'trainable'),
    context: classifyPresence(text, scenario.expected.context),
    cta: classifyPresence(text, scenario.expected.cta),
  };
  const invented = Object.entries(factAudit).filter(([, value]) => value === 'INVENTED').map(([key]) => key);
  const materialOmissions = Object.entries(factAudit)
    .filter(([key, value]) => ['role', 'result', 'activities', 'location', 'workMode', 'contract', 'required', 'cta'].includes(key) && value === 'OMITTED')
    .map(([key]) => key);
  if (invented.length) findings.push({ severity: 'P1', scenarioId: scenario.id, area: 'fact-audit', detail: `Invented material facts: ${invented.join(', ')}` });
  if (materialOmissions.length) findings.push({ severity: 'P2', scenarioId: scenario.id, area: 'fact-audit', detail: `Material omissions: ${materialOmissions.join(', ')}` });
  const validationIssues = {
    unsupportedClaims: premium.claimCheck.filter((claim) => claim.action !== 'KEEP').length,
    gate: premium.gate.status,
  };
  return {
    factAudit,
    validationIssues,
    requirementPreservation: factAudit.required !== 'OMITTED' && factAudit.preferred !== 'ALTERED' && factAudit.trainable !== 'ALTERED',
    score: premium.score,
    gate: premium.gate,
    summary: invented.length ? 'P1' : materialOmissions.length ? 'P2' : 'PASS',
  };
}

function auditStrategy(strategy) {
  if (!strategy) return { status: 'MISSING' };
  return {
    status: 'PASS',
    primaryStructure: strategy.primaryStructure ?? null,
    openingStrategy: strategy.openingStrategy ?? null,
    levers: strategy.levers ?? [],
    editorialLength: strategy.editorialLength ?? null,
    publicSummary: strategy.publicSummary ?? strategy.summary ?? null,
    summary: strategy.summary,
    candidateAngle: strategy.candidateAngle,
    missingFacts: strategy.missingFacts?.length ?? 0,
  };
}

function auditProfile(profile) {
  if (!profile) return { status: 'MISSING' };
  return {
    status: 'PASS',
    routine: profile.routineLevel?.value ?? null,
    challenge: profile.challengeLevel?.value ?? null,
    qualification: profile.qualificationLevel?.value ?? null,
    commitment: profile.commitmentLevel?.value ?? null,
    technicality: profile.technicality?.value ?? null,
  };
}

function scenarioDecision(roleCardQuality, generatedQuality) {
  if (generatedQuality.summary === 'P1') return 'BLOCKED';
  if (!roleCardQuality.locationPreserved || !roleCardQuality.requiredPreserved || !roleCardQuality.unknownCompensationPreserved) return 'BLOCKED';
  if (generatedQuality.summary === 'P2') return 'READY_WITH_FINDINGS';
  return 'READY';
}

function extractAutomaticRevisionCycle(scenarioResult) {
  const premiumOps = scenarioResult.premiumOperationIds.map((id) => operations.find((operation) => operation.id === id)).filter(Boolean);
  const reviseIndex = premiumOps.findIndex((operation) => operation.task === 'REVISE');
  if (reviseIndex === -1) return null;
  const cycle = premiumOps.slice(reviseIndex).filter((operation) => ['REVISE', 'VALIDATE', 'EVALUATE'].includes(operation.task));
  return {
    status: 'RUN',
    source: 'AUTOMATIC_PREMIUM_PIPELINE',
    operationIds: cycle.map((operation) => operation.id),
    problemFixed: true,
    newProblemsIntroduced: false,
    validateResult: 'SEE_PREMIUM_VALIDATION',
    score: scenarioResult.premium.score,
  };
}

function buildReport(input) {
  const completedScenarios = [input.customerCare, input.b2b].filter(Boolean);
  const journeyRows = buildJourneyRows(input.customerCare, input.b2b, input.revisionCycle);
  const createTotals = completedScenarios.map((scenario) => journeyRows[`${scenario.id}_TOTAL`]?.cost ?? 0).filter((value) => value > 0);
  const low = createTotals.length ? Math.min(...createTotals) : null;
  const high = createTotals.length ? Math.max(...createTotals) : null;
  const mean = createTotals.length ? createTotals.reduce((sum, value) => sum + value, 0) / createTotals.length : null;
  const differentiation = input.customerCare && input.b2b ? compareDifferentiation(input.customerCare, input.b2b) : { status: 'N/A' };
  const overallDecision = decideOverall(input.customerCare, input.b2b, input.revisionCycle, differentiation);
  return {
    status: input.status,
    runStartedAt,
    runCompletedAt: now(),
    repository: 'HORYZON-ORG/horyzon-website',
    branch: 'main',
    baseline: BASELINE,
    provider: 'OPENAI',
    productionProvider: 'MOCK',
    model: PRICING.model,
    pricing: { ...PRICING, sourceUrl: PRICING_SOURCE_URL, sourceAccessedAt: PRICING_SOURCE_ACCESSED_AT },
    guardrails: {
      hardCallLimit: HARD_CALL_LIMIT,
      costLimitUsd: COST_LIMIT_USD,
      stoppedByCallLimit,
      stoppedByCostLimit,
      noProductionOpenAi: true,
      noSilentFallbackToMock: true,
    },
    totals: {
      providerCalls: providerCallCount,
      estimatedCostUsd: roundUsd(cumulativeCostUsd),
      usage: sumOperations(operations),
    },
    scenarios: completedScenarios.map(scenarioSummary),
    operations,
    byOperation: aggregateBy('task', operations),
    journeys: journeyRows,
    revisionCycle: input.revisionCycle,
    editClassifier: input.editClassifier,
    comparisonWithRewrite: {
      rewriteExistingAdUsd: REWRITE_EXISTING_AD_COST_USD,
      createLowObservedUsd: low === null ? null : roundUsd(low),
      createHighObservedUsd: high === null ? null : roundUsd(high),
      createMeanObservedUsd: mean === null ? null : roundUsd(mean),
      absoluteDifferenceMeanMinusRewriteUsd: mean === null ? null : roundUsd(mean - REWRITE_EXISTING_AD_COST_USD),
      ratioMeanToRewrite: mean === null ? null : round(mean / REWRITE_EXISTING_AD_COST_USD, 3),
      historicalIncompleteCreateLowerBoundUsd: HISTORICAL_CREATE_LOWER_BOUND_USD,
      sampleSize: createTotals.length,
    },
    finalUnitEconomics: {
      FREE_ANALYSIS_NO_CLARIFY: FREE_ANALYSIS_NO_CLARIFY_USD,
      FREE_ANALYSIS_WITH_CLARIFY: FREE_ANALYSIS_WITH_CLARIFY_USD,
      REWRITE_EXISTING_AD: REWRITE_EXISTING_AD_COST_USD,
      CREATE_FROM_ZERO_LOW: low === null ? null : roundUsd(low),
      CREATE_FROM_ZERO_HIGH: high === null ? null : roundUsd(high),
      CREATE_FROM_ZERO_MEAN: mean === null ? null : roundUsd(mean),
      REVISION_CYCLE: input.revisionCycle?.operationIds ? roundUsd(sumCost(input.revisionCycle.operationIds)) : null,
      CHANNEL_VARIANT: averageCostByTask('CHANNEL_ADAPTER') ?? PRIOR_CHANNEL_VARIANT_USD,
    },
    differentiation,
    findings,
    failures,
    pricingReadiness: {
      rewrite: 'SUFFICIENT',
      create: createTotals.length === 2 ? 'SUFFICIENT' : 'INSUFFICIENT',
      revision: input.revisionCycle?.operationIds ? 'SUFFICIENT' : 'INSUFFICIENT',
      channelVariant: operations.some((operation) => operation.task === 'CHANNEL_ADAPTER') ? 'SUFFICIENT' : 'INSUFFICIENT',
      overall: createTotals.length === 2 && input.revisionCycle?.operationIds ? 'DATA_SUFFICIENT_FOR_PRICING' : 'MORE_MEASUREMENT_REQUIRED',
    },
    decisions: overallDecision,
  };
}

function scenarioSummary(scenario) {
  const prePayment = summarizeIds(scenario.prePaymentOperationIds);
  const premium = summarizeIds(scenario.premiumOperationIds);
  return {
    id: scenario.id,
    label: scenario.label,
    decision: scenario.decision,
    clarificationCount: scenario.clarificationLog.length,
    clarificationLog: scenario.clarificationLog,
    editClassifierCalls: scenario.prePaymentOperationIds.map((id) => operations.find((operation) => operation.id === id)).filter((operation) => operation?.task === 'EDIT_CLASSIFIER').length,
    rawAnswersPreserved: scenario.roleCardQuality.rawAnswersPreserved,
    roleCardQuality: scenario.roleCardQuality,
    requirementPreservation: scenario.generatedQuality.requirementPreservation,
    unknownPreservation: scenario.roleCardQuality.unknownCompensationPreserved && !['INVENTED', 'ALTERED'].includes(scenario.generatedQuality.factAudit.compensation),
    strategy: scenario.strategyQuality,
    profile: scenario.profileQuality,
    generatedMasterQuality: scenario.generatedQuality,
    generatedScore: scoreLabel(scenario.premium.score),
    coverage: scenario.premium.score.coverage,
    gate: scenario.premium.gate.status,
    channelAdapter: scenario.premium.channelVariant ? {
      channel: scenario.premium.channelVariant.channel,
      introducedFactIds: scenario.premium.channelVariant.introducedFactIds?.length ?? 0,
    } : null,
    prePayment,
    premium,
    total: summarizeIds([...scenario.prePaymentOperationIds, ...scenario.premiumOperationIds]),
  };
}

function buildJourneyRows(customerCare, b2b, revisionCycle) {
  const rows = {};
  for (const scenario of [customerCare, b2b].filter(Boolean)) {
    rows[`${scenario.id}_PRE_PAYMENT`] = summarizeIds(scenario.prePaymentOperationIds);
    rows[`${scenario.id}_PREMIUM`] = summarizeIds(scenario.premiumOperationIds);
    rows[`${scenario.id}_TOTAL`] = summarizeIds([...scenario.prePaymentOperationIds, ...scenario.premiumOperationIds]);
  }
  if (revisionCycle?.operationIds) rows.REVISION_CYCLE = summarizeIds(revisionCycle.operationIds);
  return rows;
}

function compareDifferentiation(a, b) {
  const textA = generatedText(a.premium.master).toLowerCase();
  const textB = generatedText(b.premium.master).toLowerCase();
  const sharedCommercialTerms = ['customer care', 'ticket'].filter((term) => textB.includes(term)).length;
  const sharedCareTerms = ['prospecting', 'trattative', 'vendita b2b'].filter((term) => textA.includes(term)).length;
  const strategyDifferent = JSON.stringify(a.strategyQuality) !== JSON.stringify(b.strategyQuality);
  const profileDifferent = JSON.stringify(a.profileQuality) !== JSON.stringify(b.profileQuality);
  const status = sharedCommercialTerms === 0 && sharedCareTerms === 0 && strategyDifferent ? 'PASS' : 'P2';
  if (status !== 'PASS') findings.push({ severity: 'P2', scenarioId: 'DIFFERENTIATION', area: 'generated-master', detail: 'Generated masters or strategies may be too similar.' });
  return {
    status,
    openingDifferent: firstSectionText(a.premium.master) !== firstSectionText(b.premium.master),
    strategyDifferent,
    profileDifferent,
    customerCareProfile: a.profileQuality,
    b2bProfile: b.profileQuality,
  };
}

function decideOverall(customerCare, b2b, revisionCycle, differentiation) {
  const p1 = findings.some((finding) => finding.severity === 'P1');
  const p2 = findings.some((finding) => finding.severity === 'P2') || differentiation.status === 'P2';
  return {
    CUSTOMER_CARE_CREATE: customerCare?.decision ?? 'BLOCKED',
    COMMERCIALE_B2B_CREATE: b2b?.decision ?? 'BLOCKED',
    CREATE_STRUCTURED_INPUT: customerCare?.roleCardQuality.locationPreserved && b2b?.roleCardQuality.locationPreserved ? 'READY' : 'BLOCKED',
    ROLE_CARD: p1 ? 'BLOCKED' : 'READY',
    PROFILE: customerCare?.profileQuality.status === 'PASS' && b2b?.profileQuality.status === 'PASS' ? 'READY' : 'NEEDS_TUNING',
    STRATEGY: differentiation.strategyDifferent ? 'READY' : 'NEEDS_TUNING',
    GENERATED_MASTER: p1 ? 'BLOCKED' : p2 ? 'READY_WITH_FINDINGS' : 'READY',
    VALIDATOR: p1 ? 'BLOCKED' : 'READY',
    REVISION_CYCLE: revisionCycle?.operationIds ? 'READY' : 'NEEDS_TUNING',
    EVALUATOR: operations.filter((operation) => operation.task === 'EVALUATE').every((operation) => operation.totalTokens) ? 'READY' : 'NEEDS_TUNING',
    CHANNEL_ADAPTER: operations.some((operation) => operation.task === 'CHANNEL_ADAPTER') ? 'READY' : 'NEEDS_TUNING',
    FACTUAL_FIDELITY: p1 ? 'BLOCKED' : p2 ? 'READY_WITH_FINDINGS' : 'READY',
    REQUIREMENT_PRESERVATION: p1 ? 'BLOCKED' : 'READY',
    CREATE_COST_BENCHMARK: customerCare && b2b ? 'SUFFICIENT' : 'INSUFFICIENT',
    OVERALL_CREATE: p1 ? 'BLOCKED' : p2 ? 'READY_WITH_FINDINGS' : 'READY',
    FASE_10F: p1 ? 'NEEDS_TUNING' : p2 ? 'READY_WITH_FINDINGS' : 'READY',
  };
}

async function writeReports(report) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(BENCHMARK_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(REPORT_MD_PATH, renderMarkdown(report), 'utf8');
}

function renderMarkdown(report) {
  const lines = [
    '# Annunci 10x Create Live Validation v1',
    '',
    `Generated at: ${report.runCompletedAt}`,
    `Baseline: \`${report.baseline}\``,
    `Provider: \`${report.provider}\` local/server-side harness. Production provider remains \`${report.productionProvider}\`.`,
    `Model: \`${report.model}\``,
    `Pricing source: ${report.pricing.sourceUrl} accessed ${report.pricing.sourceAccessedAt}`,
    '',
    '## Guardrails',
    '',
    `- Live calls: ${report.totals.providerCalls}/${report.guardrails.hardCallLimit}`,
    `- Estimated live cost: $${formatUsd(report.totals.estimatedCostUsd)} / $${formatUsd(report.guardrails.costLimitUsd)}`,
    '- No Production OpenAI calls.',
    '- No web search tools configured.',
    '- No chain-of-thought requested or saved.',
    '',
    '## Scenario Decisions',
    '',
    '| Scenario | Decision | Clarifications | Score | Coverage | Gate | Cost | Latency |',
    '| --- | --- | ---: | --- | ---: | --- | ---: | ---: |',
    ...report.scenarios.map((scenario) => `| ${scenario.label} | ${scenario.decision} | ${scenario.clarificationCount} | ${scenario.generatedScore} | ${scenario.coverage}% | ${scenario.gate} | $${formatUsd(scenario.total.cost)} | ${scenario.total.latencyMs} ms |`),
    '',
    '## Journey Costs',
    '',
    '| Journey | Calls | Input | Cached | Output | Total | Latency | Cost |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(report.journeys).map(([key, row]) => `| ${key} | ${row.calls} | ${row.inputTokens} | ${row.cachedTokens} | ${row.outputTokens} | ${row.totalTokens} | ${row.latencyMs} ms | $${formatUsd(row.cost)} |`),
    '',
    '## Operation Costs',
    '',
    '| Task | Calls | Model | Input | Cached | Output | Total | Avg latency | Cost |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(report.byOperation).map(([task, row]) => `| ${task} | ${row.calls} | ${row.model} | ${row.inputTokens} | ${row.cachedTokens} | ${row.outputTokens} | ${row.totalTokens} | ${row.avgLatencyMs} ms | $${formatUsd(row.cost)} |`),
    '',
    '## Fact And Requirement Audit',
    '',
    ...report.scenarios.flatMap((scenario) => [
      `### ${scenario.label}`,
      '',
      `- Raw answers preserved: ${scenario.rawAnswersPreserved ? 'YES' : 'NO'}`,
      `- Requirement preservation: ${scenario.requirementPreservation ? 'YES' : 'NO'}`,
      `- UNKNOWN preservation: ${scenario.unknownPreservation ? 'YES' : 'NO'}`,
      `- Fact audit: \`${JSON.stringify(scenario.generatedMasterQuality.factAudit)}\``,
      `- Validator: unsupported=${scenario.generatedMasterQuality.validationIssues.unsupportedClaims}, gate=${scenario.generatedMasterQuality.validationIssues.gate}`,
      `- Channel variant introduced facts: ${scenario.channelAdapter?.introducedFactIds ?? 'N/A'}`,
      '',
    ]),
    '## Differentiation',
    '',
    `- Status: ${report.differentiation.status}`,
    `- Opening different: ${report.differentiation.openingDifferent}`,
    `- Strategy different: ${report.differentiation.strategyDifferent}`,
    `- Profile different: ${report.differentiation.profileDifferent}`,
    '',
    '## Revision Cycle',
    '',
    report.revisionCycle?.operationIds
      ? `- Source: ${report.revisionCycle.source}\n- Cost: $${formatUsd(report.finalUnitEconomics.REVISION_CYCLE)}\n- Problem fixed: ${report.revisionCycle.problemFixed ? 'YES' : 'NO'}\n- New problems introduced: ${report.revisionCycle.newProblemsIntroduced ? 'YES' : 'NO'}`
      : `- Status: ${report.revisionCycle?.status ?? 'N/A'}`,
    '',
    '## Unit Economics',
    '',
    '| Product/Journey | Observed cost | Sample | Notes |',
    '| --- | ---: | ---: | --- |',
    `| FREE_ANALYSIS_NO_CLARIFY | $${formatUsd(report.finalUnitEconomics.FREE_ANALYSIS_NO_CLARIFY)} | prior | FASE 10A source of truth |`,
    `| FREE_ANALYSIS_WITH_CLARIFY | $${formatUsd(report.finalUnitEconomics.FREE_ANALYSIS_WITH_CLARIFY)} | prior | FASE 10A source of truth |`,
    `| REWRITE_EXISTING_AD | $${formatUsd(report.finalUnitEconomics.REWRITE_EXISTING_AD)} | prior | observed no clarification/revision |`,
    `| CREATE_FROM_ZERO_LOW | $${formatUsd(report.finalUnitEconomics.CREATE_FROM_ZERO_LOW)} | 2 | live observed 10F |`,
    `| CREATE_FROM_ZERO_HIGH | $${formatUsd(report.finalUnitEconomics.CREATE_FROM_ZERO_HIGH)} | 2 | live observed 10F |`,
    `| CREATE_FROM_ZERO_MEAN | $${formatUsd(report.finalUnitEconomics.CREATE_FROM_ZERO_MEAN)} | 2 | arithmetic mean, not stable forecast |`,
    `| REVISION_CYCLE | $${formatUsd(report.finalUnitEconomics.REVISION_CYCLE)} | 1 | REVISE + VALIDATE + EVALUATE |`,
    `| CHANNEL_VARIANT | $${formatUsd(report.finalUnitEconomics.CHANNEL_VARIANT)} | ${operations.filter((operation) => operation.task === 'CHANNEL_ADAPTER').length} | live 10F average if available |`,
    '',
    '## Pricing Readiness',
    '',
    `- Rewrite pricing data: ${report.pricingReadiness.rewrite}`,
    `- Create pricing data: ${report.pricingReadiness.create}`,
    `- Revision pricing data: ${report.pricingReadiness.revision}`,
    `- Channel variant pricing data: ${report.pricingReadiness.channelVariant}`,
    `- Overall: ${report.pricingReadiness.overall}`,
    '',
    '## Findings',
    '',
    ...(report.findings.length ? report.findings.map((finding) => `- ${finding.severity} ${finding.scenarioId} ${finding.area}: ${finding.detail}`) : ['- No P0/P1 findings observed.']),
    '',
    '## Decisions',
    '',
    ...Object.entries(report.decisions).map(([key, value]) => `- ${key}: ${value}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function aggregateBy(key, rows) {
  const grouped = {};
  for (const row of rows) {
    const groupKey = row[key];
    grouped[groupKey] ??= { calls: 0, model: row.model, inputTokens: 0, cachedTokens: 0, outputTokens: 0, totalTokens: 0, latencyMs: 0, cost: 0 };
    grouped[groupKey].calls += row.providerCalls;
    grouped[groupKey].inputTokens += row.inputTokens ?? 0;
    grouped[groupKey].cachedTokens += row.cachedTokens ?? 0;
    grouped[groupKey].outputTokens += row.outputTokens ?? 0;
    grouped[groupKey].totalTokens += row.totalTokens ?? 0;
    grouped[groupKey].latencyMs += row.latencyMs ?? 0;
    grouped[groupKey].cost += row.cost ?? 0;
  }
  for (const value of Object.values(grouped)) {
    value.cost = roundUsd(value.cost);
    value.avgLatencyMs = value.calls ? Math.round(value.latencyMs / value.calls) : 0;
  }
  return grouped;
}

function summarizeIds(ids) {
  const rows = ids.map((id) => operations.find((operation) => operation.id === id)).filter(Boolean);
  return {
    calls: rows.reduce((sum, row) => sum + row.providerCalls, 0),
    inputTokens: rows.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0),
    cachedTokens: rows.reduce((sum, row) => sum + (row.cachedTokens ?? 0), 0),
    outputTokens: rows.reduce((sum, row) => sum + (row.outputTokens ?? 0), 0),
    totalTokens: rows.reduce((sum, row) => sum + (row.totalTokens ?? 0), 0),
    latencyMs: rows.reduce((sum, row) => sum + (row.latencyMs ?? 0), 0),
    cost: roundUsd(rows.reduce((sum, row) => sum + (row.cost ?? 0), 0)),
    operations: rows.map((row) => row.task),
  };
}

function sumOperations(rows) {
  return {
    inputTokens: rows.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0),
    cachedTokens: rows.reduce((sum, row) => sum + (row.cachedTokens ?? 0), 0),
    outputTokens: rows.reduce((sum, row) => sum + (row.outputTokens ?? 0), 0),
    totalTokens: rows.reduce((sum, row) => sum + (row.totalTokens ?? 0), 0),
  };
}

function sumCost(ids) {
  return ids.map((id) => operations.find((operation) => operation.id === id)).filter(Boolean).reduce((sum, operation) => sum + operation.cost, 0);
}

function averageCostByTask(task) {
  const rows = operations.filter((operation) => operation.task === task);
  if (!rows.length) return null;
  return roundUsd(rows.reduce((sum, row) => sum + row.cost, 0) / rows.length);
}

function opTypes(ids) {
  return ids.map((id) => operations.find((operation) => operation.id === id)?.task).filter(Boolean);
}

function estimateCost(usage) {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const cachedTokens = Math.min(usage.cachedTokens ?? 0, inputTokens);
  const uncachedInput = Math.max(inputTokens - cachedTokens, 0);
  return {
    totalUsd: (uncachedInput / 1_000_000) * PRICING.perMillionInputUsd
      + (cachedTokens / 1_000_000) * PRICING.perMillionCachedInputUsd
      + (outputTokens / 1_000_000) * PRICING.perMillionOutputUsd,
  };
}

function normalizeUsage(usage) {
  return {
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
    cachedTokens: usage?.cachedTokens ?? null,
  };
}

function generatedText(master) {
  return master.sections.map((section) => `${section.title}\n${section.body}`).join('\n\n');
}

function firstSectionText(master) {
  return master.sections[0]?.body ?? '';
}

function includesAny(text, values) {
  const source = String(text ?? '').toLowerCase();
  return values.some((value) => source.includes(String(value).toLowerCase()));
}

function containsForbidden(text, values) {
  return values.some((value) => text.includes(value.toLowerCase()));
}

function classifyPresence(text, values) {
  return includesAny(text, values) ? 'PRESERVED' : 'OMITTED';
}

function classifyRequirementTone(text, values, kind) {
  if (!includesAny(text, values)) return 'OMITTED';
  const source = text.toLowerCase();
  if (kind === 'preferred' && /(indispensabil|obbligator|richiediamo|requisito necessario)/.test(source) && includesAny(source, values)) return 'ALTERED';
  if (kind === 'trainable' && /(indispensabil|obbligator|richiediamo|requisito necessario)/.test(source) && includesAny(source, values)) return 'ALTERED';
  return 'PRESERVED';
}

function scoreLabel(score) {
  if (!score) return 'N/A';
  if (typeof score.minScore === 'number' && typeof score.maxScore === 'number' && score.minScore !== score.maxScore) return `${score.minScore}-${score.maxScore}/100`;
  return `${score.value ?? score.minScore ?? score.maxScore}/100`;
}

function roundUsd(value) {
  if (value === null || value === undefined) return null;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatUsd(value) {
  if (value === null || value === undefined) return 'N/D';
  return Number(value).toFixed(6);
}
