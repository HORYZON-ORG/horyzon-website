import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { advertisingConsent, safeRecruitingMetaUrl, createRecruitingMetaTracker } from '../src/lib/recruiting-meta.ts';

const pixelId = '1445609594350659';
const href = 'https://horyzon.it/recruiting/check-up-annuncio';
const runId = '12345678-abcd-1234-abcd-123456789abc';
const fresh = () => new Date().toISOString();
const consentCases = [
  [undefined, false], [null, false], [{}, false], [{ consent: true }, true],
  [{ consent: false }, false], [{ consent: true, purposes: { 5: false } }, false],
  [{ consent: true, purposes: { 4: true } }, false], [{ purposes: { 5: true } }, true],
];
for (const [value, expected] of consentCases) assert.equal(advertisingConsent(value), expected);
assert.equal(safeRecruitingMetaUrl(href), true);
assert.equal(safeRecruitingMetaUrl(href + '?utm_source=meta&utm_medium=paid_social&utm_campaign=recruiting_checkup_v1&utm_content=video51_poche_candidature&fbclid=IwZXabc123#valuta'), true);
for (const suffix of ['?analysis=' + runId, '?email=person@example.com', '?utm_source=person@example.com', '#private-report']) assert.equal(safeRecruitingMetaUrl(href + suffix), false);
assert.equal(safeRecruitingMetaUrl('https://horyzon.it/candidature/architetti-patrimoniali'), false);

function fixture(locationHref = href, storage = new Map()) {
  const calls = [], scripts = [], statuses = [];
  const win = { location: { href: locationHref }, crypto: webcrypto,
    fbq: (...args) => calls.push(args),
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: { createElement: () => ({ setAttribute(name, value) { this[name] = value; } }), head: { appendChild: script => scripts.push(script) } },
  };
  const tracker = createRecruitingMetaTracker(pixelId, win, value => statuses.push(value));
  return { tracker, win, calls, scripts, statuses, storage };
}
const hits = f => f.calls.filter(call => ['trackSingle', 'trackSingleCustom'].includes(call[0]));
const f = fixture();
f.tracker.setConsent(false);
await f.tracker.started(runId);
await f.tracker.completed(runId, fresh());
assert.equal(f.scripts.length, 0); assert.equal(hits(f).length, 0); assert.equal(f.storage.size, 0);
f.tracker.setConsent(true);
assert.equal(f.scripts.length, 1); assert.equal(hits(f).length, 0);
f.scripts[0].onload();
assert.deepEqual(f.calls.find(call => call[0] === 'set'), ['set', 'autoConfig', false, pixelId]);
assert.deepEqual(f.calls.find(call => call[0] === 'init'), ['init', pixelId]);
assert.equal(hits(f).filter(call => call[2] === 'PageView').length, 1);
await Promise.all([f.tracker.completed(runId, fresh()), f.tracker.completed(runId, fresh())]);
await f.tracker.completed(runId, fresh());
assert.equal(hits(f).filter(call => call[2] === 'Lead').length, 1);
const lead = hits(f).find(call => call[2] === 'Lead');
assert.deepEqual(lead[3], { content_name: 'HORYZON Recruiting Check-up', content_category: 'business_service' });
assert.match(lead[4].eventID, /^[a-f0-9]{64}$/);
assert.ok(!JSON.stringify(hits(f)).includes(runId));
f.tracker.setConsent(false);
await f.tracker.download(runId); await f.tracker.bookingClick(runId);
assert.equal(hits(f).length, 2);
f.tracker.setConsent(true);
assert.equal(hits(f).filter(call => call[2] === 'PageView').length, 1);
await f.tracker.download(runId); await f.tracker.bookingClick(runId);
assert.equal(hits(f).length, 4);
const reopened = fixture(href, f.storage);
reopened.tracker.setConsent(true); reopened.scripts[0].onload();
await reopened.tracker.completed(runId, fresh());
assert.equal(hits(reopened).filter(call => call[2] === 'Lead').length, 0);
await reopened.tracker.completed('old-run-1234', '2020-01-01T00:00:00Z');
assert.equal(hits(reopened).filter(call => call[2] === 'Lead').length, 0);

const race = fixture();
race.tracker.setConsent(true);
await race.tracker.started(runId);
race.tracker.setConsent(false);
race.scripts[0].onload();
assert.equal(hits(race).length, 0);
race.tracker.setConsent(true);
assert.equal(hits(race).filter(call => call[2] === 'CheckupStarted').length, 0);
const blocked = fixture(href + '?analysis=' + runId);
blocked.tracker.setConsent(true); await blocked.tracker.completed(runId, fresh());
assert.equal(blocked.scripts.length, 0); assert.equal(blocked.storage.size, 0);
assert.equal(blocked.statuses.at(-1), 'blocked-url');

// Execute the actual consent callback embedded in the page, without loading any
// remote script. Check both the returning-visitor and revocation paths.
const source = await readFile(new URL('../src/components/cookie-controls.tsx', import.meta.url), 'utf8');
const bootstrap = source.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/)[1];
const events = [];
const context = { window: { dispatchEvent: event => events.push(event) }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } } };
vm.runInNewContext(bootstrap, context);
for (const [value, expected] of consentCases) {
  context._iub.csConfiguration.callback.onPreferenceExpressed(value);
  assert.equal(events.at(-1).detail, expected);
}
context._iub.cs = { api: { isPreferenceExpressed: () => true, getPreferences: () => ({ purposes: { 5: true } }) } };
context._iub.csConfiguration.callback.onReady(); assert.equal(events.at(-1).detail, true);
context._iub.csConfiguration.callback.onConsentRejected(); assert.equal(events.at(-1).detail, false);
console.log('PASS — consenso, rifiuto, revoca durante caricamento, deduplicazione, recupero PDF, URL riservati e payload senza recapiti. Collaudo locale simulato; non prova di ricezione Meta.');
