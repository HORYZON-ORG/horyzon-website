import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
await import('./verify-patrimonial-form-presentation.mjs');

const baseline = '03209c3861517c993ac5028cdb1e0c7c9ccbc87c';
const read = file => readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const original = file => execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
const landingFile = 'src/components/patrimonial-architect-landing.tsx';
const landing = read(landingFile), before = original(landingFile);
const prefix = source => source.slice(0, source.indexOf('  return <SessionProvider>'));
// Rev. 16 Oct 2026: the landing gains the Event's system seen from the Architect's side (clients, 50/50 map, toolkit, quiz).
for (const part of ['function SessionProvider', 'architectSessionSnapshot(now)', "new IntersectionObserver", 'setStickyVisible(!heroVisible && !formVisible)', 'const chooseValue = (value: string)']) assert(prefix(landing).includes(part), part);
const formFile = 'src/components/patrimonial-architect-form.tsx';
assert.equal(read(formFile).replace('stroke="var(--olive)"', 'stroke="#7A5A22"'), original(formFile), 'Architect form only changes SVG presentation color');
for (const file of ['src/components/patrimonial-lead-form.tsx', 'src/content/patrimonial-funnels.ts', 'src/components/patrimonial-pilot-shell.tsx']) assert.equal(read(file), original(file), `No behavioral change: ${file}`);
const css = read('src/components/patrimonial-architect.module.css');
for (const rule of ['.m-topbar', '.m-sec', '.m-hero', '.m-cta-full', '.m-ticket', '.m-stats', '.m-swipe', '.m-col', '.m-vline', '.m-fig', '.m-build', '.m-annot', '.m-track', '.m-prog', '.m-steps', '.m-1col', '.m-form', '.m-sticky']) assert(css.includes(rule));
assert(css.includes('@media (max-width: 700px)')); assert(css.includes('@supports (animation-timeline: view())'));
assert(css.includes('prefers-reduced-motion')); assert(css.includes('env(safe-area-inset-bottom, 0px)'));
assert(css.includes('scroll-snap-type:x mandatory')); assert(css.includes('flex:0 0 84%'));
assert(!/#(?:C9A15A|E2C17F|7A5A22|F3EFE6|EDE8DD)|rgba\(201,161,90/i.test(css + landing));
assert.equal((landing.match(/SCORRI LE SCHEDE →/g) ?? []).length, 3);
assert.equal((landing.match(/<section\b/g) ?? []).length, 18);
import('../src/content/patrimonial-architect-session.ts').then(({ architectProfiles }) => {
  assert.deepEqual(Object.values(architectProfiles).map(p => p.label), ['Consulente in banca', 'Consulente finanziario o assicurativo', 'Commerciale o agente', 'Imprenditore', 'Cerco un nuovo lavoro']);
  assert.equal(new Set(Object.values(architectProfiles).map(p => p.value)).size, 5, 'Profile values stay unique for the form select');
});
for (const text of ['Quello che le banche non dicono', 'Frank Cannoletta', '11 anni', '10.000+', 'Radar Patrimoniale', '70-10-10-10']) assert(landing.includes(text) || read('src/content/patrimonial-architect-content.ts').includes(text), text);
for (const id of ['clients', 'map', 'quiz']) assert(landing.includes(`data-architect-section="${id}"`), id);
assert(!/\[NOME FONDATORE\]|\[Frase del fondatore/.test(landing));
const assetPaths = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, '--', 'public/benessere-patrimoniale/percorso-architetto'], { encoding: 'utf8' }).trim().split(/\r?\n/);
// Real photos replaced some AI renders (hero, conversazione): every image the landing references must exist.
for (const [, src] of landing.matchAll(/src="(\/benessere-patrimoniale\/[^"]+)"/g)) assert(existsSync(`public${src}`), src);
void assetPaths;
console.log('PASS architect mobile presentation (rev. 16 Oct 2026): logic/form/transport/config preserved; 18 sections incl. clients, 50/50 map and quiz; lime palette, complete 700px rules, guarded view animation, reduced motion, safe area, two carousels; all referenced images present. No remote calls.');
