import { createHash, randomBytes } from 'node:crypto';

export function createOwnerSecret(): { secret: string; secretHash: string } {
  const secret = randomBytes(32).toString('base64url');
  return { secret, secretHash: hashOwnerSecret(secret) };
}

export function hashOwnerSecret(secret: string): string {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Radar owner secret is invalid.');
  return createHash('sha256').update(secret).digest('hex');
}
