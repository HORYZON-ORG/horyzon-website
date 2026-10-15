import assert from 'node:assert/strict';
import { verifyPatrimonialOpportunityMigration } from './verify-patrimonial-opportunity-sql.mjs';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { FakePatrimonialSupabase } from './fixtures/patrimonial-supabase-transport.mjs';
import { SupabasePatrimonialStore } from '../src/lib/public-leads/patrimonial-supabase.ts';
import { createProductionPatrimonialStore, PatrimonialConflictError, PatrimonialStaleLeaseError, PatrimonialStoreUnavailableError, patrimonialFlags } from '../src/lib/public-leads/patrimonial-store.ts';
import { receivePatrimonialOpportunity, applyPatrimonialCommand } from '../src/lib/public-leads/patrimonial-routing.ts';
import { handlePublicLead } from '../src/lib/public-leads/handler.ts';
import { pilotForms } from '../src/content/patrimonial-funnels.ts';
await verifyPatrimonialOpportunityMigration();

// This script cannot apply SQL, start a service, or reach any network.
let unexpectedNetwork=0,crmCalls=0;
const forbidden=async()=>{unexpectedNetwork++;throw new Error('Network forbidden');};
globalThis.fetch=forbidden;
const sqlPath='supabase/migrations/20261014225059_patrimonial_lead_v2.sql';
const source=await readFile(sqlPath,'utf8'),sql=source.toLowerCase();
const adapter=await readFile('src/lib/public-leads/patrimonial-supabase.ts','utf8');
const storeSource=await readFile('src/lib/public-leads/patrimonial-store.ts','utf8');
const tables=['patrimonial_requests','patrimonial_intents','patrimonial_consent_evidence','patrimonial_participations','patrimonial_event_editions','patrimonial_outbox_operations','patrimonial_domain_events'];
assert.equal([...sql.matchAll(/create table public\.(\w+)/g)].length,7);
for(const name of tables){assert(sql.includes(`create table public.${name}`));assert(sql.includes(`'${name}'`),'RLS/grant allowlist must cover every table');}
for(const fragment of ['request_id uuid primary key','unique (request_id, purpose)','provisional_key text unique','group_key text unique','patrimonial_architect_open','patrimonial_event_relationship','patrimonial_consultation_open','patrimonial_participation_edition','patrimonial_participation_generic','where edition_id is not null',"where edition_id is null and registration_status = 'pending_edition'",'unique (intent_id, effect_type, effect_version)','for update skip locked','pg_advisory_xact_lock','lease_version','lease_token','attempt_count','next_attempt_at','reconcile_required','clock_timestamp()','force row level security','enable row level security','from public, anon, authenticated','to service_role','grant update (intent_id)','supersedes_event_id','retention_review_at','review_after','p_expected','is distinct from v_result','patrimonial_preview_rollback','exception when sqlstate \'pz001\'','patrimonial_incomplete_acquisition'])assert(sql.includes(fragment),`missing SQL invariant: ${fragment}`);
const functions=[...sql.matchAll(/create function public\.(\w+)\([\s\S]*?\n\$\$;/g)];
assert.equal(functions.length,10);
for(const match of functions){assert(match[0].includes('security invoker'));assert(match[0].includes('set search_path = pg_catalog, public'));assert(sql.includes(`'${match[1]}'`),'function execute revoke/grant allowlist');}
for(const name of ['claim_patrimonial_operations','renew_patrimonial_operation_lease','complete_patrimonial_operation','fail_patrimonial_operation','acquire_patrimonial_request_v2','patrimonial_store_health'])assert(functions.some(m=>m[1]===name));
assert(!sql.includes('security definer'));assert(!/grant[^;]+\bto\s+(public|anon|authenticated)\b/.test(sql));
assert(!/create\s+policy|delete\s+from|truncate\s|cron\.|net\.http|http_post|dblink/.test(sql));
const references=[...sql.matchAll(/references\s+([\w.]+)/g)].map(m=>m[1]);
assert(references.every(name=>tables.some(t=>name===`public.${t}`)),'no cross-product FKs');
assert(!/(?:from|update|into|table)\s+(?:hub\.|public\.(?:radar_|annunci|ai_score))/.test(sql));
assert(!/insert into public\.patrimonial_event_editions[^;]*values\s*\(\s*'/.test(sql),'no invented edition seed');
for(const method of [...adapter.matchAll(/this\.(?:value(?:<[^;]*?>)?|mutation)\('([A-Za-z]+)'/g)].map(m=>m[1]))assert(source.includes(`'${method}'`),`missing SQL command: ${method}`);
assert(!/Memory|Map\s*\(/.test(adapter+storeSource));assert(!adapter.includes('console.'));assert(!storeSource.includes('fixtures/'));
assert(adapter.includes("redirect: 'error'"));assert(adapter.includes("cache: 'no-store'"));assert(adapter.includes('AbortSignal.timeout'));
console.log('PASS SQL static contract: 7 dedicated tables, partial uniqueness, 10 invoker RPC/helpers, leases/fencing, atomic acquisition, service-role-only privileges, no seeds/purge/cross-product references. SQL not executed.');

const env={NODE_ENV:'test',PATRIMONIAL_V2_ENABLED:'true'};
const config={SUPABASE_URL:'https://patrimonial.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service-secret',PATRIMONIAL_DURABLE_STORE_READY:'true'};
const setup=()=>{const fake=new FakePatrimonialSupabase();const store=new SupabasePatrimonialStore({url:config.SUPABASE_URL,serviceRoleKey:config.SUPABASE_SERVICE_ROLE_KEY,fetchImpl:fake.fetch.bind(fake)});return {fake,store};};
const payload=(mode='patrimonial-event',requestId=randomUUID())=>({contractVersion:'patrimonial-lead-v2',requestId,mode,sourcePath:pilotForms[mode].path,firstName:'Ada',lastName:'Fixture',email:'ada@example.test',phone:mode==='architect-path'?'+393331234567':'',province:'Milano',profile:'',message:'',consent:true,marketingConsent:false,utm:{},website:'',...(mode==='architect-path'?{experience:'',goal:'',availability:''}:{})});
const request=body=>new Request('https://horyzon.it/api/public-leads',{method:'POST',headers:{Origin:'https://horyzon.it','Content-Type':'application/json','Idempotency-Key':body.requestId},body:JSON.stringify(body)});
const submit=(body,store,at='2026-10-14T21:00:00.000Z',extra={})=>handlePublicLead(request(body),{env,store,now:()=>new Date(at),fetchImpl:async()=>{crmCalls++;throw new Error('CRM forbidden');},...extra});
const counts=f=>{const s=f.inspect();return [s.requests.size,s.provisional.size,s.consents.size,s.operations.size,s.events.size];};
const passed=[];
const {fake,store}=setup(),input=payload();
const first=await submit(input,store);assert.equal(first.status,202);const receipt=await first.json();assert.deepEqual(counts(fake),[1,1,2,1,1]);
assert.equal(fake.calls.filter(c=>c.name==='acquire_patrimonial_request_v2').length,1);
assert.deepEqual(await(await submit(input,store)).json(),receipt);assert.deepEqual(counts(fake),[1,1,2,1,1]);
assert.equal((await submit({...input,province:'Roma'},store)).status,409);
assert.equal((await store.getRequest(input.requestId)).payload.email,'ada@example.test');
assert.equal((await store.getConsentEvidence(input.requestId)).find(c=>c.purpose==='marketing').choice,false);
passed.push('1 new request commit','2 same ID/hash replay','3 changed hash conflicts');

const concurrent=setup(),same=payload();const statuses=await Promise.all(Array.from({length:3},()=>submit(same,concurrent.store).then(r=>r.status)));
assert(statuses.every(status=>status===202));assert.deepEqual(counts(concurrent.fake),[1,1,2,1,1]);
passed.push('4 concurrent same ID → one request','5 request/consents/intent/outbox/event atomic');
for(const method of ['appendConsentEvidence','enqueueOperation','createOrReuseIntent']){
  const failed=setup();failed.fake.failMethod=method;
  assert.equal((await submit(payload(),failed.store)).status,503);assert.deepEqual(counts(failed.fake),[0,0,0,0,0]);
}
// Failure at the final commit, AFTER successful previews, cannot produce ok.
const failedCommit=setup();const localFetch=failedCommit.fake.fetch.bind(failedCommit.fake);
const failFinal=new SupabasePatrimonialStore({url:config.SUPABASE_URL,serviceRoleKey:config.SUPABASE_SERVICE_ROLE_KEY,fetchImpl:async(url,init)=>String(url).endsWith('/acquire_patrimonial_request_v2')?Response.json({code:'XX000',message:'PII secret provider body'},{status:500}):localFetch(url,init)});
assert.equal((await submit(payload(),failFinal)).status,503);assert.deepEqual(counts(failedCommit.fake),[0,0,0,0,0]);
const lost=setup(),lostInput=payload();lost.fake.loseCommitResponse=true;
assert.equal((await submit(lostInput,lost.store)).status,503);assert.deepEqual(counts(lost.fake),[1,1,2,1,1]);
assert.equal((await submit(lostInput,lost.store)).status,202);assert.deepEqual(counts(lost.fake),[1,1,2,1,1]);
passed.push('6 consent failure rolls back','7 outbox/intent/commit failure rolls back; lost ACK recovers by replay');

// Resolved domain rows reference real local ledger request IDs, not fabricated
// absent sources. The same store implements both existing store interfaces.
const domain=setup();
async function seed(pipeline='ARCHITECT_PATH'){
  const body=payload(pipeline==='ARCHITECT_PATH'?'architect-path':'patrimonial-event');assert.equal((await submit(body,domain.store)).status,202);
  return {pipeline,contact:{id:'fixture-contact',locationId:'fixture-location',identityResolved:true},scopeKey:pipeline==='ARCHITECT_PATH'?'fixture-program':'patrimonial-purpose',request:{requestId:body.requestId,receivedAt:domain.fake.now,source:'website-pilot',sourcePath:body.sourcePath,privacyVersion:'patrimonial-pilot-privacy-v1',marketingConsent:false,utm:{}},actor:{type:'SYSTEM',id:'fixture-system'},ownerId:'fixture-owner',nextStepAt:'2026-10-16T21:00:00.000Z',...(pipeline==='PATRIMONIAL_EVENT'?{eventSlug:'fixture-event'}:{}),...(pipeline==='PATRIMONIAL_CONSULTATION'?{trigger:'EXPLICIT_REQUEST'}:{})};
}
const a=await receivePatrimonialOpportunity(domain.store,await seed());const a2=await receivePatrimonialOpportunity(domain.store,await seed());assert.equal(a.id,a2.id);
const e=await receivePatrimonialOpportunity(domain.store,await seed('PATRIMONIAL_EVENT'));const e2=await receivePatrimonialOpportunity(domain.store,await seed('PATRIMONIAL_EVENT'));assert.equal(e.id,e2.id);
const cmd=(i,type,fields={})=>({type,expectedRevision:i.revision,actor:{type:'OWNER',id:'fixture-owner'},at:domain.fake.now,evidenceId:'fixture-evidence',nextStepAt:'2026-10-16T21:00:00.000Z',...fields});
const edition=id=>({id,eventSlug:'fixture-event',title:'Fixture edition',revision:1,startsAt:'2026-10-16T10:00:00.000Z',endsAt:'2026-10-16T12:00:00.000Z',timeZone:'Europe/Rome',status:'ACTIVE'});
let parts=await domain.store.transaction(tx=>tx.listParticipations(e.id));
let event=await applyPatrimonialCommand(domain.store,e.id,cmd(e2,'EVENT_EDITION_SELECTED',{participationId:parts[0].id,expectedParticipationRevision:parts[0].revision,edition:edition('fixture-edition-one')}));
event=await receivePatrimonialOpportunity(domain.store,await seed('PATRIMONIAL_EVENT'));parts=await domain.store.transaction(tx=>tx.listParticipations(e.id));
const generic=parts.find(p=>p.editionId===null);
event=await applyPatrimonialCommand(domain.store,e.id,cmd(event,'EVENT_EDITION_SELECTED',{participationId:generic.id,expectedParticipationRevision:generic.revision,edition:edition('fixture-edition-two')}));
parts=await domain.store.transaction(tx=>tx.listParticipations(e.id));assert.equal(parts.length,2);assert.equal(domain.fake.inspect().editions.size,2);
const duplicate=structuredClone(parts[0]);duplicate.id=randomUUID();duplicate.revision=0;
await assert.rejects(()=>domain.store.transaction(tx=>tx.saveParticipations(e.id,[...parts,duplicate],parts)),PatrimonialConflictError);
assert.equal((await domain.store.transaction(tx=>tx.listParticipations(e.id))).length,2);
const c=await receivePatrimonialOpportunity(domain.store,await seed('PATRIMONIAL_CONSULTATION'));const c2=await receivePatrimonialOpportunity(domain.store,await seed('PATRIMONIAL_CONSULTATION'));assert.equal(c.id,c2.id);
await assert.rejects(()=>applyPatrimonialCommand(domain.store,a.id,cmd(a,'ARCHITECT_PRESENTATION_INVITED')),PatrimonialConflictError);
// Probe actual constraint behavior through RPC, independently of grouping helper.
for(const intent of [a2,event,c2]){
  const forged={...structuredClone(intent),id:randomUUID(),groupKey:randomUUID(),businessKey:randomUUID(),revision:1};
  await assert.rejects(()=>domain.store.transaction(tx=>tx.saveOpportunityIntent(forged,null)),PatrimonialConflictError);
}
passed.push('8 one OPEN Architect constraint','9 one Event relationship','10 multiple edition participations','11 duplicate participation rejected atomically','12 one OPEN Consultation constraint','13 stale transition revision conflicts');

const leased=setup();assert.equal((await submit(payload(),leased.store)).status,202);
const [one,two]=await Promise.all([leased.store.claimOperations({now:leased.fake.now,limit:1}),leased.store.claimOperations({now:leased.fake.now,limit:1})]);
assert.equal(one.length+two.length,1);const operation=(one[0]??two[0]);
const ref=(op,at=leased.fake.now)=>({operationId:op.id,leaseToken:op.leaseToken,leaseVersion:op.leaseVersion,now:at});
leased.fake.now='2026-10-14T21:00:20.000Z';await leased.store.renewLease({...ref(operation),leaseSeconds:120});
assert.equal((await leased.store.getOperation(operation.id)).leaseExpiresAt,'2026-10-14T21:02:20.000Z');
leased.fake.now='2026-10-14T21:02:21.000Z';const [reclaimed]=await leased.store.claimOperations({now:leased.fake.now,limit:1});
assert.equal(reclaimed.id,operation.id);assert.equal(reclaimed.leaseVersion,operation.leaseVersion+1);assert(reclaimed.reconcileRequired);
await assert.rejects(()=>leased.store.completeOperation(ref(operation)),PatrimonialStaleLeaseError);
await assert.rejects(()=>leased.store.renewLease(ref(operation)),PatrimonialStaleLeaseError);
await assert.rejects(()=>leased.store.completeOperation(ref(reclaimed)),PatrimonialConflictError);
const child={...structuredClone(reclaimed),id:randomUUID(),operationKey:`${reclaimed.requestId}:ADD_NOTE:v1`,kind:'ADD_NOTE',dependsOn:reclaimed.id,
  technicalState:'SYNC_PENDING',attemptCount:0,leaseVersion:0,leaseToken:null,leaseExpiresAt:null,reconcileRequired:false,lastErrorCode:null,nextAttemptAt:leased.fake.now};
await leased.store.completeCrmOperation({...ref(reclaimed),reconciliationConfirmed:true,remoteId:'fixture-remote',checkpoint:{locationId:'fixture-location',resolution:'REUSE',contactId:'fixture-contact',noteId:null},followUps:[child]});
assert.equal((await leased.store.getOperation(operation.id)).technicalState,'SYNCED');
assert.equal((await leased.store.getRequest(reclaimed.requestId)).crm.contactId,'fixture-contact');
const [childClaim]=await leased.store.claimOperations({now:leased.fake.now,limit:1});assert.equal(childClaim.id,child.id);
await leased.store.holdOperation(ref(childClaim));assert.equal((await leased.store.getOperation(child.id)).technicalState,'SYNC_PENDING');
const [childReclaim]=await leased.store.claimOperations({now:leased.fake.now,limit:1});
await leased.store.failOperation({...ref(childReclaim),state:'RECONCILE_REQUIRED',errorCode:'NETWORK',reconcileRequired:true});
assert.equal((await leased.store.claimOperations({now:leased.fake.now,limit:1})).length,0);
const [readOnlyClaim]=await leased.store.claimOperations({now:leased.fake.now,limit:1,reconciliationOnly:true});assert.equal(readOnlyClaim.id,child.id);
passed.push('14 one worker claim','15 lease renewal','16 old worker fenced','17 expired lease reclaims with reconciliation');
const retry=setup();await submit(payload(),retry.store);const [retryOp]=await retry.store.claimOperations({now:retry.fake.now,limit:1});
const retryRef={operationId:retryOp.id,leaseToken:retryOp.leaseToken,leaseVersion:retryOp.leaseVersion,now:retry.fake.now};
await retry.store.scheduleRetry({...retryRef,errorCode:'NETWORK',nextAttemptAt:'2026-10-14T21:03:00.000Z'});
assert.equal((await retry.store.claimOperations({now:retry.fake.now,limit:1})).length,0);
retry.fake.now='2026-10-14T21:03:00.000Z';const [due]=await retry.store.claimOperations({now:retry.fake.now,limit:1});assert.equal(due.attemptCount,2);
await retry.store.markManualReview({operationId:due.id,leaseToken:due.leaseToken,leaseVersion:due.leaseVersion,now:retry.fake.now,errorCode:'AUTH'});
assert.equal((await retry.store.getOperation(due.id)).technicalState,'MANUAL_REVIEW');
assert.equal((await retry.store.claimOperations({now:retry.fake.now,limit:1})).length,0);
passed.push('18 retry scheduling','19 complete effect','20 fail → manual review');

const opportunityClaim=await domain.store.transaction(tx=>tx.claimOpportunitySync(a2.id,a2.revision,domain.fake.now));
assert(opportunityClaim.token);
assert.equal(await domain.store.transaction(tx=>tx.claimOpportunitySync(a2.id,a2.revision,domain.fake.now)),null);
await domain.store.transaction(tx=>tx.authorizeOpportunityWrite(a2.id,a2.revision,opportunityClaim.token,domain.fake.now));
domain.fake.now='2026-10-14T21:01:01.000Z';
const nextOpportunityClaim=await domain.store.transaction(tx=>tx.claimOpportunitySync(a2.id,a2.revision,domain.fake.now));
assert(nextOpportunityClaim.reconcileRequired);assert.notEqual(nextOpportunityClaim.token,opportunityClaim.token);
await assert.rejects(()=>domain.store.transaction(tx=>tx.finishOpportunitySync(a2.id,a2.revision,opportunityClaim.token,domain.fake.now,'SYNCED')),PatrimonialStaleLeaseError);
await domain.store.transaction(tx=>tx.finishOpportunitySync(a2.id,a2.revision,nextOpportunityClaim.token,domain.fake.now,'MANUAL_REVIEW'));
let closedTransaction;await store.transaction(async tx=>{closedTransaction=tx;return tx.getRequest(input.requestId);});
await assert.rejects(()=>closedTransaction.getRequest(input.requestId),PatrimonialStoreUnavailableError);
passed.push('opportunity dispatch marker survives expiry; stale checkpoint denied; closed transaction cannot be reused');

for(const missing of [{},{...config,PATRIMONIAL_DURABLE_STORE_READY:''},{PATRIMONIAL_DURABLE_STORE_READY:'true'}, {...config,SUPABASE_SERVICE_ROLE_KEY:''}])assert.throws(()=>createProductionPatrimonialStore(missing),PatrimonialStoreUnavailableError);
assert.equal(createProductionPatrimonialStore(config).kind,'durable');assert(Object.values(patrimonialFlags({})).every(v=>v===false));
assert.equal((await submit(payload(),undefined,undefined,{env:{...env}})).status,503);
const unhealthy=setup();unhealthy.fake.failHealth=true;assert.equal((await submit(payload(),unhealthy.store)).status,503);assert.deepEqual(counts(unhealthy.fake),[0,0,0,0,0]);
// Exercise the production factory + environment plumbing using only the fake URL.
globalThis.fetch=fake.fetch.bind(fake);
assert.equal((await submit(payload(),undefined,fake.now,{env:{...env,...config}})).status,202);
globalThis.fetch=forbidden;
const denied=new SupabasePatrimonialStore({url:config.SUPABASE_URL,serviceRoleKey:config.SUPABASE_SERVICE_ROLE_KEY,fetchImpl:async()=>Response.json({code:'XX000',message:'fixture-service-secret ada@example.test'},{status:500})});
await assert.rejects(()=>denied.health(),error=>error instanceof PatrimonialStoreUnavailableError&&!error.message.includes('ada@')&&!error.message.includes('fixture-service-secret'));
passed.push('21 durable factory only, no memory fallback; readiness/flags default false','22 missing config/unhealthy DB → 503; sanitized errors');

// Source regression checks are read-only and do not enumerate or read tmp/.
const baseline='605676ab5ee453774e6eb2ced3fd69550209f89d';
// Provider additions are allowed for central resource mapping. The imported
// opportunity verifier still pins every original contact-provider method/ctor
// to its source baseline; legacy/Radar and the other protected files stay exact.
execFileSync('git',['diff','--exit-code',baseline,'--','src/lib/radar','src/components/patrimonial-lead-form.tsx','src/lib/public-leads/patrimonial-funnels.ts','src/app/contatti','src/components/wellbeing-page.tsx'],{stdio:'pipe'});
const before=execFileSync('git',['show',`${baseline}:src/lib/public-leads/handler.ts`],{encoding:'utf8'}).replaceAll('\r\n','\n');
const after=(await readFile('src/lib/public-leads/handler.ts','utf8')).replaceAll('\r\n','\n');
const publicBranch=s=>s.slice(s.indexOf('  const pilot = pilotMode'),s.indexOf('\nconst v2Attempts'));
assert.equal(publicBranch(before),publicBranch(after));assert.equal(crmCalls,0);assert.equal(unexpectedNetwork,0);
passed.push('23 legacy unchanged','24 2A unchanged','25 CRM provider never called','26 opportunity provider never called','27 Radar unchanged');
await import('./verify-patrimonial-opportunities.mjs');
console.log(passed.map(message=>`PASS ${message}`).join('\n'));
console.log('Patrimonial persistence: mandatory 1–27 passed with fake Supabase RPC transport and static SQL validation. Migration NOT applied; no PostgreSQL execution, remote calls or production memory fallback.');
