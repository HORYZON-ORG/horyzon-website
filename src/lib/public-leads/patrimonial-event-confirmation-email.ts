// This module is imported only by server-side routes and the protected lead handler.
import { eventGoogleCalendarUrl, EVENT_ICS_URL, EVENT_PAGE } from './patrimonial-event-calendar.ts';

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

/** Table-layout HTML email, with inline styles supported by common mail clients. */
export function renderEventEmailFrame(input: {
  preheader: string; eyebrow: string; headline: string; bodyHtml: string;
}) {
  return [
    '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<style>@media only screen and (max-width:640px){.email-shell{width:100%!important}.email-pad{padding-left:24px!important;padding-right:24px!important}.email-heading{font-size:32px!important;line-height:39px!important}.email-button{display:block!important;width:auto!important}}</style></head>',
    '<body style="margin:0;padding:0;background:#F4F1E9;color:#0B222A;font-family:Arial,Helvetica,sans-serif">',
    '<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all">' + escapeHtml(input.preheader) + '</div>',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4F1E9"><tr><td align="center" style="padding:28px 12px 32px">',
    '<table role="presentation" class="email-shell" cellpadding="0" cellspacing="0" border="0" width="620" style="width:620px;max-width:620px;background:#FFFFFF;border-collapse:separate">',
    '<tr><td class="email-pad" style="background:#0B222A;padding:34px 44px 38px;color:#FFFFFF">',
    '<p style="margin:0;color:#FFFFFF;font-size:24px;font-weight:800;letter-spacing:2.8px">HOR<span style="color:#CCEB59">Y</span>ZON<span style="font-size:10px;letter-spacing:2px;font-weight:700;color:#D5DCCC;padding-left:10px">CONSULTING</span></p>',
    '<p style="margin:8px 0 39px;font-size:10px;font-weight:700;color:#CCD7CC;letter-spacing:2.5px">BENESSERE PATRIMONIALE</p>',
    '<p style="margin:0 0 19px;border:1px solid #CCEB59;padding:8px 12px;color:#CCEB59;font-size:11px;font-weight:800;letter-spacing:1.5px;display:inline-block">' + escapeHtml(input.eyebrow) + '</p>',
    '<h1 class="email-heading" style="font-size:43px;line-height:49px;letter-spacing:-1.4px;margin:0;color:#FFFFFF;font-weight:800">' + escapeHtml(input.headline) + '</h1>',
    '<p style="font-size:16px;line-height:25px;color:#C7D3CF;margin:20px 0 0">QUELLO CHE LE BANCHE <strong style="color:#CCEB59">NON</strong> DICONO</p>',
    '</td></tr><tr><td style="height:7px;background:#CCEB59;font-size:0;line-height:0">&nbsp;</td></tr>',
    '<tr><td class="email-pad" style="padding:39px 44px 12px;background:#FFFFFF">' + input.bodyHtml + '</td></tr>',
    '<tr><td class="email-pad" style="padding:18px 44px 31px;background:#FFFFFF"><p style="color:#64727A;font-size:12px;line-height:19px;margin:0">Questa comunicazione riguarda esclusivamente la tua partecipazione all’evento e non costituisce iscrizione a newsletter o messaggi commerciali.</p></td></tr>',
    '<tr><td class="email-pad" style="padding:25px 44px 27px;background:#0B222A">',
    '<p style="margin:0 0 9px;font-size:13px;font-weight:800;color:#FFFFFF;letter-spacing:1px">HORYZON CONSULTING</p>',
    '<p style="margin:0 0 10px;font-size:12px;line-height:19px;color:#B8C4C1">Benessere Patrimoniale · FELICITÀ S.r.l.<br>Viale Papiniano 28, 20123 Milano</p>',
    '<p style="margin:0;font-size:12px;line-height:20px;color:#CCEB59"><a href="mailto:info@horyzon.it" style="color:#CCEB59;text-decoration:underline">info@horyzon.it</a> &nbsp; · &nbsp; <a href="https://horyzon.it/privacy-policy" style="color:#CCEB59;text-decoration:underline">Privacy</a></p>',
    '</td></tr></table></td></tr></table></body></html>',
  ].join('');
}

/** Sent immediately for new confirmed registrations, with durable retries on email errors. */
export function eventConfirmationContent(input: { firstName: string }) {
  const first = input.firstName.replace(/[\r\n<>]/g, ' ').trim().slice(0, 80);
  const greeting = first ? 'Ciao ' + first + ',' : 'Ciao,';
  const subject = 'Iscrizione confermata · Quello che le banche non dicono · 9 dicembre ore 21:00';
  const text = [
    greeting,
    'La tua iscrizione a «Quello che le banche non dicono» è confermata.',
    'MERCOLEDÌ 9 DICEMBRE 2026 · ORE 21:00 (ora italiana).',
    'Evento online e gratuito. Durata: 60 minuti di incontro, più eventuali domande al termine.',
    'Aggiungi l’evento al calendario:',
    'Google Calendar: ' + eventGoogleCalendarUrl(),
    'Apple / Outlook / altri: ' + EVENT_ICS_URL,
    'Riceverai un promemoria martedì 8 dicembre alle 21:00 e un altro mercoledì 9 dicembre alle 20:30 (ora italiana).',
    'Le indicazioni per accedere alla diretta ti saranno comunicate via email non appena disponibili.',
    'Per informazioni, rispondi a questo messaggio o scrivi a info@horyzon.it.',
    'Questa email è solo organizzativa, non commerciale.',
    'Horyzon Benessere Patrimoniale',
    EVENT_PAGE,
  ].join('\n\n');
  const html = renderEventEmailFrame({
    preheader: 'Iscrizione confermata. Ti aspettiamo il 9 dicembre alle ore 21:00, online e gratuitamente.',
    eyebrow: '✓ ISCRIZIONE CONFERMATA',
    headline: 'Ci vediamo il 9 dicembre.',
    bodyHtml: [
      '<p style="font-size:18px;font-weight:700;line-height:27px;color:#0B222A;margin:0 0 13px">' + escapeHtml(greeting) + '</p>',
      '<p style="font-size:16px;line-height:26px;margin:0 0 27px;color:#3A4C52">La tua iscrizione è <strong style="color:#0B222A">confermata</strong>. Ti aspettiamo all’incontro online <strong>Quello che le banche non dicono</strong>.</p>',
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F3EB;border:1px solid #E4E5D7;margin:0 0 27px"><tr><td style="padding:25px 24px 24px">',
      '<p style="font-size:11px;letter-spacing:2px;color:#64794A;font-weight:800;margin:0 0 13px">IL TUO APPUNTAMENTO</p>',
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>',
      '<td width="28%" valign="middle" style="border-right:1px solid #D8DFCA;padding:0 18px 0 0"><span style="display:block;font-size:51px;line-height:52px;font-weight:800;letter-spacing:-2px;color:#0B222A">09</span><span style="display:block;font-size:12px;font-weight:800;letter-spacing:1.7px;color:#4C6165">DIC 2026</span></td>',
      '<td valign="middle" style="padding:0 0 0 21px"><span style="display:block;font-size:13px;font-weight:700;color:#596A6E">MERCOLEDÌ · ONLINE</span><span style="display:block;font-size:29px;font-weight:800;color:#0B222A;line-height:39px">ORE 21:00</span><span style="font-size:12px;color:#526368">Orario italiano</span></td>',
      '</tr></table><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:21px;border-top:1px solid #D8DFCA"><tr><td style="padding-top:16px"><span style="font-size:13px;line-height:21px;color:#0B222A"><strong>60 minuti di incontro</strong> + eventuali domande al termine</span></td></tr></table>',
      '</td></tr></table>',
      '<p style="font-size:17px;font-weight:800;color:#0B222A;margin:0 0 11px">Mettilo subito in calendario.</p>',
      '<p style="font-size:14px;color:#59696D;line-height:22px;margin:0 0 19px">Basta un clic per non perdere l’appuntamento.</p>',
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding-bottom:11px">',
      '<a class="email-button" href="' + escapeHtml(eventGoogleCalendarUrl()) + '" style="display:block;background:#CCEB59;color:#0B222A;padding:17px 21px;text-align:center;text-decoration:none;font-size:15px;font-weight:800">AGGIUNGI A GOOGLE CALENDAR &nbsp; ›</a>',
      '</td></tr><tr><td><a class="email-button" href="' + escapeHtml(EVENT_ICS_URL) + '" style="display:block;border:1px solid #A2B08A;color:#0B222A;padding:15px 21px;text-align:center;text-decoration:none;font-size:14px;font-weight:700">APPLE / OUTLOOK / ALTRI CALENDARI &nbsp; ›</a></td></tr></table>',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;border-top:1px solid #E4E8DF"><tr><td style="padding-top:23px">',
      '<p style="font-size:16px;font-weight:800;margin:0 0 12px;color:#0B222A">Ti ricorderemo noi l’evento.</p>',
      '<p style="font-size:14px;line-height:24px;color:#40545A;margin:0 0 5px"><strong>08 dicembre · 21:00</strong> — Promemoria del giorno prima</p>',
      '<p style="font-size:14px;line-height:24px;color:#40545A;margin:0 0 17px"><strong>09 dicembre · 20:30</strong> — Mancano 30 minuti</p>',
      '<p style="font-size:13px;line-height:22px;margin:0;color:#627278">Le indicazioni per collegarti alla diretta saranno comunicate via email non appena disponibili. Per domande, rispondi a questo messaggio.</p>',
      '</td></tr></table>',
    ].join(''),
  });
  return { subject, text, html };
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
