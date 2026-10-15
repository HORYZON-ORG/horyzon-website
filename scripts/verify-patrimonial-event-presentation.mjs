import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { eventProfiles, eventProfileValue, eventScenes, eventFormTitle, eventCalculator } from '../src/content/patrimonial-event-content.ts';
import { eventSession, eventSessionSnapshot } from '../src/content/patrimonial-event-session.ts';
import { pilotForms } from '../src/content/patrimonial-funnels.ts';
await import('./verify-patrimonial-form-presentation.mjs');

const read = file => readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const show = file => execFileSync('git', ['show', `2d2426dfb5cacee8c1dc9de212f663107328e629:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
// Stable architect presentation, configuration and all backend boundaries.
const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', '2d2426dfb5cacee8c1dc9de212f663107328e629', '--', 'src/lib/public-leads', 'src/app/api/public-leads', 'supabase/migrations', 'src/components/patrimonial-architect-landing.tsx', 'src/components/patrimonial-architect-form.tsx', 'src/components/patrimonial-architect.module.css', 'src/content/patrimonial-architect-session.ts', 'src/content/patrimonial-funnels.ts', 'src/app/(patrimonial-pilot)/benessere-patrimoniale/percorso-architetto-patrimoniale', 'src/app/(patrimonial-pilot)/benessere-patrimoniale/evento/grazie'], { encoding: 'utf8' }).trim().split(/\r?\n/);
for (const file of paths) assert.equal(read(file), show(file), `Protected baseline changed: ${file}`);
const assets = execFileSync('git', ['ls-tree', '-r', '--name-only', '2d2426dfb5cacee8c1dc9de212f663107328e629', '--', 'public/benessere-patrimoniale/percorso-architetto'], { encoding: 'utf8' }).trim().split(/\r?\n/);
for (const file of assets) assert(readFileSync(file).equals(execFileSync('git', ['show', `2d2426dfb5cacee8c1dc9de212f663107328e629:${file}`], { maxBuffer: 10 * 1024 * 1024 })), `Architect asset changed: ${file}`);
const form = read('src/components/patrimonial-event-form.tsx');
assert(!form.includes('fetch(')); assert(!form.includes('marketingConsent'));
for (const name of ['firstName', 'lastName', 'province', 'email', 'phone', 'consent', 'profile', 'website']) assert(form.includes(`name="${name}"`));
assert(form.includes('La richiesta non conferma ancora la partecipazione definitiva.'));
assert(form.includes('Ci manca solo questo') && form.includes('Conferma la richiesta'));
const shared = read('src/components/patrimonial-lead-form.tsx');
assert(shared.includes("if (presentation === 'event' && mode === 'patrimonial-event' && step === 1)"));
const landing = read('src/components/patrimonial-event-landing.tsx');
const sectionNames = [...landing.matchAll(/data-event-section="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(sectionNames, ['urgency', 'hero', 'social-proof', 'scenes', 'calculator', 'pyramid', 'questions', 'gold-comparison', 'agenda', 'audience', 'speaker', 'testimonials', 'bonuses', 'request', 'faq', 'closing', 'footer', 'sticky']);
for (const placeholder of ['[000]+', '[4,9/5]', '[00]', '[000]', '[Nome C.]', '[Imprenditore, Bari]', '[Professionista, Milano]', '[Privato, Roma]', 'Valore [__] €', '[10]', 'RITRATTO IN ARRIVO', '[Una frase sulla sua storia:']) assert(landing.includes(placeholder));
for (const profile of eventProfiles) assert(pilotForms['patrimonial-event'].profiles.includes(profile.value));
assert.equal(eventProfileValue('Genitore / famiglia'), 'Altro'); assert.equal(eventProfileValue(''), '');
assert.deepEqual(eventScenes.map(scene => scene.profile), ['Privato', 'Imprenditore', 'Privato', 'Genitore / famiglia']);
for (const scene of eventScenes) assert(eventFormTitle(scene.profile).startsWith('Riserva il tuo posto.'));
assert.equal(eventSession.status, 'PLACEHOLDER'); assert.equal(eventSessionSnapshot(null).demo, true);
assert.equal(eventSessionSnapshot(null).seatsLeft, 32);
const start = Date.parse(eventSession.eventDate);
assert.deepEqual(eventSessionSnapshot(start - 90061000).cd, { d: '01', h: '01', m: '01', s: '01' });
assert.deepEqual(eventSessionSnapshot(start + 1000).cd, { d: '00', h: '00', m: '00', s: '00' });
assert.deepEqual(eventCalculator(100000), { amount: '100.000', real: '85.400', lost: '14.600', perDay: '8,00' });
for (const amount of [10000, 50000, 250000, 500000, 1000000]) {
  const raw = amount * (1 - 1 / 1.171), lost = Math.round(raw / 100) * 100;
  assert.equal(eventCalculator(amount).real, (amount - lost).toLocaleString('it-IT'));
  assert.equal(eventCalculator(amount).perDay, (raw / 1826).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}
const css = read('src/components/patrimonial-event.module.css');
assert(css.includes('position:sticky;bottom:0')); assert(css.includes('@media (max-width:820px)'));
assert(css.includes('prefers-reduced-motion')); assert(css.includes('--event-serif') && css.includes('--event-sans'));
console.log(`PASS event presentation: 18 sections, placeholders, demo clock, exact calculator, explicit profile mapping, two-step form, original transport; ${paths.length} protected architect/backend files and ${assets.length} architect assets unchanged. No remote calls.`);
