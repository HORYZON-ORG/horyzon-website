import assert from 'node:assert/strict';
import { activeRecoveryStorageKey, clearRecovery, createRecoveryEnvelope, loadActiveRecovery, recoveryStorageKey, saveRecovery, shouldRestoreRecovery } from '../src/components/radar/radar-recovery.ts';

const envelope = createRecoveryEnvelope({ assessmentId: 'opaque-id', revision: 2, currentStep: 4, answers: { 'amministrazione#0': 3 }, questionnaireVersion: 'radar-v1' });
const serialized = JSON.stringify(envelope);
assert.equal(serialized.includes('email'), false);
assert.equal(serialized.includes('telefono'), false);
assert.equal(recoveryStorageKey('opaque-id'), 'horyzon:radar:recovery:opaque-id');
assert.equal(shouldRestoreRecovery(envelope, { assessmentId: 'opaque-id', questionnaireVersion: 'radar-v1' }), true);
assert.equal(shouldRestoreRecovery(envelope, { assessmentId: 'opaque-id', questionnaireVersion: 'radar-v2' }), false);
assert.equal(shouldRestoreRecovery(envelope, { assessmentId: 'other', questionnaireVersion: 'radar-v1' }), false);

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
saveRecovery(storage, envelope);
assert.equal(values.get(activeRecoveryStorageKey()), 'opaque-id');
assert.deepEqual(loadActiveRecovery(storage, 'radar-v1'), envelope);
assert.equal(loadActiveRecovery(storage, 'radar-v2'), null);
clearRecovery(storage, 'opaque-id');
assert.equal(loadActiveRecovery(storage, 'radar-v1'), null);

console.log('Paid Radar client verifier passed');
