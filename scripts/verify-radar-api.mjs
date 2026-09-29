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
  const saved = await service.saveAnswer({ assessmentId: first.id, ownerSecret: first.ownerSecret, answerKey: step.id, value: step.kind === 'AI_MULTI' ? [0] : 3, expectedRevision: revision, currentStep });
  revision = saved.revision;
}
await service.completeAssessment(first.id, first.ownerSecret);
const grant = await service.grantPreview({ assessmentId: first.id, ownerSecret: first.ownerSecret, pin: '789987', ipKey: 'test-ip' });
assert.equal(grant.source, 'PREVIEW');
assert.equal(service.verifyPreviewGrant(grant.token, first.id), true);
assert.equal(service.verifyPreviewGrant(grant.token, second.id), false);
await assert.rejects(() => service.grantPreview({ assessmentId: second.id, ownerSecret: second.ownerSecret, pin: '000000', ipKey: 'bad-ip' }), RadarAccessError);

console.log('Paid Radar API verifier passed');
