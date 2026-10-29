import { question } from '../patrimonial-radar/catalog.ts';
import type { QuestionId } from '../patrimonial-radar/types.ts';

/**
 * Editorial layer of the Radar Patrimoniale.
 * Presentation only: IDs, options, units, periods and validation rules stay canonical
 * in catalog.ts (RP-Q-1.2-draft). Here we only decide how each question is worded.
 */
type Copy = { text: string; help: string };

export const editorialQuestions: Record<QuestionId, Copy> = {
  'RP-S01': {
    text: 'Quale bilancio vuoi descrivere?',
    help: 'Puoi considerare solo la tua situazione oppure quella del nucleo con cui condividi le spese. Se scegli il nucleo, ragiona sul bilancio comune e non contare due volte il denaro che vi scambiate.',
  },
  'RP-S02': {
    text: 'Quanto conosci di questo bilancio?',
    help: 'Per esempio, potresti conoscere tutte le entrate ma solo una parte delle spese. Una conoscenza parziale va benissimo: ci aiuta a leggere correttamente le risposte.',
  },
  'RP-S03': {
    text: 'Da dove provengono le entrate?',
    help: 'Puoi indicare più fonti. Se lavori in proprio, considera il denaro che resta per la vita personale, non il fatturato.',
  },
  'RP-S04': {
    text: 'Quante altre persone dipendono economicamente da questo bilancio?',
    help: 'Basta un numero indicativo: non servono nomi né altre informazioni personali.',
  },
  'RP-A01': {
    text: 'Negli ultimi dodici mesi, quanto è entrato al netto?',
    help: 'Puoi indicare il totale dell’anno o la media mensile. Se lavori in proprio, togli i costi dell’attività, le imposte e i contributi. Non includere nuovi prestiti, vendite di beni, prelievi dai risparmi né le somme scambiate all’interno del nucleo.',
  },
  'RP-A02': {
    text: 'Nello stesso periodo, quanto è stato speso, rate dei debiti escluse?',
    help: 'Includi affitto, bollette, spesa quotidiana, assicurazioni e spese annuali. Le rate le chiediamo a parte. Escludi ciò che hai messo da parte o investito, gli acquisti di beni patrimoniali e i trasferimenti interni al nucleo. Non contare di nuovo le imposte già tolte dalle entrate.',
  },
  'RP-A03': {
    text: 'Nell’ultimo anno, come sono state coperte le spese?',
    help: 'Attingere ai risparmi seguendo un piano è diverso dal doverlo fare, o dal chiedere un prestito, senza averlo previsto.',
  },
  'RP-A04': {
    text: 'Quanto sono state prevedibili le entrate nell’ultimo anno?',
    help: 'Anche le entrate stagionali possono variare molto ed essere comunque prevedibili.',
  },
  'RP-A05': {
    text: 'Quanta parte delle entrate arriva dalla stessa fonte principale?',
    help: 'Per esempio un unico lavoro, un’impresa, una pensione o un affitto. Non serve indicarne il nome: più pagamenti che provengono dalla stessa fonte contano insieme.',
  },
  'RP-B01': {
    text: 'Oggi, quanto serve per un mese di spese essenziali, rate escluse?',
    help: 'Pensa al minimo realistico per casa, alimentazione, utenze, trasporti e altre necessità. Le rate le aggiungiamo con la domanda dedicata. È il fabbisogno di oggi, diverso dalla media dell’ultimo anno.',
  },
  'RP-B02': {
    text: 'Di quanto denaro puoi disporre oggi, o entro sette giorni, senza indebitarti né vendere a un prezzo incerto?',
    help: 'Considera i contanti e le somme che puoi prelevare davvero. Escludi fidi, carte di credito, la casa e gli investimenti che dovresti vendere in perdita o pagando una penale. Per ora includi anche le somme accantonate: le separiamo nella domanda successiva.',
  },
  'RP-B03': {
    text: 'Di questa somma, quanto è già accantonato per spese che non si possono rimandare?',
    help: 'Considera solo importi già disponibili e destinati a impegni noti dei prossimi dodici mesi, non coperti dal budget mensile. Non li sottrarremo una seconda volta dalle spese correnti.',
  },
  'RP-B04': {
    text: 'Se arrivasse una spesa imprevista pari a un mese di spese essenziali, rate comprese, come la affronteresti entro trenta giorni?',
    help: 'È uno scenario a scopo educativo. Un nuovo prestito non conta come denaro già disponibile.',
  },
  'RP-C01': {
    text: 'Quali debiti sono aperti oggi, o hanno richiesto pagamenti nell’ultimo anno?',
    help: 'Includi anche i prestiti informali e gli acquisti a rate. Un debito può esistere anche se in questo momento non stai pagando rate.',
  },
  'RP-C02': {
    text: 'Nell’ultimo anno, quanto è stato pagato in tutto per le rate?',
    help: 'Considera capitale e interessi, nello stesso periodo delle entrate. Puoi indicare il totale annuo o la media mensile. Le rate non vanno ripetute tra le spese indicate in precedenza.',
  },
  'RP-C03': {
    text: 'Nell’ultimo anno ci sono stati ritardi nel pagare rate, affitto o bollette?',
    help: 'Non servono i motivi né l’importo dei singoli ritardi.',
  },
  'RP-C04': {
    text: 'Oggi, quanto si paga di rate in un mese normale?',
    help: 'È l’importo dovuto adesso, anche se non sempre si riesce a pagarlo. Includi le rate minime obbligatorie e segnala se sai già che cambieranno. Per le scadenze non mensili puoi indicare l’importo annuo diviso per dodici.',
  },
  'RP-D01': {
    text: 'Quali impegni economici andrebbero protetti in caso di imprevisto?',
    help: 'Ragiona sulle conseguenze economiche, non sul nome di una polizza. Non indicare condizioni di salute.',
  },
  'RP-D02': {
    text: 'Per ciascuno di questi impegni, è stata individuata una forma di protezione?',
    help: 'Può essere una tutela pubblica, aziendale, contrattuale o privata, oppure una riserva scelta consapevolmente. Avere una polizza non basta: conta sapere che cosa copre.',
  },
  'RP-E01': {
    text: 'Che cosa compone oggi il patrimonio?',
    help: 'Indica solo ciò che esiste oggi: i valori sono facoltativi e potrai aggiungerli in seguito. Non includere redditi futuri né il valore teorico di pensioni non ancora maturate.',
  },
  'RP-E02': {
    text: 'Quanta parte del patrimonio, previdenza esclusa, dipende da un’unica esposizione?',
    help: 'Per esempio un solo immobile, un’impresa o più strumenti dello stesso emittente. Conta l’esposizione economica, non il numero di prodotti.',
  },
  'RP-E03': {
    text: 'Se ne avessi bisogno entro trenta giorni, quanta parte del patrimonio potresti trasformare in denaro senza incertezze sul ricavo?',
    help: 'Considera il patrimonio senza la previdenza. Una casa o una quota d’impresa, anche di valore, non sono denaro disponibile; e anche un titolo facile da vendere può valere meno del previsto al momento della vendita.',
  },
  'RP-E04': {
    text: 'Entrate e patrimonio dipendono in larga parte dalla stessa attività o dallo stesso rischio economico?',
    help: 'Per esempio, lavorare nella propria impresa e possederne anche le quote, oppure avere reddito e beni concentrati nello stesso mercato. Non servono nomi.',
  },
  'RP-F01': {
    text: 'Gli obiettivi economici dei prossimi anni sono stati definiti?',
    help: 'Anche un obiettivo piccolo conta: una riserva per gli imprevisti, una spesa da affrontare, un cambiamento da preparare o la pensione.',
  },
  'RP-F02': {
    text: 'È stato verificato su quali risorse si potrà contare in pensione o nel lungo periodo?',
    help: 'Non serve indicare l’importo della pensione né aderire a un fondo. Una simulazione o un documento, comunque, non garantiscono il futuro.',
  },
  'RP-F03': {
    text: 'Come vengono prese le principali decisioni economiche e patrimoniali?',
    help: 'Decidere in autonomia o affidarsi a un professionista sono modi diversi di procedere: non esiste una risposta migliore.',
  },
  'RP-F04': {
    text: 'Sapresti individuare e spiegare i costi complessivi degli investimenti, anche con l’aiuto di chi li segue?',
    help: 'Conoscere i costi è diverso dal sapere che esiste una commissione. Non devi inviarci documenti né contratti.',
  },
  'RP-F05': {
    text: 'Una persona possiede diversi investimenti, tutti legati alla stessa impresa. Quale affermazione è corretta?',
    help: 'È un esempio generale: non riguarda i tuoi investimenti.',
  },
  'RP-F06': {
    text: 'Quando sono stati messi a confronto, l’ultima volta, entrate, spese e obiettivi?',
    help: 'Conta anche una verifica semplice, purché concreta: non servono software né consulenti.',
  },
  'RP-X01': {
    text: 'Nell’ultimo anno, a quanto sono ammontate le entrate nette nel mese più basso?',
    help: 'Non serve indicare di quale mese si tratta: è un dato passato, non una previsione.',
  },
  'RP-X02': {
    text: 'Ci sono condizioni che l’importo delle rate, da solo, non racconta?',
    help: 'Indica soltanto se sono presenti: non servono nomi di persone né importi delle garanzie.',
  },
  'RP-X03': {
    text: 'Delle protezioni indicate, quali aspetti hai potuto verificare?',
    help: 'Per una polizza: limiti, esclusioni, franchigie e durata. Per una riserva o un’altra forma di sostegno: disponibilità, durata e spese coperte. Non indicare motivi di salute.',
  },
  'RP-X04': {
    text: 'Vuoi indicare il valore, anche per fasce, dei beni che hai selezionato?',
    help: 'Usa valori di oggi e solo la quota che appartiene a questo bilancio. Se un immobile rientra già nel valore della tua attività, non contarlo due volte. La liquidità è quella già indicata e la consideriamo una sola volta.',
  },
  'RP-X05': {
    text: 'Quanto resta da rimborsare oggi, in tutto, per i debiti?',
    help: 'Considera il capitale ancora da restituire e gli importi già scaduti, senza contare due volte gli arretrati già compresi. Non sommare le rate future, perché includono anche gli interessi. Per i debiti condivisi non ipotizzare una quota se non la conosci. Le garanzie prestate ad altri non sono un debito certo.',
  },
  'RP-X06': {
    text: 'Che cosa vorresti realizzare con queste risorse?',
    help: 'Ne basta uno; puoi indicarne fino a tre, nell’ordine che conta per te. Per ciascuno pensa a quando potrebbero servire le risorse per la prima volta. Importi e dettagli sono facoltativi: non ti proporremo prodotti né versamenti.',
  },
  'RP-X07': {
    text: 'Un esercizio: un costo del 2% applicato per un anno a 1.000 euro, che restano invariati, a quanti euro corrisponde?',
    help: 'Considera solo questa percentuale e questo importo. Non è un rendimento, né una previsione, né il costo complessivo di un tuo investimento.',
  },
  'RP-X08': {
    text: 'Su quali informazioni si basa l’ultima verifica delle risorse per il lungo periodo, e a quando risale?',
    help: 'Bastano il tipo di fonte e il periodo: niente importi né documenti.',
  },
  'RP-X09': {
    text: 'Quali risorse potresti destinare ai tuoi obiettivi, e che cosa deve restare disponibile?',
    help: 'Partiamo da liquidità, impegni e beni già indicati: non devi ricompilarli. La parte da mantenere comprende anche gli accantonamenti già dichiarati. Puoi indicare i vincoli anche senza cifre: non stiamo verificando un capitale da investire.',
  },
  'RP-X10': {
    text: 'Quali esperienze e quali dubbi vorresti condividere prima di parlarne insieme?',
    help: 'Puoi segnalare fino a tre argomenti. Non è un esame: aver posseduto uno strumento non significa conoscerne tutti i rischi. Puoi saltare qualsiasi dettaglio.',
  },
  'RP-X11': {
    text: 'Che cosa renderebbe utile, per te, un incontro con Horyzon? E come vorresti partecipare alle decisioni?',
    help: 'Va benissimo anche voler soltanto capire meglio la propria situazione. Questa scelta non prenota un incontro, non conferisce deleghe e non impegna a ricevere una proposta.',
  },
};

/** Variant shown when income comes from a pension only (canonical RP-F02 variant). */
const pensionOnlyF02 = 'Le risorse su cui si conta in pensione sono state confrontate con le esigenze dei prossimi anni?';

/** Why we ask: one short sentence under the title. */
export const editorialPurposes: Partial<Record<QuestionId, string>> = {
  'RP-S01': 'Tutte le cifre successive si riferiranno a questo bilancio.',
  'RP-S02': 'Ci permette di non trarre conclusioni da un quadro incompleto.',
  'RP-S03': 'Serve a capire da quante fonti dipende il bilancio.',
  'RP-S04': 'Serve a capire quante persone contano su queste risorse.',
  'RP-A01': 'Serve a conoscere le risorse disponibili, senza chiederti documenti.',
  'RP-A02': 'Serve a distinguere le spese dalle rate e dal risparmio.',
  'RP-A03': 'Serve a capire se le entrate sono bastate da sole.',
  'RP-A04': 'Serve a capire quanto le entrate possono variare.',
  'RP-A05': 'Serve a capire quanto pesa un cambiamento nella stessa fonte.',
  'RP-B01': 'Serve a misurare gli imprevisti rispetto alle necessità di oggi.',
  'RP-B02': 'Distingue ciò che puoi usare subito dai beni che richiedono tempo o una vendita incerta.',
  'RP-B03': 'Serve a non considerare libere somme già impegnate.',
  'RP-B04': 'Serve a capire quanto margine c’è davanti a un imprevisto.',
  'RP-C01': 'Serve a includere gli impegni nel quadro generale. Avere debiti non è un giudizio sulla persona.',
  'RP-C02': 'Serve a leggere le rate insieme alle entrate dello stesso periodo.',
  'RP-C03': 'Serve a riconoscere situazioni da approfondire, senza attribuire colpe.',
  'RP-C04': 'Serve a conoscere gli impegni mensili di oggi.',
  'RP-D01': 'Serve a individuare ciò che è importante proteggere, senza entrare nei dettagli personali.',
  'RP-D02': 'Serve a capire dove una protezione c’è già e dove manca.',
  'RP-E01': 'Bastano categorie generali: niente indirizzi, nomi di prodotti o documenti.',
  'RP-E02': 'Serve a capire se molte risorse dipendono dalla stessa esposizione.',
  'RP-E03': 'Serve a distinguere il patrimonio dalle somme utilizzabili in breve tempo.',
  'RP-E04': 'Serve a capire se un solo rischio può toccare reddito e patrimonio insieme.',
  'RP-F01': 'I tuoi progetti danno la direzione a tutta la lettura.',
  'RP-F02': 'Serve a capire quanto è chiaro il quadro del lungo periodo.',
  'RP-F03': 'Serve a conoscere il tuo modo di decidere, senza giudicarlo.',
  'RP-F04': 'Non è un esame: serve a capire quali spiegazioni potrebbero esserti utili.',
  'RP-F05': 'È solo un esempio su cui riflettere insieme, senza voti.',
  'RP-F06': 'Serve a capire quanto è recente il tuo punto della situazione.',
  'RP-X01': 'Serve a capire quanto possono scendere le entrate.',
  'RP-X04': 'Questo dettaglio è facoltativo: fasce e stime sono sufficienti, non servono cifre esatte.',
  'RP-X05': 'Serve a distinguere il debito residuo dalle rate future.',
  'RP-X06': 'I tuoi progetti guidano questa lettura; non servono importi esatti.',
  'RP-X07': 'È un esercizio facoltativo, senza voto e senza giudizi sulla persona.',
  'RP-X09': 'Serve a comprendere priorità e vincoli, senza impegnarti a investire.',
};

export function editorialQuestion(id: QuestionId, incomeRoles: readonly string[] | null): Copy & { purpose?: string } {
  const canonical = question(id), copy = editorialQuestions[id] ?? { text: canonical.text, help: canonical.help };
  const pensionOnly = id === 'RP-F02' && incomeRoles?.includes('PENSION') && !incomeRoles.some(r => ['EMPLOYEE', 'PROFESSIONAL', 'BUSINESS'].includes(r));
  return { text: pensionOnly ? pensionOnlyF02 : copy.text, help: copy.help, purpose: editorialPurposes[id] };
}

/** Answer labels, rewritten. Codes stay canonical. */
export const editorialLabels: Record<string, string> = {
  INDIVIDUAL: 'Solo la mia situazione', HOUSEHOLD: 'Il nucleo con cui condivido le spese',
  COMPLETE: 'Conosco entrate, spese e rate dell’intero bilancio', PARTIAL: 'Ne conosco solo una parte',
  EMPLOYEE: 'Lavoro dipendente', PROFESSIONAL: 'Libera professione o lavoro autonomo', BUSINESS: 'Un’impresa di cui sono titolare o socio',
  PENSION: 'Pensione o capitale previdenziale', RENT: 'Affitti o altre rendite', TRANSFERS: 'Contributi o sostegni ricevuti con regolarità',
  NONE: 'Nessuna di queste', '0': 'Nessuna', '1': 'Una persona', '2': 'Due persone', '3+': 'Tre o più persone',
  COVERED: 'Le entrate sono bastate, senza toccare i risparmi', PLANNED_DRAW: 'Si è attinto ai risparmi, come previsto da un piano',
  OCCASIONAL_GAP: 'In alcuni mesi è servito ricorrere a risparmi o prestiti non previsti', REPEATED_GAP: 'Nella maggior parte dei mesi è servito ricorrere a risparmi o prestiti non previsti',
  REGULAR: 'Regolari', PREDICTABLE_VARIABLE: 'Variabili, ma abbastanza prevedibili', UNPREDICTABLE: 'Variabili e difficili da prevedere', NO_INCOME: 'Non ci sono state entrate',
  LE50: 'Fino alla metà', GT50_LE80: 'Più della metà, fino all’80%', GT80: 'Oltre l’80%',
  OWN_AVAILABLE: 'Con denaro disponibile, senza toccare altri impegni', EARMARKED: 'Usando somme già destinate ad altro',
  SELL_OR_BORROW: 'Vendendo beni o investimenti, oppure chiedendo un prestito', CANNOT_PAY: 'Non saprei come farvi fronte',
  MORTGAGE: 'Mutuo', CONSUMER: 'Prestito personale o finanziamento', REVOLVING: 'Carta di credito revolving', OTHER: 'Altro',
  RESOLVED: 'Sì, ma ora sono risolti', CURRENT: 'Sì, e sono ancora in corso',
  INCOME: 'Le entrate, se venissero a mancare', SUPPORT: 'Il sostentamento di altre persone', HOME: 'La casa e i beni essenziali', LIABILITY: 'Danni o responsabilità verso altri',
  CHECKED: 'Verificato', UNREVIEWED: 'Da verificare', GAP: 'Nessuna strategia ancora definita',
  CASH: 'Conti e liquidità', FINANCIAL: 'Investimenti finanziari, esclusa la previdenza', OTHER_PROPERTY: 'Altri immobili', VALUABLES: 'Metalli preziosi e beni da collezione', CRYPTO: 'Cripto-attività',
  LT50: 'Meno della metà', GE50_LT75: 'Dalla metà a meno di tre quarti', GE75: 'Tre quarti o più',
  PROPERTY: 'Un immobile', FINANCIAL_ISSUER: 'Strumenti di uno stesso emittente', UNKNOWN: 'Non so',
  LT25: 'Meno di un quarto', GE25_LT50: 'Da un quarto a meno della metà', GE50_NOT_ALL: 'Almeno la metà, ma non tutto', ALL: 'Tutto', YES: 'Sì', NO: 'No',
  IDEA: 'Un’idea, ancora senza tempi né importi', HORIZON: 'Un obiettivo con un orizzonte di tempo', DEFINED: 'Un obiettivo con tempi e risorse, stimati o da verificare',
  ROUGH: 'Solo un’idea o una stima non verificata', NOT_REVIEWED: 'Non ancora',
  DIRECT: 'Decidere in autonomia', WITH_PROFESSIONAL: 'Confrontandosi con un professionista e decidendo insieme', DELEGATED_PROFESSIONAL: 'Delegando per lo più a un professionista', OTHER_HOUSEHOLD: 'Decide soprattutto un’altra persona del nucleo',
  EXPLAIN: 'Sì, saprei individuarli e spiegarli', FOUND: 'Li ho individuati, ma non saprei spiegarli', NOT_FOUND: 'Non li ho individuati',
  COUNT: 'Avere più investimenti basta a eliminare la concentrazione', EXPOSURE: 'La dipendenza dalla stessa impresa può restare',
  WITHIN3: 'Negli ultimi tre mesi', FOUR_TO12: 'Tra quattro e dodici mesi fa', OVER12: 'Più di dodici mesi fa', NEVER: 'Mai',
  GUARANTEE: 'Garanzie prestate per debiti di altri', JOINT_OBLIGATIONS: 'Debiti cointestati con obblighi aggiuntivi', VARIABLE_RATE: 'Rate a tasso variabile',
  BALLOON_OR_MORATORIUM: 'Sospensioni o una maxi-rata finale', KNOWN_CHANGE: 'Variazioni di rata già note',
  RESERVE: 'Costruire una riserva per gli imprevisti', PLANNED_EXPENSE: 'Affrontare una spesa programmata', HOUSING: 'Acquistare o ristrutturare la casa',
  REDUCE_DEBT: 'Ridurre i debiti', WORK_CHANGE: 'Preparare un cambiamento di lavoro', LONGTERM: 'Organizzare il lungo periodo',
  FAMILY_PASSAGE: 'Preparare un futuro passaggio di patrimonio in famiglia', OTHER_CLARIFY: 'Altro, da chiarire insieme',
  WITHIN12: 'Entro dodici mesi', OVER12_TO36: 'Tra uno e tre anni', OVER36: 'Oltre tre anni', ONCE: 'Una tantum', CONTINUING: 'Continuativa',
  OFFICIAL: 'Comunicazioni ufficiali dell’ente previdenziale', CONTRACTUAL: 'Documenti contrattuali del fondo o della polizza', UNVERIFIED: 'Stime personali o simulazioni non verificate',
  ACCESS: 'Poter accedere alle risorse quando servono', PRESERVE_RESERVE: 'Non toccare la riserva e gli impegni', NO_NEW_DEBT: 'Non contrarre nuovi debiti',
  NO_HOME_BUSINESS: 'Non usare la casa né l’attività d’impresa', NOW: 'Subito', DAYS7: 'Entro sette giorni', DAYS30: 'Entro trenta giorni',
  BY_GOAL_HORIZON: 'Quando servono per l’obiettivo', HARD: 'Irrinunciabile', PREFERENCE: 'Una preferenza da discutere', GLOBAL: 'Tutti gli obiettivi',
  BONDS: 'Obbligazioni e titoli di Stato', EQUITY: 'Azioni', FUNDS_ETF: 'Fondi o ETF', INSURANCE: 'Prodotti assicurativi di investimento',
  HEARD: 'Ne ho solo sentito parlare', READ_COMPARED: 'Mi sono informato o ho confrontato, senza investire', HELD_DELEGATED: 'L’ho posseduto, lasciando le decisioni ad altri', PARTICIPATED: 'Ho partecipato alle scelte o alla gestione',
  UNDERSTAND_COSTS_RISKS: 'Capire rischi, costi e vincoli prima di decidere', AVAILABILITY: 'Avere le risorse disponibili quando servono', UNCERTAIN_RESULTS: 'Capire quali risultati sono incerti',
  GUARANTEED_NO_FLUCTUATION: 'Un rendimento certo, senza oscillazioni', HIGH_RETURN_NO_RISK_LIQUID: 'Rendimenti elevati, disponibilità immediata e nessun rischio', NONE_DEFINED: 'Nessuna aspettativa precisa',
  COST: 'I costi', LOSS: 'La possibilità di perdere', FUNCTION: 'Come funziona', CONTRACT: 'Gli impegni contrattuali',
  CLARIFY_GOALS: 'Chiarire i miei obiettivi', RESOURCES_CONSTRAINTS: 'Mettere in ordine risorse e vincoli', PROTECTION: 'Capire rischi e protezioni', COST_FUNCTION: 'Capire costi e funzionamento degli strumenti',
  INFORMATION_PROFESSIONALS: 'Capire quali informazioni e quali professionisti servono', TOGETHER: 'Confrontarci e decidere insieme', CONSIDER_DELEGATION: 'Valutare una delega, dopo averne capito le condizioni',
  UNDERSTAND_FIRST: 'Capire prima le alternative, senza decidere ora', CLARIFY: 'Da chiarire',
};

/** Labels that change meaning in a specific question. */
export const editorialOverrides: Partial<Record<QuestionId, Record<string, string>>> = {
  'RP-S03': { NONE: 'Nessuna entrata', PENSION: 'Pensione' },
  'RP-S04': { '0': 'Nessuna' },
  'RP-C01': { NONE: 'Nessun debito, né oggi né nell’ultimo anno' },
  'RP-C03': { NONE: 'No, nessun ritardo' },
  'RP-D01': { NONE: 'Nessuno in particolare' },
  'RP-D02': { CHECKED: 'Sì, ed è stata verificata', UNREVIEWED: 'Sì, ma non è ancora stata verificata', GAP: 'Non ancora' },
  'RP-E01': { HOME: 'Abitazione principale', BUSINESS: 'Quote della propria attività', PENSION: 'Previdenza complementare (capitale vincolato)', NONE: 'Nessun bene da indicare' },
  'RP-E02': { BUSINESS: 'Un’impresa' },
  'RP-F01': { NONE: 'Nessun obiettivo definito' },
  'RP-F02': { CHECKED: 'Sì, con documenti ufficiali o contrattuali di data nota' },
  'RP-F03': { DIRECT: 'In autonomia' },
  'RP-X02': { NONE: 'Nessuna di queste' },
  'RP-X06': { SUPPORT: 'Sostenere altre persone' },
  'RP-X07': { '2': '2 euro', '20': '20 euro', '200': '200 euro' },
  'RP-X08': { NONE: 'Nessuna verifica', WITHIN12: 'Negli ultimi dodici mesi' },
  'RP-X10': { NONE: 'Nessuna esperienza da segnalare', PENSION: 'Previdenza complementare', CASH: 'Conti, depositi e risparmio', WITHIN12: 'Negli ultimi dodici mesi', OTHER_CLARIFY: 'Altro, da chiarire insieme' },
};

export const editorialOptionalTitles = ['Il mese più difficile', 'Le condizioni dei debiti', 'I limiti delle protezioni', 'Il valore del patrimonio', 'Il debito residuo', 'I tuoi obiettivi', 'Un esempio sui costi', 'Le fonti per il lungo periodo', 'Risorse e vincoli', 'Esperienze e aspettative', 'Che cosa ti aspetti dall’incontro'];
