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
// The event pilot may supply evidence, but v2 must not accept fields that its
// existing request hash deliberately excludes. Recruitment may not supply it.
const { validatePilotLead, validatePatrimonialV2 } = await import('../src/lib/public-leads/patrimonial-funnels.ts');
const { pilotForms } = await import('../src/content/patrimonial-funnels.ts');
const { PATRIMONIAL_V2 } = await import('../src/lib/public-leads/patrimonial-contract.ts');
const eventLead = {
  mode: 'patrimonial-event', sourcePath: pilotForms['patrimonial-event'].path,
  firstName: 'Persona', lastName: 'Test', email: 'person@example.invalid', phone: '',
  province: 'Milano', profile: 'Professionista', message: '', consent: true,
  marketingConsent: false, utm: {}, website: '',
};
const accepted = validatePilotLead({ ...eventLead, qualification: base });
assert.deepEqual(accepted?.qualification, validateEventQualification(base));
assert.equal(validatePilotLead({ ...eventLead, qualification: { ...base, instruments: [...base.instruments, base.instruments[0]] } }), null);
assert.equal(validatePilotLead({ ...eventLead, qualification: null }), null);
assert(validatePilotLead(eventLead), 'existing event lead remains accepted');
const architectLead = {
  ...eventLead, mode: 'architect-path', sourcePath: pilotForms['architect-path'].path,
  profile: 'Imprenditore', experience: '', goal: '', availability: '',
};
assert.equal(validatePilotLead({ ...architectLead, qualification: base }), null, 'candidate funnel cannot carry event qualification');
assert.equal(validatePatrimonialV2({ ...eventLead, contractVersion: PATRIMONIAL_V2, qualification: base }), null, 'v2 cannot omit qualification from its hash');
assert(validatePatrimonialV2({ ...eventLead, contractVersion: PATRIMONIAL_V2 }), 'legacy v2 receipt unchanged');
console.log('Event qualification contract: validation, canonicalization, pilot/v2 isolation PASS');
