import { createHash, randomBytes } from 'node:crypto';

export interface Annunci10xSessionSecret {
  secret: string;
  secretHash: string;
}

const FORBIDDEN_EVENT_METADATA_KEYS = new Set([
  'raw_answer',
  'rawAnswer',
  'original_ad',
  'originalAd',
  'ad_text',
  'adText',
  'compensation',
  'company_name',
  'companyName',
  'personal_data',
  'pii',
]);

export function createAnnunci10xSessionSecret(): Annunci10xSessionSecret {
  const secret = randomBytes(32).toString('base64url');
  return { secret, secretHash: hashAnnunci10xSessionSecret(secret) };
}

export function hashAnnunci10xSessionSecret(secret: string): string {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Annunci 10x session secret is invalid.');
  return createHash('sha256').update(secret).digest('hex');
}

export function assertSafeEventMetadata(metadata: Record<string, unknown>): void {
  const forbidden = findForbiddenKey(metadata);
  if (forbidden) throw new Error(`Annunci 10x event metadata contains forbidden key: ${forbidden}`);
}

function findForbiddenKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenKey(item);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_EVENT_METADATA_KEYS.has(key)) return key;
    const found = findForbiddenKey(child);
    if (found) return found;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
