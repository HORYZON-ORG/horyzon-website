import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolvePatrimonialOwnerTarget, checkedPatrimonialOwnerRead, planPatrimonialOwnerSync } from '../src/lib/public-leads/patrimonial-owner-readiness.ts';
import { resolveRemoteOwner } from '../src/lib/public-leads/patrimonial-assignments.ts';
import { patrimonialFlags } from '../src/lib/public-leads/patrimonial-store.ts';
import { createConfiguredPatrimonialHighLevelProvider } from '../src/lib/public-leads/patrimonial-highlevel.ts';

// P2A uses only normalized synthetic read fixtures, never an account, credential,
// wire response, HTTP binding or provider executor. No real environment is read.
let networkAttempts=0,writeCalls=0;
globalThis.fetch=async()=>{networkAttempts++;throw new Error('Network forbidden in owner readiness verifier');};
const forbiddenWrites={
  createOpportunity(){writeCalls++;throw new Error('Owner create forbidden');},
  updateOpportunity(){writeCalls++;throw new Error('Owner update forbidden');},
};
const operatorId='10000000-0000-4000-8000-000000000001';
const intentId='20000000-0000-4000-8000-000000000001';
const scope={locationId:'fixture-location',contactId:'fixture-contact',pipelineId:'fixture-pipeline',opportunityId:'fixture-opportunity'};
const operator={id:operatorId,active:true,remoteUserRef:'fixture-remote-user'};
const evidence={remoteUserId:operator.remoteUserRef,locationId:scope.locationId,locationMembershipVerified:true,active:true,role:null,readAt:'2026-10-18T10:00:00.000Z',evidenceRef:'fixture-user-read',source:'LOCATION_USERS_READ'};
const observation={...scope,assignedTo:'fixture-previous-owner',version:'fixture-v1'};
const page=row=>({complete:true,opportunities:[row]});
const input={intentId,currentOperatorId:operatorId,operatorRevision:2,operator,remoteUserEvidence:evidence,scope,expectedOwnerRef:'fixture-previous-owner',expectedOpportunityVersion:'fixture-v1',ownerSyncEnabled:true,read:{kind:'COMPLETE',page:page(observation)}};
const clone=structuredClone,passed=[];
function plan(change={}) {
  // Extra spy object must remain unused; the planner API has no provider parameter.
  const request={...clone(input),...change,provider:forbiddenWrites};
  return planPatrimonialOwnerSync(request);
}
function hold(result,reason){assert.equal(result.action,'HOLD');assert.equal(result.reason,reason);assert.equal(result.executionAllowed,false);}

// 1: target comes exclusively from a separately verified native mapping.
const target=plan();assert.equal(target.action,'WRITE_REQUIRED');assert.equal(target.plan.targetOwnerRef,operator.remoteUserRef);
assert.notEqual(target.plan.targetOwnerRef,operatorId);assert.notEqual(target.plan.targetOwnerRef,intentId);
hold(plan({currentOperatorId:'30000000-0000-4000-8000-000000000001'}),'IDENTITY');
const copiedUuid={...operator,remoteUserRef:operatorId};
assert.equal(resolvePatrimonialOwnerTarget(copiedUuid,scope.locationId,{...evidence,remoteUserId:operatorId}).remoteOwnerTarget,null);
passed.push('1 internal UUID never becomes remote assignedTo target');

const unmapped={...operator,remoteUserRef:null};
assert.equal(resolveRemoteOwner(unmapped),null);
assert.deepEqual(resolvePatrimonialOwnerTarget(unmapped,scope.locationId,null),{state:'UNMAPPED',remoteOwnerTarget:null,reason:'UNMAPPED'});
hold(plan({operator:unmapped,remoteUserEvidence:null}),'UNMAPPED');passed.push('2 unmapped -> no remote owner target');
const unverified=resolvePatrimonialOwnerTarget(operator,scope.locationId,null);
assert.equal(unverified.state,'MAPPED_UNVERIFIED');assert.equal(unverified.remoteOwnerTarget,null);
hold(plan({remoteUserEvidence:null}),'USER_EVIDENCE_UNVERIFIED');
for(const partial of [{...evidence,locationMembershipVerified:false},{...evidence,locationId:'wrong-location'},{...evidence,remoteUserId:'different-user'},{...evidence,readAt:'not-a-date'}]) hold(plan({remoteUserEvidence:partial}),'USER_EVIDENCE_UNVERIFIED');
passed.push('3 syntactic mapping alone and mismatched/invalid evidence never authorize a target');
assert.deepEqual(resolvePatrimonialOwnerTarget(operator,scope.locationId,evidence),{state:'MAPPED_VERIFIED',remoteOwnerTarget:operator.remoteUserRef,reason:null});
passed.push('4 verified synthetic user/location evidence resolves pure target only');

const same=plan({read:{kind:'COMPLETE',page:page({...observation,assignedTo:operator.remoteUserRef})}});
assert.equal(same.action,'IDEMPOTENT_SUCCESS');assert.equal(same.executionAllowed,false);passed.push('5 same owner -> idempotent plan, no checkpoint write');
assert.equal(target.action,'WRITE_REQUIRED');assert.equal(target.executionAllowed,false);passed.push('6 different checkpoint-matching owner -> write-required plan, no executor');

const nullable=page({...observation,assignedTo:null});
assert.equal(checkedPatrimonialOwnerRead(nullable,scope,{nullableAssignedTo:true}).assignedTo,null);
const fromNull=plan({expectedOwnerRef:null,read:{kind:'COMPLETE',page:nullable,contract:{nullableAssignedTo:true}}});assert.equal(fromNull.action,'WRITE_REQUIRED');
assert.throws(()=>checkedPatrimonialOwnerRead(nullable,scope),e=>e.code==='SCHEMA');
passed.push('7 NULL accepted only by explicit nullable fixture contract, not claimed live-verified');
for(const value of [42,true,{},[],undefined,'','contains whitespace']) assert.throws(()=>checkedPatrimonialOwnerRead(page({...observation,assignedTo:value}),scope),e=>e.code==='SCHEMA');
const missingOwner={...observation};delete missingOwner.assignedTo;assert.throws(()=>checkedPatrimonialOwnerRead(page(missingOwner),scope),e=>e.code==='SCHEMA');
passed.push('8 malformed/missing/empty assignedTo rejected; never coalesced to NULL');
for(const [key,value] of [['locationId','wrong-location'],['contactId','wrong-contact'],['pipelineId','wrong-pipeline'],['opportunityId','wrong-opportunity']]) {
  assert.throws(()=>checkedPatrimonialOwnerRead(page({...observation,[key]:value}),scope),e=>e.code==='IDENTITY');
  hold(plan({read:{kind:'COMPLETE',page:page({...observation,[key]:value})}}),'IDENTITY');
}
passed.push('9 wrong location/contact/pipeline/native opportunity identity rejected');
const multiple={complete:true,opportunities:[observation,{...observation,opportunityId:'second-opportunity'}]};
assert.throws(()=>checkedPatrimonialOwnerRead(multiple,scope),e=>e.code==='IDENTITY');hold(plan({read:{kind:'COMPLETE',page:multiple}}),'IDENTITY');
for(const incomplete of [{complete:false,opportunities:[]},{opportunities:[]},{complete:true,nextCursor:'more-pages',opportunities:[]}]) assert.throws(()=>checkedPatrimonialOwnerRead(incomplete,scope),e=>e.code==='INCOMPLETE');
hold(plan({read:{kind:'COMPLETE',page:{complete:true,opportunities:[]}}}),'OPPORTUNITY_NOT_FOUND');
passed.push('10 multiple identities/incomplete pages rejected; zero results -> hold');

for(const kind of ['UNCERTAIN_TIMEOUT','NOT_READ']) {
  const uncertain=plan({read:{kind}});assert.equal(uncertain.action,'RECONCILE_REQUIRED');assert.equal(uncertain.requiresReadBeforeRetry,true);assert.equal(uncertain.executionAllowed,false);assert(!Object.hasOwn(uncertain,'plan'));
}
hold(plan({read:{kind:'COMPLETE',page:page({...observation,assignedTo:'human-owner'})}}),'REMOTE_CHANGED');
hold(plan({read:{kind:'COMPLETE',page:page({...observation,version:'fixture-v2'})}}),'REMOTE_CHANGED');
hold(plan({read:{kind:'COMPLETE',page:page({...observation,version:null})}}),'VERSION_UNVERIFIED');
passed.push('11 uncertain dispatch requires fresh complete read; changed owner/version held');
hold(plan({operation:'CLEAR'}),'OWNER_CLEAR_UNVERIFIED');
passed.push('12 owner clear unsupported; NULL read is not NULL/empty/omitted write semantics');
assert.equal(patrimonialFlags({}).ownerSync,false);
hold(plan({ownerSyncEnabled:false}),'OWNER_SYNC_DISABLED');
hold(plan({ownerSyncEnabled:undefined}),'OWNER_SYNC_DISABLED');
passed.push('13 missing/false ownerSync flag blocks even a verified fixture; true still plan-only');

hold(plan({operator:{...operator,active:false}}),'LOCAL_OPERATOR_INACTIVE');
hold(plan({remoteUserEvidence:{...evidence,active:false}}),'USER_UNAVAILABLE');
hold(plan({remoteUserEvidence:{...evidence,active:null}}),'USER_AVAILABILITY_UNVERIFIED');
const before=clone(input);planPatrimonialOwnerSync(input);assert.deepEqual(input,before,'pure planner must not mutate evidence or input');
const projected=checkedPatrimonialOwnerRead(page({...observation,email:'synthetic@example.invalid',phone:'synthetic',name:'synthetic'}),scope);
assert.deepEqual(Object.keys(projected).sort(),['assignedTo','contactId','locationId','opportunityId','pipelineId','version'].sort());

// The live opportunity provider and all P1 code remain byte-identical. Even a
// caller's capability fixture cannot install a missing HTTP binding implicitly.
const configured=createConfiguredPatrimonialHighLevelProvider({verifiedLocationId:scope.locationId,env:()=>({}),capabilities:{usersRead:true}});
assert.equal(configured.capabilities.usersRead,'UNKNOWN');
const providerSource=await readFile('src/lib/public-leads/patrimonial-highlevel.ts','utf8');
for(const method of ['searchOpportunities','createOpportunity','updateOpportunity']) assert.match(providerSource,new RegExp(`async ${method}[^\\n]+throw new PatrimonialCrmError\\('CONFIG'\\)`));
const syncSource=await readFile('src/lib/public-leads/patrimonial-sync.ts','utf8');assert(syncSource.includes('assignedTo: intent.ownerId'));assert(!syncSource.includes('currentOperatorId'));
const protectedPaths=['src/app','src/components','src/content','public','supabase/migrations/20261014225059_patrimonial_lead_v2.sql','supabase/migrations/20261015100912_patrimonial_opportunity_jsonb_precedence.sql','supabase/migrations/20261018094926_patrimonial_assignment_management.sql','src/lib/public-leads/patrimonial-highlevel.ts','src/lib/public-leads/patrimonial-highlevel-config.ts','src/lib/public-leads/patrimonial-contract.ts','src/lib/public-leads/patrimonial-routing.ts','src/lib/public-leads/handler.ts'];
assert.equal(execFileSync('git',['diff','e781f8dd3bafbd2fca7b3d85c077559811936f61','--',...protectedPaths],{encoding:'utf8'}),'');
assert.equal(networkAttempts,0);assert.equal(writeCalls,0);
passed.push('14 zero provider write calls, zero fetches, P2A planner remains pure; authorized P2B executor covered by owner-sync verifier');
console.log(passed.map(p=>`PASS ${p}`).join('\n'));
