// Pilot-only content. Never import these routes into public navigation or content registries.
export const PATRIMONIAL_PILOT_PRIVACY_VERSION = 'patrimonial-pilot-privacy-v1';
export const PATRIMONIAL_PILOT_MARKETING_VERSION = 'patrimonial-pilot-marketing-v1';
export const patrimonialBrand = {
  division: 'Horyzon Benessere Patrimoniale',
  path: 'Percorso Architetto Patrimoniale',
  role: 'Architetto Patrimoniale',
  network: 'Horyzon Architetti Patrimoniali',
} as const;

export const architectPath = {
  path: '/benessere-patrimoniale/percorso-architetto-patrimoniale',
  title: 'Il tuo talento può incontrare un nuovo orizzonte.',
  description: 'Un percorso per persone che vogliono trasformare capacità relazionali, crescita personale e cultura patrimoniale in una nuova competenza professionale.',
  roles: [
    { title: 'Comprendere', text: 'Imparare a leggere bisogni, obiettivi e situazioni.' },
    { title: 'Accompagnare', text: 'Aiutare la persona a fare domande migliori e compiere passi consapevoli.' },
    { title: 'Crescere', text: 'Sviluppare progressivamente competenze, responsabilità e capacità relazionali.' },
  ],
  steps: [
    { title: 'Conosci il progetto', text: 'Partecipa alla presentazione introduttiva Horyzon.' },
    { title: 'Raccontaci chi sei', text: 'Esperienza, obiettivi e cosa stai cercando.' },
    { title: 'Parliamone', text: 'Se ci sono i presupposti, facciamo un colloquio individuale.' },
    { title: 'Inizia il percorso', text: 'Se entrambe le parti decidono di proseguire, comincia il percorso di formazione e inserimento.' },
  ],
  forWhom: [
    'Ti piace lavorare con le persone.', 'Sai costruire relazioni.',
    'Hai esperienza commerciale, imprenditoriale, consulenziale o nel network marketing.',
    'Vuoi imparare prima di proporre.', 'Cerchi crescita personale e professionale.',
    'Sei disposto a dedicare tempo alla formazione.',
  ],
  notFor: [
    'Cerchi un guadagno rapido o garantito.', 'Vuoi semplicemente vendere un prodotto.',
    'Non vuoi dedicare tempo alla formazione.', "Cerchi un'attività completamente passiva.",
    'Vuoi saltare il processo di conoscenza e selezione.',
  ],
  includes: [
    { title: 'Formazione', text: 'Contenuti e strumenti.' },
    { title: 'Affiancamento', text: 'Supporto nelle prime fasi.' },
    { title: 'Metodo', text: 'Un percorso chiaro e replicabile.' },
    { title: 'Rete', text: 'Confronto con persone che costruiscono lo stesso percorso.' },
  ],
  presentation: [
    'perché Horyzon sta sviluppando questa divisione;', 'che cosa intendiamo per Benessere Patrimoniale;',
    "quale ruolo può avere l'Architetto Patrimoniale;", 'come funziona il percorso;',
    'quali caratteristiche cerchiamo;', 'quali sono i passaggi successivi.',
  ],
  thanks: ['Ricevi la conferma.', 'Ti invitiamo alla presentazione.', 'Se vuoi proseguire, completiamo la qualificazione.', 'Se ci sono i presupposti, fissiamo il colloquio.'],
} as const;

// Change the working title here: hero, metadata and CRM all read this source.
export const patrimonialEvent = {
  path: '/benessere-patrimoniale/evento',
  title: 'Quello che le banche non dicono',
  description: "Un incontro online dedicato a persone e imprenditori che vogliono capire meglio patrimonio, inflazione, diversificazione e ruolo dell'oro fisico.",
  date: 'Data da definire',
  time: 'Orario da definire',
  format: 'Online',
  phase: 'before' as 'before' | 'after',
  questions: [
    "Che differenza c'è tra mettere da parte denaro e proteggere valore?",
    'Che cosa significa davvero diversificare?',
    'Quali rischi tendiamo a non considerare quando pensiamo al patrimonio?',
    "Che ruolo può avere l'oro fisico in una strategia di diversificazione?",
    "Qual è la differenza tra possedere oro fisico e utilizzare strumenti finanziari collegati all'oro?",
    'Da quali domande partire prima di prendere una decisione?',
  ],
  forWhom: [
    'Hai costruito risparmi o patrimonio e vuoi comprenderli meglio.', 'Sei un imprenditore.',
    "Ti interessa l'oro fisico ma vuoi capire prima di decidere.", 'Vuoi conoscere il concetto di diversificazione.',
    'Ti fai domande su come proteggere nel tempo ciò che hai costruito.',
    'Vuoi arrivare a conversazioni più consapevoli con i professionisti che ti affiancano.',
  ],
  notFor: ['rendimenti garantiti;', 'previsioni certe;', 'scorciatoie per arricchirsi;', 'una raccomandazione finanziaria personalizzata durante il webinar;', 'una soluzione uguale per tutti.'],
  takeaways: [
    'Comprensione del concetto di protezione patrimoniale.', 'Più chiarezza sulla diversificazione.',
    "Un quadro iniziale sul ruolo dell'oro fisico.", 'Nuove domande da portare nelle tue decisioni.',
    'La possibilità di richiedere un confronto individuale.',
  ],
} as const;

export const pilotForms = {
  'architect-path': {
    path: architectPath.path, title: 'Raccontaci da dove parti.',
    intro: 'Non serve avere già tutte le risposte. Ci interessa capire chi sei, cosa stai cercando e se vale la pena approfondire insieme.',
    submit: 'Voglio conoscere il percorso', success: 'Candidatura ricevuta.',
    question: 'Perché vuoi conoscere il Percorso Architetto Patrimoniale?',
    profiles: ['Imprenditore', 'Commerciale', 'Professionista', 'Networker', 'Dipendente', 'Altro'],
  },
  'patrimonial-event': {
    path: patrimonialEvent.path, title: 'Partecipa al prossimo incontro.',
    intro: 'Registrati e ricevi le informazioni per partecipare.',
    submit: 'Richiedi il tuo posto', success: 'Richiesta di partecipazione ricevuta.',
    question: 'Qual è la domanda sul tuo patrimonio alla quale vorresti trovare risposta?',
    profiles: ['Privato', 'Imprenditore', 'Professionista', 'Altro'],
  },
} as const;
export type PilotMode = keyof typeof pilotForms;
export const pilotExperience = ['Sì', 'No'] as const;
export const pilotGoals = ['Cambio professionale', 'Attività aggiuntiva', 'Nuovo progetto imprenditoriale', 'Sto esplorando'] as const;
export const pilotAvailability = ['Da definire', 'Part-time', 'Full-time'] as const;
export const pilotUtmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
export type PilotUtm = Partial<Record<typeof pilotUtmKeys[number], string>>;
