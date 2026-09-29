import assert from 'node:assert/strict';
import { calculateRadarScores, radarSteps } from '../src/lib/radar/domain.ts';
import { lockedRadarProjection, unlockedRadarProjection } from '../src/lib/radar/public-projection.ts';

assert.equal(radarSteps().length, 30, 'Radar must expose the canonical 30 steps');

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

console.log('Paid Radar domain verifier passed');
