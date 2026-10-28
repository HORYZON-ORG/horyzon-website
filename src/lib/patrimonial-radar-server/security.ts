import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { RadarBackendError } from './contracts.ts';

export const opaqueToken = () => randomBytes(32).toString('base64url');
export const validToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const validUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  throw new RadarBackendError('INVALID');
}
export const contentHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new RadarBackendError('INVALID');
  const email = value.trim().toLowerCase();
  // Conservative syntax, no provider-specific aliases, plus/dot folding or mailbox guesses.
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email) || email.includes('..')) throw new RadarBackendError('INVALID');
  return email;
}
export class RadarSecrets {
  private readonly secret: string;
  constructor(secret: string) {
    if (typeof window !== 'undefined' || typeof secret !== 'string' || secret.length < 32 || secret.length > 1024) throw new RadarBackendError('UNAVAILABLE');
    this.secret = secret;
  }
  hash(purpose: string, ...values: string[]): string {
    return createHmac('sha256', this.secret).update(JSON.stringify([purpose, ...values])).digest('hex');
  }
  csrf(token: string): string { return this.hash('csrf-v1', token); }
  checkCsrf(token: string, csrf: unknown): boolean {
    if (!validToken(token) || typeof csrf !== 'string' || !/^[a-f0-9]{64}$/.test(csrf)) return false;
    return timingSafeEqual(Buffer.from(this.csrf(token), 'hex'), Buffer.from(csrf, 'hex'));
  }
}
export function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some(k => !keys.includes(k))) throw new RadarBackendError('INVALID');
  return value as Record<string, unknown>;
}
export function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1_000_000) throw new RadarBackendError('INVALID');
  return Number(value);
}
