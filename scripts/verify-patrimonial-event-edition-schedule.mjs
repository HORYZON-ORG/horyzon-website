import assert from 'node:assert/strict';
import {
  publishedEventSession, publishedEventEditionKey,
} from '../src/lib/public-leads/patrimonial-event-public-schedule.ts';
const env={SUPABASE_URL:'https://pmkyeqrfkunypfkbjnyg.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-secret'};
const active={
  edition_key:'qclbnd_20261209_2100',
  starts_at:'2026-12-09T20:00:00+00:00',
  ends_at:'2026-12-09T21:00:00+00:00',
  status:'ACTIVE',
  capacity:80,
  record:{sessions:[
    {startsAt:'2026-12-09T20:00:00+00:00',endsAt:'2026-12-09T21:00:00+00:00'},
  ]},
};
let requests=[];
const ok=async (url,options) => {
  requests.push({path:new URL(url).pathname,method:options?.method??'GET',authorization:options?.headers?.Authorization});
  if(new URL(url).pathname.endsWith('/patrimonial_event_editions'))return Response.json([active]);
  if(new URL(url).pathname.endsWith('/patrimonial_contact_event_registrations'))return new Response('[]',{headers:{'Content-Range':'0-0/2'}});
  throw Error('Unexpected read');
};
const fallback=await publishedEventSession({...env,SUPABASE_SERVICE_ROLE_KEY:undefined},ok);
assert.equal(fallback.status,'CONFIRMED');
assert.equal(fallback.editionKey,undefined);
assert.equal(requests.length,0);
const session=await publishedEventSession(env,ok);
assert.equal(session.status,'CONFIRMED');
assert.match(session.eventLabel,/9 dicembre 2026/);
assert.match(session.eventLabel,/21:00–22:00/);
assert.equal(session.editionKey,'qclbnd_20261209_2100');
assert.equal(session.seatsTotal,80);
assert.equal(session.seatsTaken,2);
assert.equal(await publishedEventEditionKey(env,ok),active.edition_key);
assert(requests.every(x=>x.method==='GET'),'public schedule must be read-only');
assert(requests.every(x=>x.authorization==='Bearer synthetic-secret'));
const inactive=async()=>Response.json([]);
assert.equal((await publishedEventSession(env,inactive)).editionKey,undefined);
assert.equal(await publishedEventEditionKey(env,inactive),null);
const untrusted=async()=>Response.json([{...active,edition_key:'invalid;&'}]);
assert.equal((await publishedEventSession(env,untrusted)).editionKey,undefined);
assert.equal(await publishedEventEditionKey(env,untrusted),null);
const brokenCount=async(url)=>new URL(url).pathname.endsWith('/patrimonial_event_editions')
  ?Response.json([active]):new Response('[]');
assert.equal((await publishedEventSession(env,brokenCount)).editionKey,undefined);
console.log('Event schedule: pending, active single 60-minute event, safe count, active edition routing, no writes PASS');
