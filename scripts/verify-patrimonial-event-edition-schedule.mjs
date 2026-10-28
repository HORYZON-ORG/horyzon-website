import assert from 'node:assert/strict';
import {
  publishedEventSession, publishedEventEditionKey,
} from '../src/lib/public-leads/patrimonial-event-public-schedule.ts';
const env={SUPABASE_URL:'https://pmkyeqrfkunypfkbjnyg.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-secret'};
const active={
  edition_key:'qblbd-20281204-20281211',
  starts_at:'2028-12-04T18:00:00+00:00',
  ends_at:'2028-12-11T21:00:00+00:00',
  status:'ACTIVE',
  capacity:80,
  record:{sessions:[
    {startsAt:'2028-12-04T18:00:00+00:00',endsAt:'2028-12-04T21:00:00+00:00'},
    {startsAt:'2028-12-11T18:00:00+00:00',endsAt:'2028-12-11T21:00:00+00:00'},
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
assert.equal(fallback.status,'PLACEHOLDER');
assert.equal(requests.length,0);
const session=await publishedEventSession(env,ok);
assert.equal(session.status,'CONFIRMED');
assert.match(session.eventLabel,/4 dicembre 2028/);
assert.match(session.eventLabel,/11 dicembre 2028/);
assert.equal(session.seatsTotal,80);
assert.equal(session.seatsTaken,2);
assert.equal(await publishedEventEditionKey(env,ok),active.edition_key);
assert(requests.every(x=>x.method==='GET'),'public schedule must be read-only');
assert(requests.every(x=>x.authorization==='Bearer synthetic-secret'));
const inactive=async()=>Response.json([]);
assert.equal((await publishedEventSession(env,inactive)).status,'PLACEHOLDER');
assert.equal(await publishedEventEditionKey(env,inactive),null);
const untrusted=async()=>Response.json([{...active,edition_key:'invalid;&'}]);
assert.equal((await publishedEventSession(env,untrusted)).status,'PLACEHOLDER');
assert.equal(await publishedEventEditionKey(env,untrusted),null);
const brokenCount=async(url)=>new URL(url).pathname.endsWith('/patrimonial_event_editions')
  ?Response.json([active]):new Response('[]');
assert.equal((await publishedEventSession(env,brokenCount)).status,'PLACEHOLDER');
console.log('Event schedule: pending, active two nights, safe count, active edition routing, no writes PASS');
