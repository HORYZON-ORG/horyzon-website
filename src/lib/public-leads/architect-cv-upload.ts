import { createHash } from 'node:crypto';
import { ARCHITECT_CV_MAX_BYTES, cvStorage, isPdf, storePendingCv, type CvStorage } from './architect-cv.ts';

type Options = { env?: Record<string, string | undefined>; storage?: CvStorage | null; now?: () => Date };
const attempts = new Map<string, { count: number; until: number }>();
const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (status: number, message: string) => reply(status, { ok: false, message });

/** Riceve il PDF grezzo (Content-Type: application/pdf), lo valida e restituisce un cvId opaco. */
export async function handleArchitectCvUpload(request: Request, options: Options = {}): Promise<Response> {
  const env = options.env ?? process.env;
  const origin = request.headers.get('origin');
  const allowed = new Set(['https://horyzon.it', 'https://www.horyzon.it', ...(env.VERCEL_URL ? [`https://${env.VERCEL_URL}`] : [])]);
  const local = new URL(request.url);
  if (['127.0.0.1', 'localhost'].includes(local.hostname)) for (const name of ['127.0.0.1', 'localhost']) allowed.add(`${local.protocol}//${name}${local.port ? `:${local.port}` : ''}`);
  if (!origin || !allowed.has(origin)) return fail(403, 'Richiesta non autorizzata.');
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/pdf') return fail(415, 'Carica il curriculum in formato PDF.');
  if (Number(request.headers.get('content-length')) > ARCHITECT_CV_MAX_BYTES) return fail(413, 'Il PDF supera i 5 MB. Riducilo e riprova.');

  const now = (options.now ?? (() => new Date()))().getTime();
  if (env.NODE_ENV !== 'test') {
    const key = createHash('sha256').update(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown').digest('hex');
    for (const [id, entry] of attempts) if (entry.until < now) attempts.delete(id);
    const entry = attempts.get(key) ?? { count: 0, until: now + 10 * 60000 };
    if (entry.count >= 6 || attempts.size >= 5000) return fail(429, 'Troppi caricamenti. Attendi qualche minuto e riprova.');
    entry.count++; attempts.set(key, entry);
  }

  const storage = options.storage !== undefined ? options.storage : cvStorage(env);
  if (!storage) return fail(503, 'Il caricamento del CV è temporaneamente non disponibile. Puoi scrivere a info@horyzon.it.');

  let bytes: Uint8Array;
  try {
    const reader = request.body?.getReader();
    if (!reader) return fail(400, 'Nessun file ricevuto.');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > ARCHITECT_CV_MAX_BYTES) { await reader.cancel(); return fail(413, 'Il PDF supera i 5 MB. Riducilo e riprova.'); }
      chunks.push(chunk.value);
    }
    bytes = Buffer.concat(chunks);
  } catch { return fail(400, 'Caricamento interrotto. Riprova.'); }
  if (!isPdf(bytes)) return fail(400, 'Il file non sembra un PDF valido. Esporta il CV in PDF e riprova.');

  try {
    return reply(200, { ok: true, cvId: await storePendingCv(storage, bytes) });
  } catch {
    return fail(502, 'Non riusciamo a salvare il CV in questo momento. Riprova tra poco oppure scrivi a info@horyzon.it.');
  }
}
