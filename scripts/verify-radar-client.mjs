import assert from 'node:assert/strict';
import { createRecoveryEnvelope, recoveryStorageKey, shouldRestoreRecovery } from '../src/components/radar/radar-recovery.ts';

const envelope = createRecoveryEnvelope({ assessmentId: 'opaque-id', revision: 2, currentStep: 4, answers: { 'amministrazione#0': 3 }, questionnaireVersion: 'radar-v1' });
const serialized = JSON.stringify(envelope);
assert.equal(serialized.includes('email'), false);
assert.equal(serialized.includes('telefono'), false);
assert.equal(recoveryStorageKey('opaque-id'), 'horyzon:radar:recovery:opaque-id');
assert.equal(shouldRestoreRecovery(envelope, { assessmentId: 'opaque-id', questionnaireVersion: 'radar-v1' }), true);
assert.equal(shouldRestoreRecovery(envelope, { assessmentId: 'opaque-id', questionnaireVersion: 'radar-v2' }), false);
assert.equal(shouldRestoreRecovery(envelope, { assessmentId: 'other', questionnaireVersion: 'radar-v1' }), false);

console.log('Paid Radar client verifier passed');
