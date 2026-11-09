import {createHash,createHmac} from 'node:crypto';
import {parseDigitalSubmission} from '../digital-leads/contract.ts';
import {digitalRpc,DigitalStoreError} from '../digital-leads/store.ts';
import {parseScenario,comparison,scenarioText,type Scenario} from './model.ts';
import {kitLink,type Env} from './access.ts';
const reply=(status:number,data:Record<string,unknown>)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function bookingUrl(env:Env=process.env){const id=env.DIGITAL_BOOKING_CALENDAR_ID;return id&&/^[a-zA-Z0-9_-]{10,80}$/.test(id)?'https://api.leadconnectorhq.com/widget/booking/'+id:null;}
export function emailReady(env:Env=process.env){return Boolean(env.RESEND_API_KEY?.startsWith('re_'));}
export function readiness(env:Env=process.env){return reply(200,{bookingUrl:bookingUrl(env),emailConfigured:emailReady(env)});}
async function body(request:Request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('TYPE');const reader=request.body?.getReader();if(!reader)throw Error('BODY');const parts:Uint8Array[]=[];let bytes=0;for(;;){const r=await reader.read();if(r.done)break;bytes+=r.value.length;if(bytes>32768){await reader.cancel();throw Error('SIZE');}parts.push(r.value);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
type Job={request_id:string;inquiry_id:string;category:string;snapshot:Scenario;email:string;first_name:string;lease_token:string;attempts:number;requested_at:string};
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function sendKitEmail(requestId:string|null,env:Env=process.env,fetcher:typeof fetch=fetch){
 if(!emailReady(env))return 'unavailable';
 const jobs=await digitalRpc<Job[]>('tempo_kit_email_claim_v1',{p_request_id:requestId},env,fetcher);const job=jobs[0];if(!job)return 'none';
 let ok=false,providerId:string|null=null;
 try{const link=kitLink(job.category,job.request_id,env,Date.parse(job.requested_at)),text='Ciao '+job.first_name+',\n\nEcco il kit gratuito e il confronto che hai richiesto. Il link è valido 7 giorni:\n'+link+'\n\n'+scenarioText(job.snapshot)+'\n\nVuoi valutare il tuo processo? '+(bookingUrl(env)||'https://horyzon.it/benessere-digitale')+'\n\nQuesta email risponde alla tua richiesta. Nessuna iscrizione a newsletter. Se non riconosci la richiesta, scrivi a info@horyzon.it.';
 const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'horyzon-tempo-kit-'+job.request_id},body:JSON.stringify({from:env.TEMPO_EMAIL_FROM||env.ANNUNCI10X_EMAIL_FROM||'Horyzon <noreply@horyzon.it>',reply_to:'info@horyzon.it',to:[job.email],subject:'Il tuo kit gratuito Horyzon · '+comparison(job.snapshot).categoryName,text,html:'<div lang="it" style="font-family:Arial,sans-serif;color:#112b33;max-width:640px;margin:auto;padding:24px"><h1 style="font-size:24px">Il tuo primo passo, pronto da usare.</h1><p><a href="'+escape(link)+'">Apri il kit gratuito</a> · link valido 7 giorni</p><pre style="font:15px/1.7 Arial,sans-serif;white-space:pre-wrap">'+escape(text)+'</pre></div>'}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 if(response.ok){const data=await response.json() as {id?:string};providerId=data.id??null;ok=!!providerId;}else await response.body?.cancel();
 }catch{/* persisted for bounded retry; never log PII */}
 await digitalRpc('tempo_kit_email_finish_v1',{p_request_id:job.request_id,p_token:job.lease_token,p_success:ok,p_provider_id:providerId},env,fetcher);
 return ok?'sent':'retry';
}
export async function handleTempoKit(request:Request,options:{env?:Env;fetcher?:typeof fetch}={}){
 const env=options.env??process.env,fetcher=options.fetcher??fetch,origin=request.headers.get('origin'),url=new URL(request.url);
 if(!origin||!new Set(['https://horyzon.it','https://www.horyzon.it',...(['localhost','127.0.0.1'].includes(url.hostname)||url.hostname.endsWith('.vercel.app')?[url.origin]:[])]).has(origin))return reply(403,{ok:false,message:'Richiesta non autorizzata.'});
 if(env.DIGITAL_LEADS_ENABLED!=='true')return reply(503,{ok:false,message:'Richieste temporaneamente non disponibili.'});
 let raw:Record<string,unknown>;try{raw=await body(request);}catch{return reply(400,{ok:false,message:'Controlla i dati inseriti.'});}
 const s=parseScenario(raw.scenario),phone=typeof raw.phone==='string'?raw.phone.trim():'';
 if(!s||phone.length<7||raw.consent!==true)return reply(400,{ok:false,message:'Controlla attività, telefono e informativa.'});
 const summary=scenarioText(s),comp=comparison(s),action=raw.intent==='consultation'?'CONSULENZA RICHIESTA':'KIT GRATUITO RICHIESTO';
 const activity=('['+action+'] '+comp.categoryName+' · priorità: '+comp.priority.name+'\n'+summary).slice(0,1190);
 const submission=parseDigitalSubmission({...raw,activity,province:'Non indicata',frequency:'other',tools:'Calcolatore Dai valore al tuo tempo; '+comp.modelVersion},request.headers.get('idempotency-key'));
 if(!submission||!submission.payload.phone)return reply(400,{ok:false,message:'Controlla nome, cognome, azienda, email e telefono.'});
 const secret=env.TEMPO_ACCESS_SECRET||env.CRON_SECRET;if(!secret||secret.length<20)return reply(503,{ok:false,message:'Ricezione temporaneamente non disponibile.'});
 const ip=(request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim(),bucket=createHmac('sha256',secret).update('tempo:'+new Date().toISOString().slice(0,10)+':'+ip).digest('hex');
 const hash=createHash('sha256').update(JSON.stringify([submission.payload,s])).digest('hex');
 try{
  const receipt=await digitalRpc<{id:string;replay:boolean}>('tempo_kit_submit_v1',{p_request_id:submission.requestId,p_hash:hash,p_payload:submission.payload,p_bucket:bucket,p_category:s.category,p_snapshot:s},env,fetcher);
  if(!receipt?.id)throw Error('STORE');
  const link=kitLink(s.category,submission.requestId,env);let email='retry';try{email=await sendKitEmail(submission.requestId,env,fetcher);}catch{/* retry on cron */}
  // Intake is already durable. External CRM failures never block delivery of the kit.
  // Existing CRM cron handles synchronization and retries.
  return reply(200,{ok:true,requestId:submission.requestId,kitUrl:link,emailStatus:email,comparison:comp,bookingUrl:bookingUrl(env),message:email==='sent'?'Kit pronto. Email inviata.':email==='none'?'Kit pronto. La richiesta email è già registrata.':'Kit pronto qui sotto. L’email è in attesa di invio.'});
 }catch(error){if(error instanceof DigitalStoreError&&error.code==='RATE_LIMIT')return reply(429,{ok:false,message:'Troppe richieste. Riprova più tardi.'});if(error instanceof DigitalStoreError&&error.code==='REPLAY_CONFLICT')return reply(409,{ok:false,message:'Richiesta già registrata con altri dati. Chiudi e riapri il modulo.'});return reply(503,{ok:false,message:'Ricezione non confermata. Riprova: manterremo lo stesso riferimento.'});}
}
export async function drainTempoEmails(env:Env=process.env,fetcher:typeof fetch=fetch){let sent=0,retry=0;for(let i=0;i<6;i++){const status=await sendKitEmail(null,env,fetcher);if(status==='unavailable'||status==='none')break;if(status==='sent')sent++;else retry++;}return {sent,retry};}
