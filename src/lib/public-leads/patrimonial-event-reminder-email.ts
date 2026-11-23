// Transactional, scheduled reminders for a confirmed event registration.
// The DB leases one reminder/kind/registration; Resend ensures idempotent scheduling.
import { eventEmailReady } from './patrimonial-event-confirmation-email.ts';
import { eventGoogleCalendarUrl, EVENT_ICS_URL, EVENT_PAGE } from './patrimonial-event-calendar.ts';

type Config = Readonly<Record<string,string|undefined>>;
type Claim = {registrationId:string;kind:'DAY_BEFORE'|'HALF_HOUR';recipient:string;firstName:string;leaseToken:string;sendAt:string};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const htmlSafe=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
async function rpc<T>(name:string,payload:Record<string,unknown>,env:Config,fetchImpl:typeof fetch):Promise<T>{
  const root=env.SUPABASE_URL?.replace(/\/$/,'');
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!root||!key||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(root))throw Error('EVENT_REMINDER_STORE_UNAVAILABLE');
  const r=await fetchImpl(root+'/rest/v1/rpc/'+name,{method:'POST',headers:{
    apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',
  },body:JSON.stringify(payload),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!r.ok){await r.body?.cancel().catch(()=>{});throw Error('EVENT_REMINDER_RPC_FAILED');}
  return await r.json() as T;
}
export function eventReminderContent(kind:Claim['kind'],firstName:string){
  const greet=firstName.replace(/[\r\n<>]/g,' ').trim().slice(0,80);
  const today=kind==='DAY_BEFORE';
  const subject=today?'Domani alle 21:00 | Quello che le banche non dicono':'Tra 30 minuti inizia l’evento Horyzon';
  const text=[
    greet?'Ciao '+greet+',':'Ciao,',
    today?'Ci vediamo domani, mercoledì 9 dicembre, alle 21:00!':'Tra 30 minuti inizia «Quello che le banche non dicono»!',
    'Evento online gratuito · mercoledì 9 dicembre 2026 · ore 21:00–22:00 (ora italiana). 60 minuti con domande e risposte.',
    'Google Calendar: '+eventGoogleCalendarUrl(),
    'Apple / Outlook (.ics): '+EVENT_ICS_URL,
    'Per partecipare consulta le indicazioni organizzative ricevute da Horyzon. Se non hai ricevuto un link di accesso, scrivi a info@horyzon.it.',
    'Questo è un promemoria relativo alla tua iscrizione all’evento, non una comunicazione promozionale.',
    'Horyzon Benessere Patrimoniale · '+EVENT_PAGE,
  ].join('\n\n');
  const html='<div style="font-family:Arial,sans-serif;color:#07171D;background:#F7F4E8;padding:32px"><div style="max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:12px"><h1>'+htmlSafe(subject)+'</h1>'+text.split('\n\n').map(x=>'<p>'+htmlSafe(x)+'</p>').join('')+'<p><a href="'+htmlSafe(eventGoogleCalendarUrl())+'">Google Calendar</a> · <a href="'+EVENT_ICS_URL+'">Apple / Outlook (.ics)</a></p></div></div>';
  return {subject,text,html};
}
export async function scheduleOneEventReminder(options:{registrationId?:string|null;env?:Config;fetchImpl?:typeof fetch}={}):Promise<'SCHEDULED'|'FAILED'|'NONE'|'NOT_CONFIGURED'>{
  const env=options.env??process.env, fetchImpl=options.fetchImpl??fetch;
  if(!eventEmailReady(env))return 'NOT_CONFIGURED';
  let claim:Claim|null;
  try{claim=await rpc<Claim|null>('patrimonial_event_reminder_claim',{p_registration_id:options.registrationId??null},env,fetchImpl);}catch{return 'FAILED';}
  if(!claim)return 'NONE';
  if(!uuid(claim.registrationId)||!uuid(claim.leaseToken)||!['DAY_BEFORE','HALF_HOUR'].includes(claim.kind)||
     typeof claim.recipient!=='string'||!claim.recipient.includes('@')||!Number.isFinite(Date.parse(claim.sendAt)))return 'FAILED';
  const sendAt=new Date(claim.sendAt).toISOString();
  let success=false,providerId:string|null=null;
  try{
    const content=eventReminderContent(claim.kind,claim.firstName);
    const from=env.PATRIMONIAL_EVENT_EMAIL_FROM??env.ANNUNCI10X_EMAIL_FROM??'Horyzon <noreply@horyzon.it>';
    const replyTo=env.PATRIMONIAL_EVENT_EMAIL_REPLY_TO??env.ANNUNCI10X_EMAIL_REPLY_TO??'info@horyzon.it';
    const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{
      Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json',
      'Idempotency-Key':'horyzon-event-'+claim.kind.toLowerCase()+'-'+claim.registrationId,
    },body:JSON.stringify({from,to:[claim.recipient],reply_to:replyTo,...content,scheduled_at:sendAt}),
      redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(response.ok){const out=await response.json() as {id?:unknown};providerId=typeof out.id==='string'?out.id:null;success=Boolean(providerId);}
    else await response.body?.cancel().catch(()=>{});
  }catch{/* The reminder stays retryable. */}
  try{const done=await rpc<boolean>('patrimonial_event_reminder_finish',{
    p_registration_id:claim.registrationId,p_kind:claim.kind,p_lease_token:claim.leaseToken,
    p_success:success,p_provider_message_id:providerId,
  },env,fetchImpl);if(!done)return 'FAILED';}catch{return 'FAILED';}
  return success?'SCHEDULED':'FAILED';
}
export async function drainEventReminders(options:{limit?:number;env?:Config;fetchImpl?:typeof fetch}={}){
  const limit=Math.max(1,Math.min(20,options.limit??12));let scheduled=0,failed=0;
  if(!eventEmailReady(options.env??process.env))return {status:'NOT_CONFIGURED',scheduled,failed};
  for(let i=0;i<limit;i++){
    const result=await scheduleOneEventReminder({env:options.env,fetchImpl:options.fetchImpl});
    if(result==='NONE')break;
    if(result==='SCHEDULED')scheduled++;else {failed++;if(result==='NOT_CONFIGURED')break;}
  }
  return {status:'PROCESSED',scheduled,failed};
}
