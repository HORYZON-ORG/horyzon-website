export type DepartmentId = 'administration' | 'production' | 'sales' | 'marketing' | 'people';
export type Department = {
  id: DepartmentId;
  name: string;
  purpose: string;
  signals: readonly string[];
  destination: string;
};

export const departments: readonly Department[] = [
  { id: 'administration', name: 'Amministrazione', purpose: 'Rendere leggibili cassa, margini, budget e continuità.', signals: ['Decisioni di spesa senza budget', 'Margini non disponibili per prodotto o servizio'], destination: 'Numeri condivisi e decisioni sostenute da un piano.' },
  { id: 'production', name: 'Produzione', purpose: 'Trasformare la promessa commerciale in qualità replicabile.', signals: ['Qualità dipendente dal titolare', 'Errori gestiti caso per caso'], destination: 'Standard chiari e servizio stabile anche in assenza del fondatore.' },
  { id: 'sales', name: 'Commerciale', purpose: 'Costruire un metodo di vendita trasferibile e misurabile.', signals: ['Trattative concentrate sul titolare', 'Risultati affidati alle iniziative individuali'], destination: 'Un processo commerciale che il team sa applicare e migliorare.' },
  { id: 'marketing', name: 'Marketing', purpose: 'Alimentare il commerciale con domanda coerente e continuativa.', signals: ['Dipendenza dal passaparola', 'Posizionamento non riconoscibile'], destination: 'Una proposta chiara e un flusso osservabile di opportunità qualificate.' },
  { id: 'people', name: 'Persone', purpose: 'Dare a ruoli, responsabilità e crescita una struttura comprensibile.', signals: ['Decisioni che risalgono sempre al titolare', 'Inserimenti senza percorso'], destination: 'Persone che conoscono il proprio contributo e dispongono degli strumenti per esprimerlo.' },
] as const;

export const operatingJourney = [
  { title: 'Definire la destinazione', description: 'Mete e obiettivi chiariscono l’orizzonte dell’impresa.' },
  { title: 'Leggere il presente', description: 'Radar e discovery rendono visibile il punto di partenza.' },
  { title: 'Disegnare l’organizzazione obiettivo', description: 'L’organigramma ideale mostra ruoli e responsabilità necessari.' },
  { title: 'Mappare persone e responsabilità', description: 'La struttura reale viene confrontata con quella necessaria.' },
  { title: 'Misurare il divario', description: 'Emergono mancanze, dipendenze e vincoli prioritari.' },
  { title: 'Scegliere il reparto prioritario', description: 'Il percorso concentra energia sul collo di bottiglia più rilevante.' },
  { title: 'Costruire il programma operativo', description: 'Procedure, ruoli, strumenti e indicatori diventano un piano verificabile.' },
  { title: 'Attivare con prove', description: 'Ogni capacità avanza solo quando accessi, test e responsabilità sono confermati.' },
  { title: 'Verificare e continuare', description: 'Risultati e scostamenti orientano il ciclo successivo.' },
] as const;
