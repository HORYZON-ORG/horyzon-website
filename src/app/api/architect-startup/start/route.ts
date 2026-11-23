import { beginArchitectStartupLead } from '@/lib/public-leads/architect-hub-intake';
import { architectStartupEnabled } from '@/lib/public-leads/architect-startup-config';
import { PATRIMONIAL_PILOT_PRIVACY_VERSION } from '@/content/patrimonial-funnels';
import { normalizePhone } from '@/lib/radar/highlevel';

export const runtime = 'nodejs';

const json = (status: number, message: string, nextStep?: { href: string }) =>
  Response.json({ ok: status === 200, message, ...(nextStep ? { nextStep } : {}) }, {
    status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });

export async function POST(request: Request) {
  if (!architectStartupEnabled(process.env)) return json(503, 'Il percorso Startup non è ancora disponibile.');
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  const allowed = new Set(['https://horyzon.it', 'https://www.horyzon.it',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])]);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    allowed.add(`${url.protocol}//${url.host}`);
  if (!origin || !allowed.has(origin)) return json(403, 'Richiesta non autorizzata.');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json(415, 'Formato non valido.');
  if (Number(request.headers.get('content-length')) > 2048)
    return json(413, 'Richiesta troppo grande.');

  let fields: unknown;
  try {
    const body = await request.text();
    if (body.length > 2048) return json(413, 'Richiesta troppo grande.');
    fields = JSON.parse(body);
  } catch { return json(400, 'Richiesta non valida.'); }
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return json(400, 'Richiesta non valida.');
  const input = fields as Record<string, unknown>;
  if (Object.keys(input).some(k => !['firstName','lastName','email','phone','consent','website'].includes(k)) ||
    input.website || input.consent !== true) return json(400, 'Controlla i dati e il consenso privacy.');
  const firstName = typeof input.firstName === 'string' ? input.firstName.trim() : '';
  const lastName = typeof input.lastName === 'string' ? input.lastName.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const phoneRaw = typeof input.phone === 'string' ? input.phone.trim() : '';
  const phone = /^\+?[0-9\s().\-/]{8,40}$/.test(phoneRaw) ? normalizePhone(phoneRaw) : '';
  if (!firstName || firstName.length > 120 || !lastName || lastName.length > 120 ||
    !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^\+[1-9][0-9]{7,14}$/.test(phone))
    return json(400, 'Inserisci nome, cognome, email e un numero di telefono valido.');

  // Vercel's forwarding headers take precedence; never retain the raw IP in Hub.
  const sourceIp = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  try {
    const href = await beginArchitectStartupLead(process.env, {
      firstName, lastName, email, phone, privacyVersion: PATRIMONIAL_PILOT_PRIVACY_VERSION,
    }, sourceIp);
    return json(200, 'Recapiti ricevuti. Puoi accedere alla presentazione Startup Horyzon.', { href });
  } catch {
    return json(503, 'Non riusciamo a preparare la presentazione. Riprova fra poco.');
  }
}
