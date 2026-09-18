import { RADAR_URL } from '@/content/product-truth';

export interface Pillar {
  number: string;
  category: string;
  title: string;
  description: string;
  points: string[];
}

export interface ApproachStep {
  number: string;
  title: string;
  description: string;
}

export interface Capability {
  number: string;
  title: string;
  description: string;
}

export interface ExperienceItem {
  tag: string;
  title: string;
  description: string;
}

export const frankData = {
  person: {
    name: 'Frank Cannoletta',
    role: 'Imprenditore & Strategista',
    eyebrow: 'HORYZON CONSULTING · PARTNER NETWORK',
    quote: '«Unisco la gestione della mente, la struttura dell’azienda e la protezione del patrimonio in un’unica visione strategica.»',
    domains: ['Persona', 'Impresa', 'Patrimonio'],
    image: '/people/frank.webp',
    imageAlt: 'Ritratto professionale di Frank Cannoletta, Imprenditore e Strategista',
    phone: '+39 348 169 8762',
    phoneRaw: '+393481698762',
    email: 'frank.cannoletta@horyzon.it',
    instagram: '@frank_cannols',
    instagramUrl: 'https://www.instagram.com/frank_cannols/',
    whatsappUrl: 'https://wa.me/393481698762?text=Buongiorno%20Frank%2C%20vorrei%20richiedere%20un%20primo%20confronto%20strategico.',
    emailConsultationUrl: 'mailto:frank.cannoletta@horyzon.it?subject=Richiesta%20di%20confronto%20strategico',
    emailDebriefUrl: 'mailto:frank.cannoletta@horyzon.it?subject=Richiesta%20debrief%20Radar',
  },
  navLinks: [
    { label: 'Profilo', href: '#profilo' },
    { label: 'Metodo', href: '#metodo' },
    { label: 'Radar', href: '#radar' },
    { label: 'Competenze', href: '#competenze' },
    { label: 'Esperienza', href: '#esperienza' },
    { label: 'Contatti', href: '#contatti' },
  ],
  profile: {
    kicker: 'PROFILO',
    title: 'Una guida strategica integrata.',
    lead: 'Per imprenditori, manager e professionisti che vogliono affrontare decisioni complesse senza separare la persona che guida, l’organizzazione che produce valore e il patrimonio costruito nel tempo.',
    body: 'L’approccio parte dall’analisi della situazione reale, identifica gli ostacoli prioritari e traduce la visione in azioni concrete, misurabili e sostenibili.',
    pillarsConcept: 'Persona, impresa e patrimonio non devono essere trattati come mondi separati. Una decisione personale può rallentare l’azienda; un processo debole può assorbire liquidità; una struttura patrimoniale fragile può condizionare le decisioni dell’imprenditore.',
  },
  method: {
    kicker: 'IL METODO',
    title: 'Tre architetture per costruire solidità.',
    intro: 'Ogni intervento mantiene una visione d’insieme, ma concentra il lavoro sulla leva che in quel momento produce il maggiore impatto.',
    pillars: [
      {
        number: '01',
        category: 'COACHING STRATEGICO & PROBLEM SOLVING',
        title: 'Architetto Emotivo',
        description: 'Gestione delle dinamiche emotive, sblocco delle prestazioni e risoluzione di problemi complessi. Un lavoro orientato a decisioni più lucide, leadership resiliente e azione sotto pressione.',
        points: [
          'Problem solving strategico',
          'Blocchi decisionali e performance',
          'Mindset e leadership',
        ],
      },
      {
        number: '02',
        category: 'RILANCIO, GESTIONE & SCALABILITÀ DELLE PMI',
        title: 'Architetto d’Impresa',
        description: 'Analisi sistemica, riorganizzazione dei processi e sviluppo aziendale. Dalla direzione generale ai numeri, dalle vendite alle persone, per rendere l’impresa più governabile e produttiva.',
        points: [
          'Direzione e controllo di gestione',
          'Processi, vendite e marketing',
          'Ricerca e valorizzazione dei talenti',
        ],
      },
      {
        number: '03',
        category: 'TUTELA & DIVERSIFICAZIONE DEL CAPITALE',
        title: 'Architetto Patrimoniale',
        description: 'Orientamento strategico per tutelare e diversificare riserve monetarie e patrimonio d’impresa o familiare, anche attraverso soluzioni reali come l’oro fisico da investimento.',
        points: [
          'Analisi degli obiettivi patrimoniali',
          'Diversificazione delle riserve',
          'Collaborazione con Careisgold S.p.A.',
        ],
      },
    ] as Pillar[],
  },
  approach: {
    kicker: 'APPROCCIO INTEGRATO',
    title: 'Il problema visibile raramente è l’unico problema.',
    lead: 'Una decisione personale può rallentare l’azienda. Un processo debole può assorbire liquidità. Una struttura patrimoniale fragile può condizionare le scelte imprenditoriali.',
    steps: [
      {
        number: '01',
        title: 'Leggere il sistema',
        description: 'Prima delle soluzioni, una fotografia chiara di persone, numeri, processi e priorità.',
      },
      {
        number: '02',
        title: 'Individuare la leva',
        description: 'Si interviene sul punto che può generare il cambiamento più rapido e sostenibile.',
      },
      {
        number: '03',
        title: 'Tradurre in azione',
        description: 'Obiettivi, responsabilità e prossimi passi diventano concreti e verificabili.',
      },
    ] as ApproachStep[],
  },
  radar: {
    kicker: 'IL PUNTO DI PARTENZA',
    title: 'Prima di scegliere una soluzione, leggiamo il punto di partenza.',
    lead: 'Il Radar d’Impresa è lo strumento di qualificazione che osserva i cinque reparti dell’azienda, la maturità dei processi e il livello di autonomia dal titolare.',
    points: [
      'Fotografa il presente dell’impresa attraverso l’analisi di amministrazione, produzione, commerciale, marketing e persone.',
      'Rende visibili i segnali di dipendenza e le prime priorità, senza emettere sentenze preordinate.',
      'Il risultato non è una diagnosi definitiva e non promette risultati automatici: fornisce una base oggettiva per il confronto.',
      'Frank Cannoletta guida il debrief successivo, collegando i risultati agli obiettivi, definendo l’organizzazione obiettivo e identificando il reparto prioritario.',
      'Dal debrief si passa a un programma operativo fatto di responsabilità chiare, azioni concrete ed evidenze verificabili nel tempo.',
    ],
    radarUrl: RADAR_URL,
    ctaPrimary: 'Inizia il Radar',
    ctaSecondary: 'Richiedi il debrief con Frank',
    finePrint: 'Il Radar si apre su Horyzon Hub. Il debrief strategico è un passaggio successivo e personalizzato. Nessun dato personale viene trasferito nel collegamento.',
  },
  capabilities: {
    kicker: 'COMPETENZE OPERATIVE',
    title: 'Dalla visione alla gestione.',
    intro: 'Competenze concrete maturate sul campo per governare la complessità aziendale e tradurla in operatività.',
    items: [
      {
        number: '01',
        title: 'Direzione generale',
        description: 'Visione d’insieme, governance strategica, definizione delle priorità e coordinamento delle aree critiche.',
      },
      {
        number: '02',
        title: 'Finanza & controllo',
        description: 'Controllo di gestione, lettura dei margini, flussi di cassa e indicatori utili alle decisioni.',
      },
      {
        number: '03',
        title: 'Processi & standard',
        description: 'Ottimizzazione dei flussi di lavoro e costruzione di standard di servizio chiari, replicabili e misurabili.',
      },
      {
        number: '04',
        title: 'Vendite & marketing',
        description: 'Organizzazione del reparto commerciale-marketing, reti vendita e strategie ad alta efficienza di risorse.',
      },
      {
        number: '05',
        title: 'Risorse umane',
        description: 'Ricerca, selezione, attrazione e fidelizzazione di persone coerenti con ruolo, cultura e obiettivi.',
      },
      {
        number: '06',
        title: 'Coaching strategico',
        description: 'Problem solving, gestione delle dinamiche emotive e supporto alle decisioni ad alto impatto.',
      },
      {
        number: '07',
        title: 'Diversificazione reale',
        description: 'Orientamento alla tutela delle riserve e valutazione di strumenti reali, incluso l’oro fisico.',
      },
    ] as Capability[],
  },
  experience: {
    kicker: 'ESPERIENZA SUL CAMPO',
    title: 'Metodo, impresa, responsabilità.',
    intro: 'Un profilo costruito tra formazione specialistica, analisi aziendale e affiancamento concreto agli imprenditori.',
    items: [
      {
        tag: 'METODO',
        title: 'Coach e Problem Solver certificato',
        description: 'Formazione nel Modello Strategico presso Nardone & Partners — Centro di Terapia Strategica.',
      },
      {
        tag: 'ANALISI',
        title: 'Esperienza nell’analisi d’azienda',
        description: 'Attività di consulenza e analisi organizzativa per le PMI, con competenze maturate sul campo nella lettura e nel miglioramento dei sistemi aziendali.',
      },
      {
        tag: 'IMPATTO',
        title: 'Volontario in Imprenditore Non Sei Solo',
        description: 'Affiancamento sul campo a imprese in crisi, con interventi orientati al rilancio, alla redditività e al marketing a costo zero.',
      },
      {
        tag: 'PATRIMONIO',
        title: 'Collaborazione con Careisgold S.p.A.',
        description: 'Sviluppo di reti dedicate e orientamento all’acquisto di oro fisico puro 24k tramite Operatore Professionale in Oro.',
      },
    ] as ExperienceItem[],
  },
  contact: {
    kicker: 'PRIMO CONFRONTO',
    title: 'Da quale punto conviene iniziare?',
    lead: 'Descrivi in poche righe la situazione, la decisione da prendere o l’obiettivo da raggiungere. Il primo confronto serve a definire con chiarezza perimetro, priorità e passo successivo.',
  },
  disclaimer: {
    title: 'Nota di correttezza professionale',
    text: 'Le attività di coaching e problem solving non sostituiscono percorsi psicologici, psicoterapeutici o sanitari. I contenuti patrimoniali hanno finalità informative e strategiche generali e non costituiscono consulenza finanziaria, fiscale o legale personalizzata né promessa di rendimento o protezione del capitale. Ogni decisione va valutata rispetto alla situazione individuale e, quando necessario, con professionisti abilitati.',
  },
} as const;
