import { timingSafeEqual } from 'node:crypto';
import { cvStorage, eligibleCandidateCvs, purgeExpiredCvs } from '@/lib/public-leads/architect-cv';
export const runtime = 'nodejs';

// Cron: pending oltre 24h; candidates oltre 12 mesi SOLO dopo verifica Horyzon
// di stato non attivo. Gli approvati e i percorsi in corso non si cancellano.
// Vercel invia "Authorization: Bearer <CRON_SECRET>"; senza CRON_SECRET la route resta chiusa.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  const ok = !!secret && provided.length === secret.length && timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
  if (!ok) return Response.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const storage = cvStorage(process.env);
  if (!storage) return Response.json({ ok: false, reason: 'storage_not_configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try {
    const now = new Date();
    const removed = await purgeExpiredCvs(
      storage, now, ids => eligibleCandidateCvs(storage, now, ids),
    );
    return Response.json({ ok: true, removed }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false, reason: 'purge_failed' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
