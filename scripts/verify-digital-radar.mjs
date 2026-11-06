import assert from 'node:assert/strict';
import { parseDigitalRadar, radarScores } from '../src/lib/digital-radar/contract.ts';
import { handleDigitalRadar } from '../src/lib/digital-radar/handler.ts';
import { digitalBookingUrl } from '../src/lib/digital-radar/booking.ts';

const id = '123e4567-e89b-42d3-a456-426614174000';
const input = { requestId:id, company:'Impresa Prova', province:'Lecce', role:'Amministrazione', name:'',
  activity:'Preparo preventivi copiando righe da email a Excel.', tools:'Excel e Outlook', frequency:'daily',
  minutes:20, occurrences:10, answers:{dati:3,processi:2,strumenti:3,competenze:2,cultura:4,sponsor:null},
  contact:null, consent:true, website:'' };
const valid = parseDigitalRadar(input,id);
assert(valid);
assert.equal(valid.payload.mode,'public');
assert.equal(valid.payload.name,'');
assert.equal(valid.payload.contact,null);
assert.equal(valid.payload.answers.sponsor,null);
assert.equal(parseDigitalRadar({...input,company:' Impresa   Prova '},id)?.hash,valid.hash);
assert.equal(parseDigitalRadar({...input,answers:{...input.answers,dati:6}},id),null);
assert.equal(parseDigitalRadar({...input,answers:{...input.answers,dati:'3'}},id),null);
assert.equal(parseDigitalRadar({...input,answers:{...input.answers,unknown:4}},id),null);
assert.equal(parseDigitalRadar({...input,answers:{dati:3}},id),null);
assert.equal(parseDigitalRadar({...input,minutes:-1},id),null);
assert.equal(parseDigitalRadar({...input,consent:false},id),null);
assert.equal(parseDigitalRadar({...input,website:'bot'},id),null);
assert.equal(parseDigitalRadar(input,crypto.randomUUID()),null);
assert.equal(parseDigitalRadar({...input,company:''},id),null);
assert.equal(parseDigitalRadar({...input,contact:{firstName:'Ada',lastName:'Lovelace',email:'invalid',phone:''}},id),null);
const contact = parseDigitalRadar({...input,contact:{firstName:'Ada',lastName:'Lovelace',email:'ADA@EXAMPLE.TEST',phone:'0832123456'}},id);
assert(contact);
assert.equal(contact.payload.contact.email,'ada@example.test');
assert.equal(contact.payload.contact.phone,'+390832123456');
const team = parseDigitalRadar({...input,company:undefined,province:undefined,token:'a'.repeat(48)},id);
assert(team);
assert.equal(team.payload.mode,'company');
assert.equal(parseDigitalRadar({...input,token:'a'.repeat(48),contact:{firstName:'Ada',lastName:'Lovelace',email:'ada@example.test',phone:''}},id),null,'team responses do not request CRM contact');
assert.equal(parseDigitalRadar({...input,token:'short'},id),null);
const scores = radarScores(valid.payload.answers);
assert.equal(scores.coverage,5);
assert.equal(scores.mean,2.8);
assert.equal(Object.hasOwn(scores.dimensions,'Sponsor interno'),false,'unknown does not mean score one');
assert.equal(radarScores(Object.fromEntries(Object.keys(input.answers).map(k=>[k,null]))).mean,null);

const env={DIGITAL_LEADS_ENABLED:'true',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-fixture-key',DIGITAL_RATE_LIMIT_SECRET:'test-only-secret-with-at-least-twenty-characters',DIGITAL_CRM_SYNC_ENABLED:'true'};
const request=(body=input,headers={})=>new Request('http://localhost:3000/api/digital-radar',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json','Idempotency-Key':id,...headers},body:JSON.stringify(body)});
let calls=0;
const fetcher=async(url,init)=>{
  calls++;
  assert.equal(new URL(url).pathname,'/rest/v1/rpc/digital_radar_submit_v1');
  assert.equal(init.headers['Content-Profile'],'hub');
  const body=JSON.parse(init.body);
  assert.equal(body.p_request_id,id);
  assert.equal(body.p_payload.contact,null);
  return Response.json({replay:false,crm_request_id:null});
};
let response=await handleDigitalRadar(request(),{env,fetcher});
assert.equal(response.status,202);
const receipt=await response.json();
assert.equal(receipt.ok,true);
assert.equal(receipt.scores.coverage,5);
assert.equal(Object.hasOwn(receipt,'client_id'),false);
assert.equal(Object.hasOwn(receipt,'token'),false);
assert.equal(calls,1);
assert.equal((await handleDigitalRadar(request(),{env:{...env,DIGITAL_LEADS_ENABLED:'false'},fetcher})).status,503);
assert.equal((await handleDigitalRadar(request(input,{Origin:'https://evil.example'}),{env,fetcher})).status,403);
assert.equal((await handleDigitalRadar(request({...input,activity:'x'.repeat(40000)}),{env,fetcher})).status,413);
assert.equal((await handleDigitalRadar(request({...input,consent:false}),{env,fetcher})).status,400);
for(const [code,status] of [['DIGITAL_RATE_LIMIT',429],['DIGITAL_REPLAY_CONFLICT',409],['DIGITAL_RADAR_LINK_INVALID',404],['DIGITAL_INVALID_INPUT',400]]){
  response=await handleDigitalRadar(request(),{env,fetcher:async()=>Response.json({message:code},{status:400})});
  assert.equal(response.status,status,code);
}
response=await handleDigitalRadar(request(),{env,fetcher:async()=>{throw Error('private details');}});
assert.equal(response.status,503);
assert.equal((await response.text()).includes('private details'),false);
let scheduled=0;
response=await handleDigitalRadar(request({...input,contact:{firstName:'Ada',lastName:'Lovelace',email:'ada@example.test',phone:''}}),{
  env,fetcher:async()=>Response.json({replay:false,crm_request_id:id}),
  scheduleCrm:()=>{scheduled++;throw Error('CRM scheduling failure');},
});
assert.equal(response.status,202,'a durable receipt survives CRM scheduling failure');
assert.equal(scheduled,1);
// Optional company profile: public Radar only, one canonical https:// form for the website.
assert.equal(valid.payload.company_site,null);
assert.equal(valid.payload.sector,null);
assert.equal(valid.payload.employees,null);
const profile=parseDigitalRadar({...input,companySite:' WWW.Azienda.it/chi-siamo/ ',sector:'  Edilizia   e impianti ',employees:'10-49'},id);
assert(profile);
assert.equal(profile.payload.company_site,'https://www.azienda.it/chi-siamo');
assert.equal(profile.payload.sector,'Edilizia e impianti');
assert.equal(profile.payload.employees,'10-49');
assert.equal(parseDigitalRadar({...input,companySite:'http://azienda.it'},id)?.payload.company_site,'https://azienda.it');
assert.equal(parseDigitalRadar({...input,companySite:'',sector:'',employees:''},id)?.hash,valid.hash,'empty optional fields equal omitted ones');
for(const companySite of ['azienda','javascript:alert(1)','https://user:pw@azienda.it','azienda .it','https://azienda.it:8080','x'.repeat(201)])
  assert.equal(parseDigitalRadar({...input,companySite},id),null,companySite);
assert.equal(parseDigitalRadar({...input,sector:'x'},id),null);
assert.equal(parseDigitalRadar({...input,sector:'x'.repeat(121)},id),null);
assert.equal(parseDigitalRadar({...input,employees:'5'},id),null);
assert.equal(parseDigitalRadar({...input,company:undefined,province:undefined,token:'a'.repeat(48),sector:'Edilizia'},id),null,'team links cannot rewrite the company profile');

// Booking widget: only a plain calendar id is accepted, on the fixed HighLevel origin.
assert.equal(digitalBookingUrl({}),null);
assert.equal(digitalBookingUrl({DIGITAL_BOOKING_CALENDAR_ID:'aBc123DeF456gHi'}),'https://api.leadconnectorhq.com/widget/booking/aBc123DeF456gHi');
for(const id of ['https://evil.example/x','abc','abc/../../x','a'.repeat(41)])
  assert.equal(digitalBookingUrl({DIGITAL_BOOKING_CALENDAR_ID:id}),null,id);

console.log('PASS digital Radar: validation, anonymous/team modes, unknown scores, bounded HTTP, durable receipt, CRM isolation, company profile, booking widget.');
