import { buildFixture, goal, resources, constraint, experience, money, field, state } from '../../../scripts/patrimonial-radar-fixtures.mjs';
import { recordAnswer } from '../patrimonial-radar/answers.ts';
import { diagnose } from '../patrimonial-radar/result.ts';
import type { AssessmentInput, QuestionId, AnswerState } from '../patrimonial-radar/types.ts';
import { contentHash } from '../patrimonial-radar-server/security.ts';
import type { AdvisorSource } from './contracts.ts';

export const PREVIEW_CASES=['T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','T11','T12','T13','T14','G01','G02','G03','G04','G05','G06','G07','G08','RECONFIRM','INACTIVE','LEGACY'] as const;
export type PreviewCase=typeof PREVIEW_CASES[number];
const set=(a:AssessmentInput,id:string,v:unknown,s:AnswerState='VALUE')=>recordAnswer(a,`RP-${id}` as QuestionId,s,v);
const attach=(a:AssessmentInput,gs:unknown[])=>set(set(a,'F01','HORIZON'),'X06',{goals:gs});
function moduleOnly(gs:unknown[],rs:unknown,L=30000,P=5000) {
  let a:AssessmentInput={asOf:'2026-10-18',answers:[]};
  for(const [id,v] of [['S01','INDIVIDUAL'],['S02','COMPLETE'],['B02',money(L)],['B03',money(P)],['F01','HORIZON']] as const)a=set(a,id,v);
  a=attach(a,gs);return rs?set(a,'X09',rs):a;
}
/** Domain test inputs only. No database, Auth, API, owner or contact adapter. */
export function previewSource(id:PreviewCase):AdvisorSource {
  if(!PREVIEW_CASES.includes(id))throw new Error('UNKNOWN_SYNTHETIC_CASE');
  let a:AssessmentInput=buildFixture('T02');
  if(id.startsWith('T'))a=buildFixture(id);
  if(id==='G01')a=set(attach(buildFixture('T04'),[goal('near')]),'X09',resources(50000,20000,[],[constraint('access','near')]));
  if(id==='G02')a=set(attach(a,[goal('housing',{category:'HOUSING',horizon:field('OVER12_TO36'),target:field(money(30000,'T0','HOUSEHOLD'))})]),'X09',{...resources(10000,8000),minimum:field(money(10000,'T0','HOUSEHOLD')),available:field(money(8000,'T0','HOUSEHOLD'))});
  if(id==='G03')a=set(set(moduleOnly([goal()],resources(15000,10000,[{goalId:'goal-a',amount:field(money(8000))}],[constraint()])),'X10',experience({doubts:field(['ACCESS'])})),'X11',{main:field('RESOURCES_CONSTRAINTS'),futureInvolvement:field('DIRECT')});
  if(id==='G04')a=set(moduleOnly([goal('long',{category:'LONGTERM',horizon:field('OVER36'),nature:field('CONTINUING'),target:state('UNKNOWN')})],resources(25000,10000),40000),'X10',experience({expectations:field(['HIGH_RETURN_NO_RISK_LIQUID'])}));
  if(id==='G05')a=moduleOnly([goal('housing',{category:'HOUSING',target:field(money(10000))}),goal('support',{category:'SUPPORT',rank:field(2)})],resources(15000,15000,[{goalId:'housing',amount:field(money(10000))},{goalId:'support',amount:field(money(8000))}]));
  if(id==='G06'){a={asOf:'2026-10-18',answers:[]};a=set(a,'F01',undefined,'UNKNOWN');a=set(a,'X06',undefined,'UNKNOWN');a=set(a,'X09',undefined,'DECLINED');a=set(a,'X11',{main:field('CLARIFY_GOALS'),futureInvolvement:field('UNDERSTAND_FIRST')});}
  if(id==='G07')a=set(attach(buildFixture('T12'),[goal('long',{horizon:field('OVER36')})]),'X09',{...resources(100000,0,[],[{id:'reserve',kind:'PRESERVE_RESERVE',scope:'GLOBAL',rigidity:field('HARD')},{id:'home',kind:'NO_HOME_BUSINESS',scope:'GLOBAL',rigidity:field('HARD')},{id:'debt',kind:'NO_NEW_DEBT',scope:'GLOBAL',rigidity:field('HARD')}]),collections:{allocations:'UNANSWERED',otherResources:'VALUE',constraints:'VALUE'},otherResources:[{goalId:'long',asset:'FINANCIAL'}]});
  if(id==='G08')a=set(set(set(attach(buildFixture('T01'),[goal('reserve',{category:'RESERVE'})]),'X09',resources(8000,1000,[{goalId:'reserve',amount:field(money(1000))}])),'X10',experience()),'X11',{main:field('RESOURCES_CONSTRAINTS'),futureInvolvement:field('DIRECT')});
  if(id==='RECONFIRM')a=set(a,'S01','INDIVIDUAL');
  if(id==='INACTIVE')a=set(a,'C01',{kinds:['NONE']});
  if(id==='LEGACY')a=recordAnswer(set(a,'F01','HORIZON'),'RP-X06','VALUE',{category:'HOUSING',horizon:field({months:18}),target:state('UNKNOWN')},1);
  const index=PREVIEW_CASES.indexOf(id)+1,suffix=String(index).padStart(12,'0'),result=diagnose(a);
  const assessmentId=`00000000-0000-4000-8000-${suffix}`;
  return {personId:'11111111-1111-4111-8111-111111111111',assessmentId,approvedInput:a,snapshot:{id:`22222222-2222-4222-8222-${suffix}`,assessmentId,approvedRevision:a.answers.length,versions:result.versions,inputHash:contentHash(a),resultHash:contentHash(result),result,answerRefs:a.answers.map(({id,revision,questionVersion,asOf})=>({id,revision,questionVersion,asOf})),completedAt:'2026-10-18T12:00:00.000Z'}};
}
