import type { AiOperationType } from '../types.ts';
import type { Annunci10xJsonSchema } from './schemas.ts';

export interface Annunci10xAiUsage {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  cachedTokens?: number | null;
}

export interface Annunci10xAiProviderRequest {
  operationType: AiOperationType;
  systemPrompt: string;
  input: unknown;
  outputSchema: Annunci10xJsonSchema;
  outputSchemaName: string;
  model: string;
  timeoutMs: number;
  operationId: string;
}

export interface Annunci10xAiProviderResult {
  output: unknown;
  provider: 'OPENAI' | 'MOCK';
  model: string;
  providerRequestId?: string | null;
  usage?: Annunci10xAiUsage;
  latencyMs: number;
}

export interface Annunci10xAiProvider {
  readonly name: 'OPENAI' | 'MOCK';
  executeStructuredTask(request: Annunci10xAiProviderRequest): Promise<Annunci10xAiProviderResult>;
}
