import { sealCheckupSession } from '@/lib/annunci-10x/checkup-queue';
import { after, NextResponse } from 'next/server';
import {
  runAnnunci10xAnalysisRun,
  startAnnunci10xAnalysisRun,
  progressLabelForAnalysisStage,
  toPublicAnalysisRunStatus,
  type PublicationChannel,
} from '@/lib/annunci-10x';
import {
  checkAnnunci10xPersistentStartLimit,
  checkAnnunci10xRateLimit,
  createContext,
  getOrCreateSession,
  readJsonBody,
  toErrorResponse,
} from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const context = createContext();
    const session = await getOrCreateSession(context);
    const volatileLimit = checkAnnunci10xRateLimit(request, session.sessionId);
    if (volatileLimit) return volatileLimit;
    const persistentLimit = await checkAnnunci10xPersistentStartLimit(context, request, session.sessionId);
    if (persistentLimit) return persistentLimit;

    const payload = await readJsonBody(request);
    const sourceKind = payload.sourceKind === 'PUBLIC_URL' ? 'PUBLIC_URL' : 'PASTED_TEXT';
    const declaredChannel = isPublicationChannel(payload.declaredChannel) ? payload.declaredChannel : undefined;
    const requestNonce = isAnalysisRequestNonce(payload.requestNonce) ? payload.requestNonce : undefined;
    const source = sourceKind === 'PUBLIC_URL'
      ? { kind: 'PUBLIC_URL' as const, url: typeof payload.url === 'string' ? payload.url : '', declaredChannel }
      : { kind: 'PASTED_TEXT' as const, text: typeof payload.text === 'string' ? payload.text : typeof payload.rawAdText === 'string' ? payload.rawAdText : '', declaredChannel };

    const started = await startAnnunci10xAnalysisRun({ session, source, context, requestNonce });
    if (payload.checkup === true && !started.run.retrievalMetadata.checkupVersion) {
      started.run = await context.persistence.updateAnalysisRun({ analysisRunId: started.run.id, sessionSecret: session.sessionSecret,
        retrievalMetadata: { ...started.run.retrievalMetadata, checkupVersion: 'recruiting-checkup-v1',
          checkupQueueToken: sealCheckupSession(session, started.run.id), attribution: sanitizeAttribution(payload.attribution) } });
      await context.persistence.appendEvent({ sessionId: session.sessionId, eventName: 'checkup_request_saved', metadata: { analysisRunId: started.run.id } });
    }
    if (started.run.status === 'QUEUED' || started.run.status === 'RUNNING') {
      after(async () => {
        await runAnnunci10xAnalysisRun({ analysisRunId: started.run.id, session, context });
      });
    }

    return NextResponse.json({
      ok: true,
      analysisRunId: started.run.id,
      status: started.run.status,
      stage: started.run.stage,
      sourceStatus: started.run.sourceStatus,
      run: {
        ...toPublicAnalysisRunStatus(started.run),
        progressLabel: progressLabelForAnalysisStage(started.run.stage),
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function isPublicationChannel(value: unknown): value is PublicationChannel {
  return value === 'LINKEDIN' || value === 'INDEED' || value === 'ATS' || value === 'EMAIL' || value === 'CUSTOM';
}


function isAnalysisRequestNonce(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,96}$/.test(value);
}

function sanitizeAttribution(value: unknown) {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].flatMap(key =>
    typeof data[key] === 'string' ? [[key, data[key].replace(/[<>\r\n]/g, '').slice(0, 160)]] : []));
}
