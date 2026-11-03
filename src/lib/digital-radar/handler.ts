import {createHmac} from 'node:crypto';
import {digitalRpc,DigitalStoreError,type DigitalEnv} from '../digital-leads/store.ts';
import {parseDigitalRadar,radarScores} from './contract.ts';

type Options={env?:DigitalEnv;fetcher?:typeof fetch;scheduleCrm?:(requestId:string)=>void};
const reply=(status:number,message:string,extra:Record<string,unknown>={})=>Response.json(
 {ok:status===202,message,...extra},{status,headers:{'Cache-Control':'no-store'}});

export async function handleDigitalRadar(request:Request,options:Options={}):Promise<Response>{
 const env=options.env??process.env;
 if(env.DIGITAL_LEADS_ENABLED!=='true')return reply(503,'Il Radar non è temporaneamente disponibile. Riprova più tardi.');
 const url=new URL(request.url),origins=new Set(['https://horyzon.it','https://www.horyzon.it']);
 if(url.hostname.endsWith('.vercel.app')||['127.0.0.1','localhost'].includes(url.hostname))origins.add(url.origin);
 if(env.VERCEL_URL)origins.add('https://'+env.VERCEL_URL);
 if(!origins.has(request.headers.get('origin')??''))return reply(403,'Richiesta non autorizzata.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(400,'Formato della richiesta non valido.');
 if(Number(request.headers.get('content-length'))>16384)return reply(413,'Il testo è troppo lungo. Riduci le informazioni inserite.');
 let input:unknown;
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,'Richiesta non valida.');
  const chunks:Uint8Array[]=[];let bytes=0;
  for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16384){await reader.cancel();return reply(413,'Il testo è troppo lungo. Riduci le informazioni inserite.');}chunks.push(value);}
  input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }catch{return reply(400,'Richiesta non valida. Controlla le risposte.');}
 const submission=parseDigitalRadar(input,request.headers.get('idempotency-key'));
 if(!submission)return reply(400,'Controlla le risposte e la presa visione dell’informativa.');
 const salt=env.DIGITAL_RATE_LIMIT_SECRET||env.CRON_SECRET;
 if(!salt||salt.length<20)return reply(503,'Non possiamo confermare la ricezione. Riprova più tardi.');
 const ip=(request.headers.get('x-forwarded-for')??request.headers.get('x-real-ip')??'unknown').split(',')[0].trim();
 const bucket=createHmac('sha256',salt).update(new Date().toISOString().slice(0,10)+':radar:'+ip+':'+(submission.payload.token??'public')).digest('hex');
 try{
  const receipt=await digitalRpc<{replay:boolean;crm_request_id:string|null}>('digital_radar_submit_v1',{
   p_request_id:submission.requestId,p_hash:submission.hash,p_payload:submission.payload,p_bucket:bucket,
  },env,options.fetcher);
  if(typeof receipt?.replay!=='boolean'||!(receipt.crm_request_id===null||receipt.crm_request_id===submission.requestId))throw new DigitalStoreError('STORE_UNAVAILABLE');
  if(receipt.crm_request_id&&env.DIGITAL_CRM_SYNC_ENABLED==='true'){
   try{options.scheduleCrm?.(receipt.crm_request_id);}catch{/* The durable outbox remains available to the existing cron. */}
  }
  return reply(202,'Risposte registrate.',{requestId:submission.requestId,scores:radarScores(submission.payload.answers)});
 }catch(error){
  if(error instanceof DigitalStoreError){
   if(error.code==='RATE_LIMIT')return reply(429,'Hai effettuato troppi invii. Riprova tra qualche minuto.');
   if(error.code==='REPLAY_CONFLICT')return reply(409,'Il riferimento di invio contiene risposte diverse. Ricarica la pagina prima di un nuovo invio.');
   if(error.code==='LINK_INVALID')return reply(404,'Questo link aziendale non è valido. Chiedi un nuovo link al referente Horyzon.');
   if(error.code==='INVALID_INPUT')return reply(400,'Controlla le risposte inserite.');
  }
  return reply(503,'Non possiamo confermare il salvataggio. Riprova: conserveremo lo stesso riferimento di invio.');
 }
}
