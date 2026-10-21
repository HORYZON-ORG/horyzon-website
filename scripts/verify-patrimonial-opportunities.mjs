import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { receivePatrimonialOpportunity, applyPatrimonialCommand, transitionArchitect, transitionEvent, transitionConsultation, unresolvedPatrimonialPipelineMapping, logicalOpportunityFields, patrimonialOpportunityProjection, PatrimonialTransitionError } from '../src/lib/public-leads/patrimonial-routing.ts';
import { syncPatrimonialOpportunity } from '../src/lib/public-leads/patrimonial-sync.ts';
import { PatrimonialConflictError, PatrimonialStaleLeaseError } from '../src/lib/public-leads/patrimonial-store.ts';
import { PatrimonialHighLevelProvider, PatrimonialCrmError } from '../src/lib/public-leads/patrimonial-highlevel.ts';

let externalCalls=0;
globalThis.fetch=async()=>{externalCalls++;throw new Error('External network forbidden in opportunity verifier');};
const clone=structuredClone;
const start='2026-10-14T10:00:00.000Z';
let clock=start;
const later=(ms=86400000)=>new Date(Date.parse(clock)+ms).toISOString();
const roles=Object.fromEntries(['SYSTEM','OWNER','HOST','BOOKING','INTERVIEWER','APPROVER'].map(type=>[type,{id:`fixture-${type}`,type}]));

// Test-only transactional repository. Separate tables/maps for intent and
// participation; uniqueness, CAS and sync fencing are checked at commit.
class MemoryOpportunityStore {
  state={intents:new Map(),participations:new Map(),sync:new Map()};
  queue=Promise.resolve();
  inspect(){return clone(this.state);}
  async transaction(work){
    const previous=this.queue; let release; this.queue=new Promise(resolve=>{release=resolve;}); await previous;
    const draft=clone(this.state); let active=true;
    const check=()=>assert(active,'closed transaction');
    const current=(id,revision)=>{check();const value=draft.intents.get(id);if(!value||value.revision!==revision)throw new PatrimonialConflictError();return value;};
    const lease=(id,revision,token,now)=>{const intent=current(id,revision),claim=draft.sync.get(id);if(!claim||claim.token!==token||Date.parse(claim.expiresAt)<=Date.parse(now))throw new PatrimonialStaleLeaseError();return {intent,claim};};
    const tx={
      async findOpportunityIntent(key){check();return clone([...draft.intents.values()].find(x=>x.groupKey===key)??null);},
      async getOpportunityIntent(id){check();return clone(draft.intents.get(id)??null);},
      async saveOpportunityIntent(intent,expected){
        check();const old=draft.intents.get(intent.id);
        if(expected===null){if(old||[...draft.intents.values()].some(x=>x.groupKey===intent.groupKey))throw new PatrimonialConflictError();}
        else {current(intent.id,expected);assert.equal(intent.revision,expected+1);}
        draft.intents.set(intent.id,clone(intent));
        const claim=draft.sync.get(intent.id);
        if(claim){claim.reconcileRequired ||= claim.writeStarted;claim.token=null;claim.state=claim.reconcileRequired?'RECONCILE_REQUIRED':'SYNC_PENDING';}
      },
      async listParticipations(id){check();return clone([...draft.participations.values()].filter(p=>p.relationId===id));},
      async saveParticipations(id,next,previousRows){
        check();const actual=[...draft.participations.values()].filter(p=>p.relationId===id);
        assert.deepEqual(actual.map(p=>[p.id,p.revision]).sort(),previousRows.map(p=>[p.id,p.revision]).sort());
        assert(previousRows.every(p=>next.some(n=>n.id===p.id)),'history rows must be retained');
        for(const part of next){
          assert.equal(part.relationId,id);assert(Number.isInteger(part.revision));
          const old=draft.participations.get(part.id);
          if(old){if(JSON.stringify(old)!==JSON.stringify(part))assert.equal(part.revision,old.revision+1);else assert.equal(part.revision,old.revision);}
          else assert.equal(part.revision,0);
          draft.participations.set(part.id,clone(part));
        }
      },
      async claimOpportunitySync(id,revision,now){
        const intent=current(id,revision),old=draft.sync.get(id);
        if(old?.token&&Date.parse(old.expiresAt)>Date.parse(now))return null;
        const claim={token:randomUUID(),expiresAt:new Date(Date.parse(now)+60000).toISOString(),state:'SYNCING',writeStarted:false,reconcileRequired:!!(old?.reconcileRequired||old?.writeStarted)};
        draft.sync.set(id,claim);return {intent:clone(intent),token:claim.token,reconcileRequired:claim.reconcileRequired};
      },
      async authorizeOpportunityWrite(id,revision,token,now){lease(id,revision,token,now).claim.writeStarted=true;},
      async finishOpportunitySync(id,revision,token,now,state,remote){
        const {intent,claim}=lease(id,revision,token,now);
        if(remote)intent.remote=clone(remote);
        claim.reconcileRequired=state==='RECONCILE_REQUIRED'||(state==='MANUAL_REVIEW'&&claim.reconcileRequired);
        claim.state=state;claim.token=null;claim.writeStarted=false;
      },
    };
    try{
      const result=clone(await work(tx));
      const groups=new Set(),participationKeys=new Set();
      for(const intent of draft.intents.values()){assert(!groups.has(intent.groupKey));groups.add(intent.groupKey);assert(Number.isInteger(intent.revision));}
      for(const p of draft.participations.values()){
        const intent=draft.intents.get(p.relationId);assert(intent);assert.equal(p.contactId,intent.contactId);
        if(p.editionId!==null||p.status==='PENDING_EDITION'){
          const key=JSON.stringify([intent.locationId,p.contactId,p.editionId??`generic:${p.eventSlug}`]);
          assert(!participationKeys.has(key),'contact/edition or pending generic must be unique');participationKeys.add(key);
        }
      }
      this.state=draft;return result;
    } finally{active=false;release();}
  }
}
const request=()=>({requestId:randomUUID(),receivedAt:clock,source:'website-pilot',sourcePath:'/percorso-architetto-patrimoniale',privacyVersion:'patrimonial-pilot-privacy-v1',marketingConsent:false,utm:{utm_source:'fixture'}});
const seed=(pipeline='ARCHITECT_PATH',overrides={})=>({pipeline,contact:{id:'fixture-contact',locationId:'fixture-location',identityResolved:true},scopeKey:pipeline==='ARCHITECT_PATH'?'fixture-program':pipeline==='PATRIMONIAL_CONSULTATION'?'patrimonial-consultation':'fixture-event',request:request(),actor:roles.SYSTEM,nextStepAt:later(),ownerId:'fixture-owner',...(pipeline==='PATRIMONIAL_EVENT'?{eventSlug:'fixture-event'}:{}),...(pipeline==='PATRIMONIAL_CONSULTATION'?{trigger:'EXPLICIT_REQUEST'}:{}),...overrides});
const command=(intent,type,extras={},terminal=false)=>({type,expectedRevision:intent.revision,actor:roles.OWNER,at:clock,...(!terminal?{nextStepAt:later()}:{}),evidenceId:'fixture-evidence',...extras});
const get=(store,id)=>store.transaction(tx=>tx.getOpportunityIntent(id));
const parts=(store,id)=>store.transaction(tx=>tx.listParticipations(id));
const apply=(store,intent,type,extra={},terminal=false)=>applyPatrimonialCommand(store,intent.id,command(intent,type,extra,terminal));
const passed=[];

// 1/2/3: same resolved business group, no stage reset; stale revision conflicts.
const store=new MemoryOpportunityStore();
let a=await receivePatrimonialOpportunity(store,seed());
assert.equal(a.stage,'A01');assert.equal(a.status,'OPEN');assert(a.revision>0);
a=await apply(store,a,'ARCHITECT_PRESENTATION_INVITED');
const oldRevision=a.revision;
const again=await receivePatrimonialOpportunity(store,seed());
assert.equal(again.id,a.id);assert.equal(again.stage,'A02');assert.equal(again.requestIds.length,2);assert.equal(again.firstRequest.requestId,a.firstRequest.requestId);
await assert.rejects(()=>applyPatrimonialCommand(store,a.id,command(a,'ARCHITECT_PRESENTATION_BOOKED',{expectedRevision:oldRevision,actor:roles.BOOKING,booking:{id:'presentation',startsAt:clock,confirmed:true}})),PatrimonialConflictError);
a=again;
passed.push('1 new A01','2 request reuses OPEN intent and preserves stage','3 stale expectedRevision conflicts');

// 4/5: attendance facts, never an automatic LOST decision.
const noShowStore=new MemoryOpportunityStore();
let noShow=await receivePatrimonialOpportunity(noShowStore,seed());
noShow=await apply(noShowStore,noShow,'ARCHITECT_PRESENTATION_INVITED');
noShow=await apply(noShowStore,noShow,'ARCHITECT_PRESENTATION_BOOKED',{actor:roles.BOOKING,booking:{id:'fixture-presentation',startsAt:clock,confirmed:true}});
noShow=await apply(noShowStore,noShow,'ARCHITECT_PRESENTATION_NO_SHOW',{actor:roles.HOST,rescheduleRequested:true});
assert.equal(noShow.stage,'A02');assert.equal(noShow.status,'OPEN');assert.equal(noShow.architect.presentationAttendance,'NO_SHOW');
a=await apply(store,a,'ARCHITECT_PRESENTATION_BOOKED',{actor:roles.BOOKING,booking:{id:'fixture-presentation',startsAt:clock,confirmed:true}});
a=await apply(store,a,'ARCHITECT_PRESENTATION_ATTENDED',{actor:roles.HOST});
assert.equal(a.stage,'A04');assert.equal(a.architect.presentationAttendance,'ATTENDED');
passed.push('4 A03 ATTENDED → A04','5 no-show → A02 OPEN, not LOST');

// 6/7/8: human qualification, eligibility, agreement and activation are separate.
a=await apply(store,a,'ARCHITECT_QUALIFIED');
a=await apply(store,a,'ARCHITECT_INTERVIEW_REQUESTED');
a=await apply(store,a,'ARCHITECT_INTERVIEW_BOOKED',{actor:roles.BOOKING,booking:{id:'fixture-interview',startsAt:clock,confirmed:true}});
a=await apply(store,a,'ARCHITECT_INTERVIEW_COMPLETED',{actor:roles.INTERVIEWER,interviewOutcome:'PROCEED'});
a=await apply(store,a,'ARCHITECT_ELIGIBILITY_SET',{actor:roles.APPROVER,eligibility:'ELIGIBLE'});
assert.equal(a.stage,'A07');assert.equal(a.status,'OPEN');
assert.throws(()=>transitionArchitect(a,command(a,'ARCHITECT_ACTIVATED',{actor:roles.APPROVER,criteriaVersion:'criteria-fixture'},true)),PatrimonialTransitionError);
a=await apply(store,a,'ARCHITECT_PATH_STARTED',{actor:roles.APPROVER,agreementEvidence:'fixture-agreement',startedAt:clock});assert.equal(a.stage,'A08');
assert.throws(()=>transitionArchitect(a,command(a,'ARCHITECT_ACTIVATED',{actor:roles.SYSTEM,criteriaVersion:'criteria-fixture'},true)),PatrimonialTransitionError);
a=await apply(store,a,'ARCHITECT_ACTIVATED',{actor:roles.APPROVER,criteriaVersion:'criteria-fixture'},true);
assert.equal(a.stage,'A09');assert.equal(a.status,'WON');assert.equal(a.nextStep,'NONE');assert.equal(a.nextStepAt,null);
assert.equal(a.events.at(-1).facts.criteriaVersion,'criteria-fixture');
const afterWon=await receivePatrimonialOpportunity(store,seed());assert.equal(afterWon.stage,'A09');assert(afterWon.ownerReviewRequired);
assert.throws(()=>transitionArchitect(afterWon,command(afterWon,'CYCLE_REOPEN_AUTHORIZED')),PatrimonialTransitionError);
passed.push('6 ELIGIBLE stays A07','7 explicit PATH_STARTED → A08','8 authorized activation → A09/WON; WON request only review');

// 9 and explicit cycle authorization: no automatic reopen from a generic form.
const negativeStore=new MemoryOpportunityStore();
let rejected=await receivePatrimonialOpportunity(negativeStore,seed());
rejected=await apply(negativeStore,rejected,'ARCHITECT_PRESENTATION_INVITED');
rejected=await apply(negativeStore,rejected,'ARCHITECT_PRESENTATION_BOOKED',{booking:{id:'presentation',startsAt:clock,confirmed:true}});
rejected=await apply(negativeStore,rejected,'ARCHITECT_PRESENTATION_ATTENDED',{actor:roles.HOST});
rejected=await apply(negativeStore,rejected,'ARCHITECT_ELIGIBILITY_SET',{eligibility:'NOT_ELIGIBLE'},true);
assert.equal(rejected.stage,'A10');assert.equal(rejected.status,'LOST');assert.equal(rejected.closeReason,'NOT_ELIGIBLE');
rejected=await receivePatrimonialOpportunity(negativeStore,seed());assert.equal(rejected.stage,'A10');
rejected=await apply(negativeStore,rejected,'CYCLE_REOPEN_AUTHORIZED');assert.equal(rejected.cycle,2);assert.equal(rejected.stage,'A01');assert.equal(rejected.closedCycles.length,1);
passed.push('9 NOT_ELIGIBLE → A10/LOST; new cycle requires explicit authorization');

// 10–14: one Event relation, separate per-edition participation records.
const eventStore=new MemoryOpportunityStore();
let e=await receivePatrimonialOpportunity(eventStore,seed('PATRIMONIAL_EVENT'));
let registrations=await parts(eventStore,e.id);
assert.equal(e.stage,'E01');assert.equal(registrations[0].status,'PENDING_EDITION');
const edition=id=>({id,eventSlug:'fixture-event',title:'Titolo fixture',revision:1,startsAt:later(3600000),endsAt:later(7200000),timeZone:'Europe/Rome',status:'ACTIVE'});
const selectedId=e.id;
e=await apply(eventStore,e,'EVENT_EDITION_SELECTED',{edition:edition('edition-one'),participationId:registrations[0].id,expectedParticipationRevision:registrations[0].revision});
assert.equal(e.id,selectedId);assert.equal(e.stage,'E01');
registrations=await parts(eventStore,e.id);const firstId=registrations[0].id;
assert.throws(()=>transitionEvent(e,registrations,command(e,'EVENT_REGISTRATION_CONFIRMED',{participationId:firstId,expectedParticipationRevision:registrations[0].revision,confirmation:{a:true,b:true,c:true,d:true}})),PatrimonialTransitionError);
e=await apply(eventStore,e,'EVENT_REGISTRATION_CONFIRMED',{participationId:firstId,expectedParticipationRevision:registrations[0].revision,confirmation:{accessConfirmed:true,capacityApproved:true,identityConfirmed:true,purposeConfirmed:true}});
assert.equal(e.stage,'E02');
e=await receivePatrimonialOpportunity(eventStore,seed('PATRIMONIAL_EVENT'));
registrations=await parts(eventStore,e.id);const generic=registrations.find(p=>p.editionId===null);
e=await apply(eventStore,e,'EVENT_EDITION_SELECTED',{edition:edition('edition-two'),participationId:generic.id,expectedParticipationRevision:generic.revision});
assert.equal(e.id,selectedId);registrations=await parts(eventStore,e.id);assert.equal(registrations.filter(p=>p.editionId!==null).length,2);
const secondId=registrations.find(p=>p.editionId==='edition-two').id;
e=await apply(eventStore,e,'EVENT_REGISTRATION_CONFIRMED',{participationId:secondId,expectedParticipationRevision:registrations.find(p=>p.id===secondId).revision,confirmation:{accessConfirmed:true,capacityApproved:true,identityConfirmed:true,purposeConfirmed:true}});
clock=later(10800000);
registrations=await parts(eventStore,e.id);
e=await apply(eventStore,e,'EVENT_COMPLETED',{actor:roles.HOST,participationId:firstId,expectedParticipationRevision:registrations.find(p=>p.id===firstId).revision});
e=await apply(eventStore,e,'EVENT_ATTENDANCE_RECORDED',{actor:roles.HOST,participationId:firstId,expectedParticipationRevision:registrations.find(p=>p.id===firstId).revision,attendance:'ATTENDED'});
assert.equal(e.stage,'E03');registrations=await parts(eventStore,e.id);assert.equal(registrations.find(p=>p.id===firstId).attendance,'ATTENDED');
e=await apply(eventStore,e,'EVENT_ATTENDANCE_RECORDED',{actor:roles.HOST,participationId:secondId,expectedParticipationRevision:registrations.find(p=>p.id===secondId).revision,attendance:'NO_SHOW'});
assert.equal(eventStore.inspect().intents.size,1);assert.equal(e.pipeline,'PATRIMONIAL_EVENT');
assert(!Object.keys(patrimonialOpportunityProjection(e)).some(key=>key.startsWith('hz_event_')));
passed.push('10 E01 + generic PENDING_EDITION','11 edition selects same E','12 second edition adds participation, same E','13 ATTENDED updates participation only','14 NO_SHOW never creates C');

// Close only after all outcomes are known; no commercial WON from a page view.
e=await apply(eventStore,e,'EVENT_FOLLOWUP_STARTED');
e=await apply(eventStore,e,'EVENT_CLOSED',{reason:'ATTENDED_COMPLETE'},true);assert.equal(e.status,'WON');
const eventAfterClose=await receivePatrimonialOpportunity(eventStore,seed('PATRIMONIAL_EVENT'));assert.equal(eventAfterClose.stage,'E05');assert(eventAfterClose.ownerReviewRequired);
assert.throws(()=>transitionEvent(eventAfterClose,[],command(eventAfterClose,'EVENT_FOLLOWUP_STARTED')),PatrimonialTransitionError);

// 15–20: explicit consultation; multiple event origins, one open C.
assert.throws(()=>transitionConsultation({...e,pipeline:'PATRIMONIAL_CONSULTATION'},command(e,'CONSULTATION_REQUESTED',{trigger:'ATTENDED'})),PatrimonialTransitionError);
let c=await receivePatrimonialOpportunity(eventStore,seed('PATRIMONIAL_CONSULTATION',{originEditionId:'edition-one'}));assert.equal(c.stage,'C01');
const sameC=await receivePatrimonialOpportunity(eventStore,seed('PATRIMONIAL_CONSULTATION',{originEditionId:'edition-two'}));assert.equal(sameC.id,c.id);assert.deepEqual(sameC.consultation.originEditionIds,['edition-one','edition-two']);c=sameC;
c=await apply(eventStore,c,'CONSULTATION_BOOKED',{actor:roles.BOOKING,booking:{id:'consultation-booking',startsAt:clock,confirmed:true}});assert.equal(c.stage,'C02');
c=await apply(eventStore,c,'CONSULTATION_COMPLETED');assert.equal(c.stage,'C03');
c=await apply(eventStore,c,'CONSULTATION_FOLLOWUP_AGREED');assert.equal(c.stage,'C04');
c=await apply(eventStore,c,'CONSULTATION_CLOSED',{reason:'QUALIFIED_FOLLOW_UP'},true);assert.equal(c.stage,'C05');assert.equal(c.status,'WON');
passed.push('15 explicit request → C01','16 other edition reuses OPEN C','17 booking C02','18 completion C03','19 follow-up C04','20 close C05');

// Domain atomicity, concurrent uniqueness, invalid actors/stages/deadlines.
const concurrentStore=new MemoryOpportunityStore();
const parallel=await Promise.all(Array.from({length:8},()=>receivePatrimonialOpportunity(concurrentStore,seed())));
assert.equal(new Set(parallel.map(i=>i.id)).size,1);assert.equal(concurrentStore.inspect().intents.size,1);
const open=await get(concurrentStore,parallel[0].id);
for(const invalid of [
  command(open,'ARCHITECT_ACTIVATED',{actor:roles.APPROVER,criteriaVersion:'criteria-fixture'},true),
  command(open,'ARCHITECT_PRESENTATION_INVITED',{actor:roles.SYSTEM}),
  command(open,'ARCHITECT_PRESENTATION_INVITED',{nextStepAt:undefined}),
  command(open,'ARCHITECT_PRESENTATION_INVITED',{nextStep:'NONE'}),
  command(open,'ARCHITECT_CLOSED',{actor:roles.SYSTEM,reason:'NOT_INTERESTED'},true),
])assert.throws(()=>transitionArchitect(open,invalid),PatrimonialTransitionError);
const originalState=concurrentStore.inspect();
await assert.rejects(()=>apply(concurrentStore,open,'ARCHITECT_ACTIVATED',{actor:roles.APPROVER},true),PatrimonialTransitionError);
assert.deepEqual(concurrentStore.inspect(),originalState);
passed.push('atomic CAS/uniqueness, actor/prerequisite/next-step guards and terminal rules');

// Full fake provider: duplicate key is location+contact+pipeline, across all statuses.
function provider(){
  const rows=new Map(),calls=[];
  const key=q=>JSON.stringify([q.locationId,q.contactId,q.pipelineId]);
  const api={locationId:'fixture-location',capabilities:{opportunitiesRead:true,opportunitiesWrite:true},rows,calls,
    async searchOpportunities(q){calls.push(['search',clone(q)]);const row=rows.get(key(q));return row?[clone(row)]:[];},
    async createOpportunity(data){calls.push(['create',clone(data)]);if(rows.has(key(data)))throw new PatrimonialCrmError('IDENTITY',{status:409});const row={...clone(data),id:`fixture-op-${rows.size+1}`,version:'1'};rows.set(key(data),row);return clone(row);},
    async updateOpportunity(id,data){calls.push(['update',clone(data)]);const old=rows.get(key(data));if(!old||old.id!==id||old.version!==data.expectedProviderVersion)throw new PatrimonialCrmError('IDENTITY',{status:409});const patch=clone(data);delete patch.expectedProviderVersion;const row={...old,...patch,customFields:{...old.customFields,...patch.customFields},id,version:String(Number(old.version)+1)};rows.set(key(data),row);return clone(row);},
  };return api;
}
const mapping=unresolvedPatrimonialPipelineMapping();assert.equal(mapping.locationId,null);
for(const entry of Object.values(mapping.pipelines)){assert.equal(entry.pipelineId,null);assert(Object.values(entry.stages).every(id=>id===null));}
const mapped=()=>{const m=unresolvedPatrimonialPipelineMapping();m.locationId='fixture-location';m.closeReason={mode:'CUSTOM',key:'fixture-close-field'};for(const [key,entry]of Object.entries(m.pipelines)){entry.pipelineId=`fixture-pipeline-${key}`;for(const stage of Object.keys(entry.stages))entry.stages[stage]=`fixture-${stage}`;for(const field of logicalOpportunityFields(key))entry.fields[field]=`fixture-${field}`;}return m;};
const flags={PATRIMONIAL_V2_ENABLED:'true',PATRIMONIAL_CRM_WRITE_ENABLED:'true',PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED:'true'};
const sync=(s,p,i,m=mapped(),f=flags)=>syncPatrimonialOpportunity({store:s,provider:p,mapping:m,intentId:i.id,expectedRevision:i.revision,env:()=>f,now:()=>new Date(clock)});
const remote=provider();
assert.equal(await sync(concurrentStore,remote,open,mapping),'HOLD');assert.equal(remote.calls.length,0);
const missingStage=mapped();missingStage.pipelines.ARCHITECT_PATH.stages.A10=null;assert.equal(await sync(concurrentStore,remote,open,missingStage),'HOLD');assert.equal(remote.calls.length,0);
const missingField=mapped();missingField.pipelines.ARCHITECT_PATH.fields.hz_intent_key=null;assert.equal(await sync(concurrentStore,remote,open,missingField),'HOLD');assert.equal(remote.calls.length,0);
const aliasedPipeline=mapped();aliasedPipeline.pipelines.PATRIMONIAL_EVENT.pipelineId=aliasedPipeline.pipelines.ARCHITECT_PATH.pipelineId;assert.equal(await sync(concurrentStore,remote,open,aliasedPipeline),'HOLD');assert.equal(remote.calls.length,0);
assert.equal(await sync(concurrentStore,remote,open,mapped(),{...flags,PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED:'false'}),'HOLD');assert.equal(remote.calls.length,0);
passed.push('21 null pipeline → zero write','22 any missing stage → zero write','23 opportunity flag false → zero write');

// 24: provider commits a matching row then reports duplicate, recover exact key.
const create=remote.createOpportunity;
let duplicateOnce=true;
remote.createOpportunity=async data=>{const row=await create(data);if(duplicateOnce){duplicateOnce=false;throw new PatrimonialCrmError('IDENTITY',{status:409});}return row;};
assert.equal(await sync(concurrentStore,remote,open),'SYNCED');
assert.equal(remote.rows.size,1);assert.equal(remote.calls.filter(([name])=>name==='create').length,1);
assert.equal(await sync(concurrentStore,remote,await get(concurrentStore,open.id)),'SYNCED');assert.equal(remote.rows.size,1);
passed.push('24 same-contact/same-pipeline duplicate reconciles without second create');

// Update from current revision, but never from an old job or over a remote human edit.
let updated=await apply(concurrentStore,await get(concurrentStore,open.id),'ARCHITECT_PRESENTATION_INVITED');
const beforeStale=remote.calls.length;
assert.equal(await sync(concurrentStore,remote,open),'CONFLICT');assert.equal(remote.calls.length,beforeStale);
assert.equal(await sync(concurrentStore,remote,updated),'SYNCED');assert.equal(remote.calls.filter(([name])=>name==='update').length,1);
updated=await apply(concurrentStore,await get(concurrentStore,open.id),'ARCHITECT_PRESENTATION_BOOKED',{booking:{id:'booking',startsAt:clock,confirmed:true}});
const row=[...remote.rows.values()][0];row.version='remote-human-revision';row.pipelineStageId='fixture-A04';
assert.equal(await sync(concurrentStore,remote,updated),'MANUAL_REVIEW');assert.equal(remote.calls.filter(([name])=>name==='update').length,1);
passed.push('current-revision update; local stale and remote human edits are not overwritten');

// 25: different pipelines for one contact are valid; Event has one CRM row for two editions.
const crossStore=new MemoryOpportunityStore(),crossProvider=provider();
const crossA=await receivePatrimonialOpportunity(crossStore,seed());
const crossE=await receivePatrimonialOpportunity(crossStore,seed('PATRIMONIAL_EVENT'));
const crossC=await receivePatrimonialOpportunity(crossStore,seed('PATRIMONIAL_CONSULTATION'));
for(const i of [crossA,crossE,crossC])assert.equal(await sync(crossStore,crossProvider,i),'SYNCED');
assert.equal(crossProvider.rows.size,3);
const eventProvider=provider();assert.equal(await sync(eventStore,eventProvider,await get(eventStore,e.id)),'SYNCED');
assert.equal(eventProvider.rows.size,1);assert.equal((await parts(eventStore,e.id)).filter(p=>p.editionId!==null).length,2);
passed.push('25 same contact across A/E/C allowed; two Event editions, one remote E row');

// An explicitly reopened Event cycle updates the same native opportunity.
let reopenedEvent=await get(eventStore,e.id);
const previousEventRemoteId=reopenedEvent.remote.id;
reopenedEvent=await apply(eventStore,reopenedEvent,'CYCLE_REOPEN_AUTHORIZED');
assert.equal(reopenedEvent.cycle,2);assert.equal(reopenedEvent.remote.id,previousEventRemoteId);
assert.equal(await sync(eventStore,eventProvider,reopenedEvent),'SYNCED');
assert.equal(eventProvider.rows.size,1);assert.equal(eventProvider.calls.filter(([name])=>name==='create').length,1);
assert.equal((await get(eventStore,e.id)).remote.id,previousEventRemoteId);
passed.push('explicit Event reopen keeps native opportunity ID and per-edition history');

// A new generic request selecting an already planned edition merges request IDs.
const mergeStore=new MemoryOpportunityStore();
let merge=await receivePatrimonialOpportunity(mergeStore,seed('PATRIMONIAL_EVENT'));
let mergeParts=await parts(mergeStore,merge.id);
merge=await apply(mergeStore,merge,'EVENT_EDITION_SELECTED',{edition:edition('merge-edition'),participationId:mergeParts[0].id,expectedParticipationRevision:mergeParts[0].revision});
merge=await receivePatrimonialOpportunity(mergeStore,seed('PATRIMONIAL_EVENT'));
mergeParts=await parts(mergeStore,merge.id);const mergeGeneric=mergeParts.find(p=>p.editionId===null);
merge=await apply(mergeStore,merge,'EVENT_EDITION_SELECTED',{edition:edition('merge-edition'),participationId:mergeGeneric.id,expectedParticipationRevision:mergeGeneric.revision});
mergeParts=await parts(mergeStore,merge.id);
assert.equal(mergeParts.filter(p=>p.editionId==='merge-edition').length,1);
assert.equal(mergeParts.find(p=>p.editionId==='merge-edition').requestIds.length,2);
assert.equal(mergeParts.find(p=>p.id===mergeGeneric.id).supersededBy,mergeParts.find(p=>p.editionId==='merge-edition').id);
const qualifiedStore=new MemoryOpportunityStore();
const qualified=await receivePatrimonialOpportunity(qualifiedStore,seed('ARCHITECT_PATH',{qualification:{profile:'Professionista',goal:'Sto esplorando'}}));
const qualifiedAgain=await receivePatrimonialOpportunity(qualifiedStore,seed('ARCHITECT_PATH',{qualification:{profile:'',goal:'Nuovo progetto imprenditoriale'}}));
assert.equal(qualifiedAgain.architect.profile,qualified.architect.profile);assert.equal(qualifiedAgain.architect.goal,'Nuovo progetto imprenditoriale');
assert.equal(qualifiedAgain.firstRequest.requestId,qualified.firstRequest.requestId);
passed.push('generic edition merge preserves IDs; pertinent A updates preserve nonempty data and first touch');

// Expired dispatch marker never authorizes another blind create.
const uncertainStore=new MemoryOpportunityStore(),uncertainProvider=provider();
const u=await receivePatrimonialOpportunity(uncertainStore,seed());
uncertainProvider.createOpportunity=async()=>{throw new PatrimonialCrmError('NETWORK',{outcomeUncertain:true});};
assert.equal(await sync(uncertainStore,uncertainProvider,u),'RECONCILE_REQUIRED');
assert.equal(await sync(uncertainStore,uncertainProvider,u),'MANUAL_REVIEW');
passed.push('uncertain create stays reconciled/manual, never blind retry');

// Production methods are non-networking stubs, even with flags true.
const realStub=new PatrimonialHighLevelProvider({verifiedLocationId:'fixture-location',env:()=>({...flags,HIGHLEVEL_PRIVATE_TOKEN:'fixture-token',HIGHLEVEL_LOCATION_ID:'fixture-location'})});
await assert.rejects(()=>realStub.searchOpportunities({locationId:'fixture-location',contactId:'fixture-contact',pipelineId:'fixture-pipeline'}),PatrimonialCrmError);
await assert.rejects(()=>realStub.createOpportunity({}),PatrimonialCrmError);await assert.rejects(()=>realStub.updateOpportunity('fixture-id',{}),PatrimonialCrmError);

// 26: every preexisting contact-provider method remains source-identical.
const file='src/lib/public-leads/patrimonial-highlevel.ts';
const baseline=execFileSync('git',['show',`fe38dfb9:${file}`],{encoding:'utf8'});
const source=await readFile(file,'utf8');
const methods=text=>{const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),map=new Map();for(const statement of ast.statements)if(ts.isClassDeclaration(statement)&&statement.name?.text==='PatrimonialHighLevelProvider')for(const member of statement.members)if(ts.isMethodDeclaration(member)||ts.isGetAccessorDeclaration(member)||ts.isConstructorDeclaration(member))map.set(member.name?.getText(ast)??'constructor',member.getText(ast).replaceAll('\r\n','\n'));return map;};
const oldMethods=methods(baseline),newMethods=methods(source);for(const [name,text]of oldMethods)assert.equal(newMethods.get(name),text,`contact transport changed: ${name}`);
passed.push('26 existing CRM contact methods unchanged');
await import('./verify-patrimonial-ledger.mjs');
await import('./verify-patrimonial-crm.mjs');
passed.push('27 ledger regressions','28 legacy regressions','29 2A regressions','30 Radar regressions');
assert.equal(externalCalls,0);
console.log(passed.map(message=>`PASS ${message}`).join('\n'));
console.log('Patrimonial opportunity routing: mandatory 1–30 cases passed with local-only stores/providers. Real opportunity methods are stubs. No remote calls, resources, messages or migrations.');
