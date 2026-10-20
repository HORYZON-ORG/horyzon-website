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
    sub: 'Sai già creare fiducia in pochi minuti. Qui impari a usarla per qualcosa che scegli tu, non per chiudere il prossimo contratto.', cta: 'Voglio usare il mio talento diversamente' },
  imprenditore: { label: 'Imprenditore', value: 'Imprenditore', scene: 'caffe', story: 1,
    sub: 'Hai costruito qualcosa da zero e sai cosa vuol dire rischiare. Ora puoi mettere quell’esperienza al servizio di chi ci sta passando adesso.', cta: 'Voglio capire se fa per me' },
  dipendente: { label: 'Dipendente', value: 'Dipendente', scene: 'domenica', story: 2,
    sub: 'Non devi lasciare tutto domani. Puoi iniziare part-time, formarti e capire passo dopo passo se è la tua strada.', cta: 'Voglio iniziare senza salti nel vuoto' },
  professionista: { label: 'Professionista', value: 'Professionista', scene: 'caffe', story: 1,
    sub: 'I tuoi clienti si fidano già di te. Il percorso ti dà un metodo in più per accompagnarli anche sulle scelte patrimoniali.', cta: 'Voglio aggiungere questa competenza' },
  altro: { label: 'Sto esplorando', value: 'Altro', scene: 'domenica', story: 2,
    sub: 'Non serve sapere già cosa vuoi. In 30 minuti capisci cosa fa questo ruolo e se ti somiglia. Poi decidi tu.', cta: 'Voglio scoprirlo in 30 minuti' },
} as const;
export type ArchitectProfileKey = keyof typeof architectProfiles;
export const architectDefaultCopy = {
  sub: 'In una presentazione online di 30 minuti scopri cosa fa questo ruolo, come ti formiamo e se fa per te. Prima capisci. Poi, se vuoi, ne parliamo a tu per tu.', cta: 'Candidati ora',
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
