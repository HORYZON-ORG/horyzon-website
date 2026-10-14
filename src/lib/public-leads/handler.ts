import { createHash } from 'node:crypto';
import { patrimonialInterest, patrimonialInterests, PATRIMONIAL_PRIVACY_VERSION } from '../../content/patrimonial.ts';
import { callHighLevel, highLevelConfig, normalizePhone } from '../radar/highlevel.ts';
import { isLegacyLeadPayload, pilotCrmDetails, pilotMode, validatePilotLead } from './patrimonial-funnels.ts';
import { pilotForms } from '../../content/patrimonial-funnels.ts';

type Options = { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: () => Date };
const attempts = new Map<string, { count: number; until: number }>();
const response = (status: number, message: string) => Response.json({ ok: status === 200, message }, { status, headers: { 'Cache-Control': 'no-store' } });
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max ? value.trim() : null;

export async function handlePublicLead(request: Request, options: Options = {}): Promise<Response> {
  const env = options.env ?? process.env;
  const origin = request.headers.get('origin');
  const allowed = new Set(['https://horyzon.it', 'https://www.horyzon.it', ...(env.VERCEL_URL ? [`https://${env.VERCEL_URL}`] : [])]);
  const host = new URL(request.url).hostname;
  if (['127.0.0.1', 'localhost'].includes(host)) {
    const localUrl = new URL(request.url);
    for (const name of ['127.0.0.1', 'localhost']) allowed.add(`${localUrl.protocol}//${name}${localUrl.port ? `:${localUrl.port}` : ''}`);
  }
  if (!origin || !allowed.has(origin)) return response(403, 'Richiesta non autorizzata.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) return response(415, 'Formato non valido.');
  if (Number(request.headers.get('content-length')) > 12000) return response(413, 'Richiesta troppo grande.');
  let input: Record<string, unknown>;
  try {
    const reader = request.body?.getReader();
    if (!reader) return response(400, 'Richiesta non valida.');
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 12000) { await reader.cancel(); return response(413, 'Richiesta troppo grande.'); } chunks.push(chunk.value); }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!input || typeof input !== 'object' || Array.isArray(input)) return response(400, 'Richiesta non valida.');
  } catch { return response(400, 'Richiesta non valida.'); }
  const pilot = pilotMode(input.mode) ? validatePilotLead(input) : null;
  if (!isLegacyLeadPayload(input) && !pilot) return response(400, 'Controlla i dati e la richiesta di ricontatto.');
  const name = text(input.name, 120), email = text(input.email, 254), rawPhone = text(input.phone ?? '', 40), message = text(input.message ?? '', 1500);
  const interest = patrimonialInterest(input.interest);
  const phone = rawPhone === null ? null : normalizePhone(rawPhone);
  if (!pilot && (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !interest || message === null || phone === null || (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) || input.consent !== true || input.website)) {
    return response(400, 'Controlla i dati e la richiesta di ricontatto.');
  }
  const config = highLevelConfig(env);
  if (!config) return response(503, 'Il modulo è temporaneamente non disponibile. Puoi scrivere a info@horyzon.it.');
  const now = (options.now ?? (() => new Date()))();
  // Process-local abuse guard; no personal data retained in the key. Provider upsert deduplicates contacts.
  if (env.NODE_ENV !== 'test') {
    const key = createHash('sha256').update(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown').digest('hex');
    for (const [id, entry] of attempts) if (entry.until < now.getTime()) attempts.delete(id);
    const entry = attempts.get(key) ?? { count: 0, until: now.getTime() + 60000 };
    if (entry.count >= 5 || attempts.size >= 5000) return response(429, 'Attendi un minuto prima di riprovare.');
    entry.count++; attempts.set(key, entry);
  }
  const crm = { ...config, fetchImpl: options.fetchImpl ?? ((url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10000) })) };
  if (pilot) {
    const details = pilotCrmDetails(pilot, now);
    try {
      const result = await callHighLevel<{ contact?: { id?: string } }>(crm, '/contacts/upsert', { locationId: config.locationId, firstName: pilot.firstName, lastName: pilot.lastName, email: pilot.email, ...(pilot.phone ? { phone: pilot.phone } : {}), source: details.source });
      const id = result.contact?.id;
      if (!id || typeof id !== 'string') throw new Error('Contact confirmation missing');
      await callHighLevel(crm, `/contacts/${encodeURIComponent(id)}/tags`, { tags: details.tags });
      await callHighLevel(crm, `/contacts/${encodeURIComponent(id)}/notes`, { body: details.note });
      return response(200, pilotForms[pilot.mode].success);
    } catch {
      return response(502, 'Non possiamo confermare la ricezione completa. Riprova oppure scrivi a info@horyzon.it.');
    }
  }
  // The legacy contract and mapping remain unchanged after the pilot branch.
  if (!name || !email || !interest) return response(400, 'Controlla i dati e la richiesta di ricontatto.');
  const parts = name.split(/\s+/);
  try {
    const result = await callHighLevel<{ contact?: { id?: string } }>(crm, '/contacts/upsert', { locationId: config.locationId, firstName: parts[0], lastName: parts.slice(1).join(' '), email: email.toLowerCase(), ...(phone ? { phone } : {}), source: `Horyzon · ${patrimonialInterests[interest].label} (horyzon.it)` });
    const id = result.contact?.id;
    if (!id || typeof id !== 'string') throw new Error('Contact confirmation missing');
    await callHighLevel(crm, `/contacts/${encodeURIComponent(id)}/tags`, { tags: ['horyzon-benessere-patrimoniale', `horyzon-${interest}`] });
    await callHighLevel(crm, `/contacts/${encodeURIComponent(id)}/notes`, { body: [`Richiesta Horyzon: ${patrimonialInterests[interest].label}`, `Ricevuta: ${now.toISOString()}`, `Provenienza: horyzon.it/contatti · ${interest}`, `Privacy: ${PATRIMONIAL_PRIVACY_VERSION} · /privacy-policy`, 'Ricontatto richiesto: sì · nessuna iscrizione a campagne marketing', ...(message ? [`Messaggio: ${message}`] : [])].join('\n') });
    return response(200, 'Richiesta ricevuta. Horyzon ti ricontatterà per questo percorso.');
  } catch {
    // Never expose or log provider response bodies, credentials or contact data.
    return response(502, 'Non possiamo confermare la ricezione completa. Riprova oppure scrivi a info@horyzon.it.');
  }
}
