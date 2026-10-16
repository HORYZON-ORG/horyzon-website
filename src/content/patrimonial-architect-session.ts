// Public pilot content only. No remote IDs, credentials or claimed availability.
export const architectSession: {
  status: 'PLACEHOLDER' | 'CONFIRMED'; sessionDate: string | null; sessionLabel: string;
  closeHoursBefore: number; seatsTotal: number | null; seatsTaken: number | null;
} = {
  status: 'PLACEHOLDER', sessionDate: null, sessionLabel: '[DATA SESSIONE · ORARIO DA CONFERMARE]',
  closeHoursBefore: 2, seatsTotal: null, seatsTaken: null,
};
export const architectProfiles = {
  banca: { label: 'Consulente in banca', value: 'Dipendente', scene: 'opportunita', story: 0,
    sub: 'Conosci i prodotti, i clienti e anche quello che in filiale non si può dire. Qui lo usi per costruire piani su tutta la mappa, non per chiudere il budget del trimestre.', cta: 'Voglio lavorare su tutta la mappa' },
  finanziario: { label: 'Consulente finanziario o assicurativo', value: 'Professionista', scene: 'caffe', story: 0,
    sub: 'Hai già clienti che si fidano di te. Ti mancano metà degli strumenti: oro fisico, immobili a reddito, beni reali. Il percorso te li mette in mano, con un metodo.', cta: 'Voglio completare la mia mappa' },
  commerciale: { label: 'Commerciale o agente', value: 'Commerciale', scene: 'opportunita', story: 1,
    sub: 'Sai creare fiducia in pochi minuti. Qui impari a usarla per qualcosa che cambia davvero la vita delle persone, non per il prodotto del mese.', cta: 'Voglio usare il mio talento diversamente' },
  imprenditore: { label: 'Imprenditore', value: 'Imprenditore', scene: 'caffe', story: 1,
    sub: 'Hai costruito qualcosa da zero e sai cosa vuol dire rischiare. Ora puoi mettere quell’esperienza al servizio di chi deve proteggere quello che ha costruito.', cta: 'Voglio capire se fa per me' },
  nuovo: { label: 'Cerco un nuovo lavoro', value: 'Altro', scene: 'domenica', story: 2,
    sub: 'Non serve venire dal settore. Cerchiamo persone che sanno ascoltare e hanno voglia di imparare: la formazione parte dalle basi e un Architetto senior ti affianca sul campo.', cta: 'Voglio un lavoro che mi stimoli' },
} as const;
export type ArchitectProfileKey = keyof typeof architectProfiles;
export const architectDefaultCopy = {
  sub: 'Horyzon cerca e forma Architetti Patrimoniali: persone che aiutano famiglie e imprenditori a far lavorare i propri risparmi su tutta la mappa, non solo su metà. In 30 minuti live scopri cosa fa questo ruolo, come ti formiamo e se fa per te.', cta: 'Riserva il mio posto',
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
