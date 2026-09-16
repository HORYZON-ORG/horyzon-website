import assert from 'node:assert/strict';
import { createScrubController, scrollTime } from '../src/components/journey/scrub-controller.ts';

assert.equal(scrollTime(0, 4000, 8), 0);
assert.equal(scrollTime(2000, 4000, 8), 4);
assert.equal(scrollTime(5000, 4000, 8), 8);

let currentTime = 0;
let seeking = false;
const seeks = [];
const scrub = createScrubController({
  currentTime: () => currentTime,
  canSeek: () => !seeking,
  seek: (time) => {
    seeks.push(time);
    seeking = true;
  },
});

scrub.update(1.25);
assert.deepEqual(seeks, [1.25], 'the first scroll target should seek immediately');

scrub.update(3);
scrub.update(4.5);
assert.deepEqual(seeks, [1.25], 'targets should coalesce while the decoder is seeking');

currentTime = 1.25;
seeking = false;
scrub.flush();
assert.deepEqual(seeks, [1.25, 4.5], 'seek completion should jump to the latest target, not replay stale targets');

console.log('Scrub controller checks passed.');
