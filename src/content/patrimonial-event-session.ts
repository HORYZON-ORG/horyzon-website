// Official date supplied by the event organizer. Only the Hub's verified ACTIVE edition
// provides editionKey and permits registrations.
export type EventSession = {
  status: 'PLACEHOLDER' | 'CONFIRMED'; eventDate: string; eventLabel: string; editionKey?: string;
  seatsTotal: number; seatsTaken: number;
};
export const eventSession: EventSession = {
  status: 'CONFIRMED',
  eventDate: '2026-12-09T20:00:00.000Z',
  eventLabel: 'Mercoledì 9 dicembre 2026 · ore 21:00–22:00 (Italia) · 60 minuti con domande e risposte',
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
