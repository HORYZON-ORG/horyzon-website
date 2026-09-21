import { runAiScoreAudit, SafeFetchError } from '@/lib/ai-score/audit';
import type { AuditStreamEvent } from '@/lib/ai-score/types';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AuditRequest = { url?: unknown };

export async function POST(request: Request) {
  let payload: AuditRequest;
  try {
    payload = await request.json() as AuditRequest;
  } catch {
    return NextResponse.json({ error: 'Payload JSON non valido.' }, { status: 400 });
  }
  if (typeof payload.url !== 'string') return NextResponse.json({ error: 'URL mancante.' }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AuditStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const audit = await runAiScoreAudit(payload.url as string, (state, label) => send({ type: 'state', state, label }));
        send({ type: 'result', audit });
      } catch (error) {
        const message = error instanceof SafeFetchError || error instanceof Error ? error.message : 'Audit non riuscito.';
        send({ type: 'error', state: 'failed', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
