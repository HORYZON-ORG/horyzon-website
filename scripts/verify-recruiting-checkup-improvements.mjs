import assert from 'node:assert/strict';
import { meanCheckupReport, buildCheckupImprovementPlan } from '../src/lib/annunci-10x/checkup-improvements.ts';

const ids = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0'));
function report(classification = 2) {
  return {
    analysisRunId: 'synthetic', roleTitle: 'Customer care', score: 69, band: 'Debole', coverage: 95, evaluableCheckCount: 19,
    areaScores: [], priorities: [], interpretation: 'Legacy capped interpretation',
    checks: ids.map(checkId => ({ checkId, label: checkId === '10' ? 'Classificazione dei requisiti' : `Criterio ${checkId}`,
      score: checkId === '16' ? null : checkId === '10' ? classification : ['01', '12', '13', '14', '17'].includes(checkId) ? 10 : 8,
      status: checkId === '16' ? 'NOT_EVALUABLE' : 'EVALUATED', statusLabel: '', reason: 'Dato da precisare.', improvement: 'Approfondire.' })),
  };
}
const original = report();
const snapshot = structuredClone(original);
const before = meanCheckupReport(original);
const after = meanCheckupReport(report(4));
assert.ok(Math.abs(before.score - 82.10526315789474) < 1e-9);
assert.ok(Math.abs(after.score - 83.15789473684211) < 1e-9);
assert.equal(before.band, 'Buona base');
assert.deepEqual(original, snapshot, 'new check-up scores must not mutate saved legacy evaluations');
const plan = buildCheckupImprovementPlan(before, after);
assert.equal(plan.priorities.length, 3);
assert.equal(plan.priorities[0].checkId, '10');
assert.equal(plan.priorities.some(p => p.checkId === '14'), false, 'do not ask again for compensation already scored complete');
assert.match(plan.priorities[0].questions.join(' '), /primo giorno/);
assert.match(plan.priorities[0].draft, /Indispensabili: \[requisiti confermati\]/);
assert.match(plan.summary, /base buona/);
assert.match(plan.nextStep, /contenuti aggiunti/);

const missing = report();
for (const c of missing.checks) if (['13', '14'].includes(c.checkId)) { c.score = 0; c.status = 'MISSING'; }
const missingPlan = buildCheckupImprovementPlan(meanCheckupReport(missing), meanCheckupReport(missing));
assert.deepEqual(missingPlan.priorities.map(p => p.checkId), ['14', '13', '10']);
assert.match(missingPlan.priorities[0].questions.join(' '), /lordo o netto/);
assert.match(missingPlan.priorities[1].questions.join(' '), /orario e turni/);
assert.doesNotMatch(JSON.stringify(missingPlan), /26\.000|35\.000|almeno due punti|\+2 punti/);

const complete = report();
complete.checks.forEach(c => { c.score = 10; c.status = 'EVALUATED'; });
assert.equal(meanCheckupReport(complete).score, 100, 'no hidden readiness ceiling in the check-up mean');
assert.equal(buildCheckupImprovementPlan(meanCheckupReport(complete), meanCheckupReport(complete)).priorities.length, 0, 'do not invent gaps for a complete ad');
complete.checks.forEach(c => { c.score = null; c.status = 'NOT_EVALUABLE'; });
assert.equal(meanCheckupReport(complete).score, null);
assert.equal(buildCheckupImprovementPlan(meanCheckupReport(complete), meanCheckupReport(complete)).priorities.length, 0);
console.log('PASS: uncapped check-up mean, N/D excluded, unchanged saved scores, tailored actions, no invented gaps or fixed uplift.');
