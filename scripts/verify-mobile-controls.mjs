import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scrollToPageTop } from '../src/components/journey/scroll-to-page-top.ts';

for (const [reducedMotion, behavior] of [[false, 'smooth'], [true, 'instant']]) {
  let received;
  scrollToPageTop(reducedMotion, options => { received = options; });
  assert.deepEqual(received, { top: 0, behavior }, `back-to-top must use ${behavior} scrolling`);
}

const experience = await readFile('src/components/experience.tsx', 'utf8');
assert(experience.includes('role="tooltip"'), 'Radar handoff note should be available as a tooltip');
assert(experience.includes('aria-describedby="radar-link-note"'), 'Radar info control should expose the tooltip to assistive technology');
assert(!experience.includes('<p className="arrival-note">L’assessment si apre'), 'Radar handoff note should not remain as a misaligned paragraph');

console.log('Mobile journey controls checks passed.');
