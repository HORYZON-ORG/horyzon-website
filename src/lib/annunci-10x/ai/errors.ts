import type { Annunci10xErrorCode } from '../types.ts';

export type Annunci10xAiErrorCode = Extract<Annunci10xErrorCode, 'AI_PROVIDER_ERROR' | 'AI_INVALID_OUTPUT' | 'RATE_LIMITED' | 'INTERNAL_ERROR' | 'INTERNAL'>;

export class Annunci10xAiError extends Error {
  readonly code: Annunci10xAiErrorCode;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(code: Annunci10xAiErrorCode, message: string, options: { retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = 'Annunci10xAiError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.status = options.status;
  }
}

export interface PublicAnnunci10xAiError {
  code: Annunci10xAiErrorCode;
  message: string;
  retryable: boolean;
  status?: number;
}

export function toPublicAiError(error: unknown): PublicAnnunci10xAiError {
  if (error instanceof Annunci10xAiError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      status: error.status,
    };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'Annunci 10x AI runtime failed.',
    retryable: false,
  };
}

export function sanitizeAiErrorPayload(error: unknown): Record<string, unknown> {
  const publicError = toPublicAiError(error);
  return {
    code: publicError.code,
    message: publicError.message,
    retryable: publicError.retryable,
    status: publicError.status ?? null,
  };
}

export function assertServerOnlyAiRuntime(): void {
  if (typeof window !== 'undefined') throw new Annunci10xAiError('INTERNAL_ERROR', 'Annunci 10x AI runtime is server-only.');
}
