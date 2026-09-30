// Advice shown in the paid Radar report. The texts below are the defaults, written in advance; the live copy
// lives in hub.radar_advice (editable from hub.horyzon.it) and overrides these row by row.
import type { RadarAreaId } from './types.ts';

export type AdviceBand = 'critico' | 'da_consolidare' | 'solido';
export type AdviceKind = 'question' | 'area' | 'autonomy' | 'ai' | 'economics' | 'global';
export interface RadarAdvice { kind: AdviceKind; subject: string; band: AdviceBand; title: string; body: string; action: string }

export const ADVICE_BANDS: readonly AdviceBand[] = ['critico', 'da_consolidare', 'solido'];
export const ADVICE_BAND_LABELS: Record<AdviceBand, string> = { critico: 'Critico', da_consolidare: 'Da consolidare', solido: 'Solido' };

/** A single 1-5 answer: 1-2 critical, 3 to consolidate, 4-5 strength. */
export function answerBand(answer: number): AdviceBand { return answer <= 2 ? 'critico' : answer === 3 ? 'da_consolidare' : 'solido'; }
/** A 0-100 index: below 40 critical, 40-69 to consolidate, 70+ solid. */
export function scoreBand(score: number): AdviceBand { return score < 40 ? 'critico' : score < 70 ? 'da_consolidare' : 'solido'; }
/** Company profit per owner hour, in euro. */
export function hourlyProfitBand(hourlyProfit: number): AdviceBand { return hourlyProfit < 15 ? 'critico' : hourlyProfit < 50 ? 'da_consolidare' : 'solido'; }

export const adviceKey = (kind: AdviceKind, subject: string, band: AdviceBand) => `${kind}:${subject}:${band}`;

type Triple = [title: string, body: string, action: string];
const set = (kind: AdviceKind, subject: string, critico: Triple, daConsolidare: Triple, solido: Triple): RadarAdvice[] =>
  ([['critico', critico], ['da_consolidare', daConsolidare], ['solido', solido]] as const).map(([band, [title, body, action]]) => ({ kind, subject, band, title, body, action }));
const q = (area: RadarAreaId, index: number, c: Triple, d: Triple, s: Triple) => set('question', `${area}#${index}`, c, d, s);

export const DEFAULT_RADAR_ADVICE: readonly RadarAdvice[] = [
  // Amministrazione
  ...q('amministrazione', 0,
    ['Cassa senza previsione', 'Oggi scopri i problemi di liquidità quando arrivano. Senza una previsione dei prossimi mesi ogni decisione di spesa è una scommessa.', 'Costruisci un prospetto di cassa settimanale per i prossimi 3 mesi, con incassi attesi e pagamenti certi, e aggiornalo ogni lunedì. Anche un foglio di calcolo basta.'],
    ['Previsione di cassa da rendere regolare', 'Hai un’idea dei prossimi mesi, ma non è ancora uno strumento che si aggiorna con regolarità.', 'Fissa un appuntamento settimanale di 30 minuti per aggiornare la previsione e confrontarla con la settimana prima.'],
    ['Cassa sotto controllo', 'Sapere cosa entra ed esce nei prossimi mesi ti permette di decidere con calma. È una base su cui costruire.', 'Affida l’aggiornamento della previsione a un collaboratore o al commercialista: tu la leggi e decidi.']),
  ...q('amministrazione', 1,
    ['Nessun piano scritto', 'Senza un piano non c’è un metro per capire se l’anno sta andando bene o male: si giudica a sensazione.', 'Scrivi un budget annuale semplice: ricavi attesi per mese, costi fissi, costi variabili. Una pagina basta per iniziare.'],
    ['Piano presente, confronto irregolare', 'Il piano esiste, ma viene guardato poco: così non guida le scelte.', 'Confronta ogni mese budget e risultati reali e annota le tre differenze più grandi con la loro causa.'],
    ['Piano e risultati dialogano', 'Confrontare piano e risultati è ciò che distingue un’impresa guidata da una che reagisce.', 'Usa il confronto mensile anche con i responsabili di reparto, ognuno sulle proprie voci.']),
  ...q('amministrazione', 2,
    ['Margini non conosciuti', 'Se non sai quanto guadagni su ogni servizio o prodotto, rischi di spingere proprio quelli che rendono meno.', 'Calcola il margine dei tuoi tre servizi o prodotti principali: prezzo meno costi diretti (materiali, ore, fornitori).'],
    ['Margini stimati, non misurati', 'Hai un’idea dei margini, ma non su tutto il listino o non aggiornata.', 'Estendi il calcolo del margine a tutto il listino e rivedilo ogni trimestre o quando cambiano i costi.'],
    ['Margini chiari', 'Conoscere i margini ti permette di scegliere cosa vendere e a chi. È un vantaggio competitivo.', 'Condividi i margini con chi vende, così le trattative proteggono il risultato e non solo il fatturato.']),
  ...q('amministrazione', 3,
    ['Spese decise d’istinto', 'Le spese importanti passano dalla tua testa, non da una regola: è difficile delegarle e controllarle.', 'Fissa una soglia di spesa oltre la quale serve un confronto con il budget, e scrivila.'],
    ['Controllo di spesa a metà', 'A volte il budget viene consultato, a volte no: la regola non è ancora un’abitudine.', 'Crea una breve lista di controllo per le spese sopra soglia e usala per tre mesi.'],
    ['Spesa governata', 'Le decisioni di spesa seguono una regola: puoi delegarle senza perdere il controllo.', 'Delega le spese sotto soglia ai responsabili e rivedi solo il riepilogo mensile.']),
  ...q('amministrazione', 4,
    ['L’amministrazione si ferma senza di te', 'Se pagamenti e incassi dipendono da te, un mese di assenza diventa un rischio per fornitori e clienti.', 'Scrivi la procedura di pagamenti e incassi e affidane l’esecuzione a una persona, con deleghe bancarie e limiti chiari.'],
    ['Autonomia amministrativa parziale', 'Alcune attività vanno avanti da sole, altre aspettano ancora la tua firma o il tuo controllo.', 'Individua le due operazioni amministrative per cui ti cercano più spesso e delegale con un limite di importo.'],
    ['Amministrazione autonoma', 'Pagamenti e incassi funzionano anche senza di te: è libertà vera per il titolare.', 'Mantieni un controllo mensile a campione e un riepilogo di cassa: fiducia, con verifica.']),
  // Produzione
  ...q('produzione', 0,
    ['Il servizio vive nella testa delle persone', 'Senza procedure scritte la qualità dipende da chi lavora quel giorno, e ogni nuovo ingresso costa settimane.', 'Scegli il processo che svolgete più spesso e scrivilo in una pagina: passaggi, responsabile, controllo finale.'],
    ['Procedure incomplete', 'Alcune attività sono scritte, altre no, oppure le procedure esistono ma non vengono aggiornate.', 'Fai rileggere le procedure a chi le usa ogni giorno e aggiornatele insieme, una al mese.'],
    ['Metodo scritto e condiviso', 'Le procedure rendono il servizio ripetibile: sono la base per crescere e delegare.', 'Trasforma le procedure in una breve guida di inserimento per i nuovi collaboratori.']),
  ...q('produzione', 1,
    ['Soddisfazione a sensazione', 'Senza una misura scopri i clienti scontenti quando se ne vanno.', 'A fine lavoro chiedi a ogni cliente due cose: un voto da 1 a 10 e cosa miglioreresti. Raccogli le risposte in un foglio.'],
    ['Misura saltuaria', 'Chiedi un parere ogni tanto, ma i dati non diventano decisioni.', 'Rendi la domanda automatica a fine servizio e guarda i risultati una volta al mese con il team.'],
    ['Clienti ascoltati', 'Misurare la soddisfazione ti dà un segnale precoce e argomenti di vendita veri.', 'Chiedi ai clienti più soddisfatti una recensione o una referenza, con il loro consenso.']),
  ...q('produzione', 2,
    ['Ogni nuovo ingresso passa da te', 'Se un nuovo collaboratore deve chiedere tutto a te, ogni assunzione ti toglie tempo invece di dartene.', 'Prepara un percorso di inserimento di due settimane: cosa leggere, chi affiancare, cosa saper fare alla fine.'],
    ['Inserimento lento', 'I nuovi imparano, ma per affiancamento e tentativi, e tu resti il riferimento.', 'Nomina per ogni nuovo ingresso un tutor che non sia tu e verifica dopo 30 giorni cosa manca.'],
    ['Inserimenti autonomi', 'Un nuovo collaboratore diventa operativo senza pesare su di te: puoi crescere.', 'Raccogli le domande più frequenti dei nuovi e aggiungile alla guida di inserimento.']),
  ...q('produzione', 3,
    ['Errori gestiti caso per caso', 'Ogni reclamo diventa un’emergenza da risolvere a mano, spesso da te, e l’errore si ripete.', 'Definisci chi riceve i reclami, entro quanto si risponde e dove si annota la causa, anche solo su un foglio condiviso.'],
    ['Gestione errori da consolidare', 'Un modo di fare esiste, ma non sempre viene seguito e le cause non vengono analizzate.', 'Una volta al mese rivedi i reclami con il team e scegli un’azione per eliminare la causa più frequente.'],
    ['Errori che insegnano', 'Un protocollo per reclami ed errori protegge i clienti e migliora il servizio nel tempo.', 'Condividi con il team i miglioramenti nati dai reclami: rafforza la cultura della qualità.']),
  ...q('produzione', 4,
    ['La qualità dipende da te', 'Se la qualità cala quando non ci sei, il tuo tempo è il limite alla crescita dell’impresa.', 'Definisci tre controlli di qualità che altri possano fare al posto tuo e scegli chi li fa.'],
    ['Qualità in parte delegata', 'Su alcuni lavori la qualità regge, su quelli importanti serve ancora il tuo occhio.', 'Scegli un tipo di lavoro importante e affidalo interamente a un collaboratore, con una verifica finale concordata.'],
    ['Qualità indipendente dal titolare', 'Il servizio mantiene il livello anche senza di te: questo aumenta il valore dell’impresa.', 'Mantieni un controllo a campione e dedica il tempo liberato allo sviluppo.']),
  // Commerciale
  ...q('commerciale', 0,
    ['Clienti che entrano ed escono senza numeri', 'Senza sapere quanti clienti arrivano e quanti perdi, non sai se l’impresa sta crescendo davvero.', 'Tieni un conteggio mensile di tre numeri: nuovi clienti, clienti persi, clienti attivi.'],
    ['Numeri commerciali parziali', 'Conosci alcuni dati, ma non in modo regolare o non per tutti i canali.', 'Aggiorna ogni mese i tre numeri e annota il motivo principale dei clienti persi.'],
    ['Portafoglio clienti misurato', 'Sai come si muove il tuo portafoglio clienti: puoi reagire prima che diventi un problema.', 'Aggiungi il valore medio per cliente, per capire quali clienti conviene cercare.']),
  ...q('commerciale', 1,
    ['Si vende a modo proprio', 'Senza un processo le vendite dipendono dal talento di chi vende, spesso il tuo.', 'Scrivi le fasi della tua vendita (primo contatto, incontro, proposta, chiusura) e cosa deve succedere in ognuna.'],
    ['Processo di vendita seguito a metà', 'Il processo esiste, ma ognuno lo adatta e senza di te si perde.', 'Usa un elenco trattative condiviso, anche un foglio, con la fase di ognuna, e rivedilo ogni settimana.'],
    ['Vendita strutturata', 'Un processo seguito da tutti rende le vendite prevedibili e insegnabili.', 'Misura quante trattative passano da una fase all’altra, per capire dove se ne perdono di più.']),
  ...q('commerciale', 2,
    ['Ogni mese si riparte da zero', 'Se le entrate sono quasi tutte occasionali, ogni mese devi rincorrere nuove vendite.', 'Individua un servizio che i clienti usano di continuo e proponilo come abbonamento o contratto annuale.'],
    ['Ricorrenza da far crescere', 'Una parte delle entrate si ripete, ma non basta ancora a dare stabilità.', 'Proponi rinnovo o abbonamento a tutti i clienti attuali prima di cercarne di nuovi.'],
    ['Entrate stabili', 'Le entrate ricorrenti rendono l’impresa più stabile e più facile da pianificare.', 'Proteggi i rinnovi con un contatto periodico e misura quanti clienti non rinnovano.']),
  ...q('commerciale', 3,
    ['Chi vende impara da solo', 'Senza formazione chi vende ripete i propri errori, e il risultato resta legato a te.', 'Organizza una sessione al mese sulle obiezioni più frequenti, con simulazioni di trattativa.'],
    ['Formazione occasionale', 'Qualche formazione c’è stata, ma non è un percorso.', 'Definisci un piccolo percorso: tre temi in tre mesi, con un obiettivo misurabile per ognuno.'],
    ['Team di vendita preparato', 'Chi vende ha metodo e strumenti: le vendite non dipendono solo da te.', 'Fai condividere al venditore migliore le sue pratiche con il resto del team.']),
  ...q('commerciale', 4,
    ['Le trattative importanti aspettano te', 'Se le vendite importanti si chiudono solo con te, il tuo tempo decide il fatturato.', 'Scegli una trattativa di media importanza e falla condurre a un collaboratore dall’inizio alla fine, con te solo come supporto.'],
    ['Delega commerciale parziale', 'Alcune trattative si chiudono senza di te, le più grandi no.', 'Definisci sconti e condizioni che chi vende può concedere senza chiederti.'],
    ['Vendite indipendenti dal titolare', 'Le trattative si chiudono anche senza di te: il fatturato non dipende dalla tua agenda.', 'Dedica il tuo tempo ai clienti strategici e alle relazioni che solo tu puoi aprire.']),
  // Marketing
  ...q('marketing', 0,
    ['Cliente ideale non definito', 'Se non è chiaro a chi ti rivolgi e perché scegliere te, ogni messaggio vale poco.', 'Descrivi in una pagina il tuo cliente migliore di oggi: settore, dimensione, problema, perché ti ha scelto.'],
    ['Posizionamento da affinare', 'Hai un’idea del tuo cliente, ma il messaggio non è ancora netto.', 'Scrivi in una frase cosa fai, per chi e cosa ti distingue, e verificala con tre clienti.'],
    ['Posizionamento chiaro', 'Sapere per chi lavori e cosa ti distingue rende più efficace ogni euro di marketing.', 'Usa la tua differenza in modo coerente su sito, social e proposte commerciali.']),
  ...q('marketing', 1,
    ['Contatti solo dal passaparola', 'Il passaparola è prezioso ma imprevedibile: non puoi pianificare la crescita.', 'Scegli un canale da presidiare con costanza (contenuti, campagne o collaborazioni) e conta i contatti che porta ogni mese.'],
    ['Flusso di contatti irregolare', 'Qualche canale funziona, ma a periodi.', 'Scegli il canale che rende di più e dagli un calendario fisso per tre mesi.'],
    ['Flusso di contatti costante', 'Un flusso regolare di richieste rende la crescita pianificabile.', 'Misura quanto ti costa ogni contatto per canale e sposta il budget su quelli che rendono.']),
  ...q('marketing', 2,
    ['Reputazione online trascurata', 'I clienti ti cercano online prima di contattarti: se trovano poco, perdi fiducia.', 'Chiedi una recensione ai dieci clienti più soddisfatti e aggiorna la scheda Google dell’azienda.'],
    ['Reputazione curata a tratti', 'Recensioni e profili ci sono, ma non vengono seguiti con regolarità.', 'Rispondi a tutte le recensioni entro una settimana e pubblica almeno un contenuto al mese.'],
    ['Reputazione solida', 'Una buona reputazione online accorcia le trattative e toglie peso al prezzo.', 'Porta le recensioni migliori dentro sito e proposte commerciali, dove il cliente decide.']),
  ...q('marketing', 3,
    ['Visibilità senza vendite', 'Il marketing fa rumore ma non porta contatti pronti per chi vende.', 'Definisci con chi vende cosa rende buono un contatto e filtra le richieste con due o tre domande prima di passarle.'],
    ['Marketing e vendite poco allineati', 'Alcuni contatti arrivano pronti, molti no.', 'Fate un incontro mensile tra marketing e vendite per vedere quali contatti sono diventati clienti e da dove venivano.'],
    ['Marketing che alimenta le vendite', 'I contatti arrivano già interessati: chi vende lavora meglio e più in fretta.', 'Misura, per ogni canale, quanti contatti diventano clienti.']),
  ...q('marketing', 4,
    ['Il marketing si ferma senza di te', 'Se sei tu a scrivere, pubblicare e decidere tutto, il marketing esiste solo quando hai tempo.', 'Affida a una persona o a un fornitore un calendario di pubblicazioni di tre mesi, con te solo in approvazione.'],
    ['Marketing in parte delegato', 'Qualcuno esegue, ma idee e decisioni passano ancora da te.', 'Scrivi linee guida semplici (tono, temi, cosa non dire), così chi esegue può decidere da solo.'],
    ['Marketing autonomo', 'Il marketing va avanti anche senza di te: la visibilità non dipende dalla tua agenda.', 'Rivedi i risultati una volta al mese, non i singoli contenuti.']),
  // Risorse umane
  ...q('risorse-umane', 0,
    ['Si assume d’urgenza', 'Senza un processo di selezione si assume chi c’è quando serve, e gli errori costano cari.', 'Per il prossimo ruolo scrivi prima una descrizione chiara (compiti, risultati attesi, competenze) e fai le stesse domande a tutti i candidati.'],
    ['Selezione da rendere metodo', 'Qualche passaggio c’è, ma cambia ogni volta.', 'Prepara un modello di annuncio e una scheda di valutazione uguale per tutti i colloqui.'],
    ['Selezione strutturata', 'Un processo di selezione chiaro riduce gli errori e attira persone migliori.', 'Misura quante persone assunte sono ancora in azienda dopo un anno.']),
  ...q('risorse-umane', 1,
    ['Ruoli confusi', 'Se le persone non sanno chi decide cosa, tutto torna da te.', 'Disegna l’organigramma attuale e scrivi, per ogni ruolo, tre responsabilità e a chi risponde.'],
    ['Ruoli in parte chiari', 'I ruoli esistono, ma i confini tra l’uno e l’altro sono sfumati.', 'Chiarisci con ogni persona quali decisioni può prendere da sola e quali deve condividere.'],
    ['Responsabilità chiare', 'Ognuno sa cosa fare e a chi rispondere: le decisioni non si accumulano sul titolare.', 'Rivedi l’organigramma una volta l’anno o quando l’impresa cresce.']),
  ...q('risorse-umane', 2,
    ['Nessun momento di squadra', 'Senza momenti condivisi le persone lavorano accanto, ma non insieme.', 'Fissa una riunione di 30 minuti ogni due settimane per condividere risultati e problemi.'],
    ['Squadra curata a volte', 'Qualche momento insieme c’è, ma non è regolare.', 'Metti in calendario per tutto l’anno gli incontri di squadra, così non dipendono dalle urgenze.'],
    ['Squadra unita', 'Curare il clima rende le persone più coinvolte e meno dipendenti dalle tue istruzioni.', 'Affida a rotazione ai collaboratori l’organizzazione dei momenti di squadra.']),
  ...q('risorse-umane', 3,
    ['Benessere non misurato', 'Scopri il malessere delle persone quando qualcuno se ne va.', 'Due volte l’anno fai un breve questionario anonimo sul clima, di cinque domande, e condividi i risultati.'],
    ['Ascolto occasionale', 'Parli con le persone, ma senza un modo regolare di capire come stanno.', 'Introduci un colloquio individuale di 20 minuti ogni trimestre con ogni collaboratore.'],
    ['Persone ascoltate', 'Misurare il benessere ti permette di intervenire prima che nascano problemi.', 'Collega i risultati dell’ascolto a una o due azioni concrete e comunicale a tutti.']),
  ...q('risorse-umane', 4,
    ['Dipendenza da persone chiave', 'Se una persona chiave se ne va, l’impresa si ferma: è un rischio grande quanto la tua assenza.', 'Individua le due persone indispensabili e affianca a ognuna una seconda persona sulle attività critiche.'],
    ['Sostituzioni possibili ma difficili', 'Qualcuno potrebbe subentrare, ma con fatica e perdita di informazioni.', 'Chiedi a ogni persona chiave di scrivere le proprie attività ricorrenti e dove si trovano le informazioni.'],
    ['Squadra che regge le assenze', 'Nessuno è insostituibile: l’impresa è più solida e vale di più.', 'Mantieni l’affiancamento sulle attività critiche anche quando tutto va bene.']),

  // Area readings
  ...set('area', 'amministrazione',
    ['Amministrazione da mettere in sicurezza', 'I numeri arrivano tardi o non arrivano: le decisioni si prendono a sensazione e la cassa può sorprenderti.', 'Parti da cassa a tre mesi e margini dei servizi principali: sono le due informazioni che cambiano più decisioni.'],
    ['Amministrazione in costruzione', 'Alcuni strumenti ci sono, ma non sono ancora un sistema regolare che guida le scelte.', 'Rendi fissi gli appuntamenti con i numeri: cassa ogni settimana, budget ogni mese.'],
    ['Amministrazione solida', 'I numeri guidano le decisioni: è una base su cui far crescere gli altri reparti.', 'Usa questa solidità per delegare: numeri chiari rendono sicura la delega.']),
  ...set('area', 'produzione',
    ['Servizio fragile', 'La qualità dipende da persone e giornate: è difficile crescere senza perdere clienti.', 'Parti dalla procedura del servizio più venduto e da un controllo di qualità fatto da altri.'],
    ['Produzione in costruzione', 'Il servizio funziona, ma poggia ancora molto su abitudini e sulla tua presenza.', 'Scrivi e aggiorna le procedure insieme a chi lavora ogni giorno.'],
    ['Produzione solida', 'Il servizio è ripetibile e misurato: puoi aumentare i volumi con fiducia.', 'Usa procedure e misure di soddisfazione come argomento di vendita.']),
  ...set('area', 'commerciale',
    ['Vendite che dipendono da te', 'Senza numeri e senza un processo, il fatturato segue la tua energia e la tua agenda.', 'Parti dai tre numeri mensili (nuovi, persi, attivi) e da una trattativa delegata.'],
    ['Commerciale in costruzione', 'Qualche metodo c’è, ma le vendite importanti restano legate a te.', 'Definisci le condizioni che chi vende può concedere senza chiederti.'],
    ['Commerciale solido', 'Le vendite hanno metodo e numeri: il fatturato è più prevedibile.', 'Lavora sulle entrate ricorrenti per rendere la crescita ancora più stabile.']),
  ...set('area', 'marketing',
    ['Marketing da impostare', 'I clienti arrivano soprattutto dal passaparola e da te: la crescita non è pianificabile.', 'Parti dal cliente ideale e da un solo canale presidiato con costanza.'],
    ['Marketing in costruzione', 'Qualcosa si muove, ma senza continuità e con pochi contatti pronti per chi vende.', 'Allinea marketing e vendite su cosa rende buono un contatto.'],
    ['Marketing solido', 'Hai un posizionamento chiaro e un flusso di contatti costante.', 'Misura quanto ti costa acquisire un cliente, per investire dove rende.']),
  ...set('area', 'risorse-umane',
    ['Organizzazione delle persone da costruire', 'Ruoli poco chiari e dipendenza da poche persone: tutto torna sulla tua scrivania.', 'Parti dall’organigramma, con tre responsabilità per ruolo, e dall’affiancamento sulle persone chiave.'],
    ['Persone in costruzione', 'La squadra c’è, ma ruoli, ascolto e selezione non sono ancora un metodo.', 'Introduci colloqui individuali regolari e una scheda di selezione unica.'],
    ['Persone solide', 'Ruoli chiari e squadra curata: l’impresa regge anche le assenze.', 'Investi sulla crescita delle persone chiave, per prepararle a nuove responsabilità.']),

  ...set('autonomy', 'titolare',
    ['L’impresa dipende da te', 'In quasi tutti i reparti le attività si fermano o rallentano quando non ci sei. Il tuo tempo è il limite della crescita.', 'Scegli un reparto e un’attività da delegare completamente nei prossimi 90 giorni, con procedura e responsabile.'],
    ['Autonomia parziale', 'Alcuni reparti vanno avanti senza di te, altri no: la dipendenza è concentrata in pochi punti.', 'Concentrati sul reparto dove l’autonomia è più bassa: è lì che il tuo tempo resta bloccato.'],
    ['Impresa autonoma', 'L’impresa funziona anche senza la tua presenza diretta: puoi dedicarti alla direzione e allo sviluppo.', 'Mantieni riunioni periodiche e numeri chiari per guidare senza tornare operativo.']),
  ...set('ai', 'ai',
    ['AI ancora lontana', 'L’intelligenza artificiale è poco usata o il team non si sente pronto. Si può partire da piccoli passi.', 'Scegli un’attività ripetitiva (email, preventivi, report) e prova per un mese uno strumento di AI con una persona del team.'],
    ['AI in sperimentazione', 'L’AI viene usata, ma a macchia di leopardo e senza regole comuni.', 'Raccogli gli usi che funzionano, scrivi due regole d’uso (dati e verifica) e condividile con tutti.'],
    ['AI nel lavoro quotidiano', 'Il team usa l’AI e si sente pronto: può diventare una leva per ridurre la dipendenza da te.', 'Collega l’AI alle procedure scritte, così aiuta a fare il lavoro senza chiedere a te.']),
  ...set('economics', 'utile_ora',
    ['Il tuo tempo rende poco', 'Ogni ora che dedichi all’impresa genera poco utile. Lavorare di più non basta: serve cambiare dove va il tuo tempo.', 'Elenca le attività a basso valore che fai ogni settimana e decidi quali delegare o eliminare.'],
    ['Il tuo tempo rende, con margini di miglioramento', 'Il tuo tempo produce utile, ma una parte delle ore va in attività che altri potrebbero fare.', 'Sposta almeno cinque ore a settimana da attività operative a vendita, sviluppo o controllo.'],
    ['Il tuo tempo rende bene', 'Ogni ora che dedichi all’impresa produce un utile significativo.', 'Proteggi le ore ad alto valore e delega il resto: è così che l’utile per ora continua a crescere.']),
  ...set('global', 'indice',
    ['Fondamenta da costruire', 'L’impresa funziona soprattutto grazie a te e a poche persone: organizzazione e autonomia sono ancora deboli.', 'Nei prossimi 90 giorni lavora su un solo reparto, quello prioritario: meglio un passo fatto che dieci iniziati.'],
    ['Impresa in costruzione', 'Ci sono basi su cui lavorare: alcuni reparti sono organizzati, altri dipendono ancora da te.', 'Porta il reparto prioritario al livello di quello più solido, usando lo stesso metodo.'],
    ['Impresa organizzata', 'Organizzazione e autonomia sono buone: l’impresa ha basi solide per crescere.', 'Punta sulla crescita: nuovi servizi, nuovi mercati o nuove persone chiave.']),
];

/** Database rows override the defaults one by one; a missing or empty row falls back to the default text. */
export function mergeAdvice(rows: readonly Partial<RadarAdvice>[]): Map<string, RadarAdvice> {
  const map = new Map(DEFAULT_RADAR_ADVICE.map((advice) => [adviceKey(advice.kind, advice.subject, advice.band), advice]));
  for (const row of rows) {
    if (!row.kind || !row.subject || !row.band) continue;
    const key = adviceKey(row.kind, row.subject, row.band);
    const base = map.get(key);
    if (!base) continue;
    map.set(key, { ...base, title: row.title?.trim() || base.title, body: row.body?.trim() || base.body, action: row.action?.trim() || base.action });
  }
  return map;
}
