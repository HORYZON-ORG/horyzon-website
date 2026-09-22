import { ANNUNCI10X_PROMPT_PACK_VERSION } from '../constants.ts';
import { ANNUNCI10X_RUBRIC } from '../rubric.ts';
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
    const conflict = /remoto.*presenza|presenza.*remoto/i.test(stringifyInput(request.input));
    return {
      extractedFacts: [
        { targetPath: 'title', value: 'Addetto pulizie', source: 'EXTRACTED', confidence: 94, evidence: 'Addetto pulizie' },
        { targetPath: 'responsibilities', value: 'Pulizia uffici e spazi comuni', source: 'EXTRACTED', confidence: 90, evidence: 'pulizia uffici' },
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
    return {
      checks: ANNUNCI10X_RUBRIC.checks.map((definition, index) => ({
        id: definition.id,
        status: index === 13 ? 'NOT_EVALUABLE' : index === 14 ? 'MISSING' : 'PASS',
        evidence: [`Evidence for ${definition.id}`],
        reason: index === 13 ? 'Not determinable from available facts.' : 'Fixture evidence.',
        suggestion: 'Keep evidence tied to confirmed facts.',
      })),
    };
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
      sections: [mockSection('section-1', 'TITLE', 'Titolo', body, ['answer-title'])],
      sourceOfTruth: true,
      generatedAt: '2026-09-22T00:00:00.000Z',
      promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
    },
    title: 'Addetto pulizie',
    metadata: { language: 'it' },
    sections: [mockSection('section-1', 'TITLE', 'Titolo', body, ['answer-title'])],
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
