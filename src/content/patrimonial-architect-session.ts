// Public pilot content only. No remote IDs, credentials or claimed availability.
export const architectSession: {
  status: 'PLACEHOLDER' | 'CONFIRMED'; sessionDate: string | null; sessionLabel: string;
  closeHoursBefore: number; seatsTotal: number | null; seatsTaken: number | null;
} = {
  status: 'PLACEHOLDER', sessionDate: null, sessionLabel: '[DATA SESSIONE · ORARIO DA CONFERMARE]',
  closeHoursBefore: 2, seatsTotal: null, seatsTaken: null,
};
export const architectProfiles = {
  commerciale: { label: 'Commerciale', value: 'Commerciale', scene: 'opportunita', story: 0,
    sub: 'Sai già creare fiducia. Qui impari a usarla per qualcosa che scegli tu.', cta: 'Voglio usare il mio talento diversamente' },
  imprenditore: { label: 'Imprenditore', value: 'Imprenditore', scene: 'caffe', story: 1,
    sub: 'Hai costruito qualcosa da zero. Ora puoi mettere la tua esperienza al servizio degli altri.', cta: 'Voglio capire se fa per me' },
  dipendente: { label: 'Dipendente', value: 'Dipendente', scene: 'domenica', story: 2,
    sub: 'Non devi lasciare tutto domani: puoi iniziare part-time e formarti passo dopo passo.', cta: 'Voglio iniziare senza salti nel vuoto' },
  professionista: { label: 'Professionista', value: 'Professionista', scene: 'caffe', story: 1,
    sub: 'I tuoi clienti si fidano già di te. Qui aggiungi un metodo per accompagnarli anche sul patrimonio.', cta: 'Voglio aggiungere questa competenza' },
  altro: { label: 'Sto esplorando', value: 'Altro', scene: 'domenica', story: 2,
    sub: 'Non serve sapere già cosa vuoi. Scopri cosa fa questo ruolo, poi decidi tu.', cta: 'Voglio scoprire se fa per me' },
} as const;
export type ArchitectProfileKey = keyof typeof architectProfiles;
export const architectDefaultCopy = {
  sub: 'Scopri cosa fa questo ruolo e come funziona il percorso. Se ti riconosci, candidati.', cta: 'Vai alla candidatura',
};
export function architectSessionSnapshot(now: number | null) {
  const confirmed = architectSession.status === 'CONFIRMED';
  const total = architectSession.seatsTotal, taken = architectSession.seatsTaken;
  const seatsReady = confirmed && total !== null && taken !== null && Number.isInteger(total) && total > 0 && Number.isInteger(taken) && taken >= 0 && taken <= total;
  const closesAt = confirmed && architectSession.sessionDate ? Date.parse(architectSession.sessionDate) - architectSession.closeHoursBefore * 3600000 : NaN;
  let diff = now !== null && Number.isFinite(closesAt) ? Math.max(0, closesAt - now) : null;
  const cd = { d: '—', h: '—', m: '—', s: '—' };
  if (diff !== null) for (const [unit, size] of [['d', 86400000], ['h', 3600000], ['m', 60000], ['s', 1000]] as const) {
    cd[unit] = String(Math.floor(diff / size)).padStart(2, '0'); diff %= size;
  }
  return { cd, sessionLabel: architectSession.sessionLabel, seatsTotal: seatsReady ? total : '[N]', seatsTaken: seatsReady ? taken : '[N]',
    seatsLeft: seatsReady ? total - taken : '[N]', seatPercent: seatsReady ? taken / total * 100 : 0, placeholder: !confirmed };
}
