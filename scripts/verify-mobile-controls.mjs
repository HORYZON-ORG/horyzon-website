import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scrollToPageTop } from '../src/components/journey/scroll-to-page-top.ts';

for (const [reducedMotion, behavior] of [[false, 'smooth'], [true, 'instant']]) {
  let received;
  scrollToPageTop(reducedMotion, options => { received = options; });
  assert.deepEqual(received, { top: 0, behavior }, `back-to-top must use ${behavior} scrolling`);
}

const experience = await readFile('src/components/experience.tsx', 'utf8');
const journey = await readFile('src/components/journey/journey.tsx', 'utf8');
const styles = await readFile('src/app/journey.css', 'utf8');

assert(!experience.includes('role="tooltip"'), 'Radar tooltip should be removed');
assert(!experience.includes('radar-info'), 'Radar info control should be removed');
assert(!journey.includes('motion-control'), 'Pause/static-view control should be removed');
assert(experience.includes('<BackToTopButton/>'), 'Back-to-top control should sit outside the video stacking context');
assert(styles.includes('.back-to-top-control{position:fixed;'), 'Back-to-top control should remain fixed to the viewport');
assert(styles.includes('z-index:1000'), 'Back-to-top control should stay above every page layer');

console.log('Mobile journey controls checks passed.');
