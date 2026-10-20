// Pure server-side business decision: NEVER treats a request receipt as a confirmed seat.
// Deliberately independent of live DB/provider: caller must read and lock authoritative
// edition + participation capacity atomically in one transaction before applying CONFIRMED.
export type EventEditionCapacity = {
  editionId: string;
  status: 'DRAFT' | 'ACTIVE' | 'CANCELLED' | 'COMPLETED';
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  cutoffAt: string | null;
  confirmedCount: number;
};
export type ConfirmationDecision =
  | { status: 'CONFIRMABLE'; editionId: string }
  | { status: 'PENDING_EDITION' | 'PENDING_CONFIRMATION'; reason: string };

export function decideAutomaticEventConfirmation(
  edition: EventEditionCapacity | null,
  now: Date,
): ConfirmationDecision {
  if (!edition) return { status: 'PENDING_EDITION', reason: 'EDITION_UNDEFINED' };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(edition.editionId)) return { status: 'PENDING_CONFIRMATION', reason: 'INVALID_EDITION' };
  if (edition.status !== 'ACTIVE') return { status: 'PENDING_CONFIRMATION', reason: 'EDITION_NOT_ACTIVE' };
  const start = Date.parse(edition.startsAt);
  const end = Date.parse(edition.endsAt);
  const cutoff = edition.cutoffAt === null ? start : Date.parse(edition.cutoffAt);
  if (![start, end, cutoff].every(Number.isFinite) || end <= start || cutoff > start)
    return { status: 'PENDING_CONFIRMATION', reason: 'INVALID_TIMING' };
  if (!Number.isInteger(edition.capacity) || (edition.capacity ?? 0) <= 0)
    return { status: 'PENDING_CONFIRMATION', reason: 'CAPACITY_UNDEFINED' };
  if (!Number.isInteger(edition.confirmedCount) || edition.confirmedCount < 0)
    return { status: 'PENDING_CONFIRMATION', reason: 'COUNT_UNVERIFIED' };
  if (now.getTime() >= cutoff) return { status: 'PENDING_CONFIRMATION', reason: 'REGISTRATION_CLOSED' };
  if (edition.confirmedCount >= edition.capacity!)
    return { status: 'PENDING_CONFIRMATION', reason: 'FULL' };
  return { status: 'CONFIRMABLE', editionId: edition.editionId };
}
