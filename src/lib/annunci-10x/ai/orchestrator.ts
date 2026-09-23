import { createHash } from 'node:crypto';
import { calculateAnnunci10xScore } from '../score.ts';
import { evaluatePublicationGate, unconfirmedClaim } from '../gates.ts';
import type { AiOperationType, GeneratedAd, RoleCard } from '../types.ts';
import type { Annunci10xPersistenceAdapter, PersistedAiOperation } from '../persistence/types.ts';
import { Annunci10xAiError, sanitizeAiErrorPayload } from './errors.ts';
import { getAnnunci10xAiTimeoutMs, getAnnunci10xModelForOperation } from './models.ts';
import type { Annunci10xAiProvider, Annunci10xAiProviderResult } from './provider.ts';
import { getAnnunci10xPrompt } from './prompts/index.ts';
import { projectAnnunci10xAiInput } from './projections.ts';
import type {
  Annunci10xAiOutputByOperation,
  Annunci10xEvaluateOutput,
  Annunci10xGenerateOutput,
  Annunci10xValidateOutput,
} from './schemas.ts';
import { validateAiOutputForOperation } from './schemas.ts';

export interface Annunci10xRunAiTaskInput<T extends AiOperationType = AiOperationType> {
  sessionId: string;
  sessionSecret: string;
  operationType: T;
  input: Record<string, unknown>;
  inputSnapshotId?: string | null;
  idempotencyInputIdentityOverride?: string;
  promptVersionOverride?: string;
  model?: string;
  timeoutMs?: number;
}

export interface Annunci10xRunAiTaskResult<T extends AiOperationType = AiOperationType> {
  output: Annunci10xAiOutputByOperation[T];
  operation: PersistedAiOperation;
  provider: Annunci10xAiProviderResult['provider'];
  model: string;
  usage?: Annunci10xAiProviderResult['usage'];
  providerRequestId?: string | null;
  latencyMs: number;
  idempotencyHit: boolean;
  retryCount: 0 | 1;
}

export interface Annunci10xAiOrchestratorConfig {
  provider: Annunci10xAiProvider;
  persistence: Annunci10xPersistenceAdapter;
  env?: Record<string, string | undefined>;
}

export class Annunci10xAiOrchestrator {
  private readonly provider: Annunci10xAiProvider;
  private readonly persistence: Annunci10xPersistenceAdapter;
  private readonly env: Record<string, string | undefined>;

  constructor(config: Annunci10xAiOrchestratorConfig) {
    this.provider = config.provider;
    this.persistence = config.persistence;
    this.env = config.env ?? process.env;
  }

  async runTask<T extends AiOperationType>(input: Annunci10xRunAiTaskInput<T>): Promise<Annunci10xRunAiTaskResult<T>> {
    const prompt = getAnnunci10xPrompt(input.operationType);
    const promptVersion = input.promptVersionOverride ?? prompt.version;
    const model = input.model ?? getAnnunci10xModelForOperation(input.operationType, this.env);
    const projectedInput = projectAnnunci10xAiInput(input.operationType, input.input);
    const idempotencyKey = createAnnunci10xAiIdempotencyKey({
      sessionId: input.sessionId,
      operationType: input.operationType,
      inputIdentity: input.idempotencyInputIdentityOverride ?? input.inputSnapshotId ?? stableHash(projectedInput),
      promptVersion,
      model,
    });
    let operation = await this.persistence.startAiOperation({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      operationType: input.operationType,
      inputSnapshotId: input.inputSnapshotId ?? null,
      promptVersion,
      idempotencyKey,
      model,
    });

    if (operation.status === 'SUCCEEDED' && operation.outputPayload?.output !== undefined) {
      const output = validateAiOutputForOperation(input.operationType, operation.outputPayload.output) as Annunci10xAiOutputByOperation[T];
      return {
        output,
        operation,
        provider: providerName(operation.outputPayload.provider),
        model: String(operation.outputPayload.model ?? model),
        usage: usageFromPayload(operation.outputPayload.usage),
        providerRequestId: typeof operation.outputPayload.providerRequestId === 'string' ? operation.outputPayload.providerRequestId : null,
        latencyMs: typeof operation.outputPayload.latencyMs === 'number' ? operation.outputPayload.latencyMs : 0,
        idempotencyHit: true,
        retryCount: retryCountFromPayload(operation.outputPayload.retryCount),
      };
    }

    if (operation.status === 'FAILED') {
      throw new Annunci10xAiError('AI_PROVIDER_ERROR', 'Annunci 10x AI operation previously failed for the same idempotency key.');
    }

    try {
      const attempt = await this.executeAndValidate(input.operationType, prompt.instructions, projectedInput, prompt.outputSchema, model, input.timeoutMs ?? getAnnunci10xAiTimeoutMs(this.env), operation.id);
      operation = await this.persistence.completeAiOperation({
        operationId: operation.id,
        sessionSecret: input.sessionSecret,
        outputPayload: {
          output: attempt.output,
          provider: attempt.providerResult.provider,
          model,
          promptId: prompt.id,
          promptVersion,
          usage: attempt.providerResult.usage ?? null,
          providerRequestId: attempt.providerResult.providerRequestId ?? null,
          latencyMs: attempt.providerResult.latencyMs,
          retryCount: attempt.retryCount,
        },
      });
      return {
        output: attempt.output as Annunci10xAiOutputByOperation[T],
        operation,
        provider: attempt.providerResult.provider,
        model,
        usage: attempt.providerResult.usage,
        providerRequestId: attempt.providerResult.providerRequestId,
        latencyMs: attempt.providerResult.latencyMs,
        idempotencyHit: false,
        retryCount: attempt.retryCount,
      };
    } catch (error) {
      await this.persistence.failAiOperation({
        operationId: operation.id,
        sessionSecret: input.sessionSecret,
        errorPayload: sanitizeAiErrorPayload(error),
      });
      throw error;
    }
  }

  private async executeAndValidate(
    operationType: AiOperationType,
    systemPrompt: string,
    input: Record<string, unknown>,
    outputSchema: Record<string, unknown>,
    model: string,
    timeoutMs: number,
    operationId: string,
  ): Promise<{ output: Annunci10xAiOutputByOperation[keyof Annunci10xAiOutputByOperation]; providerResult: Annunci10xAiProviderResult; retryCount: 0 | 1 }> {
    const first = await this.provider.executeStructuredTask({
      operationType,
      systemPrompt,
      input,
      outputSchema: outputSchema as never,
      outputSchemaName: `annunci10x_${operationType.toLowerCase()}`,
      model,
      timeoutMs,
      operationId,
    });
    try {
      return { output: validateAiOutputForOperation(operationType, first.output), providerResult: first, retryCount: 0 };
    } catch (firstError) {
      const second = await this.provider.executeStructuredTask({
        operationType,
        systemPrompt: `${systemPrompt}\n\nSchema repair: return only a valid JSON object for the provided schema. Do not add explanations.`,
        input,
        outputSchema: outputSchema as never,
        outputSchemaName: `annunci10x_${operationType.toLowerCase()}`,
        model,
        timeoutMs,
        operationId,
      });
      try {
        return { output: validateAiOutputForOperation(operationType, second.output), providerResult: second, retryCount: 1 };
      } catch {
        throw new Annunci10xAiError('AI_INVALID_OUTPUT', `Annunci 10x AI output failed schema validation after one retry: ${(firstError as Error).message}`, { retryable: false });
      }
    }
  }
}

export interface GenerateValidateReviseInput {
  sessionId: string;
  sessionSecret: string;
  inputSnapshotId?: string | null;
  roleCard: RoleCard;
  roleProfile: unknown;
  communicationStrategy: unknown;
}

export interface GenerateValidateReviseResult {
  generated: Annunci10xGenerateOutput;
  firstValidation: Annunci10xValidateOutput;
  revision?: Annunci10xAiOutputByOperation['REVISE'];
  secondValidation?: Annunci10xValidateOutput;
  finalValidation: Annunci10xValidateOutput;
  needsVerification: boolean;
  automaticRevisionCount: 0 | 1;
}

export async function runGenerateValidateReviseCycle(orchestrator: Annunci10xAiOrchestrator, input: GenerateValidateReviseInput): Promise<GenerateValidateReviseResult> {
  const generatedResult = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'GENERATE',
    input: {
      roleCard: input.roleCard,
      roleProfile: input.roleProfile,
      communicationStrategy: input.communicationStrategy,
    },
    inputSnapshotId: input.inputSnapshotId ?? null,
  });
  const generated = generatedResult.output as Annunci10xGenerateOutput;
  const firstValidationResult = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'VALIDATE',
    input: { generatedAd: generated.generatedAd, roleCard: input.roleCard },
    inputSnapshotId: input.inputSnapshotId ?? null,
  });
  const firstValidation = firstValidationResult.output as Annunci10xValidateOutput;
  if (firstValidation.result === 'PASS' || firstValidation.result === 'BLOCK') {
    return {
      generated,
      firstValidation,
      finalValidation: firstValidation,
      needsVerification: firstValidation.result !== 'PASS',
      automaticRevisionCount: 0,
    };
  }

  const revisionResult = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'REVISE',
    input: { currentMaster: generated.generatedAd, roleCard: input.roleCard, communicationStrategy: input.communicationStrategy, validationIssues: firstValidation },
    inputSnapshotId: input.inputSnapshotId ?? null,
  });
  const revision = revisionResult.output;
  const revisedMaster: GeneratedAd = { ...generated.generatedAd, sections: revision.revisedSections };
  const secondValidationResult = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'VALIDATE',
    input: { generatedAd: revisedMaster, roleCard: input.roleCard },
    inputSnapshotId: input.inputSnapshotId ?? null,
    promptVersionOverride: `${getAnnunci10xPrompt('VALIDATE').version}.post-revise`,
  });
  const secondValidation = secondValidationResult.output as Annunci10xValidateOutput;
  return {
    generated,
    firstValidation,
    revision,
    secondValidation,
    finalValidation: secondValidation,
    needsVerification: secondValidation.result !== 'PASS',
    automaticRevisionCount: 1,
  };
}

export function calculateScoreAndGateFromEvaluateOutput(output: Annunci10xEvaluateOutput) {
  const score = calculateAnnunci10xScore(output.checks.map((check) => ({
    id: check.id,
    status: check.status,
    evidence: check.evidence,
  })));
  const findings = output.checks
    .filter((check) => check.status === 'CONFLICT')
    .map((check) => unconfirmedClaim(`Rubric check ${check.id}: ${check.reason}`, 'WARNING'));
  return { score, gate: evaluatePublicationGate({ findings }) };
}

export function createAnnunci10xAiIdempotencyKey(input: {
  sessionId: string;
  operationType: AiOperationType;
  inputIdentity: string;
  promptVersion: string;
  model: string;
}): string {
  return `a10x_${stableHash(input)}`;
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function providerName(value: unknown): Annunci10xAiProviderResult['provider'] {
  return value === 'OPENAI' ? 'OPENAI' : 'MOCK';
}

function usageFromPayload(value: unknown): Annunci10xAiProviderResult['usage'] {
  if (typeof value !== 'object' || value === null) return undefined;
  return value as Annunci10xAiProviderResult['usage'];
}

function retryCountFromPayload(value: unknown): 0 | 1 {
  return value === 1 ? 1 : 0;
}
