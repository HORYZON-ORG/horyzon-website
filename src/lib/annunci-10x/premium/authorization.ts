import type { PersistedAnnunci10xSession } from '../persistence/types.ts';

export type GenerationAuthorizationStatus = 'AUTHORIZED' | 'NOT_AUTHORIZED' | 'ALREADY_CONSUMED' | 'INVALID_STATE';

export interface GenerationAuthorization {
  status: GenerationAuthorizationStatus;
  authorityId: string;
  identity: string;
  reason: string;
  remainingCredits: number;
  checkedAt: string;
}

export interface GenerationAuthorizationProvider {
  authorize(input: { session: PersistedAnnunci10xSession; productCode: 'AD_GENERATION' }): Promise<GenerationAuthorization>;
  consume(input: { session: PersistedAnnunci10xSession; authorization: GenerationAuthorization }): Promise<GenerationAuthorization>;
}

export function createProductionGenerationAuthorizationProvider(): GenerationAuthorizationProvider {
  return {
    async authorize({ session }) {
      return deniedAuthorization(session.id, 'NOT_AUTHORIZED', 'Checkout e acquisto Annunci 10x non sono ancora attivi.');
    },
    async consume({ session }) {
      return deniedAuthorization(session.id, 'NOT_AUTHORIZED', 'Nessun credito generazione disponibile.');
    },
  };
}

export function createTestGenerationAuthorizationProvider(options: { credits?: number; authorityId?: string } = {}): GenerationAuthorizationProvider {
  let credits = options.credits ?? 1;
  const authorityId = options.authorityId ?? 'annunci10x-test-generation-authority';
  return {
    async authorize({ session }) {
      if (!isGeneratableState(session.state)) return deniedAuthorization(session.id, 'INVALID_STATE', 'Stato sessione non valido per la generazione.', authorityId, credits);
      if (credits <= 0) return deniedAuthorization(session.id, 'ALREADY_CONSUMED', 'Credito test gia consumato.', authorityId, 0);
      return {
        status: 'AUTHORIZED',
        authorityId,
        identity: `${authorityId}:${session.id}:${credits}`,
        reason: 'Autorizzazione test server-side.',
        remainingCredits: credits,
        checkedAt: new Date().toISOString(),
      };
    },
    async consume({ session, authorization }) {
      if (authorization.status !== 'AUTHORIZED') return authorization;
      if (credits <= 0) return deniedAuthorization(session.id, 'ALREADY_CONSUMED', 'Credito test gia consumato.', authorityId, 0);
      credits -= 1;
      return {
        ...authorization,
        identity: `${authorityId}:${session.id}:consumed:${credits}`,
        remainingCredits: credits,
        checkedAt: new Date().toISOString(),
      };
    },
  };
}

export function sanitizeGenerationClientPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const forbidden = new Set([
    'authorized',
    'authorization',
    'authorizationStatus',
    'credits',
    'paid',
    'purchase',
    'receipt',
    'serverReceiptId',
    'testAuthorization',
    'entitlements',
  ]);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!forbidden.has(key)) sanitized[key] = value;
  }
  return sanitized;
}

export function isGeneratableState(state: PersistedAnnunci10xSession['state']): boolean {
  return ['PAYMENT_REQUIRED', 'ENTITLED', 'OUTPUT_READY', 'NEEDS_VERIFICATION'].includes(state);
}

function deniedAuthorization(
  sessionId: string,
  status: Exclude<GenerationAuthorizationStatus, 'AUTHORIZED'>,
  reason: string,
  authorityId = 'annunci10x-production-generation-authority',
  remainingCredits = 0,
): GenerationAuthorization {
  return {
    status,
    authorityId,
    identity: `${authorityId}:${sessionId}:${status}`,
    reason,
    remainingCredits,
    checkedAt: new Date().toISOString(),
  };
}
