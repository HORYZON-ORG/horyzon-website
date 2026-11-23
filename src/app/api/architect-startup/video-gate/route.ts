import { getArchitectStartupVideoGate } from '@/lib/public-leads/architect-hub-intake';
import { architectStartupConfirmationEnabled } from '@/lib/public-leads/architect-startup-config';

export const runtime = 'nodejs';

const json = (status: number, message: string, remainingSeconds?: number) =>
  Response.json({
    ok: status === 200,
    message,
    ...(remainingSeconds !== undefined ? { remainingSeconds } : {}),
  }, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });

/** Starts the 661-second gate on the server at the first valid page open. */
export async function POST(request: Request) {
  if (!architectStartupConfirmationEnabled(process.env))
    return json(503, 'La presentazione non è ancora disponibile.');

  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const allowed = new Set([
    'https://horyzon.it', 'https://www.horyzon.it',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ]);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    allowed.add(`${url.protocol}//${url.host}`);
  if (!origin || !allowed.has(origin)) return json(403, 'Richiesta non autorizzata.');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json(415, 'Formato non valido.');
  if (Number(request.headers.get('content-length')) > 512)
    return json(413, 'Richiesta troppo grande.');

  let token: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 512) return json(413, 'Richiesta troppo grande.');
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !Object.hasOwn(body, 'token'))
      return json(400, 'Collegamento non valido.');
    token = (body as { token?: unknown }).token;
  } catch { return json(400, 'Richiesta non valida.'); }

  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))
    return json(400, 'Collegamento non valido.');

  try {
    const remainingSeconds = await getArchitectStartupVideoGate(process.env, token);
    if (remainingSeconds === null) return json(400, 'Collegamento non valido o scaduto.');
    return json(200, 'Presentazione disponibile.', remainingSeconds);
  } catch {
    return json(503, 'Impossibile verificare la presentazione in questo momento. Riprova.');
  }
}
