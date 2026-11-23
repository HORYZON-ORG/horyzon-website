import assert from 'node:assert/strict';
import {eventReminderContent,scheduleOneEventReminder,drainEventReminders} from '../src/lib/public-leads/patrimonial-event-reminder-email.ts';
import {eventIcsContent,eventGoogleCalendarUrl,EVENT_START,EVENT_END} from '../src/lib/public-leads/patrimonial-event-calendar.ts';

assert.equal(EVENT_START,'2026-12-09T20:00:00.000Z');
assert.equal(EVENT_END,'2026-12-09T21:00:00.000Z');
const ics=eventIcsContent();
for(const fragment of ['BEGIN:VCALENDAR','BEGIN:VEVENT','DTSTART:20261209T200000Z','DTEND:20261209T210000Z','TRIGGER:-PT30M','END:VCALENDAR']) assert(ics.includes(fragment));
assert(ics.includes('\r\n'));
const google=new URL(eventGoogleCalendarUrl());
assert.equal(google.hostname,'calendar.google.com');
assert.equal(google.searchParams.get('dates'),'20261209T200000Z/20261209T210000Z');
for(const kind of ['DAY_BEFORE','HALF_HOUR']){
  const content=eventReminderContent(kind,'<Mario>');
  assert(!content.html.includes('<Mario>'));
  assert.match(content.text,/9 dicembre 2026/);
  assert.match(content.text,/Google Calendar/);
  assert.match(content.subject,kind==='DAY_BEFORE'?/Domani alle 21:00/:/Tra 30 minuti/);
}
const env={RESEND_API_KEY:'re_synthetic_token_abcdefghijkl',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',
  ANNUNCI10X_EMAIL_FROM:'Horyzon <noreply@horyzon.it>',ANNUNCI10X_EMAIL_REPLY_TO:'info@horyzon.it'};
const reg='123e4567-e89b-42d3-a456-426614174000',lease='123e4567-e89b-42d3-a456-426614174001';
const sends=[],api=[],pending=['DAY_BEFORE','HALF_HOUR'];
const fetchImpl=async(url,options)=>{
 const u=new URL(url),body=JSON.parse(options.body);
 if(u.pathname.endsWith('/patrimonial_event_reminder_claim')){
   const kind=pending.shift();
   return Response.json(kind?{registrationId:reg,kind,leaseToken:lease,firstName:'Mario',recipient:'test@example.invalid',
      sendAt:kind==='DAY_BEFORE'?'2026-12-08T20:00:00Z':'2026-12-09T19:30:00Z'}:null);
 }
 if(u.pathname.endsWith('/patrimonial_event_reminder_finish')){api.push(body);return Response.json(true);}
 if(u.pathname==='/emails'){sends.push({body,headers:options.headers});return Response.json({id:'resend-fixture-'+sends.length});}
 throw Error('Unexpected path '+u.pathname);
};
assert.deepEqual(await drainEventReminders({limit:3,env,fetchImpl}),{status:'PROCESSED',scheduled:2,failed:0});
assert.equal(sends.length,2);
assert.equal(sends[0].body.scheduled_at,'2026-12-08T20:00:00.000Z');
assert.equal(sends[1].body.scheduled_at,'2026-12-09T19:30:00.000Z');
assert.equal(sends[0].headers['Idempotency-Key'],'horyzon-event-day_before-'+reg);
assert.equal(sends[1].headers['Idempotency-Key'],'horyzon-event-half_hour-'+reg);
assert(api.every(x=>x.p_success===true));
assert.equal(await scheduleOneEventReminder({env:{...env,RESEND_API_KEY:undefined},fetchImpl}),'NOT_CONFIGURED');
console.log('Event webinar calendar + exact scheduled reminder delivery/idempotency PASS');
