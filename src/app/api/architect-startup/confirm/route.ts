import { confirmArchitectStartupInterest } from '@/lib/public-leads/architect-hub-intake';
import { architectStartupConfirmationEnabled } from '@/lib/public-leads/architect-startup-config';

export const runtime = 'nodejs';

const json = (status: number, message: string) => Response.json(
  { ok: status === 200, message },
  { status, headers: { 'Cache-Control': 'no-store' } },
);

export async function POST(request: Request) {
  if (!architectStartupConfirmationEnabled(process.env)) {
    return json(503, 'La conferma non è ancora disponibile.');
  }
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const allowed = new Set([
    'https://horyzon.it', 'https://www.horyzon.it',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ]);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    allowed.add(`${url.protocol}//${url.host}`);
  }
  if (!origin || !allowed.has(origin)) return json(403, 'Richiesta non autorizzata.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, 'Formato non valido.');
  if (Number(request.headers.get('content-length')) > 512) return json(413, 'Richiesta troppo grande.');

  let token: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 512) return json(413, 'Richiesta troppo grande.');
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !Object.hasOwn(body, 'token')) return json(400, 'Link non valido.');
    token = (body as { token?: unknown }).token;
  } catch { return json(400, 'Richiesta non valida.'); }

  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return json(400, 'Link non valido.');
  try {
    const confirmed = await confirmArchitectStartupInterest(process.env, token);
    if (!confirmed) return json(400, 'Link non valido o scaduto. Contatta Horyzon per assistenza.');
    return json(200, 'Conferma registrata. Il team potrà ricontattarti.');
  } catch {
    return json(503, 'Non riusciamo a registrare la conferma. Riprova senza ripetere la candidatura.');
  }
}
