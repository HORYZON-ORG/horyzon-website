import {assertPublicPilotPreservation} from './lib/patrimonial-public-preservation.mjs';
// Synthetic local composition, never a real grant or binding workflow.
import assert from 'node:assert/strict';
import {  spawnSync } from 'node:child_process';
import { reviewControlledLinkingProposal as review } from '../src/lib/patrimonial-radar-advisor/controlled-linking-review-proposal.ts';
import { planBindingRestriction } from '../src/lib/patrimonial-radar-advisor/access-contracts-proposal.ts';
const id=n=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now='2026-10-19T12:00:00.000Z',future='2026-10-20T12:00:00.000Z',past='2026-10-18T12:00:00.000Z';
let external=0;globalThis.fetch=async()=>{external++;throw Error('NETWORK_FORBIDDEN');};
const base=n=>({id:id(n),revision:0,state:'ACTIVE',evidenceId:id(100+n),changedBy:id(99),changedAt:past});
function fixture(){
  const subject={issuerKey:'synthetic-hub',staffUserId:id(1),operatorId:id(2),personId:id(3),assessmentId:id(4),locationId:'synthetic-location',contactId:'synthetic-contact'};
  return {subject,now,expectedSessionAuthority:{issuerKey:'synthetic-hub',databaseIdentity:'synthetic-db'},
    session:{issuerKey:'synthetic-hub',userId:id(1),sessionId:id(5),signatureVerified:true,issuerAudienceVerified:true,credentialExpiresAt:future,authority:{mode:'SAME_DATABASE_TRANSACTION',databaseIdentity:'synthetic-db',userId:id(1),sessionId:id(5),sessionPresent:true,userActive:true,effectiveExpiresAt:future,policyEvaluated:true}},
    catalog:{staff:[{...base(6),issuerKey:subject.issuerKey,staffUserId:id(1),operatorId:id(2)}],permissions:[{...base(7),staffBindingId:id(6),permission:'RADAR_ADVISOR_READ',locationId:subject.locationId,expiresAt:null}],persons:[{...base(8),personId:id(3),locationId:subject.locationId,contactId:subject.contactId,method:'OPERATOR_APPROVED_EVIDENCE',acknowledgmentEvidenceId:id(9)}]},
    relationships:{personId:id(3),assessmentId:id(4),locationId:subject.locationId,contactId:subject.contactId,operatorId:id(2),completeness:'COMPLETE',
      relations:[{id:id(10),kind:'OPPORTUNITY',pipeline:'PATRIMONIAL_EVENT',status:'OPEN',stage:'E02',cycle:1,revision:0,locationId:subject.locationId,contactId:subject.contactId,currentOperatorId:id(2),operatorRevision:1,consultation:null}],
      operators:[{id:id(2),active:true,revision:0}],assignments:[{id:id(11),intentId:id(10),operatorId:id(2),releasedAt:null,revision:0}],
      participations:[{id:id(12),relationId:id(10),contactId:subject.contactId,editionId:'synthetic-future-event',status:'CONFIRMED',attendance:'UNKNOWN',revision:0}],
      purposeEvidence:[{id:id(13),intentId:id(10),cycle:1,revision:0,state:'VERIFIED',assessmentIds:[id(4)],participationId:id(12)}]},
  };
}
const candidate=fixture(),saved=JSON.stringify(candidate),first=review(candidate);
assert.equal(first.status,'CANDIDATE_ONLY');assert.equal(first.authorizesAccess,false);assert.equal(first.policyStatus,'PROPOSED');assert.equal(first.requiredImplementations.length,6);assert.equal(JSON.stringify(candidate),saved);
// Registration is already CONFIRMED, but its scoped edition has not occurred:
// UNKNOWN attendance is deliberately sufficient for a proposal candidate.
const edition={id:'synthetic-future-event',startsAt:'2026-11-01T18:00:00.000Z'};
assert(Date.parse(now)<Date.parse(edition.startsAt));assert.equal(candidate.relationships.participations[0].editionId,edition.id);assert.equal(review(candidate).status,'CANDIDATE_ONLY');
const consultation=fixture();Object.assign(consultation.relationships.relations[0],{pipeline:'PATRIMONIAL_CONSULTATION',stage:'C01',consultation:{explicitRequest:true}});consultation.relationships.participations=[];consultation.relationships.purposeEvidence[0].participationId=null;assert.equal(review(consultation).status,'CANDIDATE_ONLY');
const cases=[
  ['staff revoked',i=>i.catalog.staff[0].state='REVOKED'],['staff duplicate',i=>i.catalog.staff.push({...i.catalog.staff[0],id:id(40)})],
  ['grant absent',i=>i.catalog.permissions=[]],['grant expired',i=>i.catalog.permissions[0].expiresAt=past],['grant revoked',i=>i.catalog.permissions[0].state='REVOKED'],
  ['person missing',i=>i.catalog.persons=[]],['person revoked',i=>i.catalog.persons[0].state='REVOKED'],
  ['multiple contacts',i=>i.catalog.persons.push({...i.catalog.persons[0],id:id(41),contactId:'other'})],
  ['ambiguous contact',i=>i.catalog.persons.push({...i.catalog.persons[0],id:id(41),personId:id(42)})],
  ['email matching',i=>i.catalog.persons[0].method='EMAIL_MATCH'],['supervisor alone',i=>{i.catalog.permissions=[];i.subject.role='superadmin';}],
  ['session subject mixing',i=>{i.session.userId=id(43);i.session.authority.userId=id(43);}],
  ['person proof mixing',i=>i.relationships.personId=id(44)],['episode proof mixing',i=>i.relationships.assessmentId=id(44)],
  ['operator proof mixing',i=>i.relationships.operatorId=id(44)],['Location proof mixing',i=>i.relationships.locationId='other'],['contact proof mixing',i=>i.relationships.contactId='other'],
  ['pending',i=>i.relationships.participations[0].status='PENDING_CONFIRMATION'],['no show',i=>i.relationships.participations[0].attendance='NO_SHOW'],
  ['closed',i=>i.relationships.relations[0].status='WON'],['recruitment',i=>i.relationships.relations[0].pipeline='ARCHITECT_PATH'],
  ['standalone Radar',i=>{i.relationships.relations=[];i.relationships.assignments=[];i.relationships.participations=[];i.relationships.purposeEvidence=[];}],
  ['history outside scope',i=>i.relationships.purposeEvidence[0].assessmentIds=[id(45)]],
  ['expired session',i=>i.session.credentialExpiresAt=past],['revoked session',i=>i.session.authority.sessionPresent=false],['separate Auth DB',i=>i.session.authority.mode='EXTERNAL_INDEPENDENT'],
  ['discordant responsible',i=>{const r=structuredClone(i.relationships.relations[0]);r.id=id(46);r.currentOperatorId=id(47);i.relationships.relations.push(r);}],
];
for(const [name,mutate] of cases){const input=fixture();mutate(input);const result=review(input);assert.equal(result.status,'DENIED',name);assert.equal(result.authorizesAccess,false,name);assert.equal(result.fingerprint,null,name);assert.doesNotMatch(JSON.stringify(result),/synthetic-contact|economic-sentinel|answer|amount|cookie|token/i);}
const restricted=fixture();restricted.catalog=planBindingRestriction(restricted.catalog,{kind:'staff',id:id(6),expectedRevision:0,operation:'REVOKE',actorId:id(99),evidenceId:id(90),at:now}).next;assert.equal(review(restricted).status,'DENIED','revocation after candidate');
const changed=fixture();changed.relationships.relations[0].operatorRevision++;assert.notEqual(review(changed).fingerprint,first.fingerprint,'No candidate reuse after authority revision');
const reassigned=fixture();reassigned.relationships.operators.push({id:id(48),active:true,revision:0});reassigned.relationships.relations[0].currentOperatorId=id(48);reassigned.relationships.relations[0].operatorRevision++;reassigned.relationships.assignments[0].releasedAt=now;reassigned.relationships.assignments.push({id:id(49),intentId:id(10),operatorId:id(48),releasedAt:null,revision:0});assert.equal(review(reassigned).status,'DENIED','old responsible loses even historical scope');
reassigned.subject.operatorId=id(48);reassigned.catalog.staff[0].operatorId=id(48);reassigned.catalog.staff[0].revision++;reassigned.relationships.operatorId=id(48);assert.equal(review(reassigned).status,'CANDIDATE_ONLY');reassigned.relationships.purposeEvidence[0].assessmentIds=[id(45)];assert.equal(review(reassigned).status,'DENIED','new responsible needs explicit history scope');
const broken=fixture();Object.defineProperty(broken,'catalog',{get(){throw Error('economic-sentinel');}});assert.equal(review(broken).reason,'INVALID_LOCAL_REVIEW');assert.doesNotMatch(JSON.stringify(review(broken)),/economic-sentinel/);
assertPublicPilotPreservation('40e591f23321bf292b1533daca8fc780c976bc9f',['src/app','src/components','src/lib/patrimonial-radar','src/lib/patrimonial-radar-server','src/lib/patrimonial-radar-ui','src/lib/public-leads','src/lib/radar','supabase','public','next.config.ts','package-lock.json','src/lib/patrimonial-radar-advisor/access.ts','src/lib/patrimonial-radar-advisor/p1-access-adapter.ts','src/lib/patrimonial-radar-advisor/access-contracts-proposal.ts','src/lib/patrimonial-radar-advisor/relationship-policy-proposal.ts']);
const imports=spawnSync('rg',['-l','controlled-linking-review-proposal','src/app','src/components','src/lib/patrimonial-radar-server','src/lib/patrimonial-radar-ui','src/lib/patrimonial-radar-advisor/access.ts','src/lib/patrimonial-radar-advisor/p1-access-adapter.ts'],{encoding:'utf8'});assert.equal(imports.status,1);assert.equal(external,0);
console.log(`PASS local linking review: Event before occurrence without attendance, explicit Consultation, ${cases.length} negatives, revocation/reassignment/history, subject correlation and fingerprints; always PROPOSED/non-authorizing, six real implementations still required, no network/runtime changes`);
