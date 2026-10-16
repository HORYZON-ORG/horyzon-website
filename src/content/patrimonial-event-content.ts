// Public presentation content for the patrimonial event page. No provider configuration.

// The four awareness profiles: the visitor picks the one they recognise themselves in.
export const eventScenes = [
  { id: 'mese', level: 1, label: 'CHI RINCORRE IL MESE', img: '/benessere-patrimoniale/evento/s_cart.jpg', alt: "Moneta d'oro a cui manca una fetta",
    thought: 'Non riesco a mettere da parte niente.',
    text: 'Lo stipendio arriva e se ne va. Non spendi in cose folli, eppure a fine mese non resta nulla. Ti hanno detto di risparmiare, nessuno ti ha detto come.',
    kicker: 'PER TE CHE OGGI NON RIESCI A METTERE DA PARTE',
    answer: 'La prima serata parte da te: la regola 70-10-10-10 per dare un posto a ogni euro, anche con uno stipendio normale.',
    detail: 'Niente rinunce impossibili. Un metodo semplice, da applicare dal prossimo stipendio.',
    cta: 'Voglio iniziare a mettere da parte' },
  { id: 'fermi', level: 2, label: 'CHI HA I SOLDI FERMI', img: '/benessere-patrimoniale/evento/s_hourglass.jpg', alt: "Clessidra con sabbia d'oro",
    thought: 'Ho dei soldi da parte, ma non so cosa farci.',
    text: 'Sono sul conto corrente da anni. Ogni tanto pensi di investirli, poi rimandi per paura di sbagliare. Intanto, anno dopo anno, comprano sempre meno.',
    kicker: 'PER TE CHE HAI RISPARMI FERMI SUL CONTO',
    answer: 'Prova il calcolatore qui sotto: vedrai cosa è successo negli ultimi 20 anni ai soldi rimasti fermi, e a quelli che hanno lavorato.',
    detail: 'Nelle due serate vedrai da dove si comincia, senza fretta e senza salti nel buio.',
    cta: 'Voglio capire cosa farne' },
  { id: 'consulente', level: 3, label: 'CHI SI AFFIDA', img: '/benessere-patrimoniale/evento/s_bank.jpg', alt: 'Facciata di una banca in stile classico',
    thought: 'Mi affido al consulente della banca.',
    text: 'Hai qualcuno che segue i tuoi investimenti, ma quando ti propone un prodotto non sai bene che domande fare. Vorresti capire, non solo firmare.',
    kicker: 'PER TE CHE TI AFFIDI A UN CONSULENTE',
    answer: 'Nella seconda serata ti diamo la lista delle domande da portare al prossimo appuntamento in banca.',
    detail: 'Entrerai sapendo cosa chiedere, e capirai le risposte.',
    cta: 'Voglio le domande giuste' },
  { id: 'costruisce', level: 4, label: 'CHI COSTRUISCE', img: '/benessere-patrimoniale/evento/s_business.jpg', alt: "Ingranaggi d'oro e un lingotto",
    thought: 'Risparmio e diversifico. Voglio farlo meglio.',
    text: "Hai già un metodo: ETF, immobili, magari un po' d'oro. Ora vuoi capire come ragionano i grandi patrimoni e cosa ti manca per fare il salto.",
    kicker: 'PER TE CHE STAI GIÀ COSTRUENDO',
    answer: 'Vedrai la mappa 50/50 con cui ragionano i grandi patrimoni, e dove il tuo è ancora scoperto.',
    detail: 'Il Radar Patrimoniale, in regalo, ti mostra in un colpo d’occhio cosa ti manca.',
    cta: 'Voglio fare il salto' },
] as const;

// "Chi sei?" in the form. The backend keeps its four values; the exact label travels in the notes.
export const eventProfiles = [
  { label: 'Lavoratore dipendente', value: 'Privato' },
  { label: 'Pensionato', value: 'Privato' },
  { label: 'Imprenditore', value: 'Imprenditore' },
  { label: 'Professionista', value: 'Professionista' },
  { label: 'Genitore', value: 'Altro' },
] as const;
export function eventProfileValue(label: string) {
  return eventProfiles.find(profile => profile.label === label)?.value ?? '';
}
const titles: Record<string, string> = {
  'Lavoratore dipendente': 'Riserva il tuo posto. Il tuo stipendio può lavorare per te.',
  Pensionato: 'Riserva il tuo posto. Proteggi quello che hai costruito in una vita.',
  Imprenditore: 'Riserva il tuo posto. Hai protetto l’azienda: ora tocca a te.',
  Professionista: 'Riserva il tuo posto. Arriva preparato a ogni conversazione sul patrimonio.',
  Genitore: 'Riserva il tuo posto. Per ciò che vuoi lasciare intero.',
};
export function eventFormTitle(profile: string) {
  return titles[profile] ?? 'Riserva il tuo posto per le due serate.';
}

// Inflation: cumulated Italian consumer prices over each horizon, ending 2025 (ISTAT, rounded).
// Returns: annualised, in euro, before tax and costs. ILLUSTRATIVE VALUES pending the official series (see docs).
export const eventHorizons = [5, 10, 15, 20] as const;
export type EventHorizon = typeof eventHorizons[number];
const inflation: Record<EventHorizon, number> = { 5: 0.18, 10: 0.22, 15: 0.29, 20: 0.45 };
export const eventAssets = [
  { id: 'oro', name: 'Oro', color: '#D9B45A', rates: { 5: 0.19, 10: 0.115, 15: 0.087, 20: 0.113 } },
  { id: 'argento', name: 'Argento', color: '#C9CED6', rates: { 5: 0.22, 10: 0.165, 15: 0.066, 20: 0.11 } },
  { id: 'msci', name: 'MSCI World', color: '#6FA8DC', rates: { 5: 0.12, 10: 0.105, 15: 0.11, 20: 0.08 } },
  { id: 'sp500', name: 'S&P 500', color: '#A99BE0', rates: { 5: 0.14, 10: 0.13, 15: 0.145, 20: 0.10 } },
] as const;
const fmt = (n: number) => Math.round(n).toLocaleString('it-IT');
export function eventCalculator(amount: number, years: EventHorizon = 20) {
  const real = amount / (1 + inflation[years]);
  const assets = eventAssets.map(asset => {
    const value = amount * Math.pow(1 + asset.rates[years], years);
    return { id: asset.id, name: asset.name, color: asset.color, raw: value, value: fmt(value), gain: fmt(value - amount) };
  });
  const best = assets.reduce((a, b) => (b.raw > a.raw ? b : a));
  const max = Math.max(...assets.map(a => a.raw), amount);
  return {
    amount: fmt(amount), real: fmt(real), lost: fmt(amount - real), inflation: Math.round(inflation[years] * 100),
    assets: assets.map(a => ({ ...a, width: a.raw / max * 100 })), cashWidth: real / max * 100,
    best: best.name, gap: fmt(best.raw - real),
  };
}

// The 50/50 map: 100 squares, one per cent.
export const eventAllocation = [
  { id: 'metalli', half: 'reali', share: 20, name: 'Oro e argento', color: '#D9B45A', why: 'Non dipendono da una banca né da un’azienda. Sono la parte che regge quando tutto il resto trema.' },
  { id: 'immobili', half: 'reali', share: 30, name: 'Immobili a reddito', color: '#E08A6A', why: 'Producono un affitto ogni mese e nel tempo tendono a seguire l’inflazione.' },
  { id: 'etf', half: 'finanziari', share: 20, name: 'ETF', color: '#6FA8DC', why: 'Ti fanno possedere un pezzo di migliaia di aziende nel mondo con un solo strumento.' },
  { id: 'azioni', half: 'finanziari', share: 20, name: 'Azioni e obbligazioni', color: '#8FB9AE', why: 'Crescita dalle singole aziende, stabilità e cedole dalle obbligazioni.' },
  { id: 'cripto', half: 'finanziari', share: 5, name: 'Cripto', color: '#A99BE0', why: 'Una quota piccola e consapevole su un mercato giovane e molto volatile.' },
  { id: 'passione', half: 'finanziari', share: 5, name: 'Beni da passione', color: '#EFD9B4', why: 'Una Harley, una Vespa d’epoca, un Rolex, una collezione: oggetti che ami e che nel tempo possono valere di più.' },
] as const;

// "Quali di questi strumenti conosci?" — answers travel to the CRM notes.
export const eventInstruments = [
  { id: 'oro', name: 'Oro', ten: '+11,5%', twenty: '+11%', worst: '−30% circa (2013)', role: 'Riserva di valore che non dipende da nessun emittente.' },
  { id: 'argento', name: 'Argento', ten: '+16%', twenty: '+11%', worst: '−35% circa (2013)', role: 'Più volatile dell’oro, legato anche all’uso industriale.' },
  { id: 'immobili', name: 'Immobili a reddito', ten: '+3–4%', twenty: '+3–4%', worst: '−20% prezzi 2011–2019', role: 'Rendita mensile dall’affitto; il valore della casa segue i cicli locali.' },
  { id: 'etf', name: 'ETF (MSCI World, S&P 500)', ten: '+10,5% / +13%', twenty: '+8% / +10%', worst: '−37% circa (2008)', role: 'Crescita nel lungo periodo, con cadute forti da saper reggere.' },
  { id: 'azioni', name: 'Azioni', ten: 'variabile', twenty: 'variabile', worst: 'anche −100% sul singolo titolo', role: 'Possiedi un pezzo di un’azienda: rischio e rendimento dipendono da quella.' },
  { id: 'obbligazioni', name: 'Obbligazioni e BTP', ten: '+0–1%', twenty: '+2,5%', worst: '−18% circa (2022)', role: 'Cedole e stabilità, ma il prezzo scende quando salgono i tassi.' },
  { id: 'cripto', name: 'Cripto', ten: 'molto alto', twenty: 'n.d.', worst: '−65% circa (2022)', role: 'Mercato giovane e molto volatile: solo una quota piccola.' },
  { id: 'collezione', name: 'Beni da collezione', ten: 'variabile', twenty: 'variabile', worst: 'dipende dal mercato', role: 'Moto, orologi, auto d’epoca: valore legato a rarità e passione.' },
] as const;
export const eventKnowledgeLevels = ['Ne ho sentito parlare', 'So come funziona', 'Ce l’ho già'] as const;

export function eventNotes(scene: string | null, profile: string, known: Record<string, string>) {
  const level = eventScenes.find(item => item.id === scene);
  const parts = [
    ...(profile ? [`Chi sei: ${profile}`] : []),
    ...(level ? [`Profilo: ${level.level} · ${level.label.toLowerCase()}`] : []),
    ...(Object.keys(known).length ? [`Strumenti: ${eventInstruments.filter(i => known[i.id]).map(i => `${i.name} (${known[i.id]})`).join(', ')}`] : []),
  ];
  return parts.join(' | ').slice(0, 1400);
}
