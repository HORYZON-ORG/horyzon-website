import { RadarBackendError, type Snapshot } from './contracts.ts';
import { object, validToken } from './security.ts';
import type { PatrimonialRadarService } from './service.ts';
import { customerProjection } from './customer-projection.ts';
import type {PatrimonialFoundation} from './foundation.ts';

const prefix = '/api/patrimonial-radar';
const responseHeaders = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
function reply(value: unknown, status = 200) { return Response.json(value, { status, headers: responseHeaders }); }
function snapshotReceipt(snapshot: Snapshot) {
  const { id, assessmentId, approvedRevision, versions, inputHash, resultHash, completedAt } = snapshot;
  return { id, assessmentId, approvedRevision, versions, inputHash, resultHash, completedAt, customer: customerProjection(snapshot) };
}
function cookieValue(request: Request, name: string): string {
  const matches = (request.headers.get('cookie') ?? '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${name}=`));
  if (matches.length !== 1) return '';
  const value = matches[0].slice(name.length + 1);
  return validToken(value) ? value : '';
}
function cookie(name: string, value: string, seconds: number, production: boolean) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, seconds)}${production ? '; Secure' : ''}`;
}
async function json(request: Request): Promise<unknown> {
  if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '') || Number(request.headers.get('content-length') ?? 0) > 65536 || !request.body) throw new RadarBackendError('INVALID');
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length; if (size > 65536) { await reader.cancel(); throw new RadarBackendError('INVALID'); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    let nodes = 0;
    const inspect = (v: unknown, depth: number) => {
      if (++nodes > 5000 || depth > 16 || (typeof v === 'string' && v.length > 2048)) throw new RadarBackendError('INVALID');
      if (v && typeof v === 'object') for (const [key, child] of Object.entries(v)) { if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new RadarBackendError('INVALID'); inspect(child, depth + 1); }
    };
    inspect(value, 0); return value;
  } catch { throw new RadarBackendError('INVALID'); } finally { reader.releaseLock(); }
}
export function createPatrimonialRadarHandler(service: PatrimonialRadarService, config: { origin: string; production: boolean; enabled: boolean; foundation?:PatrimonialFoundation; remoteNetworkKey?:(request:Request)=>string }) {
  const origin = new URL(config.origin).origin;
  const sessionName = config.production ? '__Host-pr_session' : 'pr_session';
  const bindingName = config.production ? '__Host-pr_login' : 'pr_login';
  return async (request: Request): Promise<Response> => {
    if (!config.enabled) return reply({ error: 'NOT_FOUND' }, 404);
    try {
      const url = new URL(request.url), path = url.pathname.slice(prefix.length);
      if (url.origin !== origin || !url.pathname.startsWith(`${prefix}/`) || url.search) throw new RadarBackendError('INVALID');
      const site = request.headers.get('sec-fetch-site');
      if (site && !['same-origin', 'none'].includes(site)) throw new RadarBackendError('FORBIDDEN');
      if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
      const token = cookieValue(request, sessionName), csrf = request.headers.get('x-patrimonial-csrf');
      const mutation = request.method === 'POST';
      if (mutation && request.headers.get('origin') !== origin) throw new RadarBackendError('FORBIDDEN');
      if (mutation && path !== '/identity/request' && path !== '/identity/verify' && !service.secrets.checkCsrf(token, csrf)) throw new RadarBackendError('FORBIDDEN');
      if(mutation&&path.startsWith('/event/')&&config.foundation){
        if(path==='/event/propose'){const b=object(await json(request),['ticket']);return reply(await config.foundation.proposeEvent(token,String(b.ticket)));}
        if(path==='/event/confirm'){const b=object(await json(request),['id','expectedRevision']);return reply(await config.foundation.confirmEvent(token,String(b.id),Number(b.expectedRevision)));}
        if(path==='/event/link-assessment'){const b=object(await json(request),['assessmentId','reconciliationId']);return reply(await config.foundation.linkAssessment(token,String(b.assessmentId),String(b.reconciliationId)));}
      }
      if (mutation && path === '/identity/request') {
        // Pre-authentication CSRF: exact Origin + JSON + custom non-simple header.
        if (csrf !== 'request-code') throw new RadarBackendError('FORBIDDEN');
        const body = object(await json(request), ['email']);
        // This local-test interface cannot collect a real person's mailbox.
        if (!config.remoteNetworkKey && (typeof body.email !== 'string' || !body.email.trim().toLowerCase().endsWith('.invalid'))) throw new RadarBackendError('INVALID');
        // This adapter is local-only. Never trust a browser-supplied forwarding/IP header.
        const challenge = await service.requestCode(body.email, config.remoteNetworkKey?.(request) ?? 'local-loopback');
        const result = reply({ challengeId: challenge.challengeId, csrf: challenge.csrf, message: challenge.message }, 202);
        result.headers.append('Set-Cookie', cookie(bindingName, challenge.binding, 600, config.production));
        return result;
      }
      if (mutation && path === '/identity/verify') {
        const verified = await service.verifyCode(await json(request), cookieValue(request, bindingName), csrf, config.remoteNetworkKey?.(request) ?? 'local-loopback');
        const result = reply({ personId: verified.personId, expiresAt: verified.expiresAt, csrf: verified.csrf });
        result.headers.append('Set-Cookie', cookie(sessionName, verified.token, Math.floor((Date.parse(verified.expiresAt) - Date.now()) / 1000), config.production));
        result.headers.append('Set-Cookie', cookie(bindingName, '', 0, config.production));
        return result;
      }
      if (!mutation && path === '/session') return reply({ ...(await service.session(token)), csrf: service.secrets.csrf(token) });
      if (mutation && path === '/session/revoke') {
        const body = object(await json(request), ['allDevices']);
        if (body.allDevices !== undefined && typeof body.allDevices !== 'boolean') throw new RadarBackendError('INVALID');
        await service.revoke(token, body.allDevices === true);
        const result = reply({ revoked: true }); result.headers.append('Set-Cookie', cookie(sessionName, '', 0, config.production)); return result;
      }
      if (path === '/assessments') return mutation ? reply(await service.create(token, await json(request)), 201) : reply(await service.history(token));
      const match = /^\/assessments\/([a-f0-9-]+)(?:\/(answer|complete|snapshot|notice))?$/i.exec(path);
      if (match) {
        const [, id, action] = match;
        if (!mutation && !action) {
          const resume = await service.resume(token, id);
          const latest = new Map(resume.assessment.input.answers.map(answer => [answer.id, answer]));
          // A resuming client needs current declarations, not superseded financial history.
          const resolved = Object.fromEntries(Object.entries(resume.resolved).map(([qid, answer]) => [qid, { id: answer.id, state: answer.state, lifecycle: answer.lifecycle, applicability: answer.applicability, ref: answer.ref, issues: answer.issues }]));
          return reply({ ...resume, assessment: { ...resume.assessment, input: { ...resume.assessment.input, answers: [...latest.values()] } }, resolved });
        }
        // Only the explicit customer allowlist crosses this boundary, never the canonical dossier.
        if (!mutation && action === 'snapshot') return reply(snapshotReceipt(await service.snapshot(token, id)));
        if (mutation && action === 'answer') return reply(await service.save(token, id, await json(request)));
        if (mutation && action === 'notice') return reply(await service.acknowledgeNotice(token,id,await json(request)));
        if (mutation && action === 'complete') return reply(snapshotReceipt(await service.complete(token, id, await json(request))));
      }
      return reply({ error: 'NOT_FOUND' }, 404);
    } catch (error) {
      const safe = error instanceof RadarBackendError ? error : new RadarBackendError('UNAVAILABLE');
      return reply({ error: safe.code }, safe.status);
    }
  };
}
