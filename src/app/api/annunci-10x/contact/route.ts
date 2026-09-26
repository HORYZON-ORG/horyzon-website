import { NextResponse } from 'next/server';
import { Annunci10xPublicError, saveAnnunci10xLeadContact } from '@/lib/annunci-10x';
import { createContext, getSessionCookie, readJsonBody, toErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x assente.', 401);
    const context = createContext();
    const session = await context.persistence.getSession(cookie.sessionId, cookie.sessionSecret);
    if (!session || session.flow !== 'ANALYZE') throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x non valida o scaduta.', 401);
    const payload = await readJsonBody(request);
    const saved = await saveAnnunci10xLeadContact({
      session: cookie,
      context,
      firstName: payload.firstName,
      lastName: payload.lastName,
      companyName: payload.companyName,
      businessRole: payload.businessRole,
      email: payload.email,
      marketingConsent: payload.marketingConsent,
    });
    return NextResponse.json({
      ok: true,
      contactSaved: saved.contactSaved,
      verificationRequired: saved.verificationRequired,
      emailVerified: saved.emailVerified,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
