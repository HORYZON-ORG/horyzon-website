// Public presentation content for the patrimonial event page. No provider configuration.

// The four awareness profiles: the visitor picks the one they recognise themselves in.
export const eventScenes = [
  { id: 'mese', level: 1, label: 'CHI RINCORRE IL MESE', img: '/benessere-patrimoniale/evento/profilo-1.jpg', alt: 'Un uomo seduto al tavolino guarda le bollette da pagare',
    thought: 'Non riesco a mettere da parte niente.',
    text: 'Lo stipendio arriva e se ne va. Non spendi in cose folli, eppure a fine mese non resta nulla. Ti hanno detto di risparmiare, nessuno ti ha detto come.',
    kicker: 'PER TE CHE OGGI NON RIESCI A METTERE DA PARTE',
    answer: 'La prima serata parte da te: la regola 70-10-10-10 per dare un posto a ogni euro, anche con uno stipendio normale.',
    detail: 'Niente rinunce impossibili. Un metodo semplice, da applicare dal prossimo stipendio.',
    cta: 'Voglio iniziare a mettere da parte' },
  { id: 'fermi', level: 2, label: 'CHI HA I SOLDI FERMI', img: '/benessere-patrimoniale/evento/profilo-2.jpg', alt: 'Una donna tiene in mano un barattolo di vetro pieno di risparmi',
    thought: 'Ho dei soldi da parte, ma non so cosa farci.',
    text: 'Sono sul conto corrente da anni. Ogni tanto pensi di investirli, poi rimandi per paura di sbagliare. Intanto, anno dopo anno, comprano sempre meno.',
    kicker: 'PER TE CHE HAI RISPARMI FERMI SUL CONTO',
    answer: 'Prova il calcolatore qui sotto: vedrai cosa è successo negli ultimi 20 anni ai soldi rimasti fermi, e a quelli che hanno lavorato.',
    detail: 'Nelle due serate vedrai da dove si comincia, senza fretta e senza salti nel buio.',
    cta: 'Voglio capire cosa farne' },
  { id: 'consulente', level: 3, label: 'CHI SI AFFIDA', img: '/benessere-patrimoniale/evento/profilo-3.jpg', alt: 'Una coppia a colloquio con un consulente',
    thought: 'Mi affido al consulente della banca.',
    text: 'Hai qualcuno che segue i tuoi investimenti, ma quando ti propone un prodotto non sai bene che domande fare. Vorresti capire, non solo firmare.',
    kicker: 'PER TE CHE TI AFFIDI A UN CONSULENTE',
    answer: 'Nella seconda serata ti diamo la lista delle domande da portare al prossimo appuntamento in banca.',
    detail: 'Entrerai sapendo cosa chiedere, e capirai le risposte.',
    cta: 'Voglio le domande giuste' },
  { id: 'costruisce', level: 4, label: 'CHI COSTRUISCE', img: '/benessere-patrimoniale/evento/profilo-4.jpg', alt: 'Mani che analizzano grafici di mercato al portatile',
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
  { id: 'oro', name: 'Oro', img: '/benessere-patrimoniale/evento/single.jpg', color: '#D4AF63', rates: { 5: 0.19, 10: 0.115, 15: 0.087, 20: 0.113 } },
  { id: 'argento', name: 'Argento', img: '/benessere-patrimoniale/evento/argento.jpg', color: '#C7CFD0', rates: { 5: 0.22, 10: 0.165, 15: 0.066, 20: 0.11 } },
  { id: 'msci', name: 'MSCI World', img: '/benessere-patrimoniale/evento/etf.jpg', color: '#7FB3AE', rates: { 5: 0.12, 10: 0.094, 15: 0.11, 20: 0.08 } },
  { id: 'sp500', name: 'S&P 500', img: '/benessere-patrimoniale/evento/crescita.jpg', color: '#E6C98A', rates: { 5: 0.14, 10: 0.1355, 15: 0.145, 20: 0.1154 } },
] as const;
// Fixed Italian grouping (10.000 and 6.897): ICU differs between server and browser for 4-digit numbers.
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export function eventCalculator(amount: number, years: EventHorizon = 20) {
  const real = amount / (1 + inflation[years]);
  const assets = eventAssets.map(asset => {
    const value = amount * Math.pow(1 + asset.rates[years], years);
    return { id: asset.id, name: asset.name, img: asset.img, color: asset.color, multiple: (Math.round(value / amount * 10) / 10).toString().replace('.', ','), raw: value, value: fmt(value), gain: fmt(value - amount) };
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
  { id: 'metalli', half: 'reali', share: 20, name: 'Oro e argento', color: '#D4AF63', why: 'Non dipendono da una banca né da un’azienda. Sono la parte che regge quando tutto il resto trema.' },
  { id: 'immobili', half: 'reali', share: 30, name: 'Immobili a reddito', color: '#A8875C', why: 'Producono un affitto ogni mese e nel tempo tendono a seguire l’inflazione.' },
  { id: 'etf', half: 'finanziari', share: 20, name: 'ETF', color: '#7FB3AE', why: 'Ti fanno possedere un pezzo di migliaia di aziende nel mondo con un solo strumento.' },
  { id: 'azioni', half: 'finanziari', share: 20, name: 'Azioni e obbligazioni', color: '#4E8F8C', why: 'Crescita dalle singole aziende, stabilità e cedole dalle obbligazioni.' },
  { id: 'cripto', half: 'finanziari', share: 5, name: 'Cripto', color: '#B9C7C4', why: 'Una quota piccola e consapevole su un mercato giovane e molto volatile.' },
  { id: 'passione', half: 'finanziari', share: 5, name: 'Beni da passione', color: '#EADBB8', why: 'Una Harley, una Vespa d’epoca, un Rolex, una collezione: oggetti che ami e che nel tempo possono valere di più.' },
] as const;

// "Quali di questi strumenti conosci?" — answers travel to the CRM notes.
// Positive track records only: what an informed choice in each instrument returned. Indicative, in euro, before tax and costs.
export const eventInstruments = [
  { id: 'oro', img: '/benessere-patrimoniale/evento/single.jpg', name: 'Oro', best: 'Oro fisico, in euro', ten: '+11,5% l’anno', result: '10.000 € → circa 29.800 €', role: 'Riserva di valore che non dipende da nessuna banca né da nessun emittente.' },
  { id: 'argento', img: '/benessere-patrimoniale/evento/argento.jpg', name: 'Argento', best: 'Argento fisico, in euro', ten: '+16% l’anno', result: '10.000 € → circa 44.000 €', role: 'Più dinamico dell’oro, spinto anche dalla domanda industriale.' },
  { id: 'immobili', img: '/benessere-patrimoniale/evento/immobili.jpg', name: 'Immobili a reddito', best: 'Bilocale di 60 m² messo a reddito', tenLabel: 'Resa lorda oggi, da Nord a Sud', ten: 'tra 7,7% e 8,4% l’anno', resultLabel: 'Affitti in un anno', result: 'da circa 6.600 € a 11.300 €', role: 'Il valore segue il mercato e intanto l’affitto entra ogni mese.',
    areas: [
      { name: 'Nord', price: '2.270 €/m²', rent: '14,5 €/m²', home: 'circa 136.000 €', month: 'circa 870 €', yield: '7,7%', trend: 'prezzi +6%, affitti +1%' },
      { name: 'Centro', price: '2.260 €/m²', rent: '15,8 €/m²', home: 'circa 136.000 €', month: 'circa 950 €', yield: '8,4%', trend: 'prezzi +3,6%, affitti +7,5%' },
      { name: 'Sud e isole', price: '1.410 €/m²', rent: '9,2 €/m²', home: 'circa 85.000 €', month: 'circa 550 €', yield: '7,8%', trend: 'prezzi +1,4%, affitti +6,6%' },
    ],
    highlight: 'Il caso più alto degli ultimi 10 anni: un bilocale a Milano comprato nel 2015 ha guadagnato circa 114.000 € di valore e circa 137.000 € di affitti lordi.' },
  { id: 'etf', img: '/benessere-patrimoniale/evento/etf.jpg', name: 'ETF', best: 'ETF S&P 500, in euro', ten: '+13,6% l’anno', result: '10.000 € → circa 35.700 €', role: 'Le 500 maggiori aziende americane in un solo strumento.' },
  { id: 'azioni', img: '/benessere-patrimoniale/evento/crescita.jpg', name: 'Azioni', best: 'Azioni globali (MSCI World)', ten: '+9,4% l’anno', result: '10.000 € → circa 24.600 €', role: 'Un pezzo delle aziende migliori del mondo, che crescono nel tempo.' },
  { id: 'obbligazioni', img: '/benessere-patrimoniale/evento/obbligazioni.jpg', name: 'Obbligazioni', best: 'Obbligazioni dei mercati emergenti', ten: '+5,5% l’anno', result: '10.000 € → circa 17.100 €', role: 'Interessi regolari: è la parte del patrimonio che paga una rendita.' },
  { id: 'cripto', img: '/benessere-patrimoniale/evento/cripto.jpg', name: 'Cripto', best: 'Bitcoin', ten: 'il più alto del decennio', result: 'Anche una quota del 5% ha fatto la differenza', role: 'Mercato giovane: per questo nella mappa pesa solo il 5%.' },
  { id: 'collezione', img: '/benessere-patrimoniale/evento/collezione.jpg', name: 'Beni da collezione', best: 'Orologi iconici e moto d’epoca', ten: 'variabile, legato alla rarità', result: 'Alcuni modelli hanno raddoppiato il valore in pochi anni', role: 'Oggetti che ami e che, scelti bene, nel tempo valgono di più.' },
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
