import { NextResponse } from 'next/server';
import { prepareCheckup, readCheckup } from '@/lib/annunci-10x/checkup';
import { Annunci10xPublicError } from '@/lib/annunci-10x';
import { createContext, getSessionCookie, toErrorResponse } from '../../_shared';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new Annunci10xPublicError('INVALID_INPUT', 'Origine non valida.', 403);
    const session = await getSessionCookie();
    if (!session) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione assente.', 401);
    const input = { session, analysisRunId: (await params).id, context: createContext() };
    const { run } = await readCheckup(input);
    if (run.retrievalMetadata.checkupVersion !== 'recruiting-checkup-v1') throw new Annunci10xPublicError('INVALID_INPUT', 'Questo risultato appartiene al percorso precedente. Avvia un nuovo check-up.', 409);
    const receipt = await prepareCheckup(input);
    return NextResponse.json({ ok: true, status: receipt.status, report: receipt.report ?? null,
      retryAfterSeconds: receipt.status === 'FAILED' ? 360 : 8 }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return toErrorResponse(error); }
}
