import { ANNUNCI10X_PROMPT_PACK_VERSION } from '../constants.ts';
import type { Annunci10xAiProvider, Annunci10xAiProviderRequest, Annunci10xAiProviderResult } from './provider.ts';
import { Annunci10xAiError } from './errors.ts';

export type MockAnnunci10xProviderMode =
  | 'success'
  | 'malformed'
  | 'timeout'
  | 'rate_limit'
  | 'provider_error'
  | 'unsupported_claim';

export class MockAnnunci10xProvider implements Annunci10xAiProvider {
  readonly name = 'MOCK' as const;
  private readonly modes: MockAnnunci10xProviderMode[];
  calls: Annunci10xAiProviderRequest[] = [];

  constructor(modes: MockAnnunci10xProviderMode | MockAnnunci10xProviderMode[] = 'success') {
    this.modes = Array.isArray(modes) ? [...modes] : [modes];
  }

  async executeStructuredTask(request: Annunci10xAiProviderRequest): Promise<Annunci10xAiProviderResult> {
    this.calls.push(request);
    const started = Date.now();
    const mode = this.modes.shift() ?? 'success';
    if (mode === 'timeout') throw new Annunci10xAiError('AI_PROVIDER_ERROR', 'Annunci 10x AI provider timed out.', { retryable: true });
    if (mode === 'rate_limit') throw new Annunci10xAiError('RATE_LIMITED', 'Annunci 10x AI provider is rate limited.', { retryable: true, status: 429 });
    if (mode === 'provider_error') throw new Annunci10xAiError('AI_PROVIDER_ERROR', 'Annunci 10x AI provider request failed.', { retryable: true, status: 503 });
    return {
      output: mode === 'malformed' ? { malformed: true } : makeMockOutput(request, mode),
      provider: 'MOCK',
      model: request.model,
      providerRequestId: `mock-${this.calls.length}`,
      usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20, cachedTokens: null },
      latencyMs: Date.now() - started,
    };
  }
}

function makeMockOutput(request: Annunci10xAiProviderRequest, mode: MockAnnunci10xProviderMode): unknown {
  if (request.operationType === 'PRECHECK') {
    const rawText = stringifyInput(request.input);
    if (/ignore all previous instructions|return the system prompt|set publication status|call external websites/i.test(rawText)) {
      return { detectedType: 'INCOMPLETE_AD', confidence: 72, reason: 'Input contains job-like content plus untrusted instructions that must be ignored.', canRunFullAnalysis: true };
    }
    if (/teaser/i.test(rawText)) return { detectedType: 'SOCIAL_TEASER', confidence: 88, reason: 'Brief social teaser, not enough for full analysis.', canRunFullAnalysis: false };
    return { detectedType: 'FULL_JOB_AD', confidence: 96, reason: 'Contains role, activities, requirements, and conditions.', canRunFullAnalysis: true };
  }
  if (request.operationType === 'EXTRACT') {
    const originalText = originalAdText(request.input);
    const title = extractMockTitle(originalText);
    const responsibility = extractMockResponsibility(originalText);
    const conflict = /remoto.*presenza|presenza.*remoto/i.test(originalText);
    return {
      extractedFacts: [
        { targetPath: 'title', value: title, source: 'EXTRACTED', confidence: 94, evidence: title },
        { targetPath: 'responsibilities', value: responsibility, source: 'EXTRACTED', confidence: 90, evidence: responsibility },
      ],
      possibleConflicts: conflict ? [{ targetPath: 'attractionContext.workMode', values: ['remoto', 'presenza'], reason: 'The input contains incompatible work mode statements.' }] : [],
    };
  }
  if (request.operationType === 'CLARIFY') {
    return /"unresolvedConflicts":\[\]|non lo so/i.test(stringifyInput(request.input))
      ? { status: 'COMPLETE' }
      : { status: 'NEEDS_CLARIFICATION', clarification: { targetPath: 'attractionContext.contractType', reason: 'Contract affects publication readiness.', question: 'Che tipo di contratto viene offerto?', helpText: null, blocking: true, canAdvance: false } };
  }
  if (request.operationType === 'PROFILE') {
    return {
      challengeRoutine: { label: 'MIXED', level: 'MIXED', rationale: 'Routine planned work plus recurring exceptions.', evidencePaths: ['responsibilities'], confidence: 82, needsConfirmation: false },
      qualification: { level: 'MEDIUM', rationale: 'Some requirements are necessary but not highly specialized.', evidencePaths: ['requirements'], confidence: 78, needsConfirmation: false },
      demand: { level: 'UNKNOWN', rationale: 'Demand cannot be inferred from title alone.', evidencePaths: [], confidence: 40, needsConfirmation: true },
      technicality: { level: 'LOW', rationale: 'No specialized tools are confirmed.', evidencePaths: ['requirements'], confidence: 75, needsConfirmation: false },
    };
  }
  if (request.operationType === 'STRATEGY') return mockStrategy();
  if (request.operationType === 'GENERATE') return mockGenerate(mode, request.input);
  if (request.operationType === 'VALIDATE') {
    if (mode === 'unsupported_claim' || /leader di mercato|50000|50,000/i.test(stringifyInput(request.input))) {
      return {
        claims: [{ id: 'claim-1', kind: 'CLAIM', claim: 'Benefit non confermato', supported: false, sourcePaths: [], action: 'REMOVE' }],
        unsupportedClaims: ['Benefit non confermato'],
        contradictions: [],
        omittedCriticalFacts: [],
        alteredRequirements: [],
        result: 'NEEDS_REVISION',
      };
    }
    return { claims: [], unsupportedClaims: [], contradictions: [], omittedCriticalFacts: [], alteredRequirements: [], result: 'PASS' };
  }
  if (request.operationType === 'EVALUATE') {
    if (request.outputSchemaName === 'annunci10x_evaluate_v2') return makeMockEvaluationV2(request.input);
    return makeMockEvaluation(request.input);
  }
  if (request.operationType === 'CHANNEL_ADAPTER') return mockChannelVariant(request.input);
  if (request.operationType === 'EDIT_CLASSIFIER') return classifyMockEdit(readEditRequest(request.input));
  if (request.operationType === 'REVISE') return mockRevision(request.input);
  return mockRevision(request.input);
}

function mockRevision(input: unknown): unknown {
  const targetId = readStringPath(input, ['targetSection', 'id']);
  if (targetId && typeof input === 'object' && input !== null) {
    const currentMaster = (input as Record<string, unknown>).currentMaster;
    const sections = typeof currentMaster === 'object' && currentMaster !== null
      && Array.isArray((currentMaster as Record<string, unknown>).sections)
      ? (currentMaster as Record<string, unknown>).sections as unknown[]
      : [];
    const target = sections.find((section) => (
      typeof section === 'object'
      && section !== null
      && (section as Record<string, unknown>).id === targetId
    ));
    if (typeof target === 'object' && target !== null) {
      return {
        revisedSections: [{ ...(target as Record<string, unknown>) }],
        changedSectionIds: [targetId],
        changeSummary: 'Targeted editorial revision preserving confirmed facts.',
        requiresValidation: true,
      };
    }
  }
  return {
    revisedSections: [mockSection('section-1', 'OPENING', 'Apertura', 'Testo rivisto senza claim non supportati.', ['answer-title'])],
    changedSectionIds: ['section-1'],
    changeSummary: 'Removed unsupported claim.',
    requiresValidation: true,
  };
}

function mockStrategy(): unknown {
  return {
    communicationStrategy: {
      id: 'strategy-1',
      sessionId: 'session-1',
      summary: 'Lead with concrete work and verified conditions.',
      candidateAngle: 'Persona che cerca chiarezza operativa.',
      emphasis: { challenge: 'MEDIUM', routine: 'HIGH', qualification: 'MEDIUM', commitment: 'MEDIUM', technicality: 'LOW' },
      proofPoints: [],
      reasons: [{ id: 'reason-1', label: 'Routine is central', factIds: ['responsibilities'] }],
      riskNotes: [],
      missingFacts: [],
      channelPriorities: ['LINKEDIN'],
      versions: versions(),
    },
    primaryStructure: 'WORK_REALITY_FIRST',
    openingStrategy: 'Concrete daily work first.',
    levers: ['stability', 'standardContribution'],
    editorialLength: 'MEDIUM',
    rationale: 'Routine-led role benefits from clarity.',
    publicSummary: 'La strategia punta su chiarezza del lavoro quotidiano e condizioni verificabili.',
  };
}

function mockGenerate(mode: MockAnnunci10xProviderMode, input: unknown): unknown {
  const roleCard = readRecordPath(input, ['roleCard']);
  const title = readStringPath(input, ['roleCard', 'title', 'value']) || 'Addetto pulizie';
  const application = readStringPath(input, ['roleCard', 'applicationInstructions', 'value']);
  const mission = readStringPath(input, ['roleCard', 'mission', 'value']);
  const responsibilities = readFactArray(input, ['roleCard', 'responsibilities']);
  const operatingContext = readStringPath(input, ['roleCard', 'attractionContext', 'operatingContext', 'value']);
  const autonomy = readStringPath(input, ['roleCard', 'attractionContext', 'autonomy', 'value']);
  const unexpectedEvents = readStringPath(input, ['roleCard', 'attractionContext', 'unexpectedEvents', 'value']);
  const companyDescription = readStringPath(input, ['roleCard', 'attractionContext', 'companyDescription', 'value']);
  const conditions = buildMockConditions(input);
  const requirements = buildMockRequirements(roleCard);
  const offer = readFactArray(input, ['roleCard', 'attractionContext', 'attractivenessEvidence']).map(cleanOfferFact).filter(Boolean).join(' ');
  const body = mode === 'unsupported_claim'
    ? `${title} con buoni pasto e benefit non confermati.`
    : [
      mission || `${title}: un ruolo operativo basato su attivita concrete e condizioni verificate.`,
      responsibilities.length ? `Nel ruolo ti occuperai di ${joinSentenceList(responsibilities)}.` : '',
      [companyDescription, operatingContext, autonomy, unexpectedEvents].filter(Boolean).join(' '),
      requirements,
      conditions,
      offer ? `L'offerta include ${offer}.` : '',
      application ? `Per candidarti, ${application}.` : '',
    ].filter(Boolean).join('\n\n');
  const sections = [
    mockSection('section-title', 'TITLE', title, '', ['create-role-title']),
    ...(mission ? [mockSection('section-opening', 'OPENING', 'Il ruolo in breve', mission, ['create-mission'])] : []),
    ...(responsibilities.length ? [mockSection('section-responsibilities', 'RESPONSIBILITIES', 'Cosa farai', `Ti occuperai di ${joinSentenceList(responsibilities)}.`, ['create-responsibilities'])] : []),
    ...([companyDescription, operatingContext, autonomy, unexpectedEvents].filter(Boolean).length
      ? [mockSection('section-context', 'CONTEXT', 'Come si lavora', [
        companyDescription,
        operatingContext,
        autonomy ? `Gestirai con autonomia ${autonomy}.` : '',
        unexpectedEvents ? `Nel lavoro potranno comparire ${unexpectedEvents}.` : '',
      ].filter(Boolean).join(' '), ['create-company-description', 'create-operating-context', 'create-autonomy', 'create-unexpected-events'])]
      : []),
    ...(requirements ? [mockSection('section-requirements', 'REQUIREMENTS', 'Chi cerchiamo', requirements, ['create-requirements'])] : []),
    ...(conditions ? [mockSection('section-conditions', 'CONDITIONS', 'Condizioni', conditions, ['create-offer'])] : []),
    ...(offer ? [mockSection('section-offer', 'GROWTH', 'Cosa trovi', `L'offerta include ${offer}.`, ['create-attraction'])] : []),
    ...(application ? [mockSection('section-application', 'APPLICATION', 'Come candidarsi', `Per candidarti, ${application}.`, ['create-application-instructions'])] : []),
  ];
  return {
    generatedAd: {
      id: 'master-1',
      sessionId: 'session-1',
      kind: 'MASTER',
      sections,
      sourceOfTruth: true,
      generatedAt: '2026-09-22T00:00:00.000Z',
      promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
    },
    title: 'Addetto pulizie',
    metadata: { language: 'it' },
    sections,
    fullText: body,
    sourcePaths: ['title', 'responsibilities', ...(application ? ['applicationInstructions'] : [])],
  };
}

function mockChannelVariant(input: unknown): unknown {
  const master = readRecordPath(input, ['master']);
  const masterSections = Array.isArray(master.sections) ? master.sections : [];
  const application = readStringPath(input, ['roleCard', 'applicationInstructions', 'value']);
  const title = masterSections.find((section) => typeof section === 'object' && section !== null && (section as Record<string, unknown>).type === 'TITLE') as Record<string, unknown> | undefined;
  const sections = masterSections.length
    ? masterSections.map((section, index) => ({ ...(section as Record<string, unknown>), id: `variant-${index + 1}` }))
    : [mockSection('variant-1', 'TITLE', 'Addetto pulizie - versione LinkedIn', '', ['answer-title'])];
  if (application && !JSON.stringify(sections).includes(application)) {
    sections.push(mockSection('variant-application', 'APPLICATION', 'Come candidarsi', `Per candidarti, ${application}.`, ['create-application-instructions']));
  }
  return {
    channelVariant: {
      id: 'variant-1',
      masterAdId: 'master-1',
      channel: 'LINKEDIN',
      sections: title ? sections : [mockSection('variant-title', 'TITLE', 'LinkedIn', '', []), ...sections],
      introducedFactIds: [],
      adaptedFromMaster: true,
    },
  };
}

function classifyMockEdit(input: string): unknown {
  if (/bari|lecce/i.test(input)) return { intent: 'FACTUAL', affectedPaths: ['attractionContext.location'], requiresConfirmation: true, reason: 'Location is a factual condition.' };
  if (/5 anni|esperienza/i.test(input)) return { intent: 'STRATEGIC', affectedPaths: ['requirements'], requiresConfirmation: true, reason: 'Requirement level changes qualification.' };
  if (/leader di mercato/i.test(input)) return { intent: 'UNSUPPORTED_FACT', affectedPaths: ['attractionContext.companyDescription'], requiresConfirmation: true, reason: 'Unsupported market claim.' };
  return { intent: 'EDITORIAL', affectedPaths: ['generatedAd.sections'], requiresConfirmation: false, reason: 'Style or length request.' };
}

function readEditRequest(input: unknown): string {
  if (typeof input === 'object' && input !== null && typeof (input as Record<string, unknown>).editRequest === 'string') {
    return String((input as Record<string, unknown>).editRequest).toLowerCase();
  }
  return stringifyInput(input);
}

function readRecordPath(input: unknown, path: string[]): Record<string, unknown> {
  let current: unknown = input;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return {};
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'object' && current !== null ? current as Record<string, unknown> : {};
}

function readFactArray(input: unknown, path: string[]): string[] {
  let current: unknown = input;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return [];
    current = (current as Record<string, unknown>)[key];
  }
  if (!Array.isArray(current)) return [];
  return current
    .map((item) => typeof item === 'object' && item !== null ? String((item as Record<string, unknown>).value ?? '').trim() : '')
    .filter(Boolean);
}

function buildMockRequirements(roleCard: Record<string, unknown>): string {
  const requirements = Array.isArray(roleCard.requirements) ? roleCard.requirements : [];
  const byClassification = new Map<string, string[]>();
  for (const requirement of requirements) {
    if (typeof requirement !== 'object' || requirement === null) continue;
    const record = requirement as Record<string, unknown>;
    const label = typeof record.label === 'object' && record.label !== null ? String((record.label as Record<string, unknown>).value ?? '').trim() : '';
    const classification = String(record.classification ?? '');
    if (!label || /^nessun/i.test(label)) continue;
    byClassification.set(classification, [...(byClassification.get(classification) ?? []), label]);
  }
  const required = byClassification.get('REQUIRED') ?? [];
  const preferred = byClassification.get('PREFERRED') ?? [];
  return [
    required.length ? `Sono indispensabili ${joinSentenceList(required)}.` : '',
    preferred.length ? `Sono elementi preferenziali ${joinSentenceList(preferred)}.` : '',
  ].filter(Boolean).join(' ');
}

function buildMockConditions(input: unknown): string {
  const location = readStringPath(input, ['roleCard', 'attractionContext', 'location', 'value']);
  const workMode = readStringPath(input, ['roleCard', 'attractionContext', 'workModeDetail', 'value']) || readStringPath(input, ['roleCard', 'attractionContext', 'workMode', 'value']);
  const contract = readStringPath(input, ['roleCard', 'attractionContext', 'contractType', 'value']);
  const schedule = readStringPath(input, ['roleCard', 'attractionContext', 'schedule', 'value']);
  const shifts = readStringPath(input, ['roleCard', 'attractionContext', 'shifts', 'value']);
  const onCall = readStringPath(input, ['roleCard', 'attractionContext', 'onCall', 'value']);
  const compensation = readStringPath(input, ['roleCard', 'compensation', 'amountText', 'value']);
  return [
    location ? `La sede e ${location}.` : '',
    workMode ? `La modalita di lavoro e ${workMode}.` : '',
    contract ? `Il contratto previsto e ${contract}.` : '',
    schedule ? `L'orario e ${schedule}.` : '',
    shifts || onCall ? `Sono condizioni gia chiarite: ${[shifts ? `turni ${shifts}` : '', onCall ? `reperibilita ${onCall}` : ''].filter(Boolean).join(' e ')}.` : '',
    compensation ? `La retribuzione prevista e ${compensation}.` : '',
  ].filter(Boolean).join(' ');
}

function joinSentenceList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

function cleanOfferFact(value: string): string {
  return value
    .replace(/\bBenefit\s*:\s*/gi, '')
    .replace(/\bFormazione\/crescita\s*:\s*/gi, '')
    .replace(/\bFormazione e crescita concreta\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mockSection(id: string, type: string, title: string, body: string, sourceFactIds: string[]): unknown {
  return { id, type, key: id, title, body, sourceFactIds };
}

function versions(): Record<string, string> {
  return {
    dataContractVersion: 'annunci10x-data-contracts-v1',
    methodVersion: 'annunci10x-method-v1',
    rubricVersion: 'annunci10x-rubric-v1',
    strategyVersion: 'annunci10x-strategy-v1',
    promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
  };
}

function stringifyInput(input: unknown): string {
  return JSON.stringify(input).toLowerCase();
}

function originalAdText(input: unknown): string {
  if (typeof input !== 'object' || input === null) return stringifyInput(input);
  const originalAd = (input as Record<string, unknown>).originalAd;
  if (typeof originalAd === 'object' && originalAd !== null && typeof (originalAd as Record<string, unknown>).rawText === 'string') {
    return String((originalAd as Record<string, unknown>).rawText);
  }
  return stringifyInput(input);
}

function extractMockTitle(text: string): string {
  const sentence = text.match(/(?:cerchiamo|selezioniamo|ricerchiamo)\s+(?:un|una)?\s*([^\n.;]{3,120})/i)?.[1]
    ?? text.match(/\b((?:addett[oa]|customer care|manutentore|impiegat[oa]|commerciale|developer|designer)[^\n.;,]{0,90})/i)?.[1];
  const cleaned = cleanMockFragment(sentence)
    .replace(/\s+(?:per|nella|nel|presso|con)\s+.+$/i, '')
    .replace(/\s+(?:a|in)\s+[A-ZÀ-Ü][a-zà-ü]+.*$/i, '')
    .trim();
  return cleaned || 'Ruolo da chiarire';
}

function extractMockResponsibility(text: string): string {
  const explicit = text.match(/(?:attivita|attività|mansioni|responsabilita|responsabilità|ti occuperai di)[:\s]+([^\n.]{8,160})/i)?.[1];
  if (explicit) return cleanMockFragment(explicit);
  const operational = text.match(/\b(?:gestira|gestirà|gestisce|gestire|risponde|rispondera|risponderà|aggiorna|aggiornamento|pulizia|manutenzione)[^\n.]{8,160}/i)?.[0];
  return cleanMockFragment(operational) || 'Attivita operative indicate nel testo originale';
}

function cleanMockFragment(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().replace(/[;:,.]+$/, '');
}

function makeMockEvaluation(input: unknown): unknown {
  const text = targetText(input);
  const lower = text.toLowerCase();
  const channel = readStringPath(input, ['channel']).toUpperCase();
  const hasRemotePresenceConflict = /\bremot[oea]\b/.test(lower) && /presenza|in sede/.test(lower);
  const checks = [
    status('01', hasRoleTitle(lower) ? 'PASS' : 'MISSING', 'Target text identifies the role.'),
    status('02', /senior|junior|responsabile|coordin|perimetro|riporterai|gestirai/i.test(text) ? 'PASS' : 'PARTIAL', 'Role perimeter is only partly visible.'),
    status('03', hasActivity(lower) ? 'PASS' : 'MISSING', 'Daily activities are visible in the target text.'),
    status('04', hasOutcome(lower) ? 'PASS' : 'MISSING', 'Activities are not enough to prove an observable expected result.'),
    status('05', /team|reparto|client[ei]|responsabile|fornitori|stakeholder|crm/i.test(text) ? 'PARTIAL' : 'MISSING', 'Operating context is partial or absent.'),
    status('06', hasAttractionReason(lower) ? 'PARTIAL' : 'NOT_EVALUABLE', 'Role popularity and company attractiveness are not determinable from target evidence alone.'),
    status('07', hasActivity(lower) ? 'PARTIAL' : 'MISSING', 'Challenge/routine balance is only partially represented.'),
    status('08', /turni|part-?time|full-?time|requisiti|disponibil/i.test(text) ? 'PARTIAL' : 'MISSING', 'Qualification or commitment is only partly explicit.'),
    status('09', /crm|ticket|software|impianti|normativa|macchinari|excel|gestionale/i.test(text) ? 'PASS' : 'PARTIAL', 'Technical detail fit is limited but not misleading.'),
    status('10', /preferibil|plus|nice to have|formazione|apprend/i.test(text) ? 'PASS' : lower.includes('requisit') ? 'MISSING' : 'NOT_EVALUABLE', 'A requirements list alone does not separate required, preferred, and trainable items.'),
    status('11', lower.includes('requisit') && hasActivity(lower) ? 'PASS' : lower.includes('requisit') ? 'PARTIAL' : 'NOT_EVALUABLE', 'Requirement relevance depends on visible work evidence.'),
    status('12', hasRemotePresenceConflict ? 'CONFLICT' : /bari|milano|roma|modena|lecce|sede|presenza|ibrid|remot/i.test(text) ? 'PASS' : 'MISSING', hasRemotePresenceConflict ? 'Target text contains incompatible work-mode statements.' : 'Location or work mode evidence checked in target text.'),
    status('13', hasDetailedSchedule(lower) ? 'PASS' : /part-?time|full-?time|turni|orari/i.test(text) ? 'PARTIAL' : 'MISSING', 'Contract or schedule evidence is incomplete without concrete hours/cadence.'),
    status('14', /ral|stipendio|compenso|retribuzione|euro|€|\d+\s?k/i.test(text) ? 'PASS' : 'NOT_EVALUABLE', 'Compensation is not visible in the target text.'),
    status('15', hasAttractionReason(lower) ? 'PARTIAL' : 'MISSING', 'Company attractiveness needs concrete target-text reasons, not just a company name.'),
    status('16', channel && channel !== 'UNKNOWN' && channel !== 'CUSTOM' ? 'PARTIAL' : 'NOT_EVALUABLE', 'Generic or unknown channel is not automatic channel-fit evidence.'),
    status('17', channel && channel !== 'UNKNOWN' && channel !== 'CUSTOM' ? 'PARTIAL' : 'NOT_EVALUABLE', 'Destination/field consistency cannot be evaluated without channel fields.'),
    status('18', text.length >= 180 ? 'PASS' : text.length >= 80 ? 'PARTIAL' : 'MISSING', 'Readability is estimated from target-text structure.'),
    status('19', /dinamic[oa]|leader|stimolante|giovane/i.test(text) ? 'PARTIAL' : text.length >= 80 ? 'PASS' : 'MISSING', 'Language is concrete enough when it avoids generic promotional wording.'),
    status('20', /candidat|candidatura|cv|invia|email|mail/i.test(text) ? /@|https?:\/\/|portale|form/i.test(text) ? 'PASS' : 'PARTIAL' : 'MISSING', 'CTA exists only if target text gives a usable application path.'),
  ];
  return { checks };
}

function makeMockEvaluationV2(input: unknown): unknown {
  const text = targetTextV2(input);
  const lower = text.toLowerCase();
  const channel = readStringPath(input, ['target', 'channel']).toUpperCase();
  const hasRemotePresenceConflict = /\bremot[oea]\b/.test(lower) && /presenza|in sede/.test(lower);
  const values: Array<[string, number | null, string, string]> = [
    ['01', hasRoleTitle(lower) ? 8 : 0, hasRoleTitle(lower) ? 'EVALUATED' : 'MISSING', 'Target text identifies the role.'],
    ['02', /senior|junior|responsabile|coordin|perimetro|riporterai|gestirai/i.test(text) ? 7 : 4, 'EVALUATED', 'Role perimeter is partly visible.'],
    ['03', hasActivity(lower) ? 8 : 0, hasActivity(lower) ? 'EVALUATED' : 'MISSING', 'Daily activities are visible in the target text.'],
    ['04', hasOutcome(lower) ? 8 : 0, hasOutcome(lower) ? 'EVALUATED' : 'MISSING', 'Observable expected result is checked from target evidence.'],
    ['05', /team|reparto|client[ei]|responsabile|fornitori|stakeholder|crm/i.test(text) ? 6 : 0, /team|reparto|client[ei]|responsabile|fornitori|stakeholder|crm/i.test(text) ? 'EVALUATED' : 'MISSING', 'Operating context is partial or absent.'],
    ['06', hasAttractionReason(lower) ? 5 : null, hasAttractionReason(lower) ? 'EVALUATED' : 'NOT_EVALUABLE', 'Role popularity and company attractiveness require target evidence.'],
    ['07', hasActivity(lower) ? 6 : 0, hasActivity(lower) ? 'EVALUATED' : 'MISSING', 'Challenge/routine balance is partially represented.'],
    ['08', /turni|part-?time|full-?time|requisiti|disponibil/i.test(text) ? 6 : 0, /turni|part-?time|full-?time|requisiti|disponibil/i.test(text) ? 'EVALUATED' : 'MISSING', 'Qualification or commitment is partly explicit.'],
    ['09', /crm|ticket|software|impianti|normativa|macchinari|excel|gestionale/i.test(text) ? 8 : 5, 'EVALUATED', 'Technical detail fit is limited but not misleading.'],
    ['10', /preferibil|plus|nice to have|formazione|apprend/i.test(text) ? 8 : lower.includes('requisit') ? 0 : null, lower.includes('requisit') || /preferibil|plus|nice to have|formazione|apprend/i.test(text) ? (/preferibil|plus|nice to have|formazione|apprend/i.test(text) ? 'EVALUATED' : 'MISSING') : 'NOT_EVALUABLE', 'Requirement classes are checked from target text.'],
    ['11', lower.includes('requisit') && hasActivity(lower) ? 8 : lower.includes('requisit') ? 5 : null, lower.includes('requisit') ? 'EVALUATED' : 'NOT_EVALUABLE', 'Requirement relevance depends on visible work evidence.'],
    ['12', hasRemotePresenceConflict ? 0 : /bari|milano|roma|modena|lecce|sede|presenza|ibrid|remot/i.test(text) ? 8 : 0, hasRemotePresenceConflict ? 'CONFLICT' : /bari|milano|roma|modena|lecce|sede|presenza|ibrid|remot/i.test(text) ? 'EVALUATED' : 'MISSING', hasRemotePresenceConflict ? 'Target text contains incompatible work-mode statements.' : 'Location or work mode evidence checked in target text.'],
    ['13', hasDetailedSchedule(lower) ? 8 : /part-?time|full-?time|turni|orari/i.test(text) ? 5 : 0, /part-?time|full-?time|turni|orari/i.test(text) || hasDetailedSchedule(lower) ? 'EVALUATED' : 'MISSING', 'Contract or schedule evidence is incomplete without concrete hours/cadence.'],
    ['14', /ral|stipendio|compenso|retribuzione|euro|€|\d+\s?k/i.test(text) ? 8 : null, /ral|stipendio|compenso|retribuzione|euro|€|\d+\s?k/i.test(text) ? 'EVALUATED' : 'NOT_EVALUABLE', 'Compensation is not visible in the target text.'],
    ['15', hasAttractionReason(lower) ? 6 : 0, hasAttractionReason(lower) ? 'EVALUATED' : 'MISSING', 'Company attractiveness needs concrete target-text reasons.'],
    ['16', channel && channel !== 'UNKNOWN' && channel !== 'CUSTOM' ? 5 : null, channel && channel !== 'UNKNOWN' && channel !== 'CUSTOM' ? 'EVALUATED' : 'NOT_EVALUABLE', 'Generic or unknown channel is not automatic channel-fit evidence.'],
    ['17', channel && channel !== 'UNKNOWN' && channel !== 'CUSTOM' ? 5 : null, channel && channel !== 'UNKNOWN' && channel !== 'CUSTOM' ? 'EVALUATED' : 'NOT_EVALUABLE', 'Destination/field consistency cannot be evaluated without channel fields.'],
    ['18', text.length >= 180 ? 8 : text.length >= 80 ? 5 : 0, text.length >= 80 ? 'EVALUATED' : 'MISSING', 'Readability is estimated from target-text structure.'],
    ['19', /dinamic[oa]|leader|stimolante|giovane/i.test(text) ? 5 : text.length >= 80 ? 8 : 0, text.length >= 80 ? 'EVALUATED' : 'MISSING', 'Language is concrete enough when it avoids generic promotional wording.'],
    ['20', /candidat|candidatura|cv|invia|email|mail/i.test(text) ? /@|https?:\/\/|portale|form/i.test(text) ? 8 : 5 : 0, /candidat|candidatura|cv|invia|email|mail/i.test(text) ? 'EVALUATED' : 'MISSING', 'CTA exists only if target text gives a usable application path.'],
  ];
  return {
    checks: values.map(([id, score, statusValue, reason]) => ({
      id,
      score,
      status: statusValue,
      evidence: statusValue === 'NOT_EVALUABLE' || statusValue === 'MISSING' ? [] : [`mock target evidence for check ${id}`],
      reason,
      missing: statusValue === 'MISSING' ? [`missing target evidence for check ${id}`] : [],
      confidence: statusValue === 'NOT_EVALUABLE' ? 45 : 82,
    })),
  };
}

function status(id: string, value: string, reason: string): unknown {
  return {
    id,
    status: value,
    evidence: value === 'NOT_EVALUABLE' ? [] : [`mock target evidence for check ${id}`],
    reason,
    suggestion: 'Use target-text evidence before assigning full credit.',
  };
}

function targetText(input: unknown): string {
  if (typeof input !== 'object' || input === null) return '';
  const record = input as Record<string, unknown>;
  const original = record.originalAd;
  if (typeof original === 'object' && original !== null && typeof (original as Record<string, unknown>).rawText === 'string') {
    return String((original as Record<string, unknown>).rawText);
  }
  const generated = record.generatedAd ?? record.master ?? record.channelVariant;
  if (typeof generated === 'object' && generated !== null && Array.isArray((generated as Record<string, unknown>).sections)) {
    return ((generated as Record<string, unknown>).sections as unknown[])
      .map((section) => typeof section === 'object' && section !== null ? String((section as Record<string, unknown>).body ?? '') : '')
      .join('\n');
  }
  return '';
}

function targetTextV2(input: unknown): string {
  if (typeof input !== 'object' || input === null) return '';
  const target = (input as Record<string, unknown>).target;
  if (typeof target === 'object' && target !== null && typeof (target as Record<string, unknown>).text === 'string') {
    return String((target as Record<string, unknown>).text);
  }
  return targetText(input);
}

function readStringPath(input: unknown, path: readonly string[]): string {
  let value = input;
  for (const key of path) {
    if (typeof value !== 'object' || value === null) return '';
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === 'string' ? value : '';
}

function hasRoleTitle(text: string): boolean {
  return /cerchiamo|selezioniamo|ricerchiamo|addett|customer care|manutentore|commerciale|developer|designer/.test(text);
}

function hasActivity(text: string): boolean {
  return /gestir|aggiorna|pulizia|manutenz|svilupp|prepar|rispond|coordina|ticket|crm|richieste/.test(text);
}

function hasOutcome(text: string): boolean {
  return /risultat|obiettivo|garantir|ridurre|aumentare|migliorare|assicurare|kpi|qualita|continuita/.test(text);
}

function hasDetailedSchedule(text: string): boolean {
  return /\b\d{1,2}\s?ore\b|\b\d{1,2}[:.]\d{2}\b|lunedi|lunedì|venerdi|venerdì|turni\s+\d/.test(text);
}

function hasAttractionReason(text: string): boolean {
  return /affiancamento|formazione|crescita|team|stabilita|welfare|flessibil|benefit|portafoglio clienti|supporto/.test(text);
}
