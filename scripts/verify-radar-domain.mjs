import assert from 'node:assert/strict';
import { calculateRadarScores, radarSteps } from '../src/lib/radar/domain.ts';
import { lockedRadarProjection, unlockedRadarProjection } from '../src/lib/radar/public-projection.ts';

assert.equal(radarSteps().length, 33, 'Radar v3: seasonal step out (asked in the form), salary and partners in');
assert.equal(radarSteps().some((step) => step.id === 'qualificazione#stagionale'), false);
assert.deepEqual(radarSteps().slice(-4).map((step) => step.id), ['economia#ore', 'economia#utile', 'economia#stipendio', 'economia#soci']);
assert.equal(radarSteps('radar-v2').length, 32, 'v2 assessments keep their 32 steps');
assert.equal(radarSteps('radar-v1').length, 30, 'Existing assessments retain their original steps');

const locked = lockedRadarProjection({ status: 'PAYMENT_REQUIRED', answeredCount: 30 });
assert.equal('scores' in locked, false, 'locked projection must not disclose scores');
assert.equal(locked.resultLocked, true);

const neutral = calculateRadarScores({});
assert.equal(neutral.areas.length, 5);
assert.equal(neutral.global, 50);
assert.equal(neutral.ownerAutonomy, 50);
assert.equal(neutral.ai, 50);

const unlocked = unlockedRadarProjection({ status: 'COMPLETED', answeredCount: 30, scores: neutral });
assert.equal(unlocked.resultLocked, false);
assert.equal(unlocked.scores.global, 50);

const economics = calculateRadarScores({ 'economia#ore': [0, 60, 0], 'economia#utile': [0, 30000] }).ownerEconomics;
assert.equal(economics.monthlyHours, 260);
assert.equal(economics.monthlyProfit, 2500);
assert.ok(Math.abs(economics.hourlyProfit - 9.615384615384615) < 1e-10);
assert.deepEqual(calculateRadarScores({ 'economia#ore': [1, 10, 6], 'economia#utile': [1, 2500] }).ownerEconomics, economics);
assert.equal(calculateRadarScores({ 'economia#ore': [0, 60, 0], 'economia#utile': [1, 0] }).ownerEconomics.hourlyProfit, 0);
assert.ok(calculateRadarScores({ 'economia#ore': [0, 60, 0], 'economia#utile': [1, -1000] }).ownerEconomics.hourlyProfit < 0);
for (const invalid of [[0, 0, 0], [0, 169, 0], [1, 25, 5], [1, 8, 0], [1, 8, 8], [1, 8, 5.5], [2, 60, 0], [0, NaN, 0]]) {
  assert.equal(calculateRadarScores({ 'economia#ore': invalid, 'economia#utile': [0, 30000] }).ownerEconomics, null);
}
assert.equal(calculateRadarScores({ 'economia#ore': [0, 60, 0], 'economia#utile': [0, Infinity] }).ownerEconomics, null);
assert.equal(neutral.ownerEconomics, null);
assert.equal(calculateRadarScores({ 'economia#ore': [0, 60, 0], 'economia#utile': [0, 30000] }).global, neutral.global);

// v3: the owner's hour is worth their share of the profit; the salary is added back for the real earnings.
const base = { 'economia#ore': [0, 60, 0], 'economia#utile': [0, 30000] };
assert.equal(economics.ownerShare, 1);
assert.equal(economics.monthlySalary, null, 'v2 never asked the salary');
assert.equal(economics.hourlyEarnings, null);
const half = calculateRadarScores({ ...base, 'economia#soci': [1, 50], 'economia#stipendio': [1, 1, 2000] }).ownerEconomics;
assert.equal(half.ownerShare, 0.5);
assert.equal(half.ownerMonthlyProfit, 1250);
assert.ok(Math.abs(half.hourlyProfit - 1250 / 260) < 1e-10);
assert.equal(half.monthlySalary, 2000);
assert.ok(Math.abs(half.hourlyEarnings - 3250 / 260) < 1e-10);
const sole = calculateRadarScores({ ...base, 'economia#soci': [0], 'economia#stipendio': [0] }).ownerEconomics;
assert.equal(sole.ownerShare, 1);
assert.equal(sole.monthlySalary, 0);
assert.equal(sole.hourlyEarnings, sole.hourlyProfit);
assert.equal(calculateRadarScores({ ...base, 'economia#stipendio': [1, 0, 36000] }).ownerEconomics.monthlySalary, 3000);
for (const invalid of [[1, 0], [1, 100], [2], [0, 50]]) assert.equal(calculateRadarScores({ ...base, 'economia#soci': invalid }).ownerEconomics.ownerShare, 1, `ignores invalid partners ${invalid}`);
for (const invalid of [[1, 2, 100], [1, 0], [0, 0, 0], [1, 0, -5]]) assert.equal(calculateRadarScores({ ...base, 'economia#stipendio': invalid }).ownerEconomics.monthlySalary, null, `ignores invalid salary ${invalid}`);

const { hourlyProfitBand } = await import('../src/lib/radar/advice.ts');
assert.equal(hourlyProfitBand(49.99), 'critico');
assert.equal(hourlyProfitBand(50), 'da_consolidare');
assert.equal(hourlyProfitBand(179.99), 'da_consolidare');
assert.equal(hourlyProfitBand(180), 'solido');
console.log('Paid Radar domain verifier passed');
