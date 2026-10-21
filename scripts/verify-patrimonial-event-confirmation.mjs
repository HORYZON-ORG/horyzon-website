import assert from 'node:assert/strict';
import { decideAutomaticEventConfirmation as decide } from '../src/lib/public-leads/patrimonial-event-confirmation.ts';

const now = new Date('2026-11-01T12:00:00Z');
const active = {
  editionId: 'horyzon-2026-11-a', status: 'ACTIVE',
  startsAt: '2026-11-15T18:00:00Z', endsAt: '2026-11-15T20:00:00Z',
  cutoffAt: null, capacity: 40, confirmedCount: 39,
};
assert.deepEqual(decide(null, now), { status: 'PENDING_EDITION', reason: 'EDITION_UNDEFINED' });
assert.deepEqual(decide(active, now), { status: 'CONFIRMABLE', editionId: active.editionId });
for (const [input, reason] of [
  [{...active, status:'DRAFT'},'EDITION_NOT_ACTIVE'],
  [{...active, status:'CANCELLED'},'EDITION_NOT_ACTIVE'],
  [{...active, capacity:null},'CAPACITY_UNDEFINED'],
  [{...active, capacity:0},'CAPACITY_UNDEFINED'],
  [{...active, capacity:3.5},'CAPACITY_UNDEFINED'],
  [{...active, confirmedCount:40},'FULL'],
  [{...active, confirmedCount:-1},'COUNT_UNVERIFIED'],
  [{...active, startsAt:'invalid'},'INVALID_TIMING'],
  [{...active, endsAt:active.startsAt},'INVALID_TIMING'],
  [{...active, cutoffAt:'2026-11-16T00:00:00Z'},'INVALID_TIMING'],
]) {
  assert.equal(decide(input, now).reason, reason);
}
assert.equal(decide(active,new Date(active.startsAt)).status,'PENDING_CONFIRMATION');
console.log('Automatic event confirmation policy: fail-closed rules PASS');
