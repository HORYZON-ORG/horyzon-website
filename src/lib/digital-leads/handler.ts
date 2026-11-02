import { createHmac, timingSafeEqual } from 'node:crypto';
import { after } from 'next/server';
import { parseDigitalSubmission } from './contract';
import { acquireDigitalLead, DigitalStoreError, type DigitalEnv } from './store';
import { runDigitalCrmDrain } from './crm';

type Options = { env?: DigitalEnv; fetcher?: typeof fetch };
const response = (status: number, message: string, other: Record<string, unknown> = {}) =>
  Response.json({ok:status===202,message,...other},{status,headers:{'Cache-Control':'no-store'}});

const allowedOrigin = (request: Request, env: DigitalEnv): boolean => {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const url = new URL(request.url);
  const allowed = new Set(['https://horyzon.it','https://www.horyzon.it']);
  if (url.hostname.endsWith('.vercel.app') || ['127.0.0.1','localhost'].includes(url.hostname))
    allowed.add(url.origin);
  if (env.VERCEL_URL) allowed.add('https://' + env.VERCEL_URL);
  return allowed.has(origin);
};
async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('UNSUPPORTED_TYPE');
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > 8192) throw new Error('TOO_LARGE');
  const stream = request.body?.getReader();
  if (!stream) throw new Error('INVALID_BODY');
  const chunks: Uint8Array[] = []; let bytes = 0;
  for (;;) {
    const {done,value} = await stream.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) { await stream.cancel(); throw new Error('TOO_LARGE'); }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(text); } catch { throw new Error('INVALID_BODY'); }
}
function rateKey(request: Request, env: DigitalEnv): string | null {
  const salt = env.DIGITAL_RATE_LIMIT_SECRET || env.CRON_SECRET;
  if (!salt || salt.length < 20) return null;
  const ip = (request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown').split(',')[0].trim();
  // Rotate the opaque identifier daily, never store or log an IP address.
  const day = new Date().toISOString().slice(0,10);
  return createHmac('sha256',salt).update(day + ':' + ip).digest('hex');
}

export async function handleDigitalLead(request: Request, options: Options = {}): Promise<Response> {
  const env = options.env ?? process.env;
  if (env.DIGITAL_LEADS_ENABLED !== 'true') return response(503,'Il modulo non è ancora disponibile. Scrivici a info@horyzon.it.');
  if (!allowedOrigin(request,env)) return response(403,'Richiesta non autorizzata.');
  let input: unknown;
  try { input = await readJson(request); }
  catch(error) {
    return response(error instanceof Error && error.message === 'TOO_LARGE' ? 413 : 400,'Controlla i dati inseriti.');
  }
  const submission = parseDigitalSubmission(input,request.headers.get('idempotency-key'));
  if (!submission) return response(400,'Controlla i campi e l’accettazione dell’informativa.');
  const bucket = rateKey(request,env);
  if (!bucket) return response(503,'La ricezione non è temporaneamente disponibile. Riprova più tardi.');
  try {
    const receipt = await acquireDigitalLead(submission,bucket,env,options.fetcher);
    if (!receipt?.id) throw new DigitalStoreError('STORE_UNAVAILABLE');
    if (env.DIGITAL_CRM_SYNC_ENABLED === 'true') {
      after(async () => {
        try { await runDigitalCrmDrain({requestId:submission.requestId,limit:1,env,fetcher:options.fetcher}); }
        catch { /* pending job stays stored and cron retries; never print personal data */ }
      });
    }
    return response(202,'Richiesta registrata. Ti ricontatteremo per approfondire.',{requestId:submission.requestId});
  } catch(error) {
    if (error instanceof DigitalStoreError) {
      if (error.code === 'RATE_LIMIT') return response(429,'Hai effettuato troppe richieste. Riprova più tardi.');
      if (error.code === 'REPLAY_CONFLICT') return response(409,'Questa richiesta è già stata registrata con dati diversi. Aggiorna la pagina prima di riprovare.');
      if (error.code === 'INVALID_INPUT') return response(400,'Controlla i dati inseriti.');
    }
    return response(503,'Non possiamo confermare la ricezione. Riprova oppure scrivi a info@horyzon.it.');
  }
}

export async function handleDigitalCrmCron(request: Request, options: Options = {}): Promise<Response> {
  const env = options.env ?? process.env;
  const expected = env.CRON_SECRET, provided = request.headers.get('authorization')?.replace(/^Bearer /,'');
  if (!expected || !provided || Buffer.byteLength(expected) !== Buffer.byteLength(provided) ||
    !timingSafeEqual(Buffer.from(expected),Buffer.from(provided))) return Response.json({ok:false},{status:401});
  if (env.DIGITAL_CRM_SYNC_ENABLED !== 'true') return Response.json({ok:true,disabled:true},{headers:{'Cache-Control':'no-store'}});
  try {
    const stats = await runDigitalCrmDrain({limit:8,env,fetcher:options.fetcher});
    return Response.json({ok:true,...stats},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({ok:false,reason:'sync_pending'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
