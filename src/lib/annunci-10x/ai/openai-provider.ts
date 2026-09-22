import { assertServerOnlyAiRuntime, Annunci10xAiError } from './errors.ts';
import type { Annunci10xAiProvider, Annunci10xAiProviderRequest, Annunci10xAiProviderResult, Annunci10xAiUsage } from './provider.ts';

interface OpenAiProviderConfig {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}

export class OpenAiAnnunci10xProvider implements Annunci10xAiProvider {
  readonly name = 'OPENAI' as const;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

  constructor(config: OpenAiProviderConfig = {}) {
    assertServerOnlyAiRuntime();
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    if (!this.apiKey) throw new Annunci10xAiError('AI_PROVIDER_ERROR', 'OpenAI API key is not configured for Annunci 10x.', { retryable: false });
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.endpoint = config.endpoint ?? 'https://api.openai.com/v1/responses';
  }

  async executeStructuredTask(request: Annunci10xAiProviderRequest): Promise<Annunci10xAiProviderResult> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          store: false,
          input: [
            { role: 'system', content: [{ type: 'input_text', text: request.systemPrompt }] },
            { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(projectProviderInput(request.input)) }] },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: request.outputSchemaName,
              strict: true,
              schema: request.outputSchema,
            },
          },
          metadata: {
            product: 'annunci10x',
            operationType: request.operationType,
            operationId: request.operationId,
          },
        }),
      });
      const latencyMs = Date.now() - started;
      if (response.status === 429) throw new Annunci10xAiError('RATE_LIMITED', 'Annunci 10x AI provider is rate limited.', { retryable: true, status: response.status });
      if (!response.ok) throw new Annunci10xAiError('AI_PROVIDER_ERROR', 'Annunci 10x AI provider request failed.', { retryable: response.status >= 500, status: response.status });
      const json = await response.json();
      return {
        output: parseStructuredOutput(json),
        provider: 'OPENAI',
        model: request.model,
        providerRequestId: optionalString(json.id),
        usage: parseUsage(json.usage),
        latencyMs,
      };
    } catch (error) {
      if (error instanceof Annunci10xAiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Annunci10xAiError('AI_PROVIDER_ERROR', 'Annunci 10x AI provider timed out.', { retryable: true });
      }
      throw new Annunci10xAiError('AI_PROVIDER_ERROR', 'Annunci 10x AI provider request failed.', { retryable: true });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createOpenAiAnnunci10xProvider(): OpenAiAnnunci10xProvider {
  return new OpenAiAnnunci10xProvider();
}

function parseStructuredOutput(response: Record<string, unknown>): unknown {
  if (typeof response.output_text === 'string') return parseJson(response.output_text);
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (typeof item !== 'object' || item === null) continue;
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : [];
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue;
      const record = part as Record<string, unknown>;
      if (typeof record.text === 'string') return parseJson(record.text);
      if (typeof record.output_text === 'string') return parseJson(record.output_text);
    }
  }
  throw new Annunci10xAiError('AI_INVALID_OUTPUT', 'Annunci 10x AI provider returned no structured output.', { retryable: false });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Annunci10xAiError('AI_INVALID_OUTPUT', 'Annunci 10x AI provider returned malformed JSON.', { retryable: false });
  }
}

function parseUsage(value: unknown): Annunci10xAiUsage | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const details = typeof record.input_tokens_details === 'object' && record.input_tokens_details !== null ? record.input_tokens_details as Record<string, unknown> : {};
  return {
    inputTokens: optionalNumber(record.input_tokens),
    outputTokens: optionalNumber(record.output_tokens),
    totalTokens: optionalNumber(record.total_tokens),
    cachedTokens: optionalNumber(details.cached_tokens),
  };
}

function projectProviderInput(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const record = { ...(value as Record<string, unknown>) };
  delete record.sessionSecret;
  delete record.cookie;
  delete record.payment;
  delete record.entitlements;
  delete record.commercialContext;
  return record;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
