import 'server-only';

/** One transactional acknowledgment per canonical Horyzon event request. Never marketing. */
type Claim = { registrationId: string; recipient: string; firstName: string; leaseToken: string };
type Receipt = { registrationId: string; contactId: string; state: string };
type Config = Readonly<Record<string,string|undefined>>;
const uuid = (v: unknown): v is string => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
export function eventEmailReady(env: Config=process.env) {
  const from=(env.PATRIMONIAL_EVENT_EMAIL_FROM ?? env.ANNUNCI10X_EMAIL_FROM ?? 'Horyzon <noreply@horyzon.it>').trim();
  const replyTo=(env.PATRIMONIAL_EVENT_EMAIL_REPLY_TO ?? env.ANNUNCI10X_EMAIL_REPLY_TO ?? 'info@horyzon.it').trim();
  return Boolean(env.RESEND_API_KEY?.startsWith('re_') && /^([^<]*<)?[^\s@<>]+@horyzon\.it>?$/i.test(from) && /^[^\s@]+@horyzon\.it$/i.test(replyTo));
}
function settings(env: Config) {
  const endpoint=env.SUPABASE_URL?.trim(), key=env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!endpoint||!key||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(endpoint)) throw new Error('EVENT_EMAIL_STORE_NOT_CONFIGURED');
  return {root:endpoint.replace(/\/$/,''),key};
}
async function rpc<T>(name: string, payload: Record<string,unknown>, env:Config, fetchImpl:typeof fetch):Promise<T> {
  const c=settings(env);
  const r=await fetchImpl(c.root+'/rest/v1/rpc/'+name,{
    method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json'},
    body:JSON.stringify(payload),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),
  });
  if(!r.ok){await r.body?.cancel().catch(()=>{});throw new Error('EVENT_EMAIL_STORE_RPC_FAILED');}
  return (await r.json()) as T;
}
export function eventConfirmationContent(input:{firstName:string}) {
  const first=input.firstName.replace(/[\r\n<>]/g,' ').trim().slice(0,80);
  const greet=first ? 'Ciao '+first+',' : 'Ciao,';
  const subject='Horyzon | Abbiamo ricevuto la tua richiesta per l’evento';
  const text=[greet,'','Abbiamo ricevuto correttamente la tua richiesta di partecipazione a «Quello che le banche non dicono».',
    'Le date dell’evento non sono ancora state fissate: questa email conferma la ricezione della richiesta, NON la prenotazione di un posto.',
    'Un referente Horyzon o il tuo Architetto Patrimoniale di riferimento ti contatterà telefonicamente per definire i dettagli organizzativi e ricordarti l’incontro quando il calendario sarà disponibile.',
    'Riceverai via email le informazioni relative all’evento, comprese le date e le indicazioni per accedere, quando saranno confermate.',
    'Questa comunicazione riguarda soltanto la richiesta che hai inviato e non costituisce iscrizione a newsletter o messaggi promozionali.',
    'Se non riconosci questa richiesta, rispondi a questa email oppure scrivi a info@horyzon.it.','','Horyzon Benessere Patrimoniale','https://horyzon.it/evento/quello-che-le-banche-non-dicono'].join('\n\n');
  const html='<div style="font-family:Arial,sans-serif;color:#07171D;background:#F7F4E8;padding:32px"><div style="max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:12px"><p style="color:#61721A;font-size:12px;letter-spacing:2px">HORYZON · BENESSERE PATRIMONIALE</p><h1 style="font-size:24px">Richiesta ricevuta</h1>'+text.split('\n\n').map(p=>'<p style="font-size:15px;line-height:1.6">'+escapeHtml(p).replace(/\n/g,'<br>')+'</p>').join('')+'</div></div>';
  return {subject,text,html};
}
export async function sendOneEventConfirmation(input:{registrationId?:string|null;env?:Config;fetchImpl?:typeof fetch}):Promise<'SENT'|'FAILED'|'NONE'|'NOT_CONFIGURED'>{
 const env=input.env??process.env;
 if(!eventEmailReady(env)) return 'NOT_CONFIGURED';
 const fetchImpl=input.fetchImpl??fetch;
 let claim:Claim|null;
 try{
   claim=await rpc<Claim|null>('patrimonial_event_email_claim',{p_registration_id:input.registrationId??null},env,fetchImpl);
 }catch{return 'FAILED';}
 if(!claim)return 'NONE';
 if(!uuid(claim.registrationId)||!uuid(claim.leaseToken)||typeof claim.recipient!=='string'||claim.recipient.length>254||!claim.recipient.includes('@'))return 'FAILED';
 let success=false,providerId:string|null=null;
 try{
   const content=eventConfirmationContent({firstName:claim.firstName});
   const from=env.PATRIMONIAL_EVENT_EMAIL_FROM??env.ANNUNCI10X_EMAIL_FROM??'Horyzon <noreply@horyzon.it>';
   const replyTo=env.PATRIMONIAL_EVENT_EMAIL_REPLY_TO??env.ANNUNCI10X_EMAIL_REPLY_TO??'info@horyzon.it';
   const r=await fetchImpl('https://api.resend.com/emails',{
     method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'horyzon-event-ack-'+claim.registrationId},
     body:JSON.stringify({from,to:[claim.recipient],reply_to:replyTo,...content}),
     redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
   });
   if(r.ok){const json=await r.json() as {id?:unknown};providerId=typeof json.id==='string'?json.id:null;success=Boolean(providerId);}
   else await r.body?.cancel().catch(()=>{});
 }catch{ /* Keep event registration; delivery is retryable. */ }
 try{await rpc<boolean>('patrimonial_event_email_finish',{
   p_registration_id:claim.registrationId,p_lease_token:claim.leaseToken,
   p_success:success,p_provider_message_id:providerId
 },env,fetchImpl);}catch{return 'FAILED';}
 return success?'SENT':'FAILED';
}
export async function drainEventConfirmationQueue(input:{limit?:number;env?:Config;fetchImpl?:typeof fetch}={}){
 const limit=Math.max(1,Math.min(15,input.limit??10));let sent=0,failed=0;
 if(!eventEmailReady(input.env??process.env))return {status:'NOT_CONFIGURED',sent,failed};
 for(let i=0;i<limit;i++){
  const result=await sendOneEventConfirmation({env:input.env,fetchImpl:input.fetchImpl});
  if(result==='NONE')break;
  if(result==='SENT')sent++;else {failed++;if(result==='NOT_CONFIGURED')break;}
 }
 return {status:'PROCESSED',sent,failed};
}
