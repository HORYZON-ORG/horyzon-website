import {assertPublicPilotPreservation} from './lib/patrimonial-public-preservation.mjs';
// Synthetic state machine only: no real Auth, database, assignment writer or HTTP.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {readAuthorizedAdvisor} from '../src/lib/patrimonial-radar-advisor/access.ts';
import {authorityFromP1,p1AdvisorAccessPorts} from '../src/lib/patrimonial-radar-advisor/p1-access-adapter.ts';
import {canonical,contentHash} from '../src/lib/patrimonial-radar-server/security.ts';
import {previewSource} from '../src/lib/patrimonial-radar-advisor/preview-fixtures.ts';
const id=n=>`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const source=previewSource('T02'),target={personId:source.personId,assessmentId:source.assessmentId};
const request=new Request('http://127.0.0.1/internal',{headers:{cookie:'pr_session=synthetic-customer-cookie',authorization:'Bearer synthetic-staff-token'}});
const passed=[];let assertions=0,external=0;
globalThis.fetch=async()=>{external++;throw Error('NETWORK_FORBIDDEN');};
function facts(){return {
 identity:{session:{staffUserId:id(1),sessionId:id(3),expiresAt:new Date(Date.now()+600000).toISOString(),revision:0,current:true,verified:true},
  staffOperatorBindings:[{id:id(4),revision:0,state:'VERIFIED',staffUserId:id(1),operatorId:id(2)},{id:id(14),revision:0,state:'VERIFIED',staffUserId:id(9),operatorId:id(10)}],
  permissions:[{id:id(16),staffUserId:id(1),operatorId:id(2),permission:'RADAR_ADVISOR_READ',revision:0,active:true},{id:id(17),staffUserId:id(9),operatorId:id(10),permission:'RADAR_ADVISOR_READ',revision:0,active:true}],
  personContactBindings:[{id:id(5),revision:0,state:'VERIFIED',personId:target.personId,contactId:'synthetic-contact',locationId:'synthetic-location'}],
  relationshipScopes:[{id:id(8),revision:0,state:'VERIFIED',...target,contactId:'synthetic-contact',locationId:'synthetic-location',intentId:id(7),policyVersion:'synthetic-explicit-intent-v1'}]},
 p1:{capabilities:{contract:'patrimonial-runtime-capabilities-v1',base:'patrimonial-v2-store-1',assignmentManagement:'p1-v1'},
  operators:[{id:id(2),active:true,revision:0,remoteUserRef:null},{id:id(10),active:true,revision:0,remoteUserRef:'synthetic-remote-user-b'}],
  intents:[{id:id(7),kind:'OPPORTUNITY',status:'OPEN',currentOperatorId:id(2),operatorRevision:4,ownerRef:'synthetic-unrelated-crm-owner',record:{contactId:'synthetic-contact',locationId:'synthetic-location'}}],
  assignments:[{id:id(6),intentId:id(7),operatorId:id(2),releasedAt:null,revision:0}]}
};}
function harness(){const h={facts:facts(),loads:0,resolves:0,events:[],readSource:()=>structuredClone(source)};
 h.ports=p1AdvisorAccessPorts({readCurrentFacts:async()=>{h.resolves++;h.onResolve?.(h.resolves);return h.facts;},
  loadApproved:async()=>{h.loads++;h.onLoad?.();return h.readSource();},
  commitDecision:async({target:t,expectedAuthority,event})=>{
   h.onCommit?.(event.outcome);
   // Synchronous fresh check + append model ONE local atomic decision. It is not
   // proof of native SQL locks, durable audit, Auth or distributed revocation.
   if(expectedAuthority&&canonical(authorityFromP1(h.facts,t))!==canonical(expectedAuthority))throw Error('STALE');
   if(h.auditUnavailable)throw Error('SYNTHETIC_AUDIT_UNAVAILABLE');
   h.events.push(structuredClone(event));
   return {id:randomUUID(),requestId:event.requestId,outcome:event.outcome,authorityHash:expectedAuthority?contentHash(expectedAuthority):null};
  }});
 return h;
}
async function denied(h,t=target){await assert.rejects(()=>readAuthorizedAdvisor(request,t,h.ports),e=>{
 assert.equal(e.message,'ADVISOR_ACCESS_DENIED');assert.deepEqual(Object.keys(e),[]);return true;
});assertions++;assert.ok(h.events.every(e=>e.outcome==='DENIED'));}
const positive=harness(),result=await readAuthorizedAdvisor(request,target,positive.ports);
assert.deepEqual(result.indicators,source.snapshot.result.indicators);assert.equal(result.general.snapshotId,source.snapshot.id);assert.equal(positive.loads,1);assert.equal(positive.resolves,2);assert.equal(positive.events.length,1);assert.equal(positive.events[0].outcome,'AUTHORIZED_RELEASE');
passed.push('Authorized operator: same immutable canonical dossier, current explicit assignment scope and mandatory audited release; CRM owner differs and remote mapping may be absent');
const negative=[
 ['no staff session',f=>f.identity.session=null],['unverified Auth identity',f=>f.identity.session.verified=false],
 ['expired session',f=>f.identity.session.expiresAt='2000-01-01T00:00:00Z'],['revoked session',f=>f.identity.session.current=false],
 ['inactive operator',f=>f.p1.operators[0].active=false],['no permission',f=>f.identity.permissions=[]],
 ['superadmin only',f=>{f.identity.permissions=[];f.identity.session.role='superadmin';}],
 ['mutable metadata claims',f=>{f.identity.staffOperatorBindings=[];f.identity.session.user_metadata={operatorId:id(2),permission:'RADAR_ADVISOR_READ'};}],
 ['missing staff binding',f=>f.identity.staffOperatorBindings=[]],['unresolved staff binding',f=>f.identity.staffOperatorBindings[0].state='UNRESOLVED'],
 ['duplicate staff',f=>f.identity.staffOperatorBindings.push({...f.identity.staffOperatorBindings[0],id:id(20),operatorId:id(10)})],
 ['shared operator identity',f=>f.identity.staffOperatorBindings.push({...f.identity.staffOperatorBindings[0],id:id(20),staffUserId:id(21)})],
 ['missing person link',f=>f.identity.personContactBindings=[]],['UNRESOLVED integration evidence',f=>f.identity.personContactBindings[0].state='UNRESOLVED'],
 ['wrong person',f=>f.identity.personContactBindings[0].personId=id(25)],
 ['contact linked to two persons',f=>f.identity.personContactBindings.push({...f.identity.personContactBindings[0],id:id(26),personId:id(25)})],
 ['duplicate person contact',f=>f.identity.personContactBindings.push({...f.identity.personContactBindings[0],id:id(26)})],
 ['wrong Location',f=>f.identity.personContactBindings[0].locationId='other-location'],
 ['no scope policy',f=>f.identity.relationshipScopes=[]],['unverified scope',f=>f.identity.relationshipScopes[0].state='UNRESOLVED'],
 ['ambiguous scopes',f=>f.identity.relationshipScopes.push({...f.identity.relationshipScopes[0],id:id(27)})],
 ['different assessment scope',f=>f.identity.relationshipScopes[0].assessmentId=id(25)],
 ['wrong contact',f=>f.p1.intents[0].record.contactId='another-contact'],
 ['operator not assigned',f=>{f.p1.intents[0].currentOperatorId=id(10);f.p1.assignments[0].operatorId=id(10);}],
 ['assignment conflicts with projection',f=>f.p1.assignments[0].operatorId=id(10)],
 ['duplicate active assignments',f=>f.p1.assignments.push({...f.p1.assignments[0],id:id(28)})],
 ['released assignment',f=>f.p1.assignments[0].releasedAt=new Date().toISOString()],
 ['null current operator',f=>f.p1.intents[0].currentOperatorId=null],['closed intent',f=>f.p1.intents[0].status='LOST'],
 ['provisional intent',f=>f.p1.intents[0].kind='PROVISIONAL'],
 ['missing capability',f=>f.p1.capabilities.assignmentManagement=null],['wrong contract',f=>f.p1.capabilities.contract='unknown'],
 ['wrong base',f=>f.p1.capabilities.base='unknown'],['invalid assignment revision',f=>f.p1.intents[0].operatorRevision=-1],
 ['invalid operator revision',f=>f.p1.operators[0].revision=1.5],['invalid grant revision',f=>f.identity.permissions[0].revision=-1],
 ['UUID or CRM owner alone',f=>{f.identity.staffOperatorBindings=[];f.p1.operators[0].remoteUserRef=id(1);f.p1.intents[0].ownerRef=id(1);}],
 ['email equality alone',f=>{f.identity.personContactBindings=[];f.identity.session.email='synthetic@example.invalid';f.p1.intents[0].record.email='synthetic@example.invalid';}],
];
for(const [name,mutate]of negative){const h=harness();mutate(h.facts);await denied(h);assert.equal(h.loads,0,name);assert.equal(h.events.length,1,name);}
passed.push(`${negative.length} negative identity/permission/capability/scope/P1 cases deny before snapshot or ledger read; duplicate/reverse ambiguous identities and mutable claims never authorize`);
const cross=harness();await denied(cross,{...target,personId:id(25)});assert.equal(cross.loads,0);
const wrongSource=harness();wrongSource.readSource=()=>({...structuredClone(source),personId:id(25)});await denied(wrongSource);
function reassign(f){const old=f.p1.assignments.find(a=>a.releasedAt===null);old.releasedAt=new Date().toISOString();old.revision++;f.p1.assignments.push({id:id(11),intentId:id(7),operatorId:id(10),releasedAt:null,revision:0});f.p1.intents[0].currentOperatorId=id(10);f.p1.intents[0].operatorRevision++;}
const history=harness();reassign(history.facts);await denied(history);assert.equal(history.loads,0);
history.facts.identity.session.staffUserId=id(9);history.facts.identity.session.sessionId=id(13);
const historical=await readAuthorizedAdvisor(request,target,history.ports);assert.equal(historical.general.snapshotId,source.snapshot.id);assert.equal(history.events.at(-1).assignmentId,id(11));assert.equal(history.events.at(-1).operatorId,id(10));
passed.push('Cross-person/copied UUID and mismatched reader source denied; historical completed dossier follows CURRENT verified scope/assignment, former operator denied and successor audited');
const changes=[
 ['reassignment',reassign],['session revocation',f=>f.identity.session.current=false],
 ['permission revocation',f=>f.identity.permissions[0].active=false],['permission regrant ABA',f=>f.identity.permissions[0].id=id(30)],['operator disabled',f=>f.p1.operators[0].active=false],
 ['session expiry',f=>f.identity.session.expiresAt='2000-01-01T00:00:00Z'],
 ['staff binding revision',f=>f.identity.staffOperatorBindings[0].revision++],['person binding revision',f=>f.identity.personContactBindings[0].revision++],
 ['scope policy revision',f=>f.identity.relationshipScopes[0].revision++],['assignment revision ABA',f=>f.p1.intents[0].operatorRevision+=2],
];
for(const [name,mutate]of changes){for(const stage of ['load','commit']){const h=harness();if(stage==='load')h.onLoad=()=>mutate(h.facts);else h.onCommit=outcome=>{if(outcome==='AUTHORIZED_RELEASE')mutate(h.facts);};await denied(h);assert.equal(h.loads,1,`${name}/${stage}`);}}
const mutable=harness();const shared=authorityFromP1(mutable.facts,target);mutable.ports.resolveCurrent=async()=>shared;mutable.onLoad=()=>{shared.permissionRevision++;};await denied(mutable);
const harmlessOwner=harness();harmlessOwner.onLoad=()=>{harmlessOwner.facts.p1.intents[0].ownerRef='different-remote-owner';};await readAuthorizedAdvisor(request,target,harmlessOwner.ports);
passed.push('20 load/commit revocation and reassignment interleavings fail closed, including session expiry, proof revisions and assignment ABA; detached proofs resist mutation; CRM owner changes do not grant/revoke internal rights');
const noAudit=harness();delete noAudit.ports.commitDecision;await assert.rejects(()=>readAuthorizedAdvisor(request,target,noAudit.ports),/ADVISOR_ACCESS_DENIED/);assert.equal(noAudit.loads,0);
const broken=harness();broken.auditUnavailable=true;await denied(broken);
for(const mutate of [r=>r.authorityHash='wrong',r=>r.requestId=id(29),r=>r.outcome='DENIED']){const h=harness(),commit=h.ports.commitDecision;h.ports.commitDecision=async i=>{const receipt=await commit(i);if(i.expectedAuthority)mutate(receipt);return receipt;};await assert.rejects(()=>readAuthorizedAdvisor(request,target,h.ports),/ADVISOR_ACCESS_DENIED/);assert.equal(h.events.at(-1).outcome,'DENIED');}
const safeKeys=['requestId','occurredAt','action','outcome','personId','assessmentId','staffUserId','operatorId','assignmentId','intentId','assignmentRevision'].sort();
for(const e of [...positive.events,...history.events,...cross.events]){assert.deepEqual(Object.keys(e).sort(),safeKeys);assert.doesNotMatch(JSON.stringify(e),/email|token|cookie|ownerRef|contactId|indicator|answer|amount|reason|result|financial/i);}
const leaking=harness();leaking.readSource=()=>{throw Error(JSON.stringify(source));};await denied(leaking);
assert.equal(external,0);
passed.push('Missing/failing audit or mismatched receipt prevents release; strict UUID/revision-only audit allowlist, generic denials and raw financial exceptions suppressed; zero network calls');
const baseline='aab329da61931c46d3754dcc12d0aaf39852d28e';
assertPublicPilotPreservation(baseline,['src/app','src/components','src/lib/patrimonial-radar','src/lib/patrimonial-radar-server','src/lib/patrimonial-radar-ui','src/lib/public-leads','src/lib/radar','supabase','public','next.config.ts','package-lock.json']);
const adapter=readFileSync('src/lib/patrimonial-radar-advisor/p1-access-adapter.ts','utf8');assert.doesNotMatch(adapter,/fetch\(|process\.env|executePatrimonialAssignment|\.remoteUserRef\s*===|\.ownerRef\s*===/);
const imports=spawnSync('rg',['-l','p1-access-adapter|readAuthorizedAdvisor','src/app','src/components','src/lib/patrimonial-radar-server'],{encoding:'utf8'});
assert.equal(imports.status,1);assert.equal(imports.stdout,'');
passed.push('No runtime/route/preview/customer/SQL/CRM/asset/flag changes and no real adapters installed; P1 shapes consumed read-only, no merge or second assignment system');
console.log(passed.map(p=>`PASS ${p}`).join('\n'));console.log(`${assertions} expected-denial requests checked; all identities synthetic.`);
