import { verifyCalendlySignature, reconcileCheckupBooking } from '@/lib/annunci-10x/checkup-booking';
import { createContext } from '../../_shared';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const signingKey = process.env.ANNUNCI10X_CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!signingKey) return Response.json({ ok: false }, { status: 503 });
  if (Number(request.headers.get('content-length') ?? 0) > 64_000) return new Response(null, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 64_000) return new Response(null, { status: 413 });
  if (!verifyCalendlySignature(body, request.headers.get('calendly-webhook-signature') ?? '', signingKey)) return Response.json({ ok: false }, { status: 401 });
  try {
    const status = await reconcileCheckupBooking(JSON.parse(body), createContext().persistence);
    return Response.json({ ok: true, status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ ok: false }, { status: 503 }); }
}
