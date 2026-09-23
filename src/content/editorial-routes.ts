export const serviceRoutes = [
 'benessere-organizzativo/analisi-organizzativa',
 'benessere-organizzativo/sviluppo-imprenditoriale',
 'benessere-organizzativo/human-management',
 'benessere-patrimoniale/visione-patrimoniale',
 'benessere-patrimoniale/imprenditori',
 'benessere-patrimoniale/professionisti',
 'benessere-digitale/imprese',
 'benessere-digitale/competenze',
 'benessere-digitale/italia-digitale',
] as const;

export type ServiceRoute = (typeof serviceRoutes)[number];
type AreaRoute = 'benessere-organizzativo' | 'benessere-patrimoniale' | 'benessere-digitale';
export type ServiceEditorial = {
 parent: AreaRoute;
 urgency: readonly string[];
 interventions: readonly string[];
 evidence: readonly string[];
 nextLabel: string;
};

export const serviceEditorial: Record<ServiceRoute, ServiceEditorial> = {
 'benessere-organizzativo/analisi-organizzativa': {
  parent: 'benessere-organizzativo', nextLabel: 'Torna al benessere organizzativo',
  urgency: ['Le decisioni restano in coda perché non è chiaro chi le prende.', 'Le responsabilità si sovrappongono e il lavoro torna sempre al titolare.', 'Errori e ritardi si ripetono senza un punto del processo in cui intervenire.'],
  interventions: ['Leggiamo ruoli, passaggi e dipendenze nel lavoro reale.', 'Rendiamo espliciti responsabilità, decisioni e punti di confronto.', 'Scegliamo pochi indicatori utili per verificare il cambiamento.'],
  evidence: ['Una mappa condivisa di ruoli e responsabilità.', 'Decisioni con un proprietario nominato.', 'Una routine di verifica che intercetta i blocchi prima che crescano.'],
 },
 'benessere-organizzativo/sviluppo-imprenditoriale': {
  parent: 'benessere-organizzativo', nextLabel: 'Torna al benessere organizzativo',
  urgency: ['Ogni scelta importante richiede la presenza del titolare.', 'La crescita aggiunge urgenze, ma non aumenta la capacità di decidere.', 'La visione dell’impresa resta difficile da tradurre in priorità operative.'],
  interventions: ['Trasformiamo obiettivi e intuizioni in priorità osservabili.', 'Disegniamo deleghe progressive con confini e momenti di confronto.', 'Costruiamo un ritmo di guida che separa strategia, operatività e verifica.'],
  evidence: ['Priorità condivise e ordinate nel tempo.', 'Deleghe con responsabilità e soglie di escalation chiare.', 'Tempo restituito alle decisioni che richiedono davvero il titolare.'],
 },
 'benessere-organizzativo/human-management': {
  parent: 'benessere-organizzativo', nextLabel: 'Torna al benessere organizzativo',
  urgency: ['Le persone ricevono compiti, ma non vedono il proprio contributo.', 'Le aspettative cambiano a seconda di chi parla.', 'Talenti e responsabilità restano scollegati dalle priorità dell’impresa.'],
  interventions: ['Mettiamo in relazione ruolo, contributo atteso e contesto.', 'Definiamo confronti utili per feedback, sviluppo e responsabilità.', 'Rendiamo visibili gli accordi che aiutano il team a lavorare insieme.'],
  evidence: ['Ruoli descritti con un contributo riconoscibile.', 'Confronti regolari basati su fatti e responsabilità.', 'Persone che sanno quando decidere, collaborare o chiedere supporto.'],
 },
 'benessere-patrimoniale/visione-patrimoniale': {
  parent: 'benessere-patrimoniale', nextLabel: 'Torna al benessere patrimoniale',
  urgency: ['Obiettivi personali, familiari e professionali vengono affrontati separatamente.', 'Le scelte si accumulano senza una vista che colleghi tempi, vincoli e priorità.', 'Gli strumenti arrivano prima della direzione che dovrebbero servire.'],
  interventions: ['Partiamo dagli obiettivi e dalle responsabilità da proteggere.', 'Rendiamo leggibili alternative, orizzonti temporali e domande aperte.', 'Coordiniamo il confronto con i professionisti competenti quando necessario.'],
  evidence: ['Una mappa che collega obiettivi, vincoli e orizzonti.', 'Domande utili da portare ai professionisti abilitati.', 'Decisioni prese con una direzione dichiarata.'],
 },
 'benessere-patrimoniale/imprenditori': {
  parent: 'benessere-patrimoniale', nextLabel: 'Torna al benessere patrimoniale',
  urgency: ['Il valore dell’impresa e le esigenze personali si influenzano senza una lettura comune.', 'La continuità familiare dipende da decisioni rimandate.', 'Il titolare porta da solo rischi che coinvolgono più sistemi.'],
  interventions: ['Mettiamo a fuoco le connessioni tra impresa, persona e famiglia.', 'Ordiniamo le priorità di continuità senza sostituire le professioni regolamentate.', 'Prepariamo un linguaggio condiviso per i tavoli di decisione.'],
  evidence: ['Priorità di continuità dichiarate e comprensibili.', 'Un quadro di domande condiviso con consulenti qualificati.', 'Scelte che distinguono gli obiettivi senza ignorare le connessioni.'],
 },
 'benessere-patrimoniale/professionisti': {
  parent: 'benessere-patrimoniale', nextLabel: 'Torna al benessere patrimoniale',
  urgency: ['Il valore creato dal lavoro non viene letto oltre il presente.', 'Informazioni e competenze sono frammentate tra interlocutori.', 'Le scelte di protezione e continuità restano senza una priorità condivisa.'],
  interventions: ['Raccogliamo gli obiettivi che richiedono una lettura coordinata.', 'Distinguiamo il contributo dei diversi professionisti coinvolti.', 'Costruiamo una sequenza di decisioni comprensibile per chi deve sostenerla.'],
  evidence: ['Obiettivi ordinati per rilevanza e orizzonte.', 'Interlocutori chiamati con un ruolo chiaro.', 'Un percorso di confronto che resta leggibile nel tempo.'],
 },
 'benessere-digitale/imprese': {
  parent: 'benessere-digitale', nextLabel: 'Torna al benessere digitale',
  urgency: ['Le informazioni passano tra strumenti scollegati e persone sovraccariche.', 'Le attività ripetitive sottraggono tempo alle decisioni utili.', 'Ogni nuova tecnologia aggiunge eccezioni invece di semplificare il lavoro.'],
  interventions: ['Partiamo dai passaggi di lavoro che oggi creano attrito.', 'Scegliamo strumenti e connessioni compatibili con ruoli e autorizzazioni.', 'Verifichiamo l’adozione nel lavoro reale prima di estendere una soluzione.'],
  evidence: ['Un processo più leggibile per chi lo usa.', 'Informazioni disponibili nel punto in cui servono.', 'Attivazioni documentate e verificabili.'],
 },
 'benessere-digitale/competenze': {
  parent: 'benessere-digitale', nextLabel: 'Torna al benessere digitale',
  urgency: ['Gli strumenti cambiano più velocemente delle abitudini di lavoro.', 'Le persone usano l’AI senza criteri condivisi.', 'La formazione resta separata dalle decisioni e dai processi quotidiani.'],
  interventions: ['Colleghiamo competenze digitali a casi d’uso reali.', 'Definiamo confini, autorizzazioni e responsabilità per gli strumenti approvati.', 'Creiamo momenti di prova, confronto e miglioramento.'],
  evidence: ['Casi d’uso compresi e ripetibili.', 'Persone che riconoscono limiti e responsabilità dell’AI.', 'Competenze verificate nel lavoro, non solo in aula.'],
 },
 'benessere-digitale/italia-digitale': {
  parent: 'benessere-digitale', nextLabel: 'Torna al benessere digitale',
  urgency: ['Il digitale viene raccontato come velocità, ma lascia indietro capacità e contesto.', 'Imprese e territori faticano a condividere una cultura dell’adozione.', 'L’innovazione è valutata per novità e non per impatto sul lavoro.'],
  interventions: ['Portiamo il confronto digitale dentro bisogni, competenze e responsabilità reali.', 'Rendiamo l’adozione accessibile senza semplificare i suoi rischi.', 'Colleghiamo competitività, inclusione e qualità delle decisioni.'],
  evidence: ['Una conversazione digitale ancorata a casi concreti.', 'Scelte che rendono persone e organizzazioni più capaci.', 'Progresso valutato anche per ciò che rende possibile nel tempo.'],
 },
};

export function isServiceRoute(route: string): route is ServiceRoute {
 return serviceRoutes.includes(route as ServiceRoute);
}
