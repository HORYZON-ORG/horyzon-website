import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { architectProfiles, architectSession, architectSessionSnapshot } from '../src/content/patrimonial-architect-session.ts';
import { pilotForms } from '../src/content/patrimonial-funnels.ts';

// The architect presentation may change; the shared transport and other forms
// remain pinned to the reviewed pre-redesign implementation, not a new baseline.
const file = 'src/components/patrimonial-lead-form.tsx';
const baseline = execFileSync('git', ['show', `77138d5:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
const current = readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const between = (source, start, end) => {
  const from = source.indexOf(start); const to = source.indexOf(end, from);
  assert(from >= 0 && to > from); return source.slice(from, to).trim();
};
assert.equal(between(current, 'function PublicLeadForm()', '\n// Same per-tab'), between(baseline, 'function PublicLeadForm()', '\n// Same per-tab'));
assert.equal(between(current, 'function pilotAttribution(', '\nfunction PilotLeadForm'), between(baseline, 'function pilotAttribution(', '\nfunction PilotLeadForm'));
assert.equal(between(current, '    sending.current = true;', '\n  if (presentation'), between(baseline, '    sending.current = true;', '\n  return <form'));
assert.equal(current.slice(current.indexOf('  return <form className="rd-form" onSubmit={submit}')), baseline.slice(baseline.indexOf('  return <form className="rd-form" onSubmit={submit}')));
assert(current.includes("if (presentation === 'architect' && mode === 'architect-path' && step === 1)"));
for (const profile of Object.values(architectProfiles)) assert(pilotForms['architect-path'].profiles.includes(profile.value));
assert.equal(architectProfiles.nuovo.value, 'Altro'); assert.equal(architectSession.status, 'PLACEHOLDER');
const placeholder = architectSessionSnapshot(Date.now());
assert.equal(placeholder.seatsTotal, '[N]'); assert.equal(placeholder.seatsLeft, '[N]'); assert.equal(placeholder.seatPercent, 0);
assert(Object.values(placeholder.cd).every(value => value === '—'));
console.log('PASS architect presentation: shared submit/attempts/timeout/UTM, legacy and standard pilot markup unchanged; profile API mapping valid; no fabricated availability/countdown. No remote calls.');
