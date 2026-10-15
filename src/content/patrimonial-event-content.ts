// Public presentation content from the supplied event mockup. No provider configuration.
export const eventScenes = [
      { id: 'banca', profile: 'Privato', label: "L'APPUNTAMENTO IN BANCA", img: '/benessere-patrimoniale/evento/s_bank.jpg', alt: 'Facciata di una banca in stile classico',
        text: 'Il consulente ti mostra un grafico e usa tre sigle che non conosci. Annuisci. Firmi. Esci senza aver capito davvero cosa hai sottoscritto.',
        thought: 'Mi fido… ma di cosa, esattamente?',
        kicker: 'PER TE CHE ESCI DALLA BANCA CON PIÙ DUBBI CHE RISPOSTE',
        answer: 'La domanda n°6 è per te: quella da fare a qualunque consulente prima di firmare.',
        detail: 'Ci dedichiamo un intero blocco, con esempi reali. Al prossimo appuntamento entrerai sapendo cosa chiedere.',
        cta: 'Voglio quella domanda' },
      { id: 'impresa', profile: 'Imprenditore', label: "L'IMPRENDITORE", img: '/benessere-patrimoniale/evento/s_business.jpg', alt: "Ingranaggi d'oro e un lingotto",
        text: "Nell'azienda hai messo anni, notti e soldi. Poi una sera ti chiedi: se qualcosa andasse storto, cosa resterebbe fuori dall'azienda per la tua famiglia?",
        thought: 'Ho costruito tanto. Ma è davvero al sicuro?',
        kicker: 'PER TE CHE HAI COSTRUITO UN’IMPRESA',
        answer: "Vedremo i rischi che non compaiono in nessun bilancio: quelli che legano il tuo patrimonio personale all'azienda.",
        detail: 'È il cuore del punto 03. Molti imprenditori lo scoprono quando è tardi: tu puoi guardarlo adesso, con calma.',
        cta: 'Riservo il posto da imprenditore' },
      { id: 'cassa', profile: 'Privato', label: 'ALLA CASSA', img: '/benessere-patrimoniale/evento/s_cart.jpg', alt: "Moneta d'oro a cui manca una fetta",
        text: 'Stessa spesa di qualche anno fa, scontrino molto più lungo. Il conto è lì, fermo, intatto. Eppure ogni mese compra un po’ meno.',
        thought: 'Ho fatto tutto giusto. Perché mi sento più povero?',
        kicker: 'PER TE CHE SENTI IL CARRELLO PIÙ PESANTE',
        answer: "Non è una tua impressione: è la fetta che l'inflazione si prende in silenzio. Nell'incontro vediamo come proteggerla.",
        detail: 'Prova il calcolatore qui sotto con la tua cifra: è il punto di partenza del primo capitolo.',
        cta: 'Voglio capire come proteggermi' },
      { id: 'figli', profile: 'Genitore / famiglia', label: 'I TUOI FIGLI', img: '/benessere-patrimoniale/evento/s_hourglass.jpg', alt: "Clessidra con sabbia d'oro",
        text: 'Pensi a cosa lascerai a chi ami. E ti accorgi che sai bene quanto hai messo da parte, ma non come proteggerlo nei prossimi vent’anni.',
        thought: 'Voglio che arrivi a loro. Intero.',
        kicker: 'PER TE CHE PENSI A CHI VERRÀ DOPO',
        answer: 'Parleremo di come ragionare sul patrimonio su un orizzonte di vent’anni, non del prossimo trimestre.',
        detail: 'È lì che la riserva di valore, e il ruolo dell’oro fisico, cambiano davvero il quadro.',
        cta: 'Riservo il posto per la mia famiglia' },
    ] as const;

export const eventProfiles = [
  { label: 'Privato', value: 'Privato' },
  { label: 'Imprenditore', value: 'Imprenditore' },
  { label: 'Professionista', value: 'Professionista' },
  { label: 'Genitore / famiglia', value: 'Altro' },
] as const;
export function eventProfileValue(label: string) {
  return eventProfiles.find(profile => profile.label === label)?.value ?? '';
}
const titles: Record<string, string> = { "Privato": 'Riserva il tuo posto. I tuoi risparmi meritano 90 minuti.', "Imprenditore": 'Riserva il tuo posto. Hai protetto l’azienda: ora tocca a te.', "Professionista": 'Riserva il tuo posto. Arriva preparato a ogni conversazione sul patrimonio.', "Genitore / famiglia": 'Riserva il tuo posto. Per ciò che vuoi lasciare intero.' };
export function eventFormTitle(profile: string) {
  return titles[profile] ?? 'Riserva il tuo posto. Ci vogliono 30 secondi.';
}
export function eventCalculator(amount: number) {
  const lostRaw = amount * (1 - 1 / 1.171);
  const lost = Math.round(lostRaw / 100) * 100;
  const fmt = (n: number) => Math.round(n).toLocaleString('it-IT');
  return {
    amount: fmt(amount), real: fmt(amount - lost), lost: fmt(lost),
    perDay: (lostRaw / 1826).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
}
