import type { AnswerRef, QuestionId } from '../patrimonial-radar/types.ts';
import { contentHash, canonical, validUuid } from '../patrimonial-radar-server/security.ts';
import { label } from '../patrimonial-radar-ui/presentation.ts';
import type { AgendaItem, AdvisorResultProjection, AdvisorSource } from './contracts.ts';
/** No diagnostic calls: one stored canonical snapshot, never a second engine. */
export function advisorProjection(source:AdvisorSource):AdvisorResultProjection {
  if(typeof window!=='undefined') throw new Error('ADVISOR_SERVER_ONLY');
  const {snapshot:s,approvedInput:input}=source,r=s.result;
  const refs=input.answers.map(({id,revision,questionVersion,asOf})=>({id,revision,questionVersion,asOf}));
  if(!validUuid(source.personId)||source.assessmentId!==s.assessmentId||!validUuid(s.assessmentId)||input.asOf!==r.periods.T0||canonical(s.versions)!==canonical(r.versions)||contentHash(input)!==s.inputHash||contentHash(r)!==s.resultHash||canonical(refs)!==canonical(s.answerRefs)) throw new Error('ADVISOR_SOURCE_MISMATCH');
  const same=(a:AnswerRef,b:AnswerRef)=>a.id===b.id&&a.revision===b.revision&&a.questionVersion===b.questionVersion&&a.asOf===b.asOf;
  const agenda:AgendaItem[]=r.interviewQuestions.map((q,i)=>{
    const evidence=r.evidence.filter(e=>e.rule===q.rule&&(e.text===q.text||e.refs.some(a=>q.refs.some(b=>same(a,b)))));
    const declined=q.refs.some(ref=>r.answers.some(a=>a.id===ref.id&&a.state==='DECLINED'));
    return {id:`canonical-${i}`,kind:'HYPOTHESIS_TO_VERIFY',question:declined?`Senza richiedere di nuovo i dati che hai preferito non comunicare, quali limiti vuoi discutere? ${q.text}`:`Quale contesto o chiarimento possiamo aggiungere a questo elemento? ${q.text}`,basis:q.text,sourceRule:q.rule,refs:q.refs,evidenceIds:evidence.map(e=>e.id),indicatorIds:evidence.flatMap(e=>e.indicators),goalIds:q.refs.some(ref=>ref.id==='RP-X06')?r.goals.goals.map(g=>g.id):[]};
  });
  for(const d of r.goals.definitions.filter(d=>d.status==='TO_CLARIFY')) {
    const g=r.goals.goals.find(g=>g.id===d.goalId);if(!g)continue;
    const questions:Record<string,string>={targetContext:'A quale perimetro e data si riferisce l’importo già dichiarato?',categoryDetail:'Quale finalità economica vorresti precisare?',rank:'Quale ordine di priorità vuoi indicare?',horizon:'Quando serviranno per la prima volta queste risorse?',nature:'Si tratta di un’esigenza una tantum o continuativa?',target:'Quale importo dovrà essere disponibile per questa esigenza?'};
    const missing=d.missing.filter(key=>!(key in g) || g[key as keyof typeof g] && typeof g[key as keyof typeof g]==='object' && (g[key as 'rank'].state!=='DECLINED'));
    agenda.push({id:`goal-${g.id}`,kind:'HYPOTHESIS_TO_VERIFY',question:`Per l’obiettivo “${label(g.category)}”: ${missing.map(key=>questions[key]??key).join(' ')||'Quali limiti vuoi discutere senza ripetere i dati che hai preferito non comunicare?'}`,basis:`Dettagli da chiarire: ${d.missing.join(', ')}. ${d.limitation}`,sourceRule:'GOAL-DEFINITION',refs:d.refs,evidenceIds:[],indicatorIds:[],goalIds:[g.id]});
  }
  const ids=(...a:QuestionId[])=>a;
  const texts=(a:string[])=>a.flatMap(id=>r.evidence.filter(e=>e.id===id).map(e=>e.text));
  const p:AdvisorResultProjection={
    projectionVersion:'RP-ADVISOR-4D1-1',general:{personId:source.personId,assessmentId:s.assessmentId,snapshotId:s.id,approvedRevision:s.approvedRevision,completedAt:s.completedAt,status:'COMPLETED',versions:s.versions,periods:r.periods,scope:r.scope,scopeCoverage:r.scopeCoverage,origin:'NOT_VERIFIED',identity:'PERSON_UUID_ONLY',assignment:'NOT_CONNECTED',completeness:r.completeness,quality:r.quality},
    areas:r.areas,indicators:r.indicators,evidence:r.evidence,favorable:r.favorable,vulnerabilities:r.vulnerabilities,priorities:r.priorities,profiles:r.profiles,goals:r.goals,incoherences:r.incoherences,current:r.answers,
    answers:input.answers.map(record=>{const a=r.answers.find(a=>a.id===record.id),h=r.history.find(h=>same(h.ref,record));if(!a||!h)throw new Error('ADVISOR_SOURCE_MISMATCH');return{record,lifecycle:a.lifecycle,disposition:h.disposition,applicability:a.applicability,issues:a.issues,contribution:h.disposition==='SUPERSEDED'?'SUPERSEDED':a.lifecycle!=='ACTIVE'?a.lifecycle:record.state==='VALUE'&&a.value!==undefined&&!a.issues.length?'CURRENT_ACTIVE':'UNAVAILABLE'};}),
    reading:[
      {title:'Qual è la situazione attuale?',basis:'CANONICAL_CALCULATION',texts:[r.profiles.reason,...texts(r.priorities)],questionIds:[],indicatorIds:['I-A01','I-B01','I-E01']},
      {title:'Che cosa vuole ottenere la persona?',basis:r.goals.goals.length?'DECLARED':'UNAVAILABLE',texts:r.goals.goals.length?r.goals.goals.map(g=>`${label(g.category)} · ${g.rank.state==='VALUE'?`priorità ${g.rank.value}`:'priorità non confermata'}`):['Nessun obiettivo utilizzabile dichiarato: non viene dedotta un’esigenza. Consultare lo stato originale di X06 e la finalità X11.'],questionIds:ids('RP-F01','RP-X06','RP-X11'),indicatorIds:[]},
      {title:'Quali risorse e capacità risultano dichiarate?',basis:'DECLARED',texts:['Risorse attuali dichiarate e margine storico sono distinti dalla capacità futura verificata. Le cifre e i limiti sono nelle sezioni economica e obiettivi.'],questionIds:ids('RP-B02','RP-B03','RP-X09'),indicatorIds:['I-A01','I-B01.Lf']},
      {title:'Quali vincoli richiedono attenzione?',basis:r.goals.resources?'DECLARED_AND_CANONICAL':'UNAVAILABLE',texts:r.goals.resources?[...r.goals.resources.constraints.map(c=>`Dichiarato: ${label(c.kind)} · ${c.rigidity.state==='VALUE'?label(c.rigidity.value):'rigidità da chiarire'}`),...r.goals.checks.filter(c=>c.status==='CLARIFY').map(c=>`Confronto canonico: ${c.message}`)]:['Vincoli personali non disponibili: nessuna assenza di vincoli presunta.'],questionIds:ids('RP-X09','RP-X10'),indicatorIds:[]},
      {title:'Quali informazioni dobbiamo approfondire?',basis:'CANONICAL_CALCULATION',texts:[...r.evidence.filter(e=>e.kind==='MISSING').map(e=>e.text),...r.incoherences.map(i=>i.message),...r.goals.missing],questionIds:r.answers.filter(a=>a.lifecycle==='RECONFIRM').map(a=>a.id),indicatorIds:[]},
    ],agenda,futureComparison:{status:'NOT_IMPLEMENTED',catalogVersion:null,recommendations:[],goalIds:r.goals.goals.map(g=>g.id),constraintIds:r.goals.resources?.constraints.map(c=>c.id)??[],requiredInputs:['Obiettivi e primo utilizzo dichiarati','Vincoli e disponibilità dichiarati','Schede delle soluzioni verificate e versionate','Requisiti e verifiche professionali separati']},
  };
  return structuredClone(p);
}
