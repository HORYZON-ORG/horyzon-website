import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Annunci10xAiError } from '../src/lib/annunci-10x/ai/errors.ts';
import { evaluateCheckupPair } from '../src/lib/annunci-10x/checkup-comparison.ts';
import { randomUUID } from 'node:crypto';
import { MemoryAnnunci10xPersistenceAdapter, MockAnnunci10xProvider, createAnonymousAnalyzeSession } from '../src/lib/annunci-10x/index.ts';
import { buildCheckupRoleCard } from '../src/lib/annunci-10x/checkup-facts.ts';
import { checkupSourceUnits, checkupLiteralIssues } from '../src/lib/annunci-10x/checkup-source.ts';
import { checkFullRewriteIssues, fullAuditIssues, fullRewriteChange } from '../src/lib/annunci-10x/checkup-editor.ts';
import { checkupCoverageIssues, composeCheckupSections, generateFaithfulCheckupMaster } from '../src/lib/annunci-10x/checkup-writer.ts';
import { checkupEvaluationInput, normalizeCheckupEvaluation } from '../src/lib/annunci-10x/checkup-evaluation.ts';
import { selectCheckupRecommendation, buildCheckupImprovementPlan } from '../src/lib/annunci-10x/checkup-improvements.ts';
import { buildAnnunci10xScoreReport } from '../src/lib/annunci-10x/score-report-email.ts';

const source = `Saldatore esperto — azienda di impianti alimentari
Monza (MB)
Principali responsabilità:
Saldatura TIG e MIG-MAG secondo WPS e ISO 9606-1.
Requisiti:
Esperienza di 5–7 anni; patente B.
Requisiti preferenziali:
Diploma tecnico.
Cosa offriamo:
Contratto a tempo indeterminato, RAL tipicamente 35.000 €.
Mensa e formazione per il rinnovo delle certificazioni.
Alloggio gratuito per i primi 4 mesi soltanto a chi proviene da altre regioni.
Sede di lavoro: in presenza
Sede: Monza, via Milano.
Candidatura:
Invia il CV a [indirizzo email].`;
const card = buildCheckupRoleCard(source, { extractedFacts: [], possibleConflicts: [] });
assert.equal(card.compensation.visibility.value, 'PUBLIC');
assert.match(card.compensation.amountText.value, /35.000/);
assert.match(card.attractionContext.location.value, /Monza, via Milano/);
assert.equal(card.requirements.find(r => /Diploma/.test(r.label.value)).classification, 'PREFERRED');
assert.equal(card.requirements.find(r => /patente/.test(r.label.value)).classification, 'REQUIRED');
assert.match(card.responsibilities[0].value, /WPS e ISO/);
assert.ok(card.attractionContext.attractivenessEvidence.some(f => /Alloggio.*soltanto/.test(f.value)));
const mixed = buildCheckupRoleCard('Tecnico\nRequisiti:\nPregressa esperienza in contesti produttivi (preferibilmente almeno 5 anni)\nResidenza in Lombardia: non saranno considerate persone fuori regione. Preferenza Milano.\nPreferibile esperienza nel settore.', { extractedFacts: [], possibleConflicts: [] });
assert.equal(mixed.requirements.find(r => /contesti produttivi/.test(r.label.value)).classification, 'REQUIRED');
assert.equal(mixed.requirements.find(r => /Residenza in Lombardia/.test(r.label.value)).classification, 'REQUIRED');
assert.equal(mixed.requirements.find(r => /Preferibile esperienza/.test(r.label.value)).classification, 'PREFERRED');
const sector = buildCheckupRoleCard('Commerciale\nRequisiti:\nConoscenza del tessuto imprenditoriale lombardo (costituirà titolo preferenziale la provenienza dai settori parquet, legno, edilizia).\nTitolo di studio: diploma tecnico (costituirà titolo preferenziale).', { extractedFacts: [], possibleConflicts: [] });
assert.equal(sector.requirements.find(r => /Conoscenza del tessuto/.test(r.label.value)).classification, 'REQUIRED');
assert.equal(sector.requirements.find(r => /Titolo di studio/.test(r.label.value)).classification, 'PREFERRED');
const metadataScope=checkupSourceUnits('Tecnico\nSede di lavoro: In presenza\nAzienda di piccole dimensioni.\nCompetenze richieste\nProgrammazione FANUC.\nRetribuzione: 1800 euro al mese');
assert.equal(metadataScope.find(u=>u.text==='Azienda di piccole dimensioni.').area,'CONTEXT');
assert.equal(metadataScope.find(u=>u.text==='Programmazione FANUC.').area,'REQUIRED');
assert.equal(metadataScope.find(u=>u.text.startsWith('Retribuzione:')).heading,undefined);
const units = checkupSourceUnits(source);
const proposal = { strategy: { qualification: 'qualificato', rhythm: 'UNKNOWN', popularity: 'UNKNOWN', technicality: 'specialistico' }, opening: [
  { text: 'Sai saldare secondo WPS e ISO 9606-1?', sourceIds: [units.find(u=>/Saldatura TIG/.test(u.text)).id] },
  { text: 'Trovi mensa e formazione per il rinnovo delle certificazioni.', sourceIds: [units.find(u=>/Mensa/.test(u.text)).id] },
], order: [...units.map(u=>u.id)].reverse() };
const composed = composeCheckupSections(source,proposal);
assert.deepEqual(checkupCoverageIssues(source,composed),[]);
for (const u of units) assert.ok(composed.some(s=>s.sourceFactIds.includes(u.id)&&s.body.includes(u.text)),u.text);
assert.ok(composed.some(s=>s.title==='Requisiti preferenziali'&&s.body.includes('Diploma tecnico.')));
assert.ok(checkupCoverageIssues(source,composed.filter(s=>!s.body.includes('5–7'))).length);
assert.ok(checkupLiteralIssues(source, source.replace('35.000', '40.000')).length >= 2);
assert.ok(checkupLiteralIssues(source, source + '\nInvia a nuovo@example.com').some(s => /non autorizzata/.test(s)));
assert.ok(checkupLiteralIssues('Commerciale. Sede Milano. Tempo pieno.', 'Commerciale. Sede Milano. Tempo pieno in sede.').some(s => /Modalità di lavoro/.test(s)));
assert.deepEqual(checkupLiteralIssues('Commerciale. Sede Milano. Tempo pieno in presenza.', 'Commerciale. Sede Milano. Tempo pieno in sede.'), []);

const input = checkupEvaluationInput({ target: { text: source, channel: 'CUSTOM', structuredFields: { artificial: true }, channelPolicy: null }, context: {} }, source);
assert.equal(input.target.channel, null);
assert.equal(input.target.structuredFields, null);
const checks = ['10','16','17','20'].map(id => ({ id, score: 10, status: 'EVALUATED', reason: '', evidence: [], missing: [], confidence: 90 }));
const normalized = normalizeCheckupEvaluation(input, { checks });
assert.deepEqual(normalized.checks.filter(c => ['16','17'].includes(c.id)).map(c => c.score), [null,null]);
assert.equal(normalized.checks.find(c => c.id === '20').score, 2);
const noCta = checkupEvaluationInput({ ...input, target: { ...input.target, text: 'Tornitore CNC. Contratto a tempo indeterminato.' } }, 'Tornitore CNC. Contratto a tempo indeterminato.');
assert.equal(normalizeCheckupEvaluation(noCta, { checks }).checks.find(c => c.id === '20').status, 'NOT_EVALUABLE');
for (const text of ['I dettagli saranno approfonditi in colloquio per i candidati selezionati.', 'La ricerca è rivolta a candidati nel rispetto della normativa.']) {
  const outsideApplication = checkupEvaluationInput({ ...input, target: { ...input.target, text } }, text);
  assert.equal(outsideApplication.context.checkupProtocol.applicationExpected, false, 'mentioning candidates is not an application instruction');
}
assert.equal(checkupEvaluationInput({ ...input, target: { ...input.target, text: 'Invia il CV aggiornato.' } }, 'Invia il CV aggiornato.').context.checkupProtocol.applicationExpected, true);
assert.equal(checkupEvaluationInput({ ...input, target: { ...input.target, text: 'Tecnico a Milano. Candidatura via email con CV.' } }, 'Tecnico a Milano. Candidatura via email con CV.').context.checkupProtocol.applicationExpected, true);
assert.equal(normalizeCheckupEvaluation({ ...input, context: {} }, { checks }).checks.find(c => c.id === '20').score, 10, 'unrelated flows retain their existing protocol');
const report = score => ({ score, checks: normalized.checks.map(c => ({ ...c, checkId: c.id, label: c.id, score: c.id === '10' ? 2 : c.score })) });
assert.equal(buildCheckupImprovementPlan(report(60), report(80)).priorities[0].checkId, '20');
const rejected = selectCheckupRecommendation(source, 'Unfaithful rewrite', report(60), report(90), { status: 'ORIGINAL_RETAINED' });
assert.equal(rejected.text, source);
assert.equal(rejected.selection.evaluatedRewriteScore, null);
const reasonChecks = Array.from({length:20}, (_,i) => ({ id:String(i+1).padStart(2,'0'), score:2, status:'EVALUATED', reason:'Le attività di assistenza elettromeccanica non sono dettagliate.', evidence:[],missing:[],confidence:80 }));
const reasonArgs = { lead:null, analysisRun:{id:'reason-test'}, evaluation:{score:{value:20,band:null,coverage:100,evaluableCheckCount:20,checks:reasonChecks}}, snapshot:null };
const specificReport = buildAnnunci10xScoreReport({...reasonArgs,useEvaluationReasons:true});
assert.match(specificReport.checks.find(c=>c.checkId==='03').reason,/assistenza elettromeccanica/);
assert.doesNotMatch(specificReport.checks.find(c=>c.checkId==='03').reason,/CRM|gestione clienti/);
assert.deepEqual(specificReport.checks.map(c=>c.score),reasonChecks.map(c=>c.score));
assert.match(buildAnnunci10xScoreReport(reasonArgs).checks.find(c=>c.checkId==='03').reason,/CRM/, 'legacy presentation remains separate from the check-up-specific reasons');

// Full rewriting, not just an introduction: fixtures are deliberately simulated.
const rewritten = {strategy:proposal.strategy,sections:[
 {type:'TITLE',title:'Posizione',body:'Saldatore esperto per un’azienda di impianti alimentari',sourceIds:[units[0].id]},
 {type:'OPENING',title:'Il lavoro, in breve',body:units.slice(1).map(u=>u.text==='Saldatura TIG e MIG-MAG secondo WPS e ISO 9606-1.'?'Esegui saldature TIG e MIG-MAG rispettando WPS e ISO 9606-1.':u.text==='Mensa e formazione per il rinnovo delle certificazioni.'?'La mensa è prevista; la formazione sostiene il rinnovo delle certificazioni.':u.text).join('\n'),sourceIds:units.slice(1).map(u=>u.id)},
]};
assert.deepEqual(checkFullRewriteIssues(source,rewritten),[]);
assert.ok(fullRewriteChange(source,rewritten).ratio>=0.5);
const auditFor = r => ({checks:units.map(u=>({sourceId:u.id,status:'PRESERVED',evidence:[r.sections.find(s=>s.sourceIds.includes(u.id)).body],reason:'Simulated faithful paraphrase.'})),addedClaims:[]});
assert.deepEqual(fullAuditIssues(source,rewritten,auditFor(rewritten)),[]);
const copyOnly={...rewritten,sections:[{type:'TITLE',title:'Posizione',body:units[0].text,sourceIds:[units[0].id]},{...rewritten.sections[1],body:source}]};
assert.ok(checkFullRewriteIssues(source,copyOnly).some(s=>s.includes('maggioranza')),'a new introduction plus copied body is not a full rewrite');
assert.ok(checkFullRewriteIssues(source,{...rewritten,sections:rewritten.sections.map(s=>({...s,body:s.body.replace('35.000','40.000')}))}).some(s=>s.includes('Numero')));
const fakeEvidence=auditFor(rewritten);fakeEvidence.checks[0].evidence=['A phrase never written'];assert.ok(fullAuditIssues(source,rewritten,fakeEvidence).some(s=>s.includes('rintracciabile')));
const missingAudit=auditFor(rewritten);missingAudit.checks.pop();assert.ok(fullAuditIssues(source,rewritten,missingAudit).some(s=>s.includes('mancante')));
for(const mode of ['repair','reject','provider-failure']){
 const persistence=new MemoryAnnunci10xPersistenceAdapter(),provider=new MockAnnunci10xProvider(),context={persistence,provider,configuredProvider:'MOCK'};
 const created=await createAnonymousAnalyzeSession(context),session={sessionId:created.session.id,sessionSecret:created.sessionSecret};
 const snapshot=await persistence.appendSnapshot({...session,roleCard:card,reason:'INITIAL_EXTRACTION'}),baseExecute=provider.executeStructuredTask.bind(provider);
 let writes=0,audits=0;
 provider.executeStructuredTask=async request=>{
  if(mode==='provider-failure')throw Error('Simulated provider failure');
  const result=await baseExecute(request);
  if(request.outputSchemaName==='annunci10x_checkup_full_rewrite'){
   writes++;assert.equal(request.input.checkupSource.originalText,source);if(writes===2)assert.ok(request.input.checkupSource.previousIssues.length);
   return {...result,output:rewritten};
  }
  if(request.outputSchemaName==='annunci10x_checkup_full_audit'){
   audits++;const audit=auditFor(rewritten);if(mode==='reject'||audits===1)audit.checks[1]={...audit.checks[1],status:'MISSING',reason:'Simulated missing material detail'};
   return {...result,output:audit};
  }
  return result;
 };
 const args={context,...session,snapshot,analysisRunId:randomUUID(),originalText:source};
 const result=await generateFaithfulCheckupMaster(args);
 assert.equal(result.quality.status,mode==='repair'?'VERIFIED':'ORIGINAL_RETAINED');assert.equal(result.quality.attempts,mode==='provider-failure'?1:2);
 await persistence.saveOutput({...session,snapshotId:snapshot.id,outputType:'MASTER',generatedContent:{...result.master,checkupQuality:result.quality},validationState:result.quality.status==='VERIFIED'?'READY':'READY_WITH_WARNINGS'});
 if(mode==='repair'){
  assert.equal(result.quality.mode,'FULL_REWRITE');assert.equal(result.quality.coverage.retained,units.length);
  await generateFaithfulCheckupMaster(args);assert.equal(writes,2);assert.equal(audits,2,'successful operations reused on reopening');
 }else assert.equal(result.master.sections[0].body,source,'an unverified rewrite cannot replace the original');
}
// Prove that every frozen benchmark fact survives arbitrary model ordering.
for (let n=1;n<=10;n++) {
  const text=readFileSync(new URL(`../../.work/benchmark-annunci-reali-2026-11-26/fonti/${String(n).padStart(2,'0')}-valutato.txt`,import.meta.url),'utf8');
  const frozen=checkupSourceUnits(text);
  const sections=composeCheckupSections(text,{...proposal,order:frozen.map(u=>u.id).reverse()},false);
  assert.deepEqual(checkupCoverageIssues(text,sections),[],`frozen ad ${n}`);
  const headings=sections.map(s=>s.type+':'+s.title);assert.equal(new Set(headings).size,headings.length,'no repeated editorial sections');
  assert.deepEqual(checkupLiteralIssues(text,sections.map(s=>s.title+'\n'+s.body).join('\n')),[],`frozen literals ${n}`);
}
// Paired grading uses one persisted operation; label order cannot decide which is the original.
{
  const persistence=new MemoryAnnunci10xPersistenceAdapter(),provider=new MockAnnunci10xProvider();
  const context={persistence,provider,configuredProvider:'MOCK'};
  const created=await createAnonymousAnalyzeSession(context);
  const session={sessionId:created.session.id,sessionSecret:created.sessionSecret};
  const snapshot=await persistence.appendSnapshot({...session,roleCard:card,reason:'INITIAL_EXTRACTION'});
  const execute=provider.executeStructuredTask.bind(provider);
  provider.executeStructuredTask=async request=>{
    const r=await execute(request);
    const checks=value=>({checks:Array.from({length:20},(_,i)=>({id:String(i+1).padStart(2,'0'),score:value,status:'EVALUATED',reason:'Concrete paired evidence.',evidence:[],missing:[],confidence:90}))});
    return {...r,output:{a:checks(4),b:checks(7)}};
  };
  for (let n=0;n<4;n++) {
    const args={context,...session,snapshotId:snapshot.id,analysisRunId:randomUUID(),originalText:source,revisedText:source+'\nTesto confronto',strategy:proposal.strategy};
    const result=await evaluateCheckupPair(args);
    assert.equal(result.originalScore.checks[0].score,result.originalLabel==='a'?4:7);
    assert.equal(result.revisedScore.checks[0].score,result.originalLabel==='a'?7:4);
    assert.deepEqual(result.originalScore.checks.filter(c=>['16','17'].includes(c.id)).map(c=>c.score),[null,null]);
    assert.equal(result.originalScore.checks.find(c=>c.id==='20').score,2);
    const calls=provider.calls.length;await evaluateCheckupPair(args);assert.equal(provider.calls.length,calls);
  }
}
// A failed comparison can be explicitly retried, while every successful attempt is cached.
{
 const persistence=new MemoryAnnunci10xPersistenceAdapter(),provider=new MockAnnunci10xProvider();
 const context={persistence,provider,configuredProvider:'MOCK'};
 const created=await createAnonymousAnalyzeSession(context),session={sessionId:created.session.id,sessionSecret:created.sessionSecret};
 const snapshot=await persistence.appendSnapshot({...session,roleCard:card,reason:'INITIAL_EXTRACTION'});
 const execute=provider.executeStructuredTask.bind(provider);let fails=true;
 provider.executeStructuredTask=async request=>{if(fails)throw new Annunci10xAiError('AI_PROVIDER_ERROR','Simulated transient failure');return execute(request);};
 const args={context,...session,snapshotId:snapshot.id,analysisRunId:randomUUID(),originalText:source,revisedText:source+'\nConfronto',strategy:proposal.strategy};
 await assert.rejects(()=>evaluateCheckupPair(args));fails=false;
 await assert.rejects(()=>evaluateCheckupPair(args),'failure stays closed without explicit retry');
 await evaluateCheckupPair({...args,retryFailedOperations:1});const calls=provider.calls.length;
 await evaluateCheckupPair({...args,retryFailedOperations:2});assert.equal(provider.calls.length,calls,'third request reuses the successful second attempt');
}
console.log('PASS: Performia source fidelity, required/preferred, pay/benefits/technical facts, stable N/D and CTA, semantic repair, safe fallback and AI deduplication (MOCK).');
