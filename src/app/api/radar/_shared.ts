import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRadarPersistence, createRadarService, RadarAccessError, RadarNotFoundError, RadarRevisionConflictError } from '@/lib/radar';

export const RADAR_SESSION_COOKIE = 'horyzon_radar_session';
export const RADAR_PREVIEW_COOKIE = 'horyzon_radar_preview';
// Scoped to the API that reads it (/api/radar/result); a '/radar' path never reached it.
export const RADAR_PREVIEW_COOKIE_PATH = '/api/radar';

export interface RadarSessionCookie { assessmentId: string; ownerSecret: string }

// The Radar is free (lead magnet). RADAR_PAID_ACCESS=1 brings back the purchase / PIN gate.
export function radarFreeAccess(env: Record<string, string | undefined> = process.env): boolean {
  return env.RADAR_PAID_ACCESS?.trim() !== '1';
}

export function createService() {
  return createRadarService({ persistence: createRadarPersistence(), previewPin: process.env.RADAR_PREVIEW_PIN, previewEnabled: process.env.RADAR_PREVIEW_ENABLED === '1', tokenSecret: process.env.RADAR_COOKIE_SECRET, freeAccess: radarFreeAccess() });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 32_000) throw new RadarAccessError('Payload troppo grande.', 413);
  const parsed = JSON.parse(text || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new RadarAccessError('Payload non valido.', 400);
  return parsed as Record<string, unknown>;
}

export async function setSessionCookie(value: RadarSessionCookie): Promise<void> {
  const store = await cookies();
  store.set(RADAR_SESSION_COOKIE, seal(value), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 14 });
}

export async function getSessionCookie(): Promise<RadarSessionCookie> {
  const store = await cookies();
  const value = store.get(RADAR_SESSION_COOKIE)?.value;
  if (!value) throw new RadarAccessError('Sessione Radar non disponibile.', 401);
  return unseal(value);
}

export function seal(value: RadarSessionCookie): string {
  const key = cookieKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.');
}

export function unseal(value: string): RadarSessionCookie {
  try {
    const [ivText, tagText, bodyText] = value.split('.');
    if (!ivText || !tagText || !bodyText) throw new Error('invalid');
    const decipher = createDecipheriv('aes-256-gcm', cookieKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(bodyText, 'base64url')), decipher.final()]).toString()) as RadarSessionCookie;
  } catch { throw new RadarAccessError('Sessione Radar non valida.', 401); }
}

export function errorResponse(error: unknown): NextResponse {
  const status = error instanceof RadarAccessError ? error.status : error instanceof RadarRevisionConflictError ? 409 : error instanceof RadarNotFoundError ? 404 : 500;
  if (status === 500) {
    console.error('Radar API failure', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown Radar failure',
    });
  }
  const message = status === 500 ? 'Radar temporaneamente non disponibile.' : (error as Error).message;
  return NextResponse.json({ ok: false, error: { message } }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function clientIp(request: Request): string { return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'; }

function cookieKey(): Buffer {
  const secret = process.env.RADAR_COOKIE_SECRET?.trim();
  if (!secret || secret.length < 32) throw new RadarAccessError('Sessione Radar non configurata.', 503);
  return createHash('sha256').update(secret).digest();
}
