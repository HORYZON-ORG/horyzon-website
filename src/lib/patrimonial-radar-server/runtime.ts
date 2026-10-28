import { RadarBackendError } from './contracts.ts';
import { createPatrimonialRadarHandler } from './http.ts';
import { PatrimonialRadarService } from './service.ts';
import { LocalSupabaseRadarRpc } from './store.ts';
import { localSimulatedEmail } from './simulated-email.ts';
import {PatrimonialFoundation} from './foundation.ts';
import {protectedRemoteConfigured} from './remote-config.ts';
import {handleRemoteRadarBackend,remoteRpc} from './remote-runtime.ts';

export function backendLocalTestEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.PATRIMONIAL_RADAR_BACKEND_ENABLED === 'true' && env.PATRIMONIAL_RADAR_BACKEND_CONTEXT === 'local-test' && !env.VERCEL && env.VERCEL_ENV !== 'production';
}
/** Next's Node adapter may use localhost internally even when bound to 127.0.0.1.
 * Canonicalize that one transport representation only after exact Host/port/protocol
 * checks. No forwarding headers or arbitrary browser-supplied origin are trusted. */
export function localNextRequest(request: Request, origin: URL): Request {
  const received = new URL(request.url);
  if (received.origin !== origin.origin && received.hostname === 'localhost' && received.port === origin.port && received.protocol === origin.protocol && request.headers.get('host') === origin.host) {
    return new Request(new URL(received.pathname + received.search, origin), request);
  }
  return request;
}
/** No ambient production Supabase keys, real email provider or fallback in-memory store. */
export function localEventRadarPort(env:Readonly<Record<string,string|undefined>>=process.env) {
  if(protectedRemoteConfigured(env)&&env.PATRIMONIAL_EVENT_RADAR_CONTEXT==='protected-remote')return async(requestId:string,email:string,payloadHash:string)=>{
    const rpc=remoteRpc(env);await rpc.attest(env.VERCEL_DEPLOYMENT_ID??'');
    return new PatrimonialFoundation(rpc,env.PATRIMONIAL_RADAR_IDENTITY_SECRET??'').prepareEvent(requestId,email,payloadHash);
  };
  if(!backendLocalTestEnabled(env)||env.PATRIMONIAL_RADAR_FOUNDATION_CONTEXT!=='local-test')return undefined;
  return async(requestId:string,email:string,payloadHash:string)=>new PatrimonialFoundation(new LocalSupabaseRadarRpc({url:env.PATRIMONIAL_RADAR_LOCAL_SUPABASE_URL??'',serverKey:env.PATRIMONIAL_RADAR_LOCAL_SERVER_KEY??'',functionName:'patrimonial_foundation_command'}),env.PATRIMONIAL_RADAR_LOCAL_SECRET??'').prepareEvent(requestId,email,payloadHash);
}
export async function handleRadarBackend(request: Request, env: Readonly<Record<string, string | undefined>> = process.env): Promise<Response> {
  if(env.PATRIMONIAL_RADAR_BACKEND_CONTEXT==='protected-remote')return handleRemoteRadarBackend(request,env);
  if (!backendLocalTestEnabled(env)) return Response.json({ error: 'NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow' } });
  try {
    const origin = new URL(env.PATRIMONIAL_RADAR_LOCAL_ORIGIN ?? '');
    if (!['http:', 'https:'].includes(origin.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new RadarBackendError('UNAVAILABLE');
    const rpc = new LocalSupabaseRadarRpc({ url: env.PATRIMONIAL_RADAR_LOCAL_SUPABASE_URL ?? '', serverKey: env.PATRIMONIAL_RADAR_LOCAL_SERVER_KEY ?? '' });
    const service = new PatrimonialRadarService(rpc, env.PATRIMONIAL_RADAR_LOCAL_SIMULATED_EMAIL_URL ? localSimulatedEmail(env.PATRIMONIAL_RADAR_LOCAL_SIMULATED_EMAIL_URL, env.PATRIMONIAL_RADAR_LOCAL_SERVER_KEY ?? '') : {
      kind: 'SIMULATED',
      // Delivery is only injected by local tests. No OTP is returned, printed or sent by this runtime.
      async sendCode() { throw new RadarBackendError('UNAVAILABLE'); },
    }, env.PATRIMONIAL_RADAR_LOCAL_SECRET ?? '');
    const foundation=env.PATRIMONIAL_RADAR_FOUNDATION_CONTEXT==='local-test'?new PatrimonialFoundation(new LocalSupabaseRadarRpc({url:env.PATRIMONIAL_RADAR_LOCAL_SUPABASE_URL??'',serverKey:env.PATRIMONIAL_RADAR_LOCAL_SERVER_KEY??'',functionName:'patrimonial_foundation_command'}),env.PATRIMONIAL_RADAR_LOCAL_SECRET??''):undefined;
    return createPatrimonialRadarHandler(service, { origin: origin.origin, production: env.NODE_ENV === 'production', enabled: true,foundation })(localNextRequest(request, origin));
  } catch { return Response.json({ error: 'UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store, private' } }); }
}
