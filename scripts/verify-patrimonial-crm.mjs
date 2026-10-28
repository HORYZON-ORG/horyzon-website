import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { handlePublicLead } from '../src/lib/public-leads/handler.ts';
import { PATRIMONIAL_V2 } from '../src/lib/public-leads/patrimonial-contract.ts';
import { runPatrimonialCrmOnce, patrimonialNoteMarker } from '../src/lib/public-leads/patrimonial-sync.ts';
import { PatrimonialHighLevelProvider, PatrimonialCrmError, unverifiedPatrimonialCapabilities } from '../src/lib/public-leads/patrimonial-highlevel.ts';
import { MemoryPatrimonialStoreForTests } from './fixtures/patrimonial-memory-store.ts';
import { pilotForms } from '../src/content/patrimonial-funnels.ts';

let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error('External network forbidden in CRM verifier'); };
const start = '2026-10-14T10:00:00.000Z';
const location = 'fixture-location';
const tags = ['horyzon-patrimoniale', 'percorso-architetto-patrimoniale', 'evento-patrimoniale', 'pilot'];
const capabilities = { ...unverifiedPatrimonialCapabilities, contactsRead: true, contactsWrite: true, tagsWrite: true, notesWrite: true };
const input = (changes = {}) => ({
  contractVersion: PATRIMONIAL_V2, requestId: randomUUID(), mode: 'architect-path', sourcePath: pilotForms['architect-path'].path,
  firstName: 'Ada', lastName: 'Fixture', email: 'person@example.test', phone: '+393331234567', province: 'Milano',
  profile: 'Imprenditore', experience: 'Sì', goal: 'Sto esplorando', availability: 'Part-time',
  message: 'Domanda di test', consent: true, marketingConsent: false, website: '', utm: { utm_source: 'fixture' }, ...changes,
});
const contact = (id = 'existing', changes = {}) => ({ id, locationId: location, email: 'person@example.test', phone: '+393331234567', tags: ['radar-impresa', 'horyzon-benessere-patrimoniale'], source: 'Radar original', assignedTo: 'fixture-owner', ...changes });

function fakeProvider(initial = []) {
  const people = new Map(initial.map(c => [c.id, structuredClone(c)]));
  const notes = [];
  const calls = [];
  const failures = new Map();
  const api = {
    locationId: location, capabilities: { ...capabilities }, verifiedTags: new Set(tags), people, notes, calls, failures,
    assertReady(write) {
      if (api.locationId !== location || api.capabilities.contactsRead !== true || (write && ['contactsWrite', 'tagsWrite', 'notesWrite'].some(k=>api.capabilities[k] !== true))) throw new PatrimonialCrmError('CONFIG');
    },
    async invoke(name, args) {
      calls.push({ name, args: structuredClone(args) });
      const failure = failures.get(name);
      if (failure) { failures.delete(name); throw failure; }
    },
    async findContactsByEmail(email) { await api.invoke('email', { email }); return structuredClone([...people.values()].filter(c=>c.email === email)); },
    async findContactsByPhone(phone) { await api.invoke('phone', { phone }); return structuredClone([...people.values()].filter(c=>c.phone === phone)); },
    async getContact(id) { await api.invoke('get', { id }); const c=people.get(id); if(!c) throw new PatrimonialCrmError('CONFIG', {status:404}); return structuredClone(c); },
    async upsertContact(data) {
      await api.invoke('create', data);
      assert(!('source' in data)); assert(!('assignedTo' in data)); assert(!('tags' in data)); assert(!('customFields' in data));
      assert(![...people.values()].some(c=>c.email === data.email || (data.phone && c.phone === data.phone)), 'create-only fake must never update an existing person');
      const c = contact(`created-${people.size + 1}`, { ...data, phone: data.phone ?? null, tags: [], source: undefined, assignedTo: undefined });
      people.set(c.id, c); return structuredClone(c);
    },
    async addTags(id, desired) {
      await api.invoke('tags', { id, tags: desired });
      assert(desired.every(t=>api.verifiedTags.has(t)));
      const c=people.get(id); c.tags=[...new Set([...(c.tags ?? []), ...desired])];
    },
    async addNote(id, body) {
      await api.invoke('note', { id, body });
      const marker = body.split('\n')[0];
      assert(!notes.some(n=>n.marker === marker), 'one note per logical request');
      const note={ id:`note-${notes.length + 1}`, locationId:api.locationId, contactId:id, marker, body };
      notes.push(note); return { id:note.id };
    },
    async findNoteByRequestMarker(id, marker) { await api.invoke('note-lookup', { id, marker }); return notes.find(n=>n.contactId === id && n.marker === marker) ?? null; },
  };
  return api;
}
async function context(initial = [], body = input()) {
  const ctx={ store:new MemoryPatrimonialStoreForTests(), provider:fakeProvider(initial), body, time:start, flags:{NODE_ENV:'test',PATRIMONIAL_V2_ENABLED:'true',PATRIMONIAL_CRM_WRITE_ENABLED:'true'} };
  ctx.acquire = async (data=body) => handlePublicLead(new Request('https://horyzon.it/api/public-leads',{ method:'POST',headers:{ Origin:'https://horyzon.it','Content-Type':'application/json','Idempotency-Key':data.requestId },body:JSON.stringify(data) }), { env:ctx.flags,store:ctx.store,now:()=>new Date(ctx.time),fetchImpl:async()=>{throw new Error('Acquisition must not invoke CRM');} });
  assert.equal((await ctx.acquire()).status,202);
  ctx.tick = (extra={}) => runPatrimonialCrmOnce({ store:ctx.store,provider:ctx.provider,env:()=>ctx.flags,now:()=>new Date(ctx.time),jitter:0,...extra });
  ctx.drain = async () => { const outcomes=[]; for(let i=0;i<30;i++) { const outcome=await ctx.tick(); outcomes.push(outcome); if(['IDLE','HOLD','CHECKPOINT_UNCONFIRMED'].includes(outcome)) return outcomes; } throw new Error('Worker did not quiesce'); };
  ctx.state = () => ctx.store.inspectForTests().requests.get(ctx.body.requestId).technicalState;
  ctx.effects = () => [...ctx.store.inspectForTests().operations.values()].filter(o=>o.kind !== 'SYNC_REQUEST');
  return ctx;
}
const count = (ctx, name) => ctx.provider.calls.filter(c=>c.name === name).length;
const writes = ctx => ctx.provider.calls.filter(c=>['create','tags','note'].includes(c.name));
const passed=[];

// 1: new person and all four individually persisted effects/remote IDs.
const fresh=await context();
await fresh.drain();
assert.equal(fresh.state(),'SYNCED'); assert.equal(count(fresh,'create'),1);
assert.deepEqual(fresh.effects().map(o=>o.kind),['RESOLVE_CONTACT','UPSERT_CONTACT','ADD_TAGS','ADD_NOTE']);
assert(fresh.effects().every(o=>o.technicalState === 'SYNCED'));
assert(fresh.effects().filter(o=>o.kind !== 'RESOLVE_CONTACT').every(o=>o.remoteId));
assert.equal(fresh.store.inspectForTests().requests.get(fresh.body.requestId).crm.contactId,'created-1');
assert.equal(fresh.provider.notes.length,1);
const note=fresh.provider.notes[0];
for(const value of [patrimonialNoteMarker(fresh.body.requestId),fresh.body.mode,fresh.body.sourcePath,start,'Marketing snapshot: no','utm_source: fixture','Sì','Sto esplorando']) assert(note.body.includes(value));
passed.push('1 new contact; ordered independent effects and persisted IDs');

// 2/3/7: reuse a Radar person; no anonymous update/source/owner/phone loss.
for(const omittedPhone of [false,true]) {
  const original=contact();
  const body=omittedPhone ? input({mode:'patrimonial-event',sourcePath:pilotForms['patrimonial-event'].path,phone:'',experience:undefined,goal:undefined,availability:undefined}) : input();
  const ctx=await context([original],body);
  await ctx.drain();
  assert.equal(ctx.state(),'SYNCED'); assert.equal(count(ctx,'create'),0);
  const saved=ctx.provider.people.get(original.id);
  assert.equal(saved.phone,original.phone); assert.equal(saved.source,original.source); assert.equal(saved.assignedTo,original.assignedTo);
  assert(original.tags.every(tag=>saved.tags.includes(tag)));
}
passed.push('2 reuse by email','3 omitted phone preserved','7 Radar source/owner/legacy tags preserved');

// C in the domain: a new unclaimed phone does not overwrite the reliable old one.
const changedPhone=await context([contact()],input({phone:'+393339999999'}));
await changedPhone.drain(); assert.equal(changedPhone.state(),'SYNCED');
assert.equal(changedPhone.provider.people.get('existing').phone,'+393331234567');
assert.equal(count(changedPhone,'create'),0);

// 4/5/6: conflicting secondary identity and non-unique primary identity.
for(const people of [
  [contact('primary',{phone:'+393330000000'}),contact('other',{email:'different@example.test'})],
  [contact('other',{email:'different@example.test'})],
  [contact('first'),contact('second',{phone:'+393330000000'})],
]) {
  const ctx=await context(people); await ctx.drain();
  assert.equal(ctx.state(),'IDENTITY_REVIEW'); assert.equal(writes(ctx).length,0);
}
passed.push('4 conflicting phone → identity review','5 different email/shared phone → identity review','6 multiple matches → identity review');

// 8: only the tags step is retried; confirmed creation/resolve are not rerun.
const tagFailure=await context();
tagFailure.provider.failures.set('tags',new PatrimonialCrmError('PROVIDER',{status:503}));
await tagFailure.drain();
assert.equal(tagFailure.state(),'RETRY_SCHEDULED'); assert.equal(count(tagFailure,'create'),1); assert.equal(count(tagFailure,'note'),0);
const resolutions=count(tagFailure,'email');
tagFailure.time=new Date(Date.parse(start)+60000).toISOString();
await tagFailure.drain();
assert.equal(tagFailure.state(),'SYNCED'); assert.equal(count(tagFailure,'create'),1); assert.equal(count(tagFailure,'email'),resolutions);
assert.equal(count(tagFailure,'tags'),2); assert.equal(count(tagFailure,'note'),1);
passed.push('8 tag-only retry after 503');

// 9/13: definitive note throttling retries only the note, respecting Retry-After.
const noteFailure=await context();
noteFailure.provider.failures.set('note',new PatrimonialCrmError('RATE_LIMIT',{status:429,retryAfterSeconds:600}));
await noteFailure.drain();
const pendingNote=noteFailure.effects().find(o=>o.kind === 'ADD_NOTE');
assert.equal(pendingNote.nextAttemptAt,new Date(Date.parse(start)+600000).toISOString());
assert.equal(noteFailure.state(),'RETRY_SCHEDULED');
noteFailure.time=pendingNote.nextAttemptAt; await noteFailure.drain();
assert.equal(noteFailure.state(),'SYNCED'); assert.equal(count(noteFailure,'tags'),1); assert.equal(count(noteFailure,'create'),1); assert.equal(count(noteFailure,'note'),2);
passed.push('9 note-only retry','13 429 and Retry-After');

// 10: contact creation committed, response lost. Reconcile by READ; never create twice.
const createTimeout=await context();
const createOnce=createTimeout.provider.upsertContact;
createTimeout.provider.upsertContact=async data=>{ await createOnce(data); throw new PatrimonialCrmError('NETWORK',{outcomeUncertain:true}); };
await createTimeout.drain(); assert.equal(createTimeout.state(),'RECONCILE_REQUIRED');
assert.equal(count(createTimeout,'create'),1);
assert.equal(await createTimeout.tick({reconciliationOnly:true}),'RECONCILED');
await createTimeout.drain(); assert.equal(createTimeout.state(),'SYNCED'); assert.equal(count(createTimeout,'create'),1);
passed.push('10 uncertain create reconciled without blind retry');

// Missing after uncertain create is not proof it never committed (eventual consistency).
const invisible=await context();
invisible.provider.failures.set('create',new PatrimonialCrmError('NETWORK',{outcomeUncertain:true}));
await invisible.drain(); assert.equal(invisible.state(),'RECONCILE_REQUIRED');
assert.equal(await invisible.tick({reconciliationOnly:true}),'MANUAL_REVIEW');
assert.equal(count(invisible,'create'),1);

// Timeout after note creation: notesRead UNKNOWN -> manual review, no append.
const noteTimeout=await context();
const appendOnce=noteTimeout.provider.addNote;
noteTimeout.provider.addNote=async (...args)=>{ await appendOnce(...args); throw new PatrimonialCrmError('NETWORK',{outcomeUncertain:true}); };
await noteTimeout.drain(); assert.equal(noteTimeout.state(),'RECONCILE_REQUIRED');
assert.equal(await noteTimeout.tick({reconciliationOnly:true}),'MANUAL_REVIEW');
assert.equal(count(noteTimeout,'note'),1); assert.equal(count(noteTimeout,'note-lookup'),0);
const reconciledNote=await context();
reconciledNote.provider.capabilities.notesRead=true;
const noteOnce=reconciledNote.provider.addNote;
reconciledNote.provider.addNote=async (...args)=>{ await noteOnce(...args); throw new PatrimonialCrmError('NETWORK',{outcomeUncertain:true}); };
await reconciledNote.drain();
// Read-only reconciliation remains possible while CRM writes are switched off.
reconciledNote.flags.PATRIMONIAL_CRM_WRITE_ENABLED='false';
assert.equal(await reconciledNote.tick({reconciliationOnly:true}),'NOTE_RECONCILED');
assert.equal(reconciledNote.state(),'SYNCED'); assert.equal(count(reconciledNote,'note'),1);
passed.push('uncertain note held without lookup; verified lookup reconciles in read-only mode');

// Local DB/checkpoint failures after a successful remote fake are uncertain too.
for(const lostAfterCommit of [false,true]) {
  const checkpointFailure=await context(); checkpointFailure.provider.capabilities.notesRead=true;
  const complete=checkpointFailure.store.completeCrmOperation.bind(checkpointFailure.store);
  let loseOnce=true;
  checkpointFailure.store.completeCrmOperation=async mutation=>{
    const operation=await checkpointFailure.store.getOperation(mutation.operationId);
    if(operation.kind === 'ADD_NOTE' && loseOnce) {
      loseOnce=false;
      if(lostAfterCommit) await complete(mutation);
      throw new Error('Fixture checkpoint acknowledgement failure');
    }
    return complete(mutation);
  };
  await checkpointFailure.drain();
  if(!lostAfterCommit) {
    assert.equal(checkpointFailure.state(),'RECONCILE_REQUIRED');
    assert.equal(await checkpointFailure.tick({reconciliationOnly:true}),'NOTE_RECONCILED');
  }
  await checkpointFailure.drain();
  assert.equal(checkpointFailure.state(),'SYNCED'); assert.equal(count(checkpointFailure,'note'),1);
  assert.equal([...checkpointFailure.store.inspectForTests().intents.values()][0].technicalState,'SYNCED');
}
passed.push('checkpoint failure before/after local commit never duplicates the remote note');

// 11/12: replay is not another job/note; conscious new request gets its own note.
assert.equal((await fresh.acquire()).status,202); await fresh.drain(); assert.equal(count(fresh,'note'),1);
const newRequest={...fresh.body,requestId:randomUUID()};
assert.equal((await fresh.acquire(newRequest)).status,202); await fresh.drain();
assert.equal(count(fresh,'create'),1); assert.equal(count(fresh,'note'),2);
assert.equal(fresh.store.inspectForTests().requests.size,2); assert.equal(fresh.store.inspectForTests().intents.size,1);
assert(fresh.provider.notes.some(n=>n.marker === patrimonialNoteMarker(newRequest.requestId)));
passed.push('11 same request no duplicate note','12 new request reuses open provisional intent and adds one note');

// Cross-funnel acquisition shares the identity lock and rechecks NEW before create.
const parallel=await context();
const event=input({mode:'patrimonial-event',sourcePath:pilotForms['patrimonial-event'].path,phone:'',experience:undefined,goal:undefined,availability:undefined});
await parallel.acquire(event);
await Promise.all(Array.from({length:20},()=>parallel.tick()));
await parallel.drain();
assert.equal(count(parallel,'create'),1); assert.equal(count(parallel,'note'),2);
passed.push('shared identity lock across funnels and requests');

// 14/15/16/17: auth/manual, gates and mapping never turn into writes.
const auth=await context(); auth.provider.failures.set('email',new PatrimonialCrmError('AUTH',{status:401}));
await auth.drain(); assert.equal(auth.state(),'MANUAL_REVIEW'); assert.equal(writes(auth).length,0);
const hold=await context(); hold.flags.PATRIMONIAL_CRM_WRITE_ENABLED='false';
assert.equal(await hold.tick(),'HOLD'); assert.equal(hold.provider.calls.length,0);
assert([...hold.store.inspectForTests().operations.values()].every(o=>o.attemptCount === 0));
hold.flags.PATRIMONIAL_V2_ENABLED='false'; assert.equal(await hold.tick(),'HOLD');
const mismatch=await context(); mismatch.provider.locationId='wrong-location'; await mismatch.drain(); assert.equal(writes(mismatch).length,0); assert.equal(mismatch.state(),'MANUAL_REVIEW');
const missingTags=await context(); missingTags.provider.verifiedTags.clear(); await missingTags.drain(); assert.equal(missingTags.state(),'MANUAL_REVIEW'); assert.equal(writes(missingTags).length,0);
const unknownCapability=await context(); unknownCapability.provider.capabilities.contactsWrite='UNKNOWN'; await unknownCapability.drain(); assert.equal(writes(unknownCapability).length,0);
passed.push('14 401 → manual review','15 flags false → pending/no writes','16 location mismatch → zero writes','17 unverified tag/capability mapping → manual/no creation');

// Flag revocation after lookup, before write, is checked again and leaves a hold.
const revoked=await context();
const readEmail=revoked.provider.findContactsByEmail;
let reads=0;
revoked.provider.findContactsByEmail=async email=>{ const result=await readEmail(email); if(++reads === 2) revoked.flags.PATRIMONIAL_CRM_WRITE_ENABLED='false'; return result; };
await revoked.drain(); assert.equal(writes(revoked).length,0); assert.equal(revoked.state(),'SYNC_PENDING');
passed.push('write flag rechecked after asynchronous reads');

const stale=await context();
assert.equal(await stale.tick(),'EXPANDED'); assert.equal(await stale.tick(),'RESOLVED');
const originalLookup=stale.provider.findContactsByEmail;
stale.provider.findContactsByEmail=async email=>{const result=await originalLookup(email);stale.time=new Date(Date.parse(start)+61000).toISOString();return result;};
assert.equal(await stale.tick(),'STALE'); assert.equal(writes(stale).length,0);
passed.push('expired lease is fenced before dispatching a write');

// Test concrete HTTP adapter through an injected fake fetch, never global fetch.
const httpEnv={NODE_ENV:'test',PATRIMONIAL_V2_ENABLED:'true',PATRIMONIAL_CRM_WRITE_ENABLED:'true',HIGHLEVEL_PRIVATE_TOKEN:'fixture-credential',HIGHLEVEL_LOCATION_ID:location};
const bindings={
  email:{verified:true,request:(email,locationId,cursor)=>({method:'GET',path:`/contacts/?email=${encodeURIComponent(email)}&locationId=${locationId}${cursor ? '&cursor='+cursor : ''}`}),decode:body=>body},
  phone:{verified:true,request:(phone,locationId)=>({method:'POST',path:'/contacts/search-fixture',body:{phone,locationId}}),decode:body=>body},
  contact:{verified:true,request:id=>({method:'GET',path:`/contacts/${id}`}),decode:body=>body.contact},
  create:{verified:true,createOnly:true,request:(data,locationId)=>({method:'POST',path:'/contacts/',body:{...data,locationId}}),decode:body=>body.contact},
};
let httpCalls=[];
const fakeHttp=async (url,init)=>{
  httpCalls.push({url,init});
  assert.equal(new URL(url).origin,'https://services.leadconnectorhq.com');
  assert.equal(init.headers.Version,'2021-07-28'); assert.equal(init.redirect,'error'); assert.equal(init.cache,'no-store'); assert(init.signal instanceof AbortSignal);
  assert(!('Idempotency-Key' in init.headers));
  if(url.endsWith('/notes')) return Response.json({note:{id:'fixture-note'}});
  if(url.endsWith('/tags')) return new Response(null,{status:204});
  if(init.method === 'POST' && new URL(url).pathname === '/contacts/') return Response.json({contact:contact('new-fixture')});
  if(new URL(url).pathname === '/contacts/existing') return Response.json({contact:contact()});
  return Response.json({contacts:[contact()],complete:true});
};
const httpOptions={env:()=>httpEnv,verifiedLocationId:location,bindings,capabilities,verifiedTags:tags,fetchImpl:fakeHttp,now:()=>new Date(start)};
const http=new PatrimonialHighLevelProvider(httpOptions);
assert.equal((await http.findContactsByEmail('PERSON@EXAMPLE.TEST'))[0].id,'existing');
assert.equal((await http.findContactsByPhone('+393331234567'))[0].id,'existing');
assert.equal((await http.getContact('existing')).id,'existing');
await http.upsertContact({firstName:'Ada',lastName:'Fixture',email:'person@example.test',phone:'+393331234567'});
await http.addTags('existing',['pilot']); await http.addNote('existing','fixture note');
const before=httpCalls.length;
httpEnv.PATRIMONIAL_CRM_WRITE_ENABLED='false';
await assert.rejects(()=>http.addTags('existing',['pilot']),PatrimonialCrmError);
await assert.rejects(()=>http.addNote('existing','fixture note'),PatrimonialCrmError);
await assert.rejects(()=>http.upsertContact({firstName:'Ada',lastName:'Fixture',email:'person@example.test'}),PatrimonialCrmError);
assert.equal(httpCalls.length,before);
httpEnv.PATRIMONIAL_CRM_WRITE_ENABLED='true';
for(const config of [
  {env:()=>({...httpEnv,HIGHLEVEL_PRIVATE_TOKEN:''})},{env:()=>({...httpEnv,HIGHLEVEL_LOCATION_ID:''})},
  {verifiedLocationId:'other-fixture'}, {baseUrl:'https://untrusted.example.test'}, {bindings:{}},
]) {
  const invalid=new PatrimonialHighLevelProvider({...httpOptions,...config});
  assert.throws(()=>invalid.assertReady(true),PatrimonialCrmError);
  await assert.rejects(()=>invalid.addTags('existing',['not-verified']),PatrimonialCrmError);
}
assert.equal(httpCalls.length,before);
const configuredWithoutLookup=new PatrimonialHighLevelProvider({...httpOptions,bindings:{}});
await assert.rejects(()=>configuredWithoutLookup.findContactsByEmail('person@example.test'),PatrimonialCrmError);
assert.equal(httpCalls.length,before);
const unsafeUpsert=new PatrimonialHighLevelProvider({...httpOptions,bindings:{...bindings,create:{...bindings.create,request:(data,locationId)=>({method:'POST',path:'/contacts/upsert',body:{...data,locationId}})}}});
await assert.rejects(()=>unsafeUpsert.upsertContact({firstName:'Ada',lastName:'Fixture',email:'person@example.test'}),PatrimonialCrmError);
assert.equal(httpCalls.length,before);

for(const status of [400,401,403,404,429,500,503]) {
  const failing=new PatrimonialHighLevelProvider({...httpOptions,fetchImpl:async()=>new Response('private body person@example.test fixture-credential',{status,headers:{'Retry-After':'120'}})});
  let error;
  try { await failing.findContactsByEmail('person@example.test'); } catch(e) { error=e; }
  assert(error instanceof PatrimonialCrmError); assert.equal(error.status,status);
  assert.equal(error.retryAfterSeconds,120);
  assert(!JSON.stringify(error).includes('example.test')); assert(!error.message.includes('fixture-credential')); assert(!error.message.includes('private body'));
  assert.equal(error.outcomeUncertain,false);
}
const timeoutHttp=new PatrimonialHighLevelProvider({...httpOptions,fetchImpl:async(_url,init)=>{if(init.method === 'GET') return Response.json({contact:contact()}); throw new DOMException('private detail','TimeoutError');}});
await assert.rejects(()=>timeoutHttp.addNote('existing','fixture body'),e=>e instanceof PatrimonialCrmError && e.code === 'NETWORK' && e.outcomeUncertain);
const insecureRoute=new PatrimonialHighLevelProvider({...httpOptions,bindings:{...bindings,email:{...bindings.email,request:()=>({method:'GET',path:'https://untrusted.example.test/contacts/'})}}});
await assert.rejects(()=>insecureRoute.findContactsByEmail('person@example.test'),PatrimonialCrmError);
assert.equal(httpCalls.length,before);
let pages=0;
const paginated=new PatrimonialHighLevelProvider({...httpOptions,fetchImpl:async()=>Response.json(++pages === 1 ? {contacts:[contact()],complete:false,nextCursor:'second'} : {contacts:[contact('duplicate')],complete:true})});
assert.equal((await paginated.findContactsByEmail('person@example.test')).length,2); assert.equal(pages,2);
const incomplete=new PatrimonialHighLevelProvider({...httpOptions,fetchImpl:async()=>Response.json({contacts:[],complete:false})});
await assert.rejects(()=>incomplete.findContactsByEmail('person@example.test'),PatrimonialCrmError);
let foreignWrites=0;
const foreign=new PatrimonialHighLevelProvider({...httpOptions,fetchImpl:async(_url,init)=>{
  if(init.method !== 'GET') foreignWrites++;
  return Response.json({contact:contact('existing',{locationId:'foreign-location'})});
}});
await assert.rejects(()=>foreign.addTags('existing',['pilot']),PatrimonialCrmError);
await assert.rejects(()=>foreign.addNote('existing','fixture body'),PatrimonialCrmError);
assert.equal(foreignWrites,0);
const marker=patrimonialNoteMarker(randomUUID());
const noteLookup={verified:true,request:id=>({method:'GET',path:`/contacts/${id}/notes`}),decode:body=>body};
for(const result of [
  {complete:false,notes:[]},
  {complete:true,notes:[{id:'note-id',locationId:'foreign-location',contactId:'existing',marker}]},
  {complete:true,notes:[{id:'note-id',locationId:location,contactId:'existing',marker},{id:'duplicate',locationId:location,contactId:'existing',marker}]},
]) {
  const invalidNotes=new PatrimonialHighLevelProvider({...httpOptions,capabilities:{...capabilities,notesRead:true},bindings:{...bindings,noteLookup},fetchImpl:async()=>Response.json(result)});
  await assert.rejects(()=>invalidNotes.findNoteByRequestMarker('existing',marker),PatrimonialCrmError);
}
const validNotes=new PatrimonialHighLevelProvider({...httpOptions,capabilities:{...capabilities,notesRead:true},bindings:{...bindings,noteLookup},fetchImpl:async()=>Response.json({complete:true,notes:[{id:'note-id',locationId:location,contactId:'existing',marker}]})});
assert.equal((await validNotes.findNoteByRequestMarker('existing',marker)).id,'note-id');
passed.push('HTTP: GET/POST, timeout signal, sanitized errors, Retry-After, config gates, pagination, redirect/URL safety');

// 18/19/20: baseline source identity plus existing fake-based regression suites.
const { MAIN_BASELINE, FUNNEL_BASELINE, assertSourcesAt } = await import('./lib/patrimonial-integration-baselines.mjs');
assertSourcesAt(MAIN_BASELINE, ['src/lib/radar/highlevel.ts','src/app/contatti/page.tsx','src/components/wellbeing-page.tsx']);
assertSourcesAt(FUNNEL_BASELINE, ['src/lib/public-leads/patrimonial-funnels.ts']);
await import('./verify-patrimonial-form-presentation.mjs');
const baseline=execFileSync('git',['show','cc15e5d0731a8227eac2a3df39d7e7b0e2242ac3:src/lib/public-leads/handler.ts'],{encoding:'utf8'}).replaceAll('\r\n','\n');
const current=(await readFile('src/lib/public-leads/handler.ts','utf8')).replaceAll('\r\n','\n');
const legacySection=text=>text.slice(text.indexOf('  const pilot = pilotMode'),text.indexOf('\nconst v2Attempts'));
assert.equal(legacySection(current),legacySection(baseline));
await import('./verify-patrimonial-leads.mjs');
await import('./verify-patrimonial-funnels.mjs');
await import('./verify-radar-free-crm.mjs');
passed.push('18 legacy source and regression unchanged','19 2A source and regression unchanged','20 Radar adapter byte-equivalent and fake CRM regression');
assert.equal(networkAttempts,0);
console.log(passed.map(x=>`PASS ${x}`).join('\n'));
console.log('Patrimonial CRM: required 1–20 cases passed; all providers/transports were fakes. Zero external calls, no live account data, no migrations or remote changes.');
