import { after, NextResponse } from 'next/server';
import {
  getAnnunci10xAnalysisRunStatus,
  runAnnunci10xAnalysisRun,
} from '@/lib/annunci-10x';
import { createContext, getSessionCookie, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Sessione Annunci 10x assente.' } }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    const { id } = await params;
    const context = createContext();
    const status = await getAnnunci10xAnalysisRunStatus({ analysisRunId: id, session: cookie, context });
    if (!status) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Analisi non trovata.' } }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    if (status.status === 'QUEUED' || status.status === 'RUNNING') {
      after(async () => {
        await runAnnunci10xAnalysisRun({ analysisRunId: id, session: cookie, context });
      });
    }
    return NextResponse.json({ ok: true, run: status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
