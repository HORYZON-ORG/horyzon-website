import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';


const read = file => readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const landing = read('src/components/patrimonial-architect-landing.tsx');
const form = read('src/components/patrimonial-architect-form.tsx');
const page = read('src/app/(patrimonial-pilot)/benessere-patrimoniale/percorso-architetto-patrimoniale/page.tsx');
const thanks = read('src/app/(patrimonial-pilot)/benessere-patrimoniale/percorso-architetto-patrimoniale/grazie/page.tsx');
const content = read('src/content/patrimonial-funnels.ts');
const crmMapping = read('src/lib/public-leads/patrimonial-funnels.ts');
const durableSync = read('src/lib/public-leads/patrimonial-sync.ts');
const session = read('src/content/patrimonial-architect-session.ts');
const leadForm = read('src/components/patrimonial-lead-form.tsx');
const css = read('src/components/patrimonial-architect.module.css');

for (const value of [
  'Ogni risultato comincia da una nuova azione.',
  'Costruiamo insieme la tua professionalità.',
  '08 · CANDIDATI',
  '09 · DOMANDE FREQUENTI',
  'Vai alla candidatura',
]) assert(landing.includes(value), `Missing evergreen candidature copy: ${value}`);

// Briefing 26/10: no "always open" promise, no seller comparison; profile choice lives in the candidature section.
for (const removed of ['SEMPRE APERTE', 'sempre aperte', 'Un venditore parte dal prodotto', 'Ogni candidatura viene letta da una persona del team', 'quasi nessuno sta servendo', 'CANDIDATI CON CONSAPEVOLEZZA', 'LA SCELTA', 'Gratuito · online · senza impegno', 'P.S.', '1:30'])
  assert(!landing.includes(removed) && !session.includes(removed) && !content.includes(removed), `Removed copy is back: ${removed}`);
const formSection = landing.slice(landing.indexOf('id="richiesta"') - 200);
assert.equal((landing.match(/data-profile="/g) ?? []).length, 5);
assert.equal((formSection.match(/data-profile="/g) ?? []).length, 5, 'Profile chips belong to the candidature section');
assert(form.includes('step === 1 && selected ? `${selected.cta} →`'), 'Step-1 submit label follows the chosen profile');

for (const obsolete of [
  'PRESENTAZIONE LIVE',
  'Riserva il mio posto',
  'Posti riservati per questa sessione',
  'posti liberi su',
  'SessionValue',
  'SessionProvider',
  'seatBar',
]) assert(!landing.includes(obsolete), `Temporary-session concept leaked into evergreen landing: ${obsolete}`);

assert(form.includes('La tua candidatura. Passo {step} di 2'));
assert(form.includes('Invia la mia candidatura →'));
assert(form.includes('Perché vuoi candidarti al Percorso Architetto Patrimoniale?'));
assert(form.includes('La candidatura non equivale all’ingresso nel percorso.'));
for (const field of ['firstName','lastName','email','phone','province','profile','experience','goal','availability','message','consent','marketingConsent']) {
  assert(form.includes(`name="${field}"`), `Missing candidate field ${field}`);
}

assert(content.includes("description: 'Un percorso di formazione e affiancamento"));
assert(content.includes("title: 'Completa la tua candidatura.'"));
assert(content.includes("success: 'Candidatura ricevuta.'"));
assert(content.includes("'La candidatura è stata registrata.'"));
assert(crmMapping.includes('Tipo pratica: candidatura'));
assert(crmMapping.includes('Origine candidatura:'));
assert(durableSync.includes('Tipo pratica: candidatura'));
assert(durableSync.includes('Motivazione candidatura:'));

assert(session.includes("cta: 'Vai alla candidatura'"));
assert(!session.includes("cta: 'Riserva il mio posto'"));

assert(page.includes("PATRIMONIAL_ARCHITECT_CANDIDATE_V2_ENABLED === 'true'"));
assert(page.includes('durableCandidateIntake={durableCandidateIntake}'));
assert(landing.includes('contractVersion={durableCandidateIntake ? PATRIMONIAL_V2 : undefined}'));
assert(leadForm.includes("fetch('/api/public-leads'"));
assert(leadForm.includes("utm: pilotAttribution(mode, !v2)"));

assert(thanks.includes('Candidatura ricevuta.'));
assert(thanks.includes('L’ingresso nel percorso non è automatico'));

for (const rule of ['.m-topbar', '.m-sec', '.m-hero', '.m-cta-full', '.m-ticket', '.m-swipe', '.m-col', '.m-vline', '.m-fig', '.m-build', '.m-annot', '.m-track', '.m-prog', '.m-steps', '.m-1col', '.m-form', '.m-sticky']) {
  assert(css.includes(rule), `Missing responsive rule ${rule}`);
}
assert(css.includes('@media (max-width: 700px)'));
assert(css.includes('prefers-reduced-motion'));
assert(css.includes('env(safe-area-inset-bottom, 0px)'));
assert(css.includes('scroll-snap-type:x mandatory'));

console.log('PASS architect evergreen candidature presentation: no temporary session/scarcity language, candidate-native form/thanks, UTM attribution preserved, durable-v2 cutover gated off by default.');
