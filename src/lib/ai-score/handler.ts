import { auditCacheKey, checkRateLimit, readDuplicateCache, withAuditSlot, writeDuplicateCache } from './limits';
import { auditRepository } from './storage';
import { runAiScoreAudit, toDetailedAudit, type AuditOptions } from './audit';
import { normalizeAuditUrl, UnsafeAuditUrlError } from './ssrf';
import { AuditDeadlineError, abortable } from './deadline';
import type { AuditStreamEvent } from './types';

type Options = { runAudit?: typeof runAiScoreAudit; auditOptions?: AuditOptions };
const jsonError = (status: number, error: string) => Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function handleAiScoreRequest(request: Request, options: Options = {}): Promise<Response> {
  if (Number(request.headers.get('content-length')) > 4096) return jsonError(413,'Richiesta troppo grande.');
  let payload: unknown;
  try {
    const reader=request.body?.getReader();
    if (!reader) return jsonError(400,'Payload JSON non valido.');
    const chunks: Uint8Array[]=[]; let bytes=0;
    const bodySignal=AbortSignal.any([request.signal,AbortSignal.timeout(5000)]);
    for (;;) { const chunk=await abortable(reader.read(),bodySignal); if(chunk.done) break; bytes+=chunk.value.byteLength;
      if(bytes>4096){await reader.cancel();return jsonError(413,'Richiesta troppo grande.');} chunks.push(chunk.value); }
    payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return jsonError(400,'Payload JSON non valido.'); }
  const rawUrl=payload&&typeof payload==='object'&&'url' in payload&&typeof payload.url==='string'?payload.url:'';
  if(!rawUrl.trim())return jsonError(400,'Inserisci un dominio o URL da analizzare.');
  if(rawUrl.length>2048)return jsonError(400,'L’indirizzo è troppo lungo.');
  let url:string;
  try {url=normalizeAuditUrl(rawUrl).toString();}
  catch(error){return jsonError(400,error instanceof UnsafeAuditUrlError?error.message:'URL non valido.');}
  const clientKey=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')?.trim()||'anonymous';
  const rate=checkRateLimit(clientKey);
  if(!rate.allowed)return Response.json({error:rate.reason},{status:429,headers:{'Retry-After':String(rate.retryAfter),'Cache-Control':'no-store'}});
  const cacheKey=auditCacheKey(url);
  const cached=readDuplicateCache(cacheKey)??await auditRepository.findRecent(cacheKey);
  const controller=new AbortController();
  const signal=AbortSignal.any([controller.signal,request.signal]);
  const encoder=new TextEncoder(); let open=true;
  const stream=new ReadableStream<Uint8Array>({
    start(output){
      void (async()=>{
      const send=(event:AuditStreamEvent)=>{if(open&&!signal.aborted)output.enqueue(encoder.encode(JSON.stringify(event)+'\n'));};
      try {
        if(cached){ send({type:'state',state:'scoring',label:'Preparazione risultato recente'});send({type:'result',audit:toDetailedAudit(cached)});return; }
        const audit=await withAuditSlot(()=>(options.runAudit??runAiScoreAudit)(url,(state,label)=>send({type:'state',state,label}),{...options.auditOptions,signal,clientKey}));
        if(signal.aborted)return;
        writeDuplicateCache(cacheKey,audit);
        await auditRepository.save(cacheKey,audit);
        send({type:'result',audit:toDetailedAudit(audit)});
      } catch(error) {
        const message=error instanceof UnsafeAuditUrlError||error instanceof AuditDeadlineError?error.message:'Analisi non completata. Il sito o un servizio non ha risposto: riprova tra poco.';
        send({type:'error',state:'failed',message});
      } finally {if(open){open=false;output.close();}}
      })();
    },
    cancel(){open=false;controller.abort(new AuditDeadlineError());},
  });
  return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
