import assert from 'node:assert/strict';
import { scrollToPageTop } from '../src/components/journey/scroll-to-page-top.ts';

for (const [reducedMotion, behavior] of [[false, 'smooth'], [true, 'instant']]) {
  let received;
  scrollToPageTop(reducedMotion, options => { received = options; });
  assert.deepEqual(received, { top: 0, behavior }, `back-to-top must use ${behavior} scrolling`);
}

console.log('Mobile journey controls checks passed.');
