import assert from 'node:assert/strict';
import { createMemoryRadarPersistence } from '../src/lib/radar/persistence/adapter.ts';
import { createRadarService, RadarAccessError } from '../src/lib/radar/service.ts';
import { timingSafePinMatch } from '../src/lib/radar/preview.ts';
import { radarSteps } from '../src/lib/radar/domain.ts';

assert.equal(timingSafePinMatch('789987', '789987'), true);
assert.equal(timingSafePinMatch('789986', '789987'), false);

const persistence = createMemoryRadarPersistence();
const service = createRadarService({ persistence, previewPin: '789987', previewEnabled: true, tokenSecret: 'a'.repeat(32) });
const qualification = { aziendaNome: 'Acme', referenteNome: 'Ada', referenteEmail: 'ada@example.com', referenteTelefono: '3000000000', settore: 'Servizi', volumeAffari: '1 – 5 milioni €', numeroDipendenti: '6-20', seasonal: false };
const first = await service.createAssessment(qualification);
const second = await service.createAssessment({ ...qualification, aziendaNome: 'Beta' });
let revision = 0;
let currentStep = 0;
for (const step of radarSteps().filter((item) => item.id !== 'qualificazione#stagionale')) {
  currentStep += 1;
  const saved = await service.saveAnswer({ assessmentId: first.id, ownerSecret: first.ownerSecret, answerKey: step.id, value: step.kind === 'OWNER_HOURS' ? [0, 60, 0] : step.kind === 'COMPANY_PROFIT' ? [0, 30000] : step.kind === 'OWNER_SALARY' ? [1, 1, 2000] : step.kind === 'PARTNERS' ? [1, 50] : step.kind === 'AI_MULTI' ? [0] : 3, expectedRevision: revision, currentStep });
  revision = saved.revision;
}
const completed = await service.completeAssessment(first.id, first.ownerSecret);
assert.equal(completed.answeredCount, 34, 'v3: 33 questions + the seasonal answer from the form');
assert.equal('scores' in completed, false);
await assert.rejects(() => service.saveAnswer({ assessmentId: first.id, ownerSecret: first.ownerSecret, answerKey: 'economia#ore', value: [0, 0, 0], expectedRevision: revision, currentStep: 32 }), /economic answer/i);
const grant = await service.grantPreview({ assessmentId: first.id, ownerSecret: first.ownerSecret, pin: '789987', ipKey: 'test-ip' });
assert.equal(grant.source, 'PREVIEW');
assert.equal(service.verifyPreviewGrant(grant.token, first.id), true);
assert.equal(service.verifyPreviewGrant(grant.token, second.id), false);
await assert.rejects(() => service.grantPreview({ assessmentId: second.id, ownerSecret: second.ownerSecret, pin: '000000', ipKey: 'bad-ip' }), RadarAccessError);

const result = await service.readPreviewResult(first.id, first.ownerSecret, grant.token);
assert.equal(result.scores.ownerEconomics.monthlyHours, 260);
assert.equal(result.scores.ownerEconomics.monthlyProfit, 2500);
// The preview grant cookie must reach the result API: browsers only send a cookie to paths under its Path.
const { readFileSync } = await import('node:fs');
const shared = readFileSync(new URL('../src/app/api/radar/_shared.ts', import.meta.url), 'utf8');
const cookiePath = shared.match(/RADAR_PREVIEW_COOKIE_PATH = '([^']+)'/)?.[1];
assert.ok(cookiePath, 'preview cookie path constant missing');
assert.ok('/api/radar/result'.startsWith(cookiePath), `preview cookie path ${cookiePath} does not cover /api/radar/result`);
for (const route of ['preview', 'session']) assert.match(readFileSync(new URL(`../src/app/api/radar/${route}/route.ts`, import.meta.url), 'utf8'), /path: RADAR_PREVIEW_COOKIE_PATH/, `${route} route must use the shared preview cookie path`);
console.log('Paid Radar API verifier passed');
