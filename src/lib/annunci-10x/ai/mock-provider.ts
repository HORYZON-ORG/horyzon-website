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
  if (request.operationType === 'GENERATE') return mockGenerate(mode);
  if (request.operationType === 'VALIDATE') {
    if (mode === 'unsupported_claim' || /buoni pasto|leader di mercato|50000|50,000/i.test(stringifyInput(request.input))) {
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
    return makeMockEvaluation(request.input);
  }
  if (request.operationType === 'CHANNEL_ADAPTER') return mockChannelVariant();
  if (request.operationType === 'EDIT_CLASSIFIER') return classifyMockEdit(readEditRequest(request.input));
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

function mockGenerate(mode: MockAnnunci10xProviderMode): unknown {
  const body = mode === 'unsupported_claim'
    ? 'Addetto pulizie con buoni pasto e benefit non confermati.'
    : 'Addetto pulizie per pulizia uffici e spazi comuni.';
  return {
    generatedAd: {
      id: 'master-1',
      sessionId: 'session-1',
      kind: 'MASTER',
      sections: [
        mockSection('section-1', 'TITLE', 'Titolo', body, ['answer-title']),
        mockSection('section-2', 'RESPONSIBILITIES', 'Attivita', 'Pulizia uffici, corridoi e spazi comuni.', ['answer-responsibility']),
      ],
      sourceOfTruth: true,
      generatedAt: '2026-09-22T00:00:00.000Z',
      promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
    },
    title: 'Addetto pulizie',
    metadata: { language: 'it' },
    sections: [
      mockSection('section-1', 'TITLE', 'Titolo', body, ['answer-title']),
      mockSection('section-2', 'RESPONSIBILITIES', 'Attivita', 'Pulizia uffici, corridoi e spazi comuni.', ['answer-responsibility']),
    ],
    fullText: body,
    sourcePaths: ['title', 'responsibilities'],
  };
}

function mockChannelVariant(): unknown {
  return {
    channelVariant: {
      id: 'variant-1',
      masterAdId: 'master-1',
      channel: 'LINKEDIN',
      sections: [mockSection('section-1', 'TITLE', 'Titolo', 'Addetto pulizie - versione LinkedIn', ['answer-title'])],
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
