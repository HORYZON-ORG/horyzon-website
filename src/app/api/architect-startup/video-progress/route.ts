import { reportArchitectStartupPlayback } from '@/lib/public-leads/architect-hub-intake';
import { architectStartupConfirmationEnabled } from '@/lib/public-leads/architect-startup-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (status: number, data: Record<string, unknown>) =>
  Response.json({ ok: status === 200, ...data }, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });

const validRate = (rate: unknown): rate is number =>
  typeof rate === 'number' && [1, 1.1, 1.25, 1.5].includes(rate);

/** The native-player heartbeat is checked by private Hub RPC; no fixed timer. */
export async function POST(request: Request) {
  if (!architectStartupConfirmationEnabled(process.env))
    return json(503, { message: 'Presentazione non disponibile.' });

  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const allowed = new Set([
    'https://horyzon.it', 'https://www.horyzon.it',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ]);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    allowed.add(`${url.protocol}//${url.host}`);
  if (!origin || !allowed.has(origin))
    return json(403, { message: 'Richiesta non autorizzata.' });
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json(415, { message: 'Formato non valido.' });
  if (Number(request.headers.get('content-length')) > 512)
    return json(413, { message: 'Richiesta troppo grande.' });

  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 512) return json(413, { message: 'Richiesta troppo grande.' });
    input = JSON.parse(raw);
  } catch { return json(400, { message: 'Richiesta non valida.' }); }

  if (!input || typeof input !== 'object' || Array.isArray(input))
    return json(400, { message: 'Richiesta non valida.' });
  const params = input as Record<string, unknown>;
  const keys = Object.keys(params);
  if (keys.some(key => !['token', 'positionSeconds', 'playbackRate', 'complete'].includes(key)) ||
      typeof params.token !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(params.token) ||
      (params.positionSeconds !== undefined &&
       (typeof params.positionSeconds !== 'number' || !Number.isFinite(params.positionSeconds) ||
        params.positionSeconds < 0 || params.positionSeconds > 662)) ||
      (params.playbackRate !== undefined && !validRate(params.playbackRate)) ||
      (params.complete !== undefined && typeof params.complete !== 'boolean') ||
      (params.complete === true && params.positionSeconds === undefined))
    return json(400, { message: 'Dati del video non validi.' });

  try {
    const progress = await reportArchitectStartupPlayback(process.env, params.token, {
      positionSeconds: params.positionSeconds as number | undefined,
      playbackRate: params.playbackRate as number | undefined,
      complete: params.complete as boolean | undefined,
    });
    if (!progress) return json(400, { message: 'Collegamento non valido o scaduto.' });
    return json(200, progress);
  } catch {
    return json(503, { message: 'Non riusciamo a verificare la visione. Riprova.' });
  }
}
