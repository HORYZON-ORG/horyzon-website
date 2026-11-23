import { normalizeCheckupContact } from '@/lib/annunci-10x/checkup-contact';
import { normalizeEmailAddress } from '@/lib/annunci-10x/lead-verification';
import { NextResponse } from 'next/server';
import { Annunci10xPublicError, saveAnnunci10xLeadContact } from '@/lib/annunci-10x';
import { syncAnnunci10xLead } from '@/lib/annunci-10x/highlevel';
import { createContext, getSessionCookie, readJsonBody, toErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x assente.', 401);
    const context = createContext();
    const session = await context.persistence.getSession(cookie.sessionId, cookie.sessionSecret);
    if (!session || (session.flow !== 'ANALYZE' && session.flow !== 'CREATE')) {
      throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x non valida o scaduta.', 401);
    }
    const payload = await readJsonBody(request);
    const analysisRunId = typeof payload.analysisRunId === 'string' ? payload.analysisRunId : null;
    const run = analysisRunId ? await context.persistence.getAnalysisRun(analysisRunId, cookie.sessionSecret) : null;
    if (analysisRunId && (!run || run.sessionId !== cookie.sessionId)) throw new Annunci10xPublicError('INVALID_INPUT', 'Richiesta non valida.', 400);
    const checkupContact = run?.retrievalMetadata.checkupVersion
      ? normalizeCheckupContact(payload, normalizeEmailAddress(payload.email)) : null;
    if (checkupContact && (typeof payload.companyName !== 'string' || !payload.companyName.trim())) throw new Annunci10xPublicError('INVALID_INPUT', 'Indica la tua azienda.', 400);
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
    if (checkupContact && run) {
      const questionId = `checkup-contact:${run.id}`;
      const answers = await context.persistence.getAnswers(cookie.sessionId, cookie.sessionSecret);
      const rawAnswer = JSON.stringify(checkupContact);
      if (answers.filter(a => a.questionId === questionId).at(-1)?.rawAnswer !== rawAnswer) {
        await context.persistence.appendAnswer({ ...cookie, interviewStep: 'ROLE', questionId, rawAnswer });
      }
    }
    const crm = await syncAnnunci10xLead({ session: cookie, persistence: context.persistence });
    return NextResponse.json({
      ok: true,
      contactSaved: saved.contactSaved,
      verificationRequired: saved.verificationRequired,
      emailVerified: saved.emailVerified,
      crmStatus: crm.status,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
