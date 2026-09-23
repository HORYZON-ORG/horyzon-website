import type { AiOperationType } from '../types.ts';

export const ANNUNCI10X_AI_DEFAULT_MODEL = 'gpt-5-mini';
export const ANNUNCI10X_AI_DEFAULT_TIMEOUT_MS = 90000;

export const ANNUNCI10X_MODEL_ENV_BY_OPERATION = {
  PRECHECK: 'ANNUNCI10X_MODEL_PRECHECK',
  EXTRACT: 'ANNUNCI10X_MODEL_EXTRACT',
  CLARIFY: 'ANNUNCI10X_MODEL_CLARIFY',
  PROFILE: 'ANNUNCI10X_MODEL_PROFILE',
  STRATEGY: 'ANNUNCI10X_MODEL_STRATEGY',
  GENERATE: 'ANNUNCI10X_MODEL_GENERATE',
  VALIDATE: 'ANNUNCI10X_MODEL_VALIDATE',
  EVALUATE: 'ANNUNCI10X_MODEL_EVALUATE',
  CHANNEL_ADAPTER: 'ANNUNCI10X_MODEL_CHANNEL_ADAPTER',
  EDIT_CLASSIFIER: 'ANNUNCI10X_MODEL_EDIT_CLASSIFIER',
  REVISE: 'ANNUNCI10X_MODEL_REVISE',
} as const satisfies Record<AiOperationType, string>;

export function getAnnunci10xModelForOperation(operationType: AiOperationType, env: Record<string, string | undefined> = process.env): string {
  return env[ANNUNCI10X_MODEL_ENV_BY_OPERATION[operationType]] ?? env.ANNUNCI10X_MODEL_DEFAULT ?? ANNUNCI10X_AI_DEFAULT_MODEL;
}

export function getAnnunci10xAiTimeoutMs(env: Record<string, string | undefined> = process.env): number {
  const raw = env.ANNUNCI10X_AI_TIMEOUT_MS;
  if (!raw) return ANNUNCI10X_AI_DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : ANNUNCI10X_AI_DEFAULT_TIMEOUT_MS;
}

export function getAnnunci10xAiProviderName(env: Record<string, string | undefined> = process.env): 'OPENAI' | 'MOCK' {
  return env.ANNUNCI10X_AI_PROVIDER === 'MOCK' ? 'MOCK' : 'OPENAI';
}
