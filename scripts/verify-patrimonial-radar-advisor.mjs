import {withoutReadableCacheHeaders} from './lib/readable-cache-config.mjs';
import {execFileSync} from 'node:child_process';
import {assertPublicPilotPreservation} from './lib/patrimonial-public-preservation.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PREVIEW_CASES,previewSource} from '../src/lib/patrimonial-radar-advisor/preview-fixtures.ts';
import {advisorProjection} from '../src/lib/patrimonial-radar-advisor/projection.ts';
import {advisorPreviewEnabled} from '../src/lib/patrimonial-radar-advisor/preview-gate.ts';
import {readAuthorizedAdvisor} from '../src/lib/patrimonial-radar-advisor/access.ts';
import {customerProjection} from '../src/lib/patrimonial-radar-server/customer-projection.ts';
import {contentHash} from '../src/lib/patrimonial-radar-server/security.ts';
import {diagnose} from '../src/lib/patrimonial-radar/result.ts';
import {indicatorText} from '../src/lib/patrimonial-radar-advisor/formatting.ts';

const passed=[];
for(const scenario of PREVIEW_CASES) {
  const source=previewSource(scenario),before=JSON.stringify(source),r=source.snapshot.result,p=advisorProjection(source),customer=customerProjection(source.snapshot);
  assert.deepEqual(r,diagnose(source.approvedInput));assert.equal(p.general.snapshotId,source.snapshot.id);assert.equal(p.general.approvedRevision,source.snapshot.approvedRevision);
  for(const key of ['indicators','areas','profiles','goals','evidence','incoherences'])assert.deepEqual(p[key],r[key]);
  assert.deepEqual(p.general.versions,r.versions);assert.deepEqual(p.general.completeness,r.completeness);
  assert.equal(p.answers.length,source.approvedInput.answers.length);assert.deepEqual(p.answers.map(a=>a.record),source.approvedInput.answers);
  for(const a of p.answers)if(a.disposition==='SUPERSEDED'||a.lifecycle!=='ACTIVE')assert.notEqual(a.contribution,'CURRENT_ACTIVE');
  for(const e of p.evidence)for(const ref of e.refs)assert.ok(p.answers.some(a=>a.record.id===ref.id&&a.record.revision===ref.revision));
  for(const i of Object.values(p.indicators))if(!i.usable)assert.match(indicatorText(i),/Non calcolabile|Non applicabile|Descrizione/);
  for(const q of p.agenda){assert.equal(q.kind,'HYPOTHESIS_TO_VERIFY');assert.ok(q.sourceRule);assert.ok(r.interviewQuestions.some(c=>c.rule===q.sourceRule&&c.text===q.basis)||q.goalIds.length);for(const id of q.evidenceIds)assert.ok(p.evidence.some(e=>e.id===id));for(const id of q.goalIds)assert.ok(p.goals.goals.some(g=>g.id===id));}
  assert.equal(p.reading.length,5);assert.equal(p.futureComparison.status,'NOT_IMPLEMENTED');assert.deepEqual(p.futureComparison.recommendations,[]);assert.equal(p.futureComparison.catalogVersion,null);
  for(const a of ['A','B','C','D','E','F'])assert.equal(customer.areas[a].state,p.areas[a].state);
  assert.doesNotMatch(JSON.stringify(customer),/"(indicators|profiles|history|answers|interviewQuestions|formula|resources|experience)":/);
  assert.equal(JSON.stringify(source),before);p.indicators['I-A01'].reason='MUTATION';assert.equal(JSON.stringify(source),before);
}
passed.push('25 synthetic snapshots: same canonical/customer states, exact indicators/rational bands, profiles, goals, evidence refs, full original revisions, immutable source and no Advisor customer payload');
const g5=advisorProjection(previewSource('G05'));assert.equal(g5.goals.goals.length,2);assert.equal(g5.goals.checks.find(c=>c.rule==='R-G04').status,'CLARIFY');
const g6=advisorProjection(previewSource('G06'));assert.equal(g6.goals.goals.length,0);assert.equal(g6.goals.resources,null);assert.equal(g6.goals.serviceUtility.main.value,'CLARIFY_GOALS');
const g7=advisorProjection(previewSource('G07'));assert.equal(g7.goals.resources.available.value.amount,'0');assert.equal(g7.goals.resources.constraints.length,3);
const legacy=advisorProjection(previewSource('LEGACY'));assert.equal(legacy.goals.goals[0].rank.state,'UNANSWERED');assert.ok(!legacy.agenda.find(q=>q.id.startsWith('goal-')).question.includes('Quando serviranno'),'Known legacy horizon is not re-asked');
assert.ok(advisorProjection(previewSource('RECONFIRM')).answers.some(a=>a.contribution==='RECONFIRM'));
assert.ok(advisorProjection(previewSource('INACTIVE')).answers.some(a=>a.contribution==='INACTIVE'));
for(const mutate of [s=>s.personId='untrusted',s=>s.assessmentId='wrong',s=>s.approvedInput.answers=[],s=>s.snapshot.result.profiles.reason='wrong',s=>s.snapshot.answerRefs=[]]){const s=previewSource('T02');mutate(s);assert.throws(()=>advisorProjection(s),/SOURCE_MISMATCH/);}
passed.push('Multiple goals, conflicting shared allocations, declared constraints/zero, missing/declined resources, legacy priority not invented, reconfirm/inactive exclusion, tampered snapshot/ledger rejected');
const target={personId:previewSource('T02').personId,assessmentId:previewSource('T02').assessmentId};
const request=new Request('http://127.0.0.1/internal',{headers:{cookie:'pr_session=copied-customer-cookie',authorization:'Bearer opaque-fake'}});
const authority={...target,staffUserId:'90000000-0000-4000-8000-000000000001',operatorId:'90000000-0000-4000-8000-000000000002',sessionId:'90000000-0000-4000-8000-000000000003',sessionExpiresAt:new Date(Date.now()+600000).toISOString(),sessionRevision:0,operatorRegistryRevision:0,locationId:'synthetic-location',permissionId:'90000000-0000-4000-8000-000000000016',permissionRevision:0,staffOperatorBindingId:'90000000-0000-4000-8000-000000000004',staffOperatorBindingRevision:0,personContactBindingId:'90000000-0000-4000-8000-000000000005',personContactBindingRevision:0,relationshipScopeId:'90000000-0000-4000-8000-000000000008',relationshipScopeRevision:0,relationshipPolicyVersion:'synthetic-explicit-intent-v1',sessionCurrent:true,operatorActive:true,staffOperatorLinkVerified:true,permission:'RADAR_ADVISOR_READ',personContactLinkVerified:true,contactId:'synthetic-contact',relation:{kind:'CURRENT_ASSIGNEE',operatorId:'90000000-0000-4000-8000-000000000002',revision:4,current:true,assignmentId:'90000000-0000-4000-8000-000000000006',assignmentRevision:0,intentId:'90000000-0000-4000-8000-000000000007'}};
await assert.rejects(()=>readAuthorizedAdvisor(request,target),/ACCESS_DENIED/);
const syntheticAudit=async({event,expectedAuthority})=>({id:randomUUID(),requestId:event.requestId,outcome:event.outcome,authorityHash:expectedAuthority?contentHash(expectedAuthority):null});
let loads=0;const source=previewSource('T02');
for(const a of [null,{...authority,sessionCurrent:false},{...authority,operatorActive:false},{...authority,staffOperatorLinkVerified:false},{...authority,permission:null},{...authority,personContactLinkVerified:false},{...authority,personId:'other'},{...authority,assessmentId:'other'},{...authority,role:'superadmin',relation:null},{...authority,relation:{...authority.relation,operatorId:'other'}},{...authority,relation:{...authority.relation,current:false}},{...authority,relation:{...authority.relation,kind:'UNRESOLVED_SUPERVISION'}}]) {
 await assert.rejects(()=>readAuthorizedAdvisor(request,target,{commitDecision:syntheticAudit,resolveCurrent:async()=>a,loadApproved:async()=>{loads++;return source;}}),/ACCESS_DENIED/);
}assert.equal(loads,0);
let resolves=0;const positive=await readAuthorizedAdvisor(request,target,{commitDecision:syntheticAudit,resolveCurrent:async()=>{resolves++;return structuredClone(authority);},loadApproved:async()=>source});assert.equal(positive.general.personId,target.personId);assert.equal(resolves,2);
for(const second of [null,{...authority,operatorActive:false},{...authority,relation:{...authority.relation,revision:5}},{...authority,operatorId:'operator-b',relation:{...authority.relation,operatorId:'operator-b'}}]) {let n=0;await assert.rejects(()=>readAuthorizedAdvisor(request,target,{commitDecision:syntheticAudit,resolveCurrent:async()=>n++?second:authority,loadApproved:async()=>source}),/ACCESS_DENIED/);}
await assert.rejects(()=>readAuthorizedAdvisor(request,target,{commitDecision:syntheticAudit,resolveCurrent:async()=>authority,loadApproved:async()=>({...source,personId:'another-person'})}),/ACCESS_DENIED/);
passed.push('Abstract access: default deny, no customer-session authority, no generic/superadmin bypass, no reads before authorization; valid simulated relation, revocation/reassignment/session/operator/subject failures and recheck after load');
const flags={PATRIMONIAL_RADAR_ADVISOR_PREVIEW_ENABLED:'true',PATRIMONIAL_RADAR_ADVISOR_PREVIEW_CONTEXT:'synthetic-local',NODE_ENV:'development'};
assert.equal(advisorPreviewEnabled(flags),true);
for(const env of [{},{...flags,NODE_ENV:'production'},{...flags,VERCEL:'1'},{...flags,VERCEL_ENV:'production'},{...flags,PATRIMONIAL_RADAR_ADVISOR_PREVIEW_CONTEXT:'real'},{...flags,PATRIMONIAL_RADAR_ADVISOR_PREVIEW_ENABLED:'false'}])assert.equal(advisorPreviewEnabled(env),false);
const projection=readFileSync('src/lib/patrimonial-radar-advisor/projection.ts','utf8');assert.doesNotMatch(projection,/diagnose\(|calculateIndicators|evaluateProfiles|fetch\(|process\.env|console\./);
const preview=readFileSync('src/lib/patrimonial-radar-advisor/preview-fixtures.ts','utf8');assert.doesNotMatch(preview,/fetch\(|LocalSupabase|readAuthorizedAdvisor|process\.env|public-leads/);
const page=readFileSync('src/app/(site)/internal/radar-patrimoniale/advisor-preview/page.tsx','utf8');assert.match(page,/if\(!advisorPreviewEnabled\(process.env\)\)notFound\(\)/);assert.doesNotMatch(page,/readAuthorizedAdvisor|searchParams.*personId|cookies\(/);
const baseline='640e4101f19248c7e1c86049e3bb66165d68f24f';
assertPublicPilotPreservation(baseline,['src/lib/patrimonial-radar','src/lib/patrimonial-radar-server','src/lib/patrimonial-radar-ui','src/components/patrimonial-radar','src/app/radar-patrimoniale','src/app/api','src/lib/public-leads','supabase','public','package-lock.json']);
const oldConfig=execFileSync('git',['show',`${baseline}:next.config.ts`],{encoding:'utf8'}).replaceAll('\r\n','\n'),config=withoutReadableCacheHeaders(readFileSync('next.config.ts','utf8').replaceAll('\r\n','\n')).replace(' experimental: { globalNotFound: true },\n','');const begin=config.indexOf("{ source: '/internal/radar-patrimoniale/advisor-preview', headers: ["),end=config.indexOf("{ source: '/radar-patrimoniale', headers: [",begin);assert.equal(config.slice(0,begin)+config.slice(end),oldConfig);
passed.push('Dev preview production/default OFF; fixture-only route with no real reader, no public Advisor API, customer/domain/SQL/CRM/assets untouched, existing headers byte-preserved');
assert.equal(contentHash(source.snapshot.result),source.snapshot.resultHash);
console.log(passed.map(p=>`PASS ${p}`).join('\n'));
