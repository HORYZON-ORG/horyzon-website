export const CHECKUP_VERSION = 'recruiting-checkup-v1';
export const CHECKUP_KEEP_ORIGINAL_INTRO = 'Nel PDF trovi la valutazione del tuo annuncio, il testo consigliato e le informazioni da aggiungere per migliorarlo.';
export const CHECKUP_CALENDAR_URL = 'https://calendly.com/angelo-ria/incontro-con-angelo-ria-revisione-annuncio';
export const CHECKUP_INVITATION = [
  'Nel PDF trovi la valutazione del tuo annuncio e una versione migliorata, con le modifiche spiegate.',
  'Con qualche informazione in più sulla figura che cerchi, possiamo renderlo ancora più preciso e aderente alla tua ricerca.',
  'Per questo ti regaliamo 15 minuti di confronto con Angelo: partirete dal lavoro già fatto per individuare ulteriori miglioramenti.',
  'Prenota i tuoi 15 minuti gratuiti.',
] as const;


export function checkupCalendarUrl(analysisRunId: string) {
  const url = new URL(CHECKUP_CALENDAR_URL);
  url.searchParams.set('utm_source', 'horyzon');
  url.searchParams.set('utm_medium', 'checkup');
  url.searchParams.set('utm_content', analysisRunId);
  return url.toString();
}
