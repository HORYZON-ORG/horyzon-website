// Curriculum per la candidatura Architetto Patrimoniale (percorso pilot).
// Il file vive solo in un bucket Supabase privato: mai URL pubblici, mai nel testo
// delle note CRM, mai nei log. Il nome file del candidato non viene usato né salvato.
//
//   1. /api/public-leads/cv  → valida il PDF e lo salva in pending/<cvId>.pdf
//   2. /api/public-leads     → la candidatura porta cvId; il server sposta il file in
//      candidates/<cvId>.pdf PRIMA di scrivere su HighLevel (niente contatto senza CV)
//   3. se HIGHLEVEL_CV_FIELD_ID è configurato, il PDF viene caricato anche nel campo
//      file del contatto; un errore qui non fa perdere la candidatura (nota di verifica)
//   4. il cron di retention cancella pending dopo 24 ore e candidates dopo 12 mesi
import { randomUUID } from 'node:crypto';

export const ARCHITECT_CV_BUCKET = 'architect-cv';
export const ARCHITECT_CV_MAX_BYTES = 5 * 1024 * 1024;
export const ARCHITECT_CV_PENDING_TTL_MS = 24 * 3600 * 1000;
export const ARCHITECT_CV_RETENTION_MS = 365 * 24 * 3600 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type CvStorage = { url: string; key: string; fetchImpl: typeof fetch };
export type Env = Record<string, string | undefined>;

export const isCvId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** Un PDF reale inizia con "%PDF-" e contiene "%%EOF" verso la fine. */
export function isPdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 64 || bytes.byteLength > ARCHITECT_CV_MAX_BYTES) return false;
  const head = Buffer.from(bytes.subarray(0, 5)).toString('latin1');
  const tail = Buffer.from(bytes.subarray(Math.max(0, bytes.byteLength - 2048))).toString('latin1');
  return head === '%PDF-' && tail.includes('%%EOF');
}

export function cvStorage(env: Env, fetchImpl: typeof fetch = fetch): CvStorage | null {
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.trim().replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key, fetchImpl } : null;
}

const headers = (s: CvStorage, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${s.key}`, apikey: s.key, ...extra });
const objectUrl = (s: CvStorage, path: string) => `${s.url}/storage/v1/object/${ARCHITECT_CV_BUCKET}/${path}`;
export const pendingPath = (id: string) => `pending/${id}.pdf`;
export const candidatePath = (id: string) => `candidates/${id}.pdf`;

export async function storePendingCv(s: CvStorage, bytes: Uint8Array): Promise<string> {
  const id = randomUUID();
  const res = await s.fetchImpl(objectUrl(s, pendingPath(id)), {
    method: 'POST', headers: headers(s, { 'Content-Type': 'application/pdf', 'x-upsert': 'false', 'Cache-Control': 'no-store' }), body: Buffer.from(bytes),
  });
  if (!res.ok) throw new Error('cv_store_failed');
  return id;
}

async function exists(s: CvStorage, path: string): Promise<boolean> {
  const res = await s.fetchImpl(`${s.url}/storage/v1/object/info/${ARCHITECT_CV_BUCKET}/${path}`, { headers: headers(s) });
  if (res.ok) return true;
  if (res.status === 400 || res.status === 404) return false;
  throw new Error('cv_lookup_failed');
}

/**
 * Collega il CV alla candidatura spostandolo da pending a candidates.
 * Idempotente: se il file è già in candidates (retry dopo un errore CRM) va bene così.
 * 'missing' = nessun file con quell'id (scaduto o mai caricato).
 */
export async function claimCv(s: CvStorage, id: string): Promise<'claimed' | 'missing'> {
  const res = await s.fetchImpl(`${s.url}/storage/v1/object/move`, {
    method: 'POST', headers: headers(s, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ bucketId: ARCHITECT_CV_BUCKET, sourceKey: pendingPath(id), destinationKey: candidatePath(id) }),
  });
  if (res.ok) return 'claimed';
  return await exists(s, candidatePath(id)) ? 'claimed' : 'missing';
}

export async function readCandidateCv(s: CvStorage, id: string): Promise<Uint8Array> {
  const res = await s.fetchImpl(objectUrl(s, candidatePath(id)), { headers: headers(s) });
  if (!res.ok) throw new Error('cv_read_failed');
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Carica il PDF nel campo file del contatto HighLevel (endpoint forms/upload-custom-files,
 * chiave multipart "<customFieldId>_<uuid>"). Da verificare con un read-back nella Location
 * prima di considerarlo affidabile: per questo un errore non blocca mai la candidatura.
 */
export async function uploadCvToHighLevel(crm: { token: string; locationId: string; fetchImpl: typeof fetch }, contactId: string, fieldId: string, bytes: Uint8Array, fileName: string): Promise<void> {
  const body = new FormData();
  body.append(`${fieldId}_${randomUUID()}`, new Blob([Buffer.from(bytes)], { type: 'application/pdf' }), fileName);
  const qs = new URLSearchParams({ contactId, locationId: crm.locationId });
  const res = await crm.fetchImpl(`https://services.leadconnectorhq.com/forms/upload-custom-files?${qs}`, {
    method: 'POST', headers: { Authorization: `Bearer ${crm.token}`, Version: '2021-07-28', Accept: 'application/json' }, body,
  });
  if (!res.ok) throw new Error('cv_highlevel_failed');
}

type Listed = { name: string; id: string | null; created_at?: string | null };
async function list(s: CvStorage, prefix: string, offset: number): Promise<Listed[]> {
  const res = await s.fetchImpl(`${s.url}/storage/v1/object/list/${ARCHITECT_CV_BUCKET}`, {
    method: 'POST', headers: headers(s, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'created_at', order: 'asc' } }),
  });
  if (!res.ok) throw new Error('cv_list_failed');
  return await res.json() as Listed[];
}

/** Retention: pending oltre 24 ore, candidates oltre 12 mesi. Restituisce quanti file ha rimosso. */
export async function purgeExpiredCvs(s: CvStorage, now: Date): Promise<{ pending: number; candidates: number }> {
  const removed = { pending: 0, candidates: 0 };
  for (const [prefix, ttl, bucket] of [['pending', ARCHITECT_CV_PENDING_TTL_MS, 'pending'], ['candidates', ARCHITECT_CV_RETENTION_MS, 'candidates']] as const) {
    const expired: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await list(s, prefix, offset);
      for (const item of page) {
        if (!item.id || !item.created_at) continue; // cartelle o metadati mancanti: mai cancellare alla cieca
        if (now.getTime() - Date.parse(item.created_at) > ttl) expired.push(`${prefix}/${item.name}`);
      }
      if (page.length < 1000) break;
    }
    for (let i = 0; i < expired.length; i += 100) {
      const res = await s.fetchImpl(`${s.url}/storage/v1/object/${ARCHITECT_CV_BUCKET}`, {
        method: 'DELETE', headers: headers(s, { 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: expired.slice(i, i + 100) }),
      });
      if (!res.ok) throw new Error('cv_purge_failed');
    }
    removed[bucket] = expired.length;
  }
  return removed;
}
