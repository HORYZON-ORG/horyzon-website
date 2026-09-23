import { NextResponse } from 'next/server';
import {
  Annunci10xPublicError,
  createProductionGenerationAuthorizationProvider,
  requestAnnunci10xPremiumEdit,
  sanitizeGenerationClientPayload,
} from '@/lib/annunci-10x';
import { checkAnnunci10xRateLimit, createContext, getSessionCookie, readJsonBody, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = createContext();
    const cookie = await getSessionCookie();
    if (!cookie) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x assente.', 401);
    const limited = checkAnnunci10xRateLimit(request, cookie.sessionId);
    if (limited) return limited;
    const payload = sanitizeGenerationClientPayload(await readJsonBody(request));
    const editRequest = typeof payload.editRequest === 'string' ? payload.editRequest : '';
    const targetPath = typeof payload.targetPath === 'string' ? payload.targetPath : undefined;
    const result = await requestAnnunci10xPremiumEdit({
      sessionId: cookie.sessionId,
      sessionSecret: cookie.sessionSecret,
      editRequest,
      targetPath,
      context,
      authorizationProvider: createProductionGenerationAuthorizationProvider(),
    });
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
