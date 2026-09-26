import { createHash } from 'node:crypto';

import {
  ANNUNCI10X_RUBRIC_VERSION_V2,
  ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
} from '../constants.ts';
import { calculateAnnunci10xScoreV2 } from '../score-v2.ts';
import type { ScoreResultV2 } from '../types-v2.ts';
import { Annunci10xAiError } from './errors.ts';
import { getAnnunci10xAiTimeoutMs, getAnnunci10xModelForOperation } from './models.ts';
import {
  ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2,
  EVALUATE_PROMPT_V2,
} from './prompts/evaluate-v2.ts';
import type { Annunci10xAiProvider, Annunci10xAiProviderResult, Annunci10xAiUsage } from './provider.ts';
import { validateEvaluateOutputV2, type Annunci10xEvaluateOutputV2 } from './schemas-v2.ts';

export type Annunci10xEvaluateTargetKindV2 = 'ORIGINAL_AD' | 'GENERATED_MASTER' | 'CHANNEL_VARIANT';

export interface Annunci10xEvaluateTargetV2 {
  kind: Annunci10xEvaluateTargetKindV2;
  text: string;
  channel?: string | null;
  structuredFields?: Record<string, unknown> | null;
  applicationDestination?: string | Record<string, unknown> | null;
  channelPolicy?: Record<string, unknown> | null;
}

export interface Annunci10xEvaluateContextV2 {
  roleCard?: unknown;
  roleProfile?: unknown;
  communicationStrategy?: unknown;
}

export interface Annunci10xEvaluateInputV2 {
  target: Annunci10xEvaluateTargetV2;
  context?: Annunci10xEvaluateContextV2 | null;
}

export interface RunAnnunci10xEvaluateV2Options {
  input: Annunci10xEvaluateInputV2;
  provider: Annunci10xAiProvider;
  model?: string;
  timeoutMs?: number;
  operationId?: string;
  env?: Record<string, string | undefined>;
}

export interface RunAnnunci10xEvaluateV2Result extends Annunci10xEvaluateOutputV2 {
  score: ScoreResultV2;
  provider: Annunci10xAiProviderResult['provider'];
  model: string;
  usage?: Annunci10xAiUsage;
  latencyMs: number;
  retryCount: number;
  promptVersion: typeof ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2;
  rubricVersion: typeof ANNUNCI10X_RUBRIC_VERSION_V2;
  scoreSemanticsVersion: typeof ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2;
  operationId: string;
  providerRequestId?: string | null;
}

export function projectEvaluateInputV2(input: Annunci10xEvaluateInputV2): Annunci10xEvaluateInputV2 {
  return {
    target: {
      kind: input.target.kind,
      text: input.target.text,
      channel: input.target.channel ?? null,
      structuredFields: sanitizeTargetValue(input.target.structuredFields ?? null) as Record<string, unknown> | null,
      applicationDestination: sanitizeTargetValue(input.target.applicationDestination ?? null) as string | Record<string, unknown> | null,
      channelPolicy: sanitizeTargetValue(input.target.channelPolicy ?? null) as Record<string, unknown> | null,
    },
    context: projectEvaluateContextV2(input.context ?? {}),
  };
}

export function projectEvaluateContextV2(context: Annunci10xEvaluateContextV2): Annunci10xEvaluateContextV2 {
  return {
    roleCard: sanitizeContextValue(context.roleCard),
    roleProfile: sanitizeContextValue(context.roleProfile),
    communicationStrategy: sanitizeContextValue(context.communicationStrategy),
  };
}

export async function runAnnunci10xEvaluateV2(options: RunAnnunci10xEvaluateV2Options): Promise<RunAnnunci10xEvaluateV2Result> {
  const env = options.env ?? process.env;
  const model = options.model ?? getAnnunci10xModelForOperation('EVALUATE', env);
  const timeoutMs = options.timeoutMs ?? getAnnunci10xAiTimeoutMs(env);
  const projectedInput = projectEvaluateInputV2(options.input);
  const operationId = options.operationId ?? createEvaluateOperationIdV2({ input: projectedInput, model });

  const first = await executeEvaluateRequestV2({
    provider: options.provider,
    input: projectedInput,
    model,
    timeoutMs,
    operationId,
    systemPrompt: EVALUATE_PROMPT_V2.instructions,
  });
  const firstParsed = tryValidateEvaluateOutputV2(first.output);
  if (firstParsed.ok) return buildEvaluateResultV2(firstParsed.output, first, operationId, 0);

  const repair = await executeEvaluateRequestV2({
    provider: options.provider,
    input: projectedInput,
    model,
    timeoutMs,
    operationId,
    systemPrompt: [
      EVALUATE_PROMPT_V2.instructions,
      '',
      'SCHEMA REPAIR: The previous response did not match the required JSON schema or V2 validation rules. Return only a corrected JSON object with exactly 20 checks and no provider-owned aggregate fields.',
    ].join('\n'),
  });
  const repairParsed = tryValidateEvaluateOutputV2(repair.output);
  if (repairParsed.ok) {
    return buildEvaluateResultV2(repairParsed.output, {
      ...repair,
      latencyMs: first.latencyMs + repair.latencyMs,
      usage: mergeUsage(first.usage, repair.usage),
      providerRequestId: repair.providerRequestId ?? first.providerRequestId,
    }, operationId, 1);
  }

  throw new Annunci10xAiError('AI_INVALID_OUTPUT', 'Annunci 10x V2 AI output failed schema validation after one retry.', { retryable: false });
}

export function createEvaluateOperationIdV2(input: { input: Annunci10xEvaluateInputV2; model: string }): string {
  return `annunci10x-evaluate-v2-${stableHash({
    input: input.input,
    model: input.model,
    promptVersion: ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2,
  })}`;
}

async function executeEvaluateRequestV2(options: {
  provider: Annunci10xAiProvider;
  input: Annunci10xEvaluateInputV2;
  model: string;
  timeoutMs: number;
  operationId: string;
  systemPrompt: string;
}): Promise<Annunci10xAiProviderResult> {
  return options.provider.executeStructuredTask({
    operationType: 'EVALUATE',
    systemPrompt: options.systemPrompt,
    input: options.input,
    outputSchema: EVALUATE_PROMPT_V2.outputSchema,
    outputSchemaName: 'annunci10x_evaluate_v2',
    model: options.model,
    timeoutMs: options.timeoutMs,
    operationId: options.operationId,
  });
}

function tryValidateEvaluateOutputV2(value: unknown): { ok: true; output: Annunci10xEvaluateOutputV2 } | { ok: false } {
  try {
    return { ok: true, output: validateEvaluateOutputV2(value) };
  } catch {
    return { ok: false };
  }
}

function buildEvaluateResultV2(output: Annunci10xEvaluateOutputV2, providerResult: Annunci10xAiProviderResult, operationId: string, retryCount: number): RunAnnunci10xEvaluateV2Result {
  return {
    checks: output.checks,
    score: calculateAnnunci10xScoreV2(output.checks),
    provider: providerResult.provider,
    model: providerResult.model,
    usage: providerResult.usage,
    latencyMs: providerResult.latencyMs,
    retryCount,
    promptVersion: ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2,
    rubricVersion: ANNUNCI10X_RUBRIC_VERSION_V2,
    scoreSemanticsVersion: ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
    operationId,
    providerRequestId: providerResult.providerRequestId,
  };
}

function sanitizeTargetValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeTargetValue).filter((item) => item !== undefined);
  if (!isJsonPrimitiveOrObject(value)) return undefined;
  if (typeof value !== 'object' || value === null) return value;

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (shouldRemoveTargetKey(key)) continue;
    const sanitized = sanitizeTargetValue(nested);
    if (sanitized !== undefined) output[key] = sanitized;
  }
  return output;
}

function sanitizeContextValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(sanitizeContextValue).filter((item) => item !== undefined);
  if (!isJsonPrimitiveOrObject(value)) return undefined;
  if (typeof value !== 'object' || value === null) return value;

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (shouldRemoveContextKey(key)) continue;
    const sanitized = sanitizeContextValue(nested);
    if (sanitized !== undefined) output[key] = sanitized;
  }
  return output;
}

function isJsonPrimitiveOrObject(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean', 'object'].includes(typeof value);
}

function shouldRemoveTargetKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return [
    'sessionsecret',
    'cookie',
    'apikey',
    'api_key',
    'openai_api_key',
    'authorization',
    'access_token',
    'refresh_token',
    'secret',
  ].includes(normalized);
}

function shouldRemoveContextKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return [
    'sessionsecret',
    'cookie',
    'apikey',
    'api_key',
    'openai_api_key',
    'payment',
    'purchase',
    'entitlements',
    'commercialcontext',
    'price',
    'discount',
    'name',
    'firstname',
    'first_name',
    'lastname',
    'last_name',
    'surname',
    'customername',
    'customer_name',
    'leadname',
    'lead_name',
    'email',
    'phone',
    'telefono',
    'authorization',
    'access_token',
    'refresh_token',
    'secret',
  ].includes(normalized);
}

function mergeUsage(first?: Annunci10xAiUsage, second?: Annunci10xAiUsage): Annunci10xAiUsage | undefined {
  if (!first && !second) return undefined;
  return {
    inputTokens: addOptional(first?.inputTokens, second?.inputTokens),
    outputTokens: addOptional(first?.outputTokens, second?.outputTokens),
    totalTokens: addOptional(first?.totalTokens, second?.totalTokens),
    cachedTokens: addOptional(first?.cachedTokens, second?.cachedTokens),
  };
}

function addOptional(first?: number | null, second?: number | null): number | null {
  if (first === null && second === null) return null;
  const left = typeof first === 'number' ? first : 0;
  const right = typeof second === 'number' ? second : 0;
  return left + right;
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 32);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
