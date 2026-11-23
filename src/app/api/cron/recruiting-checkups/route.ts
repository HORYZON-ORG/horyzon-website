import { timingSafeEqual } from 'node:crypto';
import { processCheckupQueue } from '@/lib/annunci-10x/checkup-queue';
import { createAnnunci10xRuntimeContext } from '@/lib/annunci-10x';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return Response.json({ ok: false }, { status: 401 });
  const result = await processCheckupQueue(createAnnunci10xRuntimeContext());
  return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
}
