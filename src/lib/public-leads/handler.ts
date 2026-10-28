import {protectedRemoteConfigured} from '../patrimonial-radar-server/remote-config.ts';
import type {EventIntakePort} from '../patrimonial-radar-server/event-intake.ts';
import { createHash, randomUUID } from 'node:crypto';
import { patrimonialInterest, patrimonialInterests, PATRIMONIAL_PRIVACY_VERSION } from '../../content/patrimonial.ts';
import { callHighLevel, highLevelConfig, normalizePhone } from '../radar/highlevel.ts';
import { isLegacyLeadPayload, pilotCrmDetails, pilotMode, validatePilotLead, validatePatrimonialV2 } from './patrimonial-funnels.ts';
import { pilotForms } from '../../content/patrimonial-funnels.ts';
import { recordEventLeadInHub } from './patrimonial-hub-event-ingress.ts';
import { validateArchitectEventReferral } from './patrimonial-referral-preflight.ts';
import { canonicalPatrimonialPayload, isPatrimonialRequestId, PATRIMONIAL_V2, type PatrimonialRequest } from './patrimonial-contract.ts';
import { patrimonialConsentEvidence } from './patrimonial-consents.ts';
import { claimCv, cvStorage, isCvId, readCandidateCv, uploadCvToHighLevel, type CvStorage } from './architect-cv.ts';
import { registerArchitectCandidate, markArchitectCandidateCrm } from './architect-hub-intake.ts';
import { createProductionPatrimonialStore, patrimonialFlags, PatrimonialConflictError, PatrimonialReplayExpiredError, type PatrimonialStore } from './patrimonial-store.ts';

type Options = { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: () => Date; store?: PatrimonialStore; cvStorage?: CvStorage | null; eventRadarNextStep?: (requestId:string,email:string,payloadHash:string)=>Promise<{href:string;expiresInSeconds:number}>; eventIntake?:EventIntakePort; hubFetchImpl?: typeof fetch };
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
  // Explicit dispatch prevents a malformed/disabled v2 request falling into 2A or legacy.
  if (Object.hasOwn(input, 'contractVersion')) {
    if (input.contractVersion !== PATRIMONIAL_V2) return response(400, 'Versione della richiesta non valida.');
    return handlePatrimonialV2(request, input, options);
  }
  if (Object.hasOwn(input, 'requestId') || request.headers.has('idempotency-key')) return response(400, 'Versione della richiesta mancante.');
  // Il CV viaggia a parte (/api/public-leads/cv): qui arriva solo il suo id opaco.
  // Obbligatorio per la candidatura Architetto, mai accettato dagli altri moduli.
  const { cvId, ...fields } = input;
  if (cvId !== undefined && input.mode !== 'architect-path') return response(400, 'Controlla i dati e la richiesta di ricontatto.');
  const pilot = pilotMode(fields.mode) ? validatePilotLead(fields) : null;
  if (pilot?.mode === 'architect-path' && !isCvId(cvId)) return response(400, 'Allega il tuo curriculum in PDF per inviare la candidatura.');
  if (!isLegacyLeadPayload(input) && !pilot) return response(400, 'Controlla i dati e la richiesta di ricontatto.');
  // Event signup requires explicit go-live, a functioning Hub bridge and verified referrals.
  if (pilot?.mode === 'patrimonial-event') {
    if (env.NODE_ENV !== 'test' && env.PATRIMONIAL_EVENT_SIGNUP_ENABLED !== 'true')
      return response(503, 'Le iscrizioni all’evento non sono ancora aperte.');
    if (env.PATRIMONIAL_EVENT_SIGNUP_ENABLED === 'true' && env.HORYZON_HUB_EVENT_INGRESS_ENABLED !== 'true')
      return response(503, 'L’archivio Horyzon non è ancora pronto per le iscrizioni.');
    if (pilot.referralCode) {
      try { await validateArchitectEventReferral({ code: pilot.referralCode, env, fetchImpl: options.fetchImpl }); }
      catch { return response(503, 'Il link personale non è verificabile. Nessuna iscrizione è stata registrata.'); }
    }
  }
  const name = text(input.name, 120), email = text(input.email, 254), rawPhone = text(input.phone ?? '', 40), message = text(input.message ?? '', 1500);
  const interest = patrimonialInterest(input.interest);
  const phone = rawPhone === null ? null : normalizePhone(rawPhone);
  if (!pilot && (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !interest || message === null || phone === null || (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) || input.consent !== true || input.website)) {
    return response(400, 'Controlla i dati e la richiesta di ricontatto.');
  }
  const config = highLevelConfig(env);
  const hubArchitectEnabled = pilot?.mode === 'architect-path' && env.PATRIMONIAL_ARCHITECT_HUB_INTAKE_ENABLED === 'true';
  if (!config && !hubArchitectEnabled) return response(503, 'Il modulo è temporaneamente non disponibile. Puoi scrivere a info@horyzon.it.');
  const now = (options.now ?? (() => new Date()))();
  // Process-local abuse guard; no personal data retained in the key. Provider upsert deduplicates contacts.
  if (env.NODE_ENV !== 'test') {
    const key = createHash('sha256').update(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown').digest('hex');
    for (const [id, entry] of attempts) if (entry.until < now.getTime()) attempts.delete(id);
    const entry = attempts.get(key) ?? { count: 0, until: now.getTime() + 60000 };
    if (entry.count >= 5 || attempts.size >= 5000) return response(429, 'Attendi un minuto prima di riprovare.');
    entry.count++; attempts.set(key, entry);
  }
  const crm = config ? { ...config, fetchImpl: options.fetchImpl ?? ((url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10000) })) } : null;
  if (pilot) {
    const details = pilotCrmDetails(pilot, now);
    const cv = pilot.mode === 'architect-path' && isCvId(cvId) ? cvId : null;
    const storage = options.cvStorage !== undefined ? options.cvStorage : cvStorage(env);
    if (cv) {
      // Prima il CV, poi il CRM: nessun contatto HighLevel per una candidatura senza CV.
      if (!storage) return response(503, 'Il caricamento del CV è temporaneamente non disponibile. Puoi scrivere a info@horyzon.it.');
      try {
        if (await claimCv(storage, cv) === 'missing') return response(400, 'Il CV caricato non è più disponibile. Caricalo di nuovo e reinvia la candidatura.');
      } catch { return response(503, 'Non riusciamo a collegare il CV in questo momento. Riprova tra poco.'); }
    }
    // Store the private Horyzon candidate before projecting it to HighLevel.
    // The cutover is opt-in and fail-closed; the event/public funnels are unchanged.
    let hubStored = false;
    if (cv && pilot.mode === 'architect-path') {
      try {
        hubStored = await registerArchitectCandidate(env, cv, pilot, options.hubFetchImpl);
      } catch {
        return response(503, 'Non riusciamo a registrare la candidatura nell’archivio Horyzon. Riprova tra poco.');
      }
    }
    // The Hub is the receipt of record. A CRM outage must not lose a stored
    // application or ask the person to submit their CV again.
    if (!crm || !config) return hubStored
      ? response(200, pilotForms[pilot.mode].success)
      : response(503, 'Il modulo è temporaneamente non disponibile.');
    try {
      const result = await callHighLevel<{ contact?: { id?: string } }>(crm, '/contacts/upsert', { locationId: config.locationId, firstName: pilot.firstName, lastName: pilot.lastName, email: pilot.email, ...(pilot.phone ? { phone: pilot.phone } : {}), source: details.source });
      const id = result.contact?.id;
      if (!id || typeof id !== 'string') throw new Error('Contact confirmation missing');
      await callHighLevel(crm, `/contacts/${encodeURIComponent(id)}/tags`, { tags: details.tags });
      const fieldId = env.HIGHLEVEL_CV_FIELD_ID?.trim();
      const cvLine = cv ? `\nCurriculum: ricevuto (PDF) · archivio privato Horyzon · rif. ${cv}${fieldId ? '' : ' · campo CV HighLevel non ancora configurato'}` : '';
      await callHighLevel(crm, `/contacts/${encodeURIComponent(id)}/notes`, { body: details.note + cvLine });
      if (cv && storage && fieldId) {
        try {
          await uploadCvToHighLevel({ ...crm, fetchImpl: options.fetchImpl ?? ((url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(25000) })) }, id, fieldId, await readCandidateCv(storage, cv), `CV-${pilot.lastName}-${pilot.firstName}.pdf`.replace(/[^\w.-]+/g, '_'));
        } catch {
          // La candidatura e il CV sono già al sicuro: si segnala solo la verifica manuale.
          try { await callHighLevel(crm, `/contacts/${encodeURIComponent(id)}/notes`, { body: `Curriculum: caricamento nel campo HighLevel non riuscito · verifica manuale · rif. ${cv}` }); } catch { /* best effort */ }
        }
      }
      if (hubStored && cv) {
        try { await markArchitectCandidateCrm(env, cv, id, true, options.hubFetchImpl); }
        catch { /* CRM succeeded; Hub keeps a visible pending sync state for reconciliation. */ }
      }
      if (pilot.mode === 'patrimonial-event' && env.HORYZON_HUB_EVENT_INGRESS_ENABLED === 'true') {
        try {
          const result = await recordEventLeadInHub({
            lead: pilot, highlevelContactId: id, highlevelLocationId: config.locationId,
            source: details.source, env, fetchImpl: options.fetchImpl,
          });
          if (result !== 'RECORDED') throw new Error('HUB_NOT_RECORDED');
        } catch {
          return response(502, 'Richiesta ricevuta nel CRM, ma collegamento Horyzon non confermato. Non inviare nuovamente: contatta info@horyzon.it per verificare la scheda.');
        }
      }
      return response(200, pilotForms[pilot.mode].success);
    } catch {
      if (hubStored && cv) {
        try { await markArchitectCandidateCrm(env, cv, null, false, options.hubFetchImpl); }
        catch { /* The candidate and CV remain stored; manual reconciliation may be required. */ }
      }
      return hubStored
        ? response(200, pilotForms[pilot.mode].success)
        : response(502, 'Non possiamo confermare la ricezione completa. Riprova oppure scrivi a info@horyzon.it.');
    }
  }
  // The legacy contract and mapping remain unchanged after the pilot branch.
  if (!crm || !config) return response(503, 'Il modulo è temporaneamente non disponibile.');
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

const v2Attempts = new Map<string, { count: number; until: number }>();
async function handlePatrimonialV2(request: Request, input: Record<string, unknown>, options: Options): Promise<Response> {
  const env = options.env ?? process.env;
  if (!patrimonialFlags(env).v2) return response(503, 'Questo modulo non è ancora disponibile.');
  if (input.mode === 'patrimonial-event' && env.NODE_ENV !== 'test' && env.PATRIMONIAL_EVENT_SIGNUP_ENABLED !== 'true')
    return response(503, 'Le iscrizioni all’evento non sono ancora aperte.');
  if (input.website) return response(400, 'Richiesta non valida.');
  const now = (options.now ?? (() => new Date()))();
  if (env.NODE_ENV !== 'test') {
    const key = createHash('sha256').update(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown').digest('hex');
    for (const [id, entry] of v2Attempts) if (entry.until < now.getTime()) v2Attempts.delete(id);
    const entry = v2Attempts.get(key) ?? { count: 0, until: now.getTime() + 60000 };
    if (entry.count >= 5 || v2Attempts.size >= 5000) return response(429, 'Attendi un minuto prima di riprovare.');
    entry.count++; v2Attempts.set(key, entry);
  }
  const lead = validatePatrimonialV2(input);
  const headerId = request.headers.get('idempotency-key');
  if (!lead || !isPatrimonialRequestId(input.requestId) || !isPatrimonialRequestId(headerId) || input.requestId.toLowerCase() !== headerId.toLowerCase()) return response(400, 'Controlla i dati e il riferimento della richiesta.');
  const requestId = input.requestId.toLowerCase();
  try {
    // Production requires configured, healthy Supabase and explicit readiness.
    // Memory is accepted only through server-side injection with NODE_ENV=test.
    const intake=lead.mode==='patrimonial-event'?options.eventIntake:undefined;
    // The superseded runtime intake cannot persist v2 referral provenance.
    // Never drop the code or fall through to legacy/CRM on that configuration.
    if (intake && lead.referralCode !== undefined) return response(503, 'Il collegamento personale non è ancora disponibile in questo ambiente.');
    const store = intake ? null : options.store ?? createProductionPatrimonialStore(env);
    if (store && store.kind !== 'durable' && env.NODE_ENV !== 'test') return response(503, 'Il modulo è temporaneamente non disponibile.');
    const receivedAt = now.toISOString();
    const candidate: PatrimonialRequest = {
      id: requestId, contractVersion: PATRIMONIAL_V2, payload: lead,
      payloadHash: createHash('sha256').update(canonicalPatrimonialPayload(lead)).digest('hex'),
      receivedAt, replayExpiresAt: new Date(now.getTime() + 90 * 86400000).toISOString(),
      technicalState: 'RECEIVED', intentId: null,
      receipt: { ok: true, requestId, receiptStatus: 'received', crmStatus: 'pending' },
    };
    const receipt = intake ? await intake(candidate) : await store!.transaction(async tx => {
      const acquired = await tx.createOrReplayRequest(candidate, receivedAt);
      if (acquired.replay) return acquired.request.receipt;
      for (const evidence of patrimonialConsentEvidence(candidate)) await tx.appendConsentEvidence(evidence);
      const provisionalKey = createHash('sha256').update(JSON.stringify([lead.mode, lead.email, lead.eventEditionId])).digest('hex');
      const intent = await tx.createOrReuseIntent({
        id: randomUUID(), provisionalKey, mode: lead.mode, requestedEditionId: lead.eventEditionId,
        contactId: null, opportunityId: null, identityResolved: false, technicalState: 'IDENTITY_REVIEW', createdAt: receivedAt,
      });
      await tx.attachIntent(requestId, intent.id);
      await tx.enqueueOperation({
        id: randomUUID(), operationKey: `${requestId}:SYNC_REQUEST:v1`, kind: 'SYNC_REQUEST', requestId, intentId: intent.id,
        identityLockKey: createHash('sha256').update(lead.email).digest('hex'),
        technicalState: 'SYNC_PENDING', createdAt: receivedAt, nextAttemptAt: receivedAt,
        attemptCount: 0, leaseToken: null, leaseVersion: 0, leaseExpiresAt: null, reconcileRequired: false, lastErrorCode: null,
      });
      await tx.appendEvent({ id: `${requestId}:received`, name: 'request_received', requestId, intentId: intent.id, occurredAt: receivedAt, contractVersion: PATRIMONIAL_V2 });
      return candidate.receipt;
    });
    // No CRM transport, provider credentials, messages or remote effects on v2.
    if (lead.mode === 'patrimonial-event' && options.eventRadarNextStep && ((env.PATRIMONIAL_RADAR_FOUNDATION_CONTEXT === 'local-test' && !env.VERCEL && env.VERCEL_ENV !== 'production') || (protectedRemoteConfigured(env) && env.PATRIMONIAL_EVENT_RADAR_CONTEXT === 'protected-remote'))) {
      // The canonical receipt is already committed. A missing Radar continuation
      // must never invalidate it or replay the legacy CRM path.
      try {
        const radarNextStep = await options.eventRadarNextStep(requestId, lead.email, candidate.payloadHash);
        if (/^\/radar-patrimoniale#event=[A-Za-z0-9_-]{43}$/.test(radarNextStep.href)) return Response.json({...receipt,radarNextStep},{status:202,headers:{'Cache-Control':'no-store'}});
      } catch { /* Keep the truthful canonical receipt; no guessed identity/link. */ }
    }
    return Response.json(receipt, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof PatrimonialConflictError) return response(409, 'Questo riferimento è già associato a una richiesta con dati diversi. Verifica il precedente invio prima di crearne uno nuovo.');
    if (error instanceof PatrimonialReplayExpiredError) return response(410, 'Il riferimento è scaduto. Contattaci per verificare il precedente invio.');
    // A commit may already exist: keep the same ID on retry. No compensation or fallback.
    return response(503, 'Ricezione non confermata. Riprova con lo stesso riferimento oppure scrivici per verificare l’invio.');
  }
}
