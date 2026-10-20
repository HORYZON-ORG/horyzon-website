import assert from 'node:assert/strict';
import {
  canonicalEventQualification,
  eventQualificationSnapshot,
  validateEventQualification,
} from '../src/lib/public-leads/patrimonial-event-qualification.ts';

const base = {
  schemaVersion: 1,
  audienceProfile: 'Professionista',
  sceneId: 'fermi',
  consultationRequested: false,
  instruments: [
    { instrumentId: 'oro', knowledgeLevel: 'So come funziona' },
    { instrumentId: 'etf', knowledgeLevel: 'Ne ho sentito parlare' },
  ],
};
assert.deepEqual(eventQualificationSnapshot(base), {
  ...base,
  awarenessLevel: 2,
  instruments: [
    { instrumentId: 'etf', knowledgeLevel: 'Ne ho sentito parlare' },
    { instrumentId: 'oro', knowledgeLevel: 'So come funziona' },
  ],
});
assert.equal(
  canonicalEventQualification(base),
  canonicalEventQualification({ ...base, instruments: [...base.instruments].reverse() }),
  'instrument ordering is not semantically significant',
);
assert.notEqual(
  canonicalEventQualification(base),
  canonicalEventQualification({ ...base, consultationRequested: true }),
  'an explicit request must change the snapshot',
);
assert.notEqual(
  canonicalEventQualification(base),
  canonicalEventQualification({ ...base, consultationRequested: null }),
  'unknown and false must stay distinct',
);
assert.equal(validateEventQualification({ ...base, instruments: [] })?.instruments.length, 0);
assert.equal(eventQualificationSnapshot({ ...base, sceneId: null })?.awarenessLevel, null);
for (const invalid of [
  { ...base, extra: 'not allowed' },
  { ...base, schemaVersion: 2 },
  { ...base, consultationRequested: 'false' },
  { ...base, audienceProfile: 'unknown' },
  { ...base, sceneId: 'unknown' },
  { ...base, instruments: [...base.instruments, base.instruments[0]] },
  { ...base, instruments: [{ instrumentId: 'sconosciuto', knowledgeLevel: 'Ce l’ho già' }] },
  { ...base, instruments: [{ instrumentId: 'oro', knowledgeLevel: 'unknown' }] },
  { ...base, instruments: [{ instrumentId: 'oro', knowledgeLevel: 'Ce l’ho già', freeText: 'x' }] },
  { ...base, instruments: null },
  null,
  [],
]) {
  assert.equal(validateEventQualification(invalid), null, JSON.stringify(invalid));
}
console.log('Event qualification contract: validation, canonicalization, nullable evidence PASS');
