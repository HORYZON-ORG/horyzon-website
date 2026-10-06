import { NextResponse } from 'next/server';
import {
  Annunci10xPublicError,
  isAnnunci10xFulfillmentEnabled,
  runAnnunci10xPremiumGeneration,
  sanitizeGenerationClientPayload,
} from '@/lib/annunci-10x';
import { checkAnnunci10xRateLimit, createContext, getSessionCookie, readJsonBody, toErrorResponse } from '../../_shared';
import type { PublicationChannel } from '@/lib/annunci-10x';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const context = createContext();
    const cookie = await getSessionCookie();
    if (!cookie) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x assente.', 401);
    const limited = checkAnnunci10xRateLimit(request, cookie.sessionId);
    if (limited) return limited;
    if (!isAnnunci10xFulfillmentEnabled()) {
      throw new Annunci10xPublicError('GENERATION_BLOCKED', 'Generazione temporaneamente non disponibile.', 503);
    }
    const payload = sanitizeGenerationClientPayload(await readJsonBody(request));
    const result = await runAnnunci10xPremiumGeneration({
      sessionId: cookie.sessionId,
      sessionSecret: cookie.sessionSecret,
      channel: parseChannel(payload.channel),
      context,
    });
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function parseChannel(value: unknown): PublicationChannel | undefined {
  if (value === 'LINKEDIN' || value === 'INDEED' || value === 'ATS' || value === 'EMAIL' || value === 'CUSTOM') return value;
  return undefined;
}
