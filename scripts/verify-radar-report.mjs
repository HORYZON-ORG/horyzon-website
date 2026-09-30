import assert from 'node:assert/strict';
import { ADVICE_BANDS, DEFAULT_RADAR_ADVICE, answerBand, mergeAdvice, scoreBand } from '../src/lib/radar/advice.ts';
import { RADAR_AREAS, calculateRadarScores } from '../src/lib/radar/domain.ts';
import { buildRadarReport } from '../src/lib/radar/report.ts';

// Every question, department and index has a text for each band, and nothing is left empty.
for (const area of RADAR_AREAS) for (let i = 0; i < area.questions.length; i++) for (const band of ADVICE_BANDS)
  assert.ok(DEFAULT_RADAR_ADVICE.some((a) => a.kind === 'question' && a.subject === `${area.id}#${i}` && a.band === band), `missing advice ${area.id}#${i} ${band}`);
for (const kind of ['area', 'autonomy', 'ai', 'economics', 'global']) assert.ok(DEFAULT_RADAR_ADVICE.filter((a) => a.kind === kind).length >= 3, `missing ${kind} readings`);
for (const advice of DEFAULT_RADAR_ADVICE) assert.ok(advice.title && advice.body && advice.action, `empty advice ${advice.kind}:${advice.subject}:${advice.band}`);
assert.equal(new Set(DEFAULT_RADAR_ADVICE.map((a) => `${a.kind}:${a.subject}:${a.band}`)).size, DEFAULT_RADAR_ADVICE.length, 'duplicate advice keys');

assert.deepEqual([1, 2, 3, 4, 5].map(answerBand), ['critico', 'critico', 'da_consolidare', 'solido', 'solido']);
assert.deepEqual([0, 39, 40, 69, 70, 100].map(scoreBand), ['critico', 'critico', 'da_consolidare', 'da_consolidare', 'solido', 'solido']);

// Database rows override defaults; empty fields keep the default text.
const merged = mergeAdvice([{ kind: 'question', subject: 'commerciale#4', band: 'critico', title: 'Titolo dal database', body: '', action: null }]);
assert.equal(merged.get('question:commerciale#4:critico').title, 'Titolo dal database');
assert.ok(merged.get('question:commerciale#4:critico').body.length > 10);

// A company strong in administration, weak in sales, dependent on the owner.
const answers = { 'qualificazione#stagionale': 1, 'ai#uso': 2, 'ai#leva': 4, 'ai#pronti': 2, 'ai#casoUso': [0, 3] };
for (const area of RADAR_AREAS) for (let i = 0; i < 5; i++) answers[`${area.id}#${i}`] = area.id === 'amministrazione' ? 5 : area.id === 'commerciale' ? 1 : i === 4 ? 2 : 3;
const report = buildRadarReport({ scores: calculateRadarScores(answers), answers, advice: mergeAdvice([]), context: { aziendaNome: 'Acme', referenteNome: 'Ada Rossi', settore: 'Servizi', numeroDipendenti: '6-20', volumeAffari: '', completedAt: null }, now: new Date('2026-10-01T09:00:00Z') });
assert.equal(report.areas.length, 5);
assert.equal(report.areas.find((a) => a.id === 'amministrazione').band, 'solido');
assert.equal(report.areas.find((a) => a.id === 'amministrazione').gaps.length, 0);
assert.equal(report.areas.find((a) => a.id === 'commerciale').gaps.length, 5);
assert.equal(report.weakest.label, 'Commerciale');
assert.equal(report.priorities.length, 3);
assert.equal(report.priorities[0].area, 'Commerciale', 'the weakest department leads the priorities');
assert.equal(new Set(report.priorities.map((p) => p.area)).size, 3, 'priorities spread over three departments');
assert.deepEqual(report.ai.uses, ['Contenuti e marketing', 'Analisi dati e decisioni']);
assert.equal(report.seasonal, true);
assert.equal(report.economics, null);
assert.ok(report.global.reading.title && report.autonomy.gapReading);

console.log('Paid Radar report verifier passed');
