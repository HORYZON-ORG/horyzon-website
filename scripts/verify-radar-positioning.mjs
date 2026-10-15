import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { radarSteps, calculateRadarScores, isRadarComplete } from '../src/lib/radar/domain.ts';
import { createMemoryRadarPersistence } from '../src/lib/radar/persistence/adapter.ts';
import { buildRadarReport } from '../src/lib/radar/report.ts';
import { mergeAdvice } from '../src/lib/radar/advice.ts';

const key = 'marketing#posizionamento';
const steps = radarSteps();
const step = steps.find((s) => s.id === key);
assert.equal(step?.kind, 'POSITIONING', 'marketing asks for positioning and its explanation together');
assert.equal(step.areaId, 'marketing');
assert.equal(steps[steps.indexOf(step) + 1].areaId, 'risorse-umane');
for (const [version, count] of [['radar-v1', 30], ['radar-v2', 32], ['radar-v3', 33]]) {
  assert.equal(radarSteps(version).length, count);
  assert.equal(radarSteps(version).some((s) => s.id === key), false);
}
const value = { rating: 2, description: 'Ci riconoscono per la puntualità delle consegne.' };
assert.deepEqual(calculateRadarScores({ [key]: value }), calculateRadarScores({}), 'qualitative positioning does not alter the existing score formula');
const store = createMemoryRadarPersistence();
const session = await store.createAssessment({ aziendaNome: 'Test', referenteNome: 'Ada', referenteEmail: 'ada@example.com', referenteTelefono: '3000000000', settore: 'Servizi', volumeAffari: '', numeroDipendenti: '1-5', seasonal: false });
const ownership = { assessmentId: session.id, ownerSecretHash: session.ownerSecretHash };
for (const invalid of [3, 'test', [2], {}, { rating: 0, description: 'test' }, { rating: 6, description: 'test' }, { rating: 2.5, description: 'test' }, { rating: 3, description: '   ' }, { rating: 3, description: 'x'.repeat(2001) }]) {
  await assert.rejects(() => store.saveAnswer({ ...ownership, answerKey: key, value: invalid, expectedRevision: 0, currentStep: 21 }), /positioning/i);
}
await store.saveAnswer({ ...ownership, answerKey: key, value, expectedRevision: 0, currentStep: 21 });
assert.deepEqual((await store.resumeAssessment(ownership)).answers[key], value);
const complete = Object.fromEntries(steps.map((s) => [s.id, s.kind === 'POSITIONING' ? value : s.kind === 'OWNER_HOURS' ? [0, 60, 0] : s.kind === 'COMPANY_PROFIT' ? [0, 30000] : ['OWNER_SALARY', 'PARTNERS'].includes(s.kind) ? [0] : s.kind === 'AI_MULTI' ? [0] : 3]));
assert.equal(isRadarComplete(complete), true);
assert.equal(isRadarComplete({ ...complete, [key]: { rating: 3, description: '' } }), false);
const context = { aziendaNome: 'Test', referenteNome: 'Ada', settore: 'Servizi', numeroDipendenti: '1-5', volumeAffari: '', completedAt: null };
const report = buildRadarReport({ scores: calculateRadarScores(complete), answers: complete, advice: mergeAdvice([]), context });
assert.deepEqual(report.positioning, value);
assert.equal(buildRadarReport({ scores: calculateRadarScores({}), answers: {}, advice: mergeAdvice([]), context }).positioning, null);
assert.doesNotMatch(JSON.stringify(report), /"action":/, 'the shared report contains diagnosis only, including database advice overrides');
for (const file of ['src/components/radar/radar-result.tsx', 'src/lib/radar/report-pdf.tsx']) {
  assert.doesNotMatch(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), /\.action\b|Da fare|Prossimi 90 giorni|lavora sulla crescita/);
}
console.log('Radar positioning and diagnosis-only report verifier passed');
