import {assertPublicPilotPreservation} from './lib/patrimonial-public-preservation.mjs';
// Local DRAFT models. These checks do not create persistent VERIFIED mappings or grants.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {validateBindingCatalogProposal,evaluateBindingCandidate,planBindingRestriction,assessStaffSessionProposal} from '../src/lib/patrimonial-radar-advisor/access-contracts-proposal.ts';
import {evaluateRelationshipPolicyProposal as policy} from '../src/lib/patrimonial-radar-advisor/relationship-policy-proposal.ts';
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const before='2026-10-18T12:00:00.000Z',now='2026-10-19T12:00:00.000Z',future='2026-10-20T12:00:00.000Z';
let external=0;globalThis.fetch=async()=>{external++;throw Error('NETWORK_FORBIDDEN');};const passed=[];
const base=n=>({id:id(n),revision:0,state:'ACTIVE',evidenceId:id(90+n),changedBy:id(80),changedAt:before});
const catalog=()=>({staff:[{...base(1),issuerKey:'synthetic-hub',staffUserId:id(2),operatorId:id(3)}],permissions:[{...base(4),staffBindingId:id(1),permission:'RADAR_ADVISOR_READ',locationId:'synthetic-location',expiresAt:null}],persons:[{...base(5),personId:id(6),locationId:'synthetic-location',contactId:'synthetic-contact',method:'OPERATOR_APPROVED_EVIDENCE',acknowledgmentEvidenceId:id(7)}]});
const subject={issuerKey:'synthetic-hub',staffUserId:id(2),operatorId:id(3),personId:id(6),locationId:'synthetic-location',contactId:'synthetic-contact'};
assert.equal(validateBindingCatalogProposal(catalog()).validation,'VALID_SHAPE');assert.equal(evaluateBindingCandidate(catalog(),subject,now).status,'CANDIDATE_ONLY');
const invalid=[c=>c.staff.push({...c.staff[0],id:id(20)}),c=>c.staff.push({...c.staff[0],id:id(20),staffUserId:id(21)}),c=>c.persons.push({...c.persons[0],id:id(20),personId:id(21)}),c=>c.persons.push({...c.persons[0],id:id(20),contactId:'other'}),c=>c.permissions.push({...c.permissions[0],id:id(20)}),c=>c.persons[0].method='OTP_ONLY',c=>c.persons[0].method='EMAIL_MATCH',c=>c.staff[0].email='synthetic@example.invalid',c=>c.staff[0].remoteUserRef=id(3),c=>c.staff[0].revision=-1,c=>c.permissions[0].staffBindingId=id(29),c=>c.persons[0].acknowledgmentEvidenceId='',c=>c.persons[0].state='UNRESOLVED'];
for(const mutate of invalid){const c=catalog();mutate(c);assert.throws(()=>validateBindingCatalogProposal(c),/ACCESS_CONTRACT_PROPOSAL_INVALID/);}
for(const mutate of [c=>c.staff[0].state='REVOKED',c=>c.staff[0].state='CONFLICT',c=>c.permissions[0].state='REVOKED',c=>c.permissions[0].expiresAt=before,c=>c.persons[0].state='CONFLICT',c=>c.persons[0].contactId='other']){const c=catalog();mutate(c);const r=evaluateBindingCandidate(c,subject,now);assert.equal(r.status,'DENIED');assert.equal(r.authorizesAccess,false);}
assert.equal(evaluateBindingCandidate(catalog(),{...subject,staffUserId:id(50)},now).status,'DENIED');
passed.push('Proposed binding/grant shapes: distinct IDs, uniqueness both directions, purpose/Location-scoped permission, evidence/ack refs, explicit expiry/revocation/conflict; OTP/email/owner/extra PII fields rejected');
const c=catalog(),original=JSON.stringify(c),command={kind:'persons',id:id(5),expectedRevision:0,operation:'SUSPEND_CONFLICT',actorId:id(80),evidenceId:id(81),at:now};
const plan=planBindingRestriction(c,command);assert.equal(JSON.stringify(c),original);assert.equal(plan.next.persons[0].state,'CONFLICT');assert.equal(plan.next.persons[0].revision,1);assert.equal(plan.authorizesAccess,false);
assert.equal(plan.next.persons[0].evidenceId,c.persons[0].evidenceId);assert.equal(plan.audit.evidenceId,command.evidenceId);
const revoked=planBindingRestriction(plan.next,{...command,expectedRevision:1,operation:'REVOKE'});assert.equal(revoked.next.persons[0].state,'REVOKED');
assert.throws(()=>planBindingRestriction(plan.next,command),/CONFLICT/);assert.throws(()=>planBindingRestriction(revoked.next,{...command,expectedRevision:2}),/CONFLICT/);
assert.throws(()=>planBindingRestriction(c,{...command,at:'2000-01-01T00:00:00Z'}),/INVALID/);
// Reference CAS only. There is no production or persistent repository here.
let model=c;const p1=planBindingRestriction(c,command),p2=planBindingRestriction(c,{...command,operation:'REVOKE'});
const apply=p=>{assert.equal(validateBindingCatalogProposal(model).catalogFingerprint,p.expectedCatalogFingerprint,'STALE_CATALOG');model=p.next;};apply(p1);assert.throws(()=>apply(p2),/STALE_CATALOG/);
assert.deepEqual(Object.keys(plan.audit).sort(),['recordId','kind','operation','actorId','fromRevision','toRevision','at','evidenceId'].sort());assert.doesNotMatch(JSON.stringify(plan.audit),/email|amount|answer|token|cookie|goal/i);
passed.push('Pure restriction plans preserve immutable identities and source; monotonic revision, terminal revocation, conflict suspension, stale revision and two-plan CAS model checked; technical-only change audit');
function inventory(){return {...subject,assessmentId:id(8),completeness:'COMPLETE',relations:[{id:id(9),kind:'OPPORTUNITY',pipeline:'PATRIMONIAL_EVENT',status:'OPEN',stage:'E02',cycle:1,revision:2,locationId:'synthetic-location',contactId:'synthetic-contact',currentOperatorId:id(3),operatorRevision:1,consultation:null}],operators:[{id:id(3),active:true,revision:0},{id:id(30),active:true,revision:0}],assignments:[{id:id(10),intentId:id(9),operatorId:id(3),releasedAt:null,revision:0}],participations:[{id:id(11),relationId:id(9),contactId:'synthetic-contact',editionId:'synthetic-edition',status:'CONFIRMED',attendance:'UNKNOWN',revision:1}],purposeEvidence:[{id:id(12),intentId:id(9),cycle:1,revision:0,state:'VERIFIED',assessmentIds:[id(8)],participationId:id(11)}]};}
const event=inventory(),saved=JSON.stringify(event);const e=policy(event);assert.equal(e.status,'CANDIDATE_ONLY');assert.equal(e.authorizesAccess,false);assert.equal(e.policyStatus,'PROPOSED');assert.equal(JSON.stringify(event),saved);
const consultation=()=>{const i=inventory();Object.assign(i.relations[0],{pipeline:'PATRIMONIAL_CONSULTATION',stage:'C01',consultation:{explicitRequest:true}});i.participations=[];i.purposeEvidence[0].participationId=null;return i;};assert.equal(policy(consultation()).status,'CANDIDATE_ONLY');
const cases=[
 ['unassigned',i=>{i.relations[0].currentOperatorId=null;},'DENIED'],['disabled',i=>i.operators[0].active=false,'DENIED'],
 ['another operator',i=>i.operatorId=id(30),'DENIED'],['duplicate assignment',i=>i.assignments.push({...i.assignments[0],id:id(31)}),'DENIED'],
 ['duplicate identity',i=>i.operators.push({...i.operators[0]}),'DENIED'],['partial collection',i=>i.completeness='PARTIAL','DENIED'],
 ['foreign contact',i=>i.relations[0].contactId='other','DENIED'],['wrong Location',i=>i.relations[0].locationId='other','DENIED'],
 ['unverified purpose',i=>i.purposeEvidence[0].state='UNRESOLVED','DECISION_REQUIRED'],['purpose absent',i=>i.purposeEvidence=[],'DECISION_REQUIRED'],
 ['history outside scope',i=>i.purposeEvidence[0].assessmentIds=[id(33)],'DECISION_REQUIRED'],['reopened cycle',i=>i.relations[0].cycle++,'DECISION_REQUIRED'],
 ['pending edition',i=>{i.participations[0].editionId=null;i.participations[0].status='PENDING_EDITION';},'DECISION_REQUIRED'],
 ['no-show',i=>i.participations[0].attendance='NO_SHOW','DECISION_REQUIRED'],['cancelled participation',i=>i.participations[0].status='CANCELLED','DENIED'],
 ['Architect recruitment alone',i=>i.relations[0].pipeline='ARCHITECT_PATH','DENIED'],['invalid stage',i=>i.relations[0].stage='E05','DENIED'],
 ['closed unreleased',i=>i.relations[0].status='WON','DECISION_REQUIRED'],['closed released',i=>{i.relations[0].status='WON';i.relations[0].currentOperatorId=null;i.assignments[0].releasedAt=now;},'DENIED'],
 ['invalid revision',i=>i.relations[0].operatorRevision=-1,'DENIED'],
];
for(const [name,mutate,status]of cases){const i=inventory();mutate(i);const r=policy(i);assert.equal(r.status,status,name);assert.equal(r.authorizesAccess,false,name);}
const implicit=consultation();implicit.relations[0].consultation.explicitRequest=false;assert.equal(policy(implicit).status,'DENIED');
passed.push(`${cases.length+1} proposed relationship negatives: no assignment, inactive operator, incomplete/discordant inventory, unverified purpose/history, closed/reopened cases, no-show, pending edition, recruitment and non-explicit consultation never authorize`);
const multiple=inventory(),other=consultation();other.relations[0].id=id(40);other.assignments[0].id=id(41);other.assignments[0].intentId=id(40);other.purposeEvidence[0].id=id(42);other.purposeEvidence[0].intentId=id(40);multiple.relations.push(other.relations[0]);multiple.assignments.push(other.assignments[0]);multiple.purposeEvidence.push(other.purposeEvidence[0]);
const multi=policy(multiple);assert.equal(multi.status,'CANDIDATE_ONLY');assert.equal(multi.refs.filter(r=>'intentId'in r).length,2);
const reverse=structuredClone(multiple);for(const key of ['relations','assignments','operators','purposeEvidence'])reverse[key].reverse();assert.equal(policy(reverse).inventoryFingerprint,multi.inventoryFingerprint);assert.deepEqual(policy(reverse).refs,multi.refs);
const conflict=structuredClone(multiple);conflict.relations[1].currentOperatorId=id(30);conflict.assignments[1].operatorId=id(30);assert.equal(policy(conflict).reason,'DIFFERENT_CURRENT_RESPONSIBLES');
const reassigned=inventory();reassigned.relations[0].currentOperatorId=id(30);reassigned.relations[0].operatorRevision++;reassigned.assignments[0].releasedAt=now;reassigned.assignments.push({id:id(43),intentId:id(9),operatorId:id(30),releasedAt:null,revision:0});assert.equal(policy(reassigned).status,'DENIED');reassigned.operatorId=id(30);assert.equal(policy(reassigned).status,'CANDIDATE_ONLY');assert.notEqual(policy(reassigned).inventoryFingerprint,e.inventoryFingerprint);
const revisionOnly=inventory();revisionOnly.relations[0].operatorRevision+=2;assert.notEqual(policy(revisionOnly).inventoryFingerprint,e.inventoryFingerprint);
assert.notEqual(policy(conflict).inventoryFingerprint,multi.inventoryFingerprint,'A newly conflicting relation invalidates a prior candidate');
const knownOnly=catalog();knownOnly.permissions=[];assert.equal(evaluateBindingCandidate(knownOnly,{...subject,role:'superadmin'},now).status,'DENIED');
passed.push('Multiple Event/Consultation relations all fenced, same operator candidate, discordant operators require resolution; ordering invariant, reassigned historical scope excludes former operator and revisions/ABA change full-inventory fingerprint');
const session=()=>({issuerKey:'synthetic-hub',userId:id(2),sessionId:id(50),signatureVerified:true,issuerAudienceVerified:true,credentialExpiresAt:future,authority:{mode:'SAME_DATABASE_TRANSACTION',databaseIdentity:'synthetic-db',userId:id(2),sessionId:id(50),sessionPresent:true,userActive:true,effectiveExpiresAt:future,policyEvaluated:true}});
const expected={issuerKey:'synthetic-hub',databaseIdentity:'synthetic-db'};assert.equal(assessStaffSessionProposal(session(),expected,now).status,'CURRENT_CANDIDATE');
for(const mutate of [s=>s.signatureVerified=false,s=>s.signatureVerified='true',s=>s.issuerAudienceVerified=false,s=>s.issuerKey='other',s=>s.credentialExpiresAt=before,s=>s.authority=null,s=>s.authority.mode='EXTERNAL_INDEPENDENT',s=>s.authority.databaseIdentity='other',s=>s.authority.sessionPresent=false,s=>s.authority.userActive=false,s=>s.authority.userId=id(51),s=>s.authority.effectiveExpiresAt=before,s=>s.authority.policyEvaluated=false]){const s=session();mutate(s);const r=assessStaffSessionProposal(s,expected,now);assert.equal(r.status,'DENIED');assert.equal(r.authorizesAccess,false);}
passed.push('13 session negatives: decode/expiry alone insufficient, revoked/disabled/discordant rows rejected; external independent transactions remain unavailable under the proposed strict atomic policy; no auth.sessions columns invented');
const baseline='b70edc22ddcbce2ed460543c9a33d0843edbdfd7';assertPublicPilotPreservation(baseline,['src/app','src/components','src/lib/patrimonial-radar','src/lib/patrimonial-radar-server','src/lib/patrimonial-radar-ui','src/lib/public-leads','src/lib/radar','supabase','public','next.config.ts','package-lock.json','src/lib/patrimonial-radar-advisor/access.ts','src/lib/patrimonial-radar-advisor/p1-access-adapter.ts']);
const consumers=spawnSync('rg',['-l','access-contracts-proposal|relationship-policy-proposal','src/app','src/components','src/lib/patrimonial-radar-server','src/lib/patrimonial-radar-advisor/access.ts','src/lib/patrimonial-radar-advisor/p1-access-adapter.ts'],{encoding:'utf8'});assert.equal(consumers.status,1);assert.equal(consumers.stdout,'');assert.equal(external,0);
passed.push('All outputs explicitly deny actual authorization; no runtime/adapter/preview/customer/diagnostic/SQL/flag changes, no database writer or network');
console.log(passed.map(p=>`PASS ${p}`).join('\n'));
