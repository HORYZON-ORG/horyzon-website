// Local contract simulator, NOT PostgreSQL and never imported by application code.
// It models RPC atomicity/rollback and constraints; SQL is checked separately.
import assert from 'node:assert/strict';
const copy=structuredClone;
const error=(message,code='PT409')=>Object.assign(new Error(message),{code});
const snapshotChanged=()=>error('PATRIMONIAL_SNAPSHOT_CHANGED');
const conflict=()=>error('PATRIMONIAL_CONFLICT');
const invalid=()=>error('PATRIMONIAL_INVALID_INPUT','22023');
const stale=()=>error('PATRIMONIAL_STALE_LEASE');

export class FakePatrimonialSupabase {
  state={requests:new Map(),provisional:new Map(),consents:new Map(),operations:new Map(),events:new Map(),opportunities:new Map(),participations:new Map(),editions:new Map(),sync:new Map()};
  calls=[]; now='2026-10-14T21:00:00.000Z'; failMethod=null; loseCommitResponse=false; failHealth=false; queue=Promise.resolve();
  inspect(){return copy(this.state);}
  async fetch(url,init){
    assert.match(String(url),/^https:\/\/patrimonial\.invalid\/rest\/v1\/rpc\/(patrimonial_store_health|patrimonial_store_transaction|acquire_patrimonial_request_v2)$/);
    assert.equal(init.method,'POST');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert(init.signal);
    const name=String(url).split('/').at(-1);const body=JSON.parse(init.body);this.calls.push({name,body});
    const previous=this.queue;let release;this.queue=new Promise(resolve=>{release=resolve;});await previous;
    try{
      if(name==='patrimonial_store_health')return this.failHealth?Response.json({code:'42P01',message:'sensitive provider body'},{status:503}):Response.json({version:'patrimonial-v2-store-1'});
      const draft=copy(this.state),results=[];
      for(const [index,command]of body.p_commands.entries()){
        if(command.method===this.failMethod)throw invalid();
        const result=this.execute(draft,command);
        if(Object.hasOwn(body.p_expected,String(index))){try{assert.deepEqual(result,body.p_expected[index]);}catch{throw snapshotChanged();}}
        results.push(copy(result));
      }
      const preview=body.p_preview===true;
      if(!preview){
        for(const command of body.p_commands.filter(c=>c.method==='createOrReplayRequest')){
          const r=draft.requests.get(command.args[0].id),cs=[...draft.consents.values()].filter(c=>c.requestId===r.id);
          if(!r.intentId||cs.length!==2||!cs.some(c=>c.purpose==='requested-contact'&&c.choice)||![...draft.operations.values()].some(o=>o.requestId===r.id&&o.kind==='SYNC_REQUEST')||![...draft.events.values()].some(e=>e.requestId===r.id&&e.name==='request_received'))throw invalid();
        }
        this.state=draft;
        if(this.loseCommitResponse){this.loseCommitResponse=false;throw new TypeError('lost local response');}
      }
      return Response.json(results);
    }catch(e){
      if(!e.code)throw e;
      return Response.json({code:e.code,message:e.message},{status:e.code==='PT409'?409:e.code==='PT410'?410:400});
    }finally{release();}
  }
  execute(s,c){
    const [a,b,d,f,g,h]=c.args,now=Date.parse(this.now);
    const owned=()=>{const op=s.operations.get(a.operationId);if(!op||op.technicalState!=='SYNCING'||op.leaseToken!==a.leaseToken||op.leaseVersion!==a.leaseVersion||Date.parse(op.leaseExpiresAt)<=now)throw stale();return op;};
    const opportunity=()=>{const i=s.opportunities.get(a);if(!i||i.revision!==b)throw conflict();return i;};
    switch(c.method){
    case 'getRequest':return copy(s.requests.get(a)??null);
    case 'getOperation':return copy(s.operations.get(a)??null);
    case 'getConsentEvidence':return copy([...s.consents.values()].filter(x=>x.requestId===a).sort((x,y)=>x.purpose.localeCompare(y.purpose)));
    case 'createOrReplayRequest':{
      const old=s.requests.get(a.id);if(old){if(old.payloadHash!==a.payloadHash)throw conflict();if(Date.parse(old.replayExpiresAt)<=now)throw error('PATRIMONIAL_REPLAY_EXPIRED','PT410');return {request:copy(old),replay:true};}
      s.requests.set(a.id,copy(a));return {request:copy(a),replay:false};
    }
    case 'createOrReuseIntent':{const old=[...s.provisional.values()].find(i=>i.provisionalKey===a.provisionalKey);if(old)return copy(old);s.provisional.set(a.id,copy(a));return copy(a);}
    case 'attachIntent':{const r=s.requests.get(a),i=s.provisional.get(b);if(!r||!i||(r.intentId&&r.intentId!==b))throw conflict();r.intentId=b;r.technicalState='SYNC_PENDING';i.technicalState='SYNC_PENDING';break;}
    case 'appendConsentEvidence':{if(!s.requests.has(a.requestId))throw invalid();const old=s.consents.get(a.id);if(old){assert.deepEqual(old,a);break;}s.consents.set(a.id,copy(a));break;}
    case 'appendEvent':{if(!s.requests.has(a.requestId)||!s.provisional.has(a.intentId))throw invalid();if(!s.events.has(a.id))s.events.set(a.id,copy(a));break;}
    case 'enqueueOperation':{if(!s.requests.has(a.requestId)||!s.provisional.has(a.intentId))throw invalid();if(![...s.operations.values()].some(o=>o.operationKey===a.operationKey))s.operations.set(a.id,copy(a));break;}
    case 'claimOperations':{
      const result=[],lock=o=>o.identityLockKey??o.intentId;
      const rows=[...s.operations.values()].sort((x,y)=>Number(y.technicalState==='SYNCING')-Number(x.technicalState==='SYNCING')||x.nextAttemptAt.localeCompare(y.nextAttemptAt)||x.id.localeCompare(y.id));
      for(const op of rows){
        const expired=op.technicalState==='SYNCING'&&Date.parse(op.leaseExpiresAt)<=now;
        if(a.reconciliationOnly?op.technicalState!=='RECONCILE_REQUIRED':(!expired&&!['SYNC_PENDING','RETRY_SCHEDULED'].includes(op.technicalState)))continue;
        if(Date.parse(op.nextAttemptAt)>now||(op.dependsOn&&s.operations.get(op.dependsOn)?.technicalState!=='SYNCED'))continue;
        if(rows.some(x=>x.id!==op.id&&lock(x)===lock(op)&&((x.technicalState==='SYNCING'&&(Date.parse(x.leaseExpiresAt)>now||!expired))||['IDENTITY_REVIEW','MANUAL_REVIEW'].includes(x.technicalState)||(x.technicalState==='RECONCILE_REQUIRED'&&!a.reconciliationOnly))))continue;
        if(op.attemptCount>=5){op.technicalState='MANUAL_REVIEW';op.reconcileRequired ||=expired;op.leaseToken=null;op.leaseExpiresAt=null;continue;}
        op.reconcileRequired ||=expired;op.technicalState='SYNCING';op.attemptCount++;op.leaseVersion++;op.leaseToken=c.tokens[result.length];op.leaseExpiresAt=new Date(Date.parse(a.now)+(a.leaseSeconds??60)*1000).toISOString();
        result.push(copy(op));if(result.length>=a.limit)break;
      }return result;
    }
    case 'renewLease':{const op=owned();const end=Date.parse(a.now)+(a.leaseSeconds??60)*1000;if(end< Date.parse(op.leaseExpiresAt)||end<=now)throw stale();op.leaseExpiresAt=new Date(end).toISOString();break;}
    case 'completeOperation':case 'completeCrmOperation':{
      const op=owned();if(op.reconcileRequired&&!a.reconciliationConfirmed)throw conflict();
      if(a.checkpoint){const r=s.requests.get(op.requestId),i=s.provisional.get(op.intentId);if((r.crm?.locationId&&r.crm.locationId!==a.checkpoint.locationId)||(r.crm?.contactId&&r.crm.contactId!==a.checkpoint.contactId))throw conflict();r.crm=copy(a.checkpoint);if(a.checkpoint.contactId){i.contactId=a.checkpoint.contactId;i.identityResolved=true;}}
      for(const follow of a.followUps??[])this.execute(s,{method:'enqueueOperation',args:[follow]});
      if(a.remoteId)op.remoteId=a.remoteId;op.technicalState='SYNCED';op.reconcileRequired=false;op.leaseToken=null;op.leaseExpiresAt=null;break;
    }
    case 'holdOperation':case 'scheduleRetry':case 'failOperation':case 'markManualReview':{
      const op=owned();
      if(c.method==='scheduleRetry'){if(op.reconcileRequired||Date.parse(a.nextAttemptAt)<=now)throw conflict();op.technicalState=op.attemptCount>=5?'MANUAL_REVIEW':'RETRY_SCHEDULED';op.nextAttemptAt=a.nextAttemptAt;}
      else if(c.method==='holdOperation')op.technicalState=op.reconcileRequired?'RECONCILE_REQUIRED':'SYNC_PENDING';
      else{op.technicalState=c.method==='markManualReview'?'MANUAL_REVIEW':a.state;op.reconcileRequired ||=a.state==='RECONCILE_REQUIRED'||a.reconcileRequired===true;}
      if(a.errorCode)op.lastErrorCode=a.errorCode;op.leaseToken=null;op.leaseExpiresAt=null;break;
    }
    case 'findOpportunityIntent':return copy([...s.opportunities.values()].find(i=>i.groupKey===a)??null);
    case 'getOpportunityIntent':return copy(s.opportunities.get(a)??null);
    case 'saveOpportunityIntent':{
      const old=s.opportunities.get(a.id);
      if(b===null?!!old:!old||old.revision!==b||a.revision!==b+1)throw conflict();
      if(a.requestIds.some(id=>!s.requests.has(id)))throw invalid();
      for(const i of s.opportunities.values())if(i.id!==a.id&&((i.groupKey===a.groupKey)||(i.locationId===a.locationId&&i.contactId===a.contactId&&i.pipeline===a.pipeline&&(a.pipeline==='PATRIMONIAL_EVENT'||(i.scopeKey===a.scopeKey&&i.status==='OPEN'&&a.status==='OPEN')))))throw conflict();
      s.opportunities.set(a.id,copy(a));const claim=s.sync.get(a.id);if(claim){claim.reconcileRequired ||=claim.writeStarted;claim.token=null;}break;
    }
    case 'listParticipations':return copy([...s.participations.values()].filter(p=>p.relationId===a).sort((x,y)=>x.id.localeCompare(y.id)));
    case 'saveParticipations':{
      const i=s.opportunities.get(a);if(!i||i.pipeline!=='PATRIMONIAL_EVENT')throw invalid();
      const actual=[...s.participations.values()].filter(p=>p.relationId===a);assert.deepEqual(actual.sort((x,y)=>x.id.localeCompare(y.id)),copy(d).sort((x,y)=>x.id.localeCompare(y.id)));
      for(const p of b){
        if(p.relationId!==a||p.contactId!==i.contactId||!s.requests.has(p.requestIds[0]))throw invalid();
        const old=s.participations.get(p.id);if(old&&JSON.stringify(old)!==JSON.stringify(p)&&p.revision!==old.revision+1)throw conflict();
        for(const q of s.participations.values())if(q.id!==p.id&&q.contactId===p.contactId&&((p.editionId!==null&&q.editionId===p.editionId)||(p.editionId===null&&q.editionId===null&&p.status==='PENDING_EDITION'&&q.status==='PENDING_EDITION'&&p.eventSlug===q.eventSlug)))throw conflict();
        if(p.editionId){const edition=s.editions.get(p.editionId);if(edition)assert.deepEqual(edition,p.edition);else s.editions.set(p.editionId,copy(p.edition));}s.participations.set(p.id,copy(p));
      }break;
    }
    case 'claimOpportunitySync':{
      const intent=opportunity(),old=s.sync.get(a);if(old?.token&&Date.parse(old.expiresAt)>now)return null;
      const row={token:c.tokens[0],expiresAt:new Date(Date.parse(d)+60000).toISOString(),writeStarted:false,reconcileRequired:!!(old?.reconcileRequired||old?.writeStarted)};s.sync.set(a,row);return {intent:copy(intent),token:row.token,reconcileRequired:row.reconcileRequired};
    }
    case 'authorizeOpportunityWrite':case 'finishOpportunitySync':{
      const intent=opportunity(),claim=s.sync.get(a);if(!claim||claim.token!==d||Date.parse(claim.expiresAt)<=now)throw stale();
      if(c.method==='authorizeOpportunityWrite')claim.writeStarted=true;
      else{claim.token=null;claim.reconcileRequired=g==='RECONCILE_REQUIRED'||(g==='MANUAL_REVIEW'&&claim.reconcileRequired);claim.writeStarted=false;if(h)intent.remote=copy(h);}void f;break;
    }
    default:throw invalid();
    }
    return null;
  }
}
