import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MemoryAnnunci10xPersistenceAdapter, MockAnnunci10xProvider, createAnonymousAnalyzeSession } from '../src/lib/annunci-10x/index.ts';
import { buildCheckupRoleCard } from '../src/lib/annunci-10x/checkup-facts.ts';
import { checkupSourceUnits, checkupLiteralIssues } from '../src/lib/annunci-10x/checkup-source.ts';
import { checkupCoverageIssues, generateFaithfulCheckupMaster } from '../src/lib/annunci-10x/checkup-writer.ts';
import { checkupEvaluationInput, normalizeCheckupEvaluation } from '../src/lib/annunci-10x/checkup-evaluation.ts';
import { selectCheckupRecommendation, buildCheckupImprovementPlan } from '../src/lib/annunci-10x/checkup-improvements.ts';

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
const units = checkupSourceUnits(source);
const proposal = { strategy: { qualification: 'qualificato', rhythm: 'UNKNOWN', popularity: 'UNKNOWN', technicality: 'specialistico' }, sections: [
  { type: 'TITLE', title: '', body: 'Saldatore esperto', sourceIds: [] },
  { type: 'OPENING', title: '', body: source, sourceIds: units.map(u => u.id) },
] };
assert.deepEqual(checkupCoverageIssues(source, proposal), []);
assert.ok(checkupLiteralIssues(source, source.replace('35.000', '40.000')).length >= 2);
assert.ok(checkupLiteralIssues(source, source + '\nInvia a nuovo@example.com').some(s => /non autorizzata/.test(s)));
assert.ok(checkupCoverageIssues(source, { ...proposal, sections: proposal.sections.map(s => ({ ...s, sourceIds: [] })) }).some(s => /non coperta/.test(s)));
assert.ok(checkupCoverageIssues(source, { ...proposal, sections: [{ ...proposal.sections[0], title: 'Bonus 9999' }, proposal.sections[1]] }).some(s => /9999/.test(s)));

const input = checkupEvaluationInput({ target: { text: source, channel: 'CUSTOM', structuredFields: { artificial: true }, channelPolicy: null }, context: {} }, source);
assert.equal(input.target.channel, null);
assert.equal(input.target.structuredFields, null);
const checks = ['10','16','17','20'].map(id => ({ id, score: 10, status: 'EVALUATED', reason: '', evidence: [], missing: [], confidence: 90 }));
const normalized = normalizeCheckupEvaluation(input, { checks });
assert.deepEqual(normalized.checks.filter(c => ['16','17'].includes(c.id)).map(c => c.score), [null,null]);
assert.equal(normalized.checks.find(c => c.id === '20').score, 2);
const noCta = checkupEvaluationInput({ ...input, target: { ...input.target, text: 'Tornitore CNC. Contratto a tempo indeterminato.' } }, 'Tornitore CNC. Contratto a tempo indeterminato.');
assert.equal(normalizeCheckupEvaluation(noCta, { checks }).checks.find(c => c.id === '20').status, 'NOT_EVALUABLE');
assert.equal(normalizeCheckupEvaluation({ ...input, context: {} }, { checks }).checks.find(c => c.id === '20').score, 10, 'unrelated flows retain their existing protocol');
const report = score => ({ score, checks: normalized.checks.map(c => ({ ...c, checkId: c.id, label: c.id, score: c.id === '10' ? 2 : c.score })) });
assert.equal(buildCheckupImprovementPlan(report(60), report(80)).priorities[0].checkId, '20');
const rejected = selectCheckupRecommendation(source, 'Unfaithful rewrite', report(60), report(90), { status: 'ORIGINAL_RETAINED' });
assert.equal(rejected.text, source);
assert.equal(rejected.selection.evaluatedRewriteScore, null);

// These are deliberately simulated provider/audit responses, not real model tests.
for (const mode of ['repair', 'reject', 'provider-failure']) {
  const persistence = new MemoryAnnunci10xPersistenceAdapter();
  const provider = new MockAnnunci10xProvider();
  const context = { persistence, provider, configuredProvider: 'MOCK' };
  const created = await createAnonymousAnalyzeSession(context);
  const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  const snapshot = await persistence.appendSnapshot({ ...session, roleCard: card, reason: 'INITIAL_EXTRACTION' });
  const baseExecute = provider.executeStructuredTask.bind(provider);
  let writes = 0, audits = 0;
  provider.executeStructuredTask = async request => {
    if (mode === 'provider-failure') throw Error('Simulated provider failure');
    const result = await baseExecute(request);
    if (request.outputSchemaName === 'annunci10x_checkup_rewrite') {
      writes++;
      assert.equal(request.input.checkupSource.originalText, source);
      if (writes === 2) assert.ok(request.input.checkupSource.previousIssues.length);
      return { ...result, output: proposal };
    }
    if (request.outputSchemaName === 'annunci10x_checkup_source_audit') {
      audits++;
      return { ...result, output: { issues: mode === 'reject' || audits === 1 ? [{ sourceId: units[0].id, reason: 'Simulated semantic omission' }] : [] } };
    }
    return result;
  };
  const args = { context, ...session, snapshot, analysisRunId: randomUUID(), originalText: source };
  const result = await generateFaithfulCheckupMaster(args);
  assert.equal(result.quality.status, mode === 'repair' ? 'VERIFIED' : 'ORIGINAL_RETAINED');
  assert.equal(result.quality.attempts, mode === 'provider-failure' ? 1 : 2);
  const persisted = await persistence.saveOutput({ ...session, snapshotId: snapshot.id, outputType: 'MASTER', generatedContent: { ...result.master, checkupQuality: result.quality }, validationState: result.quality.status === 'VERIFIED' ? 'READY' : 'READY_WITH_WARNINGS' });
  assert.ok(persisted.id, 'verified and fallback masters must both satisfy the real persistence validator, including empty writer headings');
  if (mode !== 'repair') assert.equal(result.master.sections[0].body, source);
  if (mode === 'repair') {
    const repeated = await generateFaithfulCheckupMaster(args);
    assert.equal(repeated.quality.status, 'VERIFIED');
    assert.equal(writes, 2, 'reopening uses persisted operations, no duplicate AI generation');
    assert.equal(audits, 2);
  }
}
console.log('PASS: Performia source fidelity, required/preferred, pay/benefits/technical facts, stable N/D and CTA, semantic repair, safe fallback and AI deduplication (MOCK).');
