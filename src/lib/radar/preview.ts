import { createHmac, timingSafeEqual } from 'node:crypto';

export function timingSafePinMatch(submitted: string, expected: string): boolean {
  const left = Buffer.from(submitted);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createPreviewToken(assessmentId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ assessmentId, expiresAt: now + 15 * 60_000 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyPreviewToken(token: string, assessmentId: string, secret: string, now = Date.now()): boolean {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!timingSafePinMatch(signature, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { assessmentId?: unknown; expiresAt?: unknown };
    return parsed.assessmentId === assessmentId && typeof parsed.expiresAt === 'number' && parsed.expiresAt > now;
  } catch {
    return false;
  }
}
