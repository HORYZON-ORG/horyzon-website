import type { ServiceRoute } from './editorial-routes';

type Presentation = {
  words: readonly [string, string, string];
  caption: string;
  question: string;
  workTitle: string;
  evidenceTitle: string;
};

// Editorial framing only: diagnostic, interventions and evidence stay in editorial-routes.
export const servicePresentation = {
  'benessere-organizzativo/analisi-organizzativa': {
    words: ['Ruoli', 'Passaggi', 'Responsabilità'],
    caption: 'Rendere leggibile il lavoro, prima di cambiarlo.',
    question: 'Dove si ferma il lavoro?',
    workTitle: 'Dai blocchi a una mappa condivisa.',
    evidenceTitle: 'Responsabilità che si possono riconoscere.',
  },
  'benessere-organizzativo/sviluppo-imprenditoriale': {
    words: ['Visione', 'Priorità', 'Deleghe'],
    caption: 'La visione diventa una direzione condivisa.',
    question: 'La crescita dipende ancora tutta da te?',
    workTitle: 'Dare alla visione una forma praticabile.',
    evidenceTitle: 'Più direzione nelle scelte di ogni giorno.',
  },
  'benessere-organizzativo/human-management': {
    words: ['Persone', 'Contributo', 'Crescita'],
    caption: 'Ogni persona deve poter vedere il proprio contributo.',
    question: 'Le persone sanno dove possono fare la differenza?',
    workTitle: 'Collegare persone, ruoli e contributi.',
    evidenceTitle: 'Accordi chiari. Contributi riconoscibili.',
  },
  'benessere-patrimoniale/visione-patrimoniale': {
    words: ['Obiettivi', 'Orizzonti', 'Continuità'],
    caption: 'Una direzione comprensibile, prima degli strumenti.',
    question: 'Le tue scelte guardano lo stesso orizzonte?',
    workTitle: 'Mettere in relazione ciò che vuoi proteggere.',
    evidenceTitle: 'Una mappa per orientare il confronto.',
  },
  'benessere-patrimoniale/imprenditori': {
    words: ['Impresa', 'Persona', 'Famiglia'],
    caption: 'Il valore costruito si legge insieme alle responsabilità.',
    question: 'Impresa e famiglia decidono senza una vista comune?',
    workTitle: 'Dare ordine alle priorità di continuità.',
    evidenceTitle: 'Obiettivi distinti. Una lettura comune.',
  },
  'benessere-patrimoniale/professionisti': {
    words: ['Obiettivi', 'Competenze', 'Confronto'],
    caption: 'Competenze diverse intorno a una direzione chiara.',
    question: 'Chi tiene insieme obiettivi e interlocutori?',
    workTitle: 'Coordinare il contributo dei professionisti.',
    evidenceTitle: 'Un confronto che resta leggibile nel tempo.',
  },
  'benessere-digitale/imprese': {
    words: ['Processi', 'Connessioni', 'Adozione'],
    caption: 'Strumenti connessi al lavoro che devono aiutare.',
    question: 'Il digitale semplifica o aggiunge altri passaggi?',
    workTitle: 'Dal punto di attrito alla prova sul campo.',
    evidenceTitle: 'Adozione visibile nel lavoro reale.',
  },
  'benessere-digitale/competenze': {
    words: ['Comprendere', 'Scegliere', 'Governare'],
    caption: 'La competenza serve quando orienta una scelta reale.',
    question: 'Gli strumenti cambiano. E le capacità di usarli?',
    workTitle: 'Imparare dentro i casi d’uso quotidiani.',
    evidenceTitle: 'Capacità che vanno oltre la formazione.',
  },
  'benessere-digitale/italia-digitale': {
    words: ['Competitività', 'Inclusione', 'Capacità'],
    caption: 'Il progresso vale per ciò che rende possibile.',
    question: 'L’innovazione sta rendendo le persone più capaci?',
    workTitle: 'Collegare adozione, contesto e responsabilità.',
    evidenceTitle: 'Una cultura digitale ancorata alla realtà.',
  },
} as const satisfies Record<ServiceRoute, Presentation>;
