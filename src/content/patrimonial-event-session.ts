// Public event is not yet scheduled. No placeholder availability is published.
// This public configuration is never an event edition or a backend eligibility gate.
type EventSession = {
  status: 'PLACEHOLDER' | 'CONFIRMED'; eventDate: string; eventLabel: string;
  seatsTotal: number; seatsTaken: number;
};
export const eventSession: EventSession = {
  status: 'PLACEHOLDER',
  eventDate: '',
  eventLabel: 'Date in definizione',
  seatsTotal: 0,
  seatsTaken: 0,
};
export function eventSessionSnapshot(now: number | null, session: EventSession = eventSession) {
  const total = Math.max(0, session.seatsTotal);
  const taken = Math.min(Math.max(0, session.seatsTaken), total);
  const event = Date.parse(session.eventDate);
  const diff = now === null ? null : Math.max(0, (Number.isFinite(event) ? event : 0) - now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    demo: session.status === 'PLACEHOLDER', eventLabel: session.eventLabel,
    seatsTotal: total, seatsTaken: taken, seatsLeft: total - taken,
    cd: diff === null ? { d: '—', h: '—', m: '—', s: '—' } : {
      d: pad(Math.floor(diff / 86400000)), h: pad(Math.floor(diff / 3600000) % 24),
      m: pad(Math.floor(diff / 60000) % 60), s: pad(Math.floor(diff / 1000) % 60),
    },
  };
}
