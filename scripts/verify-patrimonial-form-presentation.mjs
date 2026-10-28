import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { architectProfiles, architectSession, architectSessionSnapshot } from '../src/content/patrimonial-architect-session.ts';
import { pilotForms } from '../src/content/patrimonial-funnels.ts';

// The architect presentation may change; the shared transport and other forms
// remain pinned to the reviewed pre-redesign implementation, not a new baseline.
const file = 'src/components/patrimonial-lead-form.tsx';
const baseline = execFileSync('git', ['show', `cc15e5d0731a8227eac2a3df39d7e7b0e2242ac3:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
const rawCurrent = readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
// Compare the CV-enabled transport to its immutable remote source. Only the
// Event-only, post-canonical-receipt navigation differs; the complete source is pinned.
const continuation=rawCurrent.split('\n').filter(line=>line.includes('router.push(`${form.path}/grazie#radar='));
assert.equal(continuation.length,1);
assert(continuation[0].includes("v2 && mode === 'patrimonial-event'"));
const eventReferralLine="      ...(v2 && mode === 'patrimonial-event' && referral.current !== undefined ? {referralCode: referral.current} : {}),";
assert.equal(rawCurrent.split('\n').filter(line=>line===eventReferralLine).length,1,'One exact Event-v2-only payload extension');
// The full source stays pinned; normalize only the explicitly reviewed field.
// Keep the original shared submit/CV/attempt/timeout comparison intact below.
const current=rawCurrent.replace(continuation[0]+'\n','').replace(eventReferralLine+'\n','');
const pins=JSON.parse(readFileSync('scripts/fixtures/patrimonial-foundation-source-manifest.json','utf8'));
assert.equal((await import('node:crypto')).createHash('sha256').update(rawCurrent).digest('hex'),pins[file]);
const between = (source, start, end) => {
  const from = source.indexOf(start); const to = source.indexOf(end, from);
  assert(from >= 0 && to > from); return source.slice(from, to).trim();
};
assert.equal(between(current, 'function PublicLeadForm()', '\n// Same per-tab'), between(baseline, 'function PublicLeadForm()', '\n// Same per-tab'));
assert.equal(between(current, 'function pilotAttribution(', '\nfunction PilotLeadForm'), between(baseline, 'function pilotAttribution(', '\nfunction PilotLeadForm'));
assert.equal(between(current, '    sending.current = true;', '\n  if (presentation'), between(baseline, '    sending.current = true;', '\n  if (presentation'));
assert.equal(current.slice(current.indexOf('  return <form className="rd-form" onSubmit={submit}')), baseline.slice(baseline.indexOf('  return <form className="rd-form" onSubmit={submit}')));
assert(current.includes("if (presentation === 'architect' && mode === 'architect-path' && step === 1)"));
for (const profile of Object.values(architectProfiles)) assert(pilotForms['architect-path'].profiles.includes(profile.value));
assert.equal(architectProfiles.altro.value, 'Altro'); assert.equal(architectSession.status, 'PLACEHOLDER');
const placeholder = architectSessionSnapshot(Date.now());
assert.equal(placeholder.seatsTotal, '[N]'); assert.equal(placeholder.seatsLeft, '[N]'); assert.equal(placeholder.seatPercent, 0);
assert(Object.values(placeholder.cd).every(value => value === '—'));
console.log('PASS architect presentation: CV-enabled shared submit/attempts/timeout/UTM preserved against cc15e5d; Event-only receipt navigation pinned; profile API mapping valid; no fabricated availability/countdown. No remote calls.');
