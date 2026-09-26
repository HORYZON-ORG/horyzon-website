import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ANNUNCI10X_COOKIE_NAME,
  Annunci10xPublicError,
  createAnnunci10xRuntimeContext,
  createAnonymousAnalyzeSession,
  decodeAnnunci10xCookie,
  encodeAnnunci10xCookie,
  type Annunci10xRuntimeContext,
  type Annunci10xSessionCookie,
} from '@/lib/annunci-10x';

const MAX_JSON_BYTES = 32_000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
const ANALYSIS_START_LIMIT = 4;
const ANALYSIS_START_WINDOW_SECONDS = 60 * 10;
const limits = new Map<string, { count: number; resetAt: number }>();

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new Annunci10xPublicError('INVALID_INPUT', 'Payload troppo grande.', 413);
  }
  try {
    const parsed = JSON.parse(text || '{}');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('invalid');
    return parsed as Record<string, unknown>;
  } catch {
    throw new Annunci10xPublicError('INVALID_INPUT', 'Payload JSON non valido.', 400);
  }
}

export async function getSessionCookie(): Promise<Annunci10xSessionCookie | null> {
  const cookieStore = await cookies();
  return decodeAnnunci10xCookie(cookieStore.get(ANNUNCI10X_COOKIE_NAME)?.value);
}

export async function getOrCreateSession(context: Annunci10xRuntimeContext): Promise<Annunci10xSessionCookie & { created: boolean }> {
  const existing = await getSessionCookie();
  if (existing) {
    const session = await context.persistence.getSession(existing.sessionId, existing.sessionSecret);
    if (session?.flow === 'ANALYZE') return { ...existing, created: false };
  }
  const created = await createAnonymousAnalyzeSession(context);
  const cookie = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  await setSessionCookie(cookie);
  return { ...cookie, created: true };
}

export async function setSessionCookie(cookie: Annunci10xSessionCookie): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: ANNUNCI10X_COOKIE_NAME,
    value: encodeAnnunci10xCookie(cookie),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function createContext(): Annunci10xRuntimeContext {
  return createAnnunci10xRuntimeContext();
}

export function checkAnnunci10xRateLimit(request: Request, sessionId?: string): NextResponse | null {
  const key = `${clientIp(request)}:${sessionId ?? 'no-session'}`;
  const now = Date.now();
  const current = limits.get(key);
  if (!current || current.resetAt < now) {
    limits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  current.count += 1;
  if (current.count <= MAX_REQUESTS) return null;
  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return NextResponse.json(publicErrorPayload('RATE_LIMITED', 'Troppe richieste ravvicinate. Riprova tra poco.'), {
    status: 429,
    headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' },
  });
}

export async function checkAnnunci10xPersistentStartLimit(context: Annunci10xRuntimeContext, request: Request, sessionId: string): Promise<NextResponse | null> {
  const subject = `${clientIp(request)}:${sessionId}`;
  const result = await context.persistence.checkRateLimit({
    scope: 'annunci10x_analysis_start',
    subject,
    limit: ANALYSIS_START_LIMIT,
    windowSeconds: ANALYSIS_START_WINDOW_SECONDS,
  });
  if (result.allowed) return null;
  return NextResponse.json(publicErrorPayload('RATE_LIMITED', 'Troppe analisi avviate ravvicinate. Riprova tra poco.'), {
    status: 429,
    headers: { 'Retry-After': String(result.retryAfterSeconds), 'Cache-Control': 'no-store' },
  });
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof Annunci10xPublicError) {
    return NextResponse.json(publicErrorPayload(error.code, error.message), { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  }
  const record = typeof error === 'object' && error !== null ? error as { code?: unknown; message?: unknown; status?: unknown } : {};
  const code = typeof record.code === 'string' ? record.code : 'INTERNAL';
  const status = code === 'RATE_LIMITED' ? 429
    : code === 'NOT_FOUND' ? 404
    : code === 'EMAIL_VERIFICATION_REQUIRED' ? 403
    : code === 'ANALYSIS_NOT_READY' || code === 'RESULT_NOT_AVAILABLE' ? 409
    : code === 'VERIFICATION_INVALID' || code === 'VERIFICATION_EXPIRED' ? 400
    : code === 'PAYMENT_REQUIRED' || code === 'ENTITLEMENT_MISSING' ? 402
      : code === 'GENERATION_BLOCKED' || code === 'NEEDS_VERIFICATION' ? 409
        : code === 'AI_PROVIDER_ERROR' || code === 'EMAIL_PROVIDER_UNAVAILABLE' || code === 'EMAIL_VERIFICATION_UNAVAILABLE' ? 503
          : code === 'AI_INVALID_OUTPUT' ? 502
            : 500;
  const message = code === 'AI_PROVIDER_ERROR'
    ? 'Provider AI non disponibile per Annunci 10x.'
    : code === 'ANALYSIS_NOT_READY'
      ? 'Il risultato non e ancora pronto.'
      : code === 'EMAIL_VERIFICATION_REQUIRED'
        ? 'Verifica la tua email per visualizzare il risultato.'
        : code === 'RESULT_NOT_AVAILABLE'
          ? 'Il risultato non e disponibile per questa analisi.'
    : code === 'EMAIL_PROVIDER_UNAVAILABLE' || code === 'EMAIL_VERIFICATION_UNAVAILABLE'
      ? 'Verifica email non disponibile.'
      : code === 'VERIFICATION_EXPIRED'
        ? 'Codice scaduto.'
        : code === 'VERIFICATION_INVALID'
          ? 'Codice non valido.'
    : code === 'RATE_LIMITED'
      ? 'Provider AI temporaneamente limitato.'
      : code === 'PAYMENT_REQUIRED'
        ? 'Generazione Annunci 10x non autorizzata.'
        : code === 'GENERATION_BLOCKED'
          ? 'Generazione Annunci 10x non disponibile per questa sessione.'
          : 'Analisi non completata. Riprova tra poco.';
  return NextResponse.json(publicErrorPayload(code, message), { status, headers: { 'Cache-Control': 'no-store' } });
}

function publicErrorPayload(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'anonymous';
}

export function clientFingerprint(request: Request): string {
  return clientIp(request);
}
