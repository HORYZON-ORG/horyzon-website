import { NextResponse } from 'next/server';
import { auditCacheKey, checkRateLimit, readDuplicateCache, withAuditSlot, writeDuplicateCache } from '@/lib/ai-score/limits';
import { auditRepository } from '@/lib/ai-score/storage';
import { runAiScoreAudit, toFreeAudit } from '@/lib/ai-score/audit';
import type { AuditStreamEvent } from '@/lib/ai-score/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON non valido.' }, { status: 400 });
  }

  const url = isRecord(payload) && typeof payload.url === 'string' ? payload.url : '';
  if (!url.trim()) {
    return NextResponse.json({ error: 'Inserisci un dominio o URL da analizzare.' }, { status: 400 });
  }

  const clientKey = getClientKey(request);
  const rateLimit = checkRateLimit(clientKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.reason },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }

  const cacheKey = auditCacheKey(url);
  const cached = readDuplicateCache(cacheKey) ?? await auditRepository.findRecent(cacheKey);
  if (cached) {
    return streamEvents([
      { type: 'state', state: 'queued', label: 'Risultato recente trovato' },
      { type: 'state', state: 'scoring', label: 'Preparazione risultato gratuito' },
      { type: 'result', audit: toFreeAudit(cached) },
    ]);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AuditStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        const audit = await withAuditSlot(() => runAiScoreAudit(url, (state, label) => {
          send({ type: 'state', state, label });
        }));
        writeDuplicateCache(cacheKey, audit);
        await auditRepository.save(cacheKey, audit);
        send({ type: 'result', audit: toFreeAudit(audit) });
      } catch (error) {
        send({ type: 'error', state: 'failed', message: error instanceof Error ? error.message : 'Analisi non riuscita.' });
      } finally {
        controller.close();
      }
    },
  });

  return ndjson(stream);
}

function streamEvents(events: AuditStreamEvent[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }
      controller.close();
    },
  });
  return ndjson(stream);
}

function ndjson(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function getClientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return forwarded || realIp || 'anonymous';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
