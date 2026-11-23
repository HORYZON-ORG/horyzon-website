import { readCheckup } from '@/lib/annunci-10x/checkup';
import { Annunci10xPublicError } from '@/lib/annunci-10x';
import { createContext, getSessionCookie, toErrorResponse } from '../../../_shared';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new Annunci10xPublicError('INVALID_INPUT', 'Origine non valida.', 403);
    const session = await getSessionCookie();
    if (!session) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione assente.', 401);
    const context = createContext();
    const analysisRunId = (await params).id;
    const { receipt } = await readCheckup({ session, context, analysisRunId });
    if (!receipt?.report) throw new Annunci10xPublicError('ANALYSIS_NOT_READY', 'PDF ancora in preparazione.', 409);
    await context.persistence.appendEvent({ sessionId: session.sessionId, eventName: 'booking_click', metadata: { analysisRunId } });
    // A click never marks a booking as confirmed.
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return toErrorResponse(error); }
}
