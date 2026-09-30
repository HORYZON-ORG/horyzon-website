import assert from 'node:assert/strict';
import { calculateRadarScores, radarSteps } from '../src/lib/radar/domain.ts';
import { lockedRadarProjection, unlockedRadarProjection } from '../src/lib/radar/public-projection.ts';

assert.equal(radarSteps().length, 32, 'New Radar adds two economic steps');
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
console.log('Paid Radar domain verifier passed');
