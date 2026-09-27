"use client";

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Annunci10xAnalyzeFlow } from './annunci-10x-analyze-flow';
import styles from './annunci-10x.module.css';

type Mode = 'ANALYZE' | 'CREATE';
type CreateStepId = 'ROLE_CONTEXT' | 'PRIMARY_CONTRIBUTION' | 'WORK_REALITY' | 'REQUIREMENTS' | 'ATTRACTION' | 'OFFER' | 'CHANNEL_APPLICATION';
type ProductCode = 'GUIDE' | 'AD_GENERATION' | 'GUIDE_PLUS_AD';
type AnalyzeChannel = '' | 'LINKEDIN' | 'INDEED' | 'ATS' | 'EMAIL' | 'CUSTOM';
type UnknownKey = 'workMode' | 'contract' | 'schedule' | 'compensation' | 'benefits' | 'growth' | 'channel';

interface CommercialOffer {
  id: string;
  productCode: ProductCode;
  displayName: string;
  description: string;
  includedCapabilities: string[];
  eligibility: 'AVAILABLE' | 'UNAVAILABLE';
  pricingStatus: 'OPEN_DECISION';
  discountReason: 'NONE' | 'GUIDE_OWNER' | 'BUNDLE';
  purchaseEnabled: false;
  reasonUnavailable: string;
}

interface PublicOperation {
  type: string;
  promptVersion: string;
  model: string;
  provider: 'MOCK' | 'OPENAI';
  latencyMs: number;
  totalTokens?: number | null;
  idempotencyHit: boolean;
}

interface CreateState {
  sessionId: string;
  state: string;
  provider: 'MOCK' | 'OPENAI';
  currentStep: CreateStepId | 'SUMMARY' | 'COMMERCIAL';
  completedSteps: CreateStepId[];
  completion: { answered: number; total: number; coverage: number };
  roleCard: {
    title: string;
    mission: string;
    outcomes: string[];
    responsibilities: string[];
    requirements: { label: string; classification: string }[];
    location: string;
    workMode: string;
    contractType: string;
    schedule: string;
    compensation: string;
    attractionEvidence: string[];
    channel: string | null;
    missingFacts: string[];
  };
  strategy: { summary: string; candidateAngle: string; channelPriorities: string[]; riskNotes: string[]; missingFacts: string[] } | null;
  clarification: { id: string; targetPath: string; question: string; reason: string; blocking: boolean; canAdvance: boolean } | null;
  canConfirm: boolean;
  paymentRequired: boolean;
  commercial: {
    checkoutEnabled: false;
    price: 'OPEN_DECISION';
    discountValue: 'OPEN_DECISION';
    entitlements: string;
    pricingStatus: 'OPEN_DECISION';
    availableOffers: CommercialOffer[];
    entitlementSummary: { guide: boolean; adGenerationCredits: number; source: string };
  };
  operations: PublicOperation[];
}

interface CreateDraft {
  role: string;
  companyContext: string;
  primaryResult: string;
  activities: string;
  requiredRequirements: string;
  preferredRequirements: string;
  trainableRequirements: string;
  disqualifyingRequirements: string;
  operatingContext: string;
  autonomy: string;
  incidents: string;
  location: string;
  workMode: string;
  contract: string;
  schedule: string;
  shifts: string;
  availability: string;
  compensation: string;
  benefits: string;
  growth: string;
  channel: AnalyzeChannel;
  application: string;
}

const emptyDraft: CreateDraft = {
  role: '',
  companyContext: '',
  primaryResult: '',
  activities: '',
  requiredRequirements: '',
  preferredRequirements: '',
  trainableRequirements: '',
  disqualifyingRequirements: '',
  operatingContext: '',
  autonomy: '',
  incidents: '',
  location: '',
  workMode: '',
  contract: '',
  schedule: '',
  shifts: '',
  availability: '',
  compensation: '',
  benefits: '',
  growth: '',
  channel: '',
  application: '',
};

const defaultUnknowns: Record<UnknownKey, boolean> = {
  workMode: false,
  contract: false,
  schedule: false,
  compensation: false,
  benefits: false,
  growth: false,
  channel: false,
};

const createStepOrder: CreateStepId[] = ['ROLE_CONTEXT', 'PRIMARY_CONTRIBUTION', 'WORK_REALITY', 'REQUIREMENTS', 'ATTRACTION', 'OFFER', 'CHANNEL_APPLICATION'];
const proofItems = ['Metodo Performia', 'Dal 2001, in oltre 26 paesi', '20 controlli per ogni annuncio'];
const storyBeats = [
  'Pubblichi un annuncio. Arrivano candidature, ma molte persone non c’entrano davvero con il lavoro.',
  'Fai colloqui. Sulla carta sembravano candidati adatti, poi scopri che ruolo e aspettative erano stati capiti in modo diverso.',
  'Intanto il team copre il vuoto, i manager perdono tempo e una posizione che doveva sostenere la crescita diventa un freno.',
];
const targetLines = [
  'Se sei un imprenditore e una posizione scoperta sta rallentando l’azienda.',
  'Se gestisci HR o recruiting e passi ore tra candidature e colloqui poco utili.',
  'Se devi sostituire qualcuno ma continui a rimandare perché trovare un’alternativa sembra impossibile.',
  'Se l’azienda potrebbe crescere, ma non riesci a inserire le persone necessarie.',
];
const funnelRows = [
  ['Tanti visualizzano', 'curiosità generica'],
  ['Alcuni si candidano', 'motivazione ancora incerta'],
  ['Pochi sono coerenti', 'qui si vede la qualità dell’annuncio'],
  ['Le persone giuste capiscono', 'l’obiettivo non è allargare: è filtrare meglio'],
];
const costItems = [
  ['Tempo perso', 'Candidature da leggere, telefonate, colloqui e follow-up che non avvicinano la scelta.'],
  ['Ruolo fermo', 'Una posizione scoperta scarica lavoro sul team e rallenta clienti, consegne o vendite.'],
  ['Aspettative confuse', 'Quando l’annuncio promette o omette troppo, il problema esplode dopo.'],
];
const controls = [
  'Risultato atteso', 'Attività reali', 'Responsabilità', 'Requisiti obbligatori', 'Requisiti preferenziali',
  'Cosa si può imparare', 'Sede', 'Orario', 'Contratto', 'Compenso', 'Benefit', 'Crescita concreta',
  'Contesto operativo', 'Autonomia', 'Ritmo del lavoro', 'Vincoli reali', 'Tono e chiarezza', 'Candidatura',
  'Coerenza complessiva', 'Informazioni mancanti',
];
const roles = ['Magazziniere', 'Cameriere', 'Cuoco', 'Venditore / Commerciale', 'Customer Care', 'Tecnico', 'Impiegato amministrativo', 'Automation Engineer'];
const methodSteps = ['Lavoro reale', 'Persona necessaria', 'Strategia', 'Annuncio', 'Verifica'];
const faqItems = [
  ['È davvero gratis?', 'Sì. Lo Score gratuito richiede solo il testo o il link dell’annuncio e una verifica email per mostrarti il report.'],
  ['Quanto tempo serve?', 'Di solito circa 2 minuti per avviare l’analisi, poi ricevi il risultato appena il sistema completa i controlli.'],
  ['Devo inserire la carta di credito?', 'No. La carta di credito non è richiesta per l’analisi gratuita.'],
  ['Posso usare un link invece del testo?', 'Sì, se il link è pubblico e leggibile. Se non riusciamo a leggerlo, puoi incollare il testo.'],
  ['Lo Score decide se devo assumere qualcuno?', 'No. Lo Score valuta la chiarezza dell’annuncio, non prende decisioni di selezione.'],
  ['Cosa succede se mancano informazioni?', 'Il report ti indica quali parti non erano valutabili e quali dati conviene chiarire prima di pubblicare.'],
  ['Funziona anche per ruoli operativi?', 'Sì. Il metodo è pensato per ruoli concreti, ricorrenti e spesso difficili da spiegare bene.'],
  ['Funziona per ruoli commerciali o tecnici?', 'Sì. I controlli aiutano a distinguere risultato atteso, requisiti e condizioni reali del lavoro.'],
  ['Posso creare un annuncio da zero?', 'Sì. Il percorso guidato parte dai fatti del ruolo e costa 9 € quando è disponibile.'],
  ['Che differenza c’è con la guida?', 'La guida premium da 49 € spiega il metodo completo e ti aiuta a riscrivere con più autonomia.'],
  ['Cosa include il prodotto da 7 €?', 'È il percorso leggero per trasformare un annuncio già analizzato in una versione più chiara.'],
  ['Quando serve una consulenza?', 'Quando il problema non è solo il testo, ma il fabbisogno, il processo o la selezione complessiva.'],
];

export function Annunci10xClient() {
  const [mode, setMode] = useState<Mode>('ANALYZE');
  const [createState, setCreateState] = useState<CreateState | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(emptyDraft);
  const [unknowns, setUnknowns] = useState<Record<UnknownKey, boolean>>(defaultUnknowns);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [editTarget, setEditTarget] = useState('title');
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const analyzeRef = useRef<HTMLDivElement | null>(null);
  const createRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetch('/api/annunci-10x/create/state', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: { ok: boolean; result: CreateState | null }) => {
        if (payload.ok && payload.result) setCreateState(payload.result);
      })
      .catch(() => undefined);
  }, []);

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    window.setTimeout(() => {
      if (nextMode === 'CREATE' && createRef.current) {
        scrollToElement(createRef.current);
        return;
      }
      if (analyzeRef.current) scrollToElement(analyzeRef.current);
    }, 0);
  }

  async function startCreate(): Promise<CreateState | null> {
    setMode('CREATE');
    setError(null);
    setRunning(true);
    try {
      const response = await fetch('/api/annunci-10x/create/start', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Avvio non riuscito.');
      setCreateState(payload.result);
      return payload.result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Avvio non riuscito.');
      return null;
    } finally {
      setRunning(false);
    }
  }

  async function submitStructuredCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRunning(true);
    try {
      let state = createState;
      if (!state) {
        const response = await fetch('/api/annunci-10x/create/start', { method: 'POST' });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Avvio non riuscito.');
        state = payload.result;
      }
      if (!state || state.paymentRequired) return;
      let nextState = state;
      const answers = composeCreateAnswers(createDraft, unknowns);
      for (const stepId of createStepOrder) {
        const response = await fetch('/api/annunci-10x/create/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stepId, answer: answers[stepId] }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Scheda non salvata.');
        nextState = payload.result;
      }
      setCreateState(nextState);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Scheda non salvata.');
    } finally {
      setRunning(false);
    }
  }

  async function submitCreateClarification(skip = false) {
    if (!createState?.clarification) return;
    setError(null);
    setRunning(true);
    try {
      const response = await fetch('/api/annunci-10x/create/clarify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clarificationId: createState.clarification.id, answer: skip ? 'Non lo so' : clarificationAnswer }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Chiarimento non salvato.');
      setCreateState(payload.result);
      setClarificationAnswer('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chiarimento non salvato.');
    } finally {
      setRunning(false);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRunning(true);
    try {
      const response = await fetch('/api/annunci-10x/create/edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetPath: editTarget, value: editValue }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Modifica non salvata.');
      setCreateState(payload.result);
      setEditValue('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Modifica non salvata.');
    } finally {
      setRunning(false);
    }
  }

  async function confirmCreate() {
    setError(null);
    setRunning(true);
    try {
      const response = await fetch('/api/annunci-10x/create/confirm', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Conferma non riuscita.');
      setCreateState(payload.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conferma non riuscita.');
    } finally {
      setRunning(false);
    }
  }

  return <div className={styles.page}>
    <a className={styles.skipLink} href="#content">Salta al contenuto</a>
    <FunnelHeader onAnalyze={() => selectMode('ANALYZE')} />
    <main id="content" data-page="annunci-10x">
      <section className={styles.hero} aria-labelledby="annunci10x-hero-title">
        <Image src="/annunci-10x/hero.jpeg" alt="Professionisti che camminano verso una città al tramonto" fill sizes="100vw" preload className={styles.heroImage} />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroGrid}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Annunci 10x · by Horyzon</p>
            <h1 id="annunci10x-hero-title">Il tuo annuncio sceglie i candidati prima di te.</h1>
            <p className={styles.heroSubhead}>Scopri in 2 minuti se sta scegliendo quelli sbagliati.</p>
            <p className={styles.heroLead}>Incolla il testo o il link del tuo annuncio. Vedi subito lo Score su 100 e ricevi via email il report con i punti da correggere.</p>
            <p className={styles.heroMicroLead}>Gratis · 2 minuti · nessuna carta di credito</p>
            <div className={styles.heroActions} aria-label="Percorsi iniziali">
              <button type="button" onClick={() => selectMode('ANALYZE')}>Analizza il mio annuncio — gratis</button>
              <button type="button" onClick={() => selectMode('CREATE')}>Devi ancora scriverlo? Crea l&apos;annuncio da zero — 9 €</button>
            </div>
            <HeroProofStrip />
          </div>
          <div ref={analyzeRef} className={styles.heroPanel} aria-label="Analisi gratuita Annunci 10x">
            <ScoreDemoCard />
            <Annunci10xAnalyzeFlow />
          </div>
        </div>
      </section>

      <ProblemNarrative />
      <CentralIdeaSection />
      <InverseFunnelSection />
      <CostProblemSection />
      <ProductExplainerSection />
      <ControlsSection />
      <RoleStrip />
      <BeforeAfterSection />
      <MethodSection />
      <ProductChoiceSection onAnalyze={() => selectMode('ANALYZE')} onCreate={() => selectMode('CREATE')} />

      {mode === 'CREATE' && <section ref={createRef} id="crea-annuncio" className={styles.createSection} aria-labelledby="create-route-title">
        <div className={styles.sectionHeading}>
          <p>Percorso guidato</p>
          <h2 id="create-route-title">Crea il tuo annuncio da zero</h2>
          <span>Se il testo non esiste ancora, parti dai fatti del ruolo. La logica resta la stessa: prima chiarezza, poi scrittura.</span>
        </div>
        <CreateFlow state={createState} draft={createDraft} unknowns={unknowns} running={running} clarificationAnswer={clarificationAnswer} editTarget={editTarget} editValue={editValue} error={error} onStart={startCreate} onDraft={setCreateDraft} onUnknowns={setUnknowns} onSubmitStructured={submitStructuredCreate} onClarificationAnswer={setClarificationAnswer} onSubmitClarification={submitCreateClarification} onEditTarget={setEditTarget} onEditValue={setEditValue} onSubmitEdit={submitEdit} onConfirm={confirmCreate} />
      </section>}

      <GuideSection />
      <GuaranteeSection />
      <ConsultingSection />
      <FaqSection />
      <FinalCta onAnalyze={() => selectMode('ANALYZE')} onCreate={() => selectMode('CREATE')} />
    </main>
    <FunnelFooter />
  </div>;
}

function FunnelHeader({ onAnalyze }: { onAnalyze: () => void }) {
  return <header className={styles.funnelHeader} aria-label="Annunci 10x">
    <Link href="/" className={styles.brand}>Horyzon</Link>
    <nav aria-label="Navigazione Annunci 10x"><a href="#metodo">Metodo</a><a href="#prodotti">Prodotti</a><a href="#faq">FAQ</a></nav>
    <button type="button" onClick={onAnalyze}>Analizza gratis</button>
  </header>;
}

function FunnelFooter() {
  return <footer className={styles.funnelFooter}>
    <div><strong>Horyzon</strong><p>FELICITÀ srl · Viale Papiniano 28, 20123 Milano · P.IVA 05120660757 · SDI SU9YNJA</p></div>
    <nav aria-label="Link legali Annunci 10x"><Link href="/privacy-policy">Privacy</Link><Link href="/cookie-policy">Cookie</Link><a href="mailto:info@horyzon.it">info@horyzon.it</a></nav>
  </footer>;
}

function HeroProofStrip() {
  return <div className={styles.proofStrip} aria-label="Prove del metodo">{proofItems.map((item) => <span key={item}>{item}</span>)}</div>;
}

function ScoreDemoCard() {
  return <aside className={styles.scoreDemo} aria-label="Esempio di Score">
    <p>Esempio di Score</p>
    <div><span>Commerciale B2B</span><strong>67<small>/100</small></strong><em>Debole</em></div>
    <ScoreBandBar activeIndex={1} />
    <small>Una fotografia sintetica: abbastanza chiaro da partire, non abbastanza preciso da filtrare bene.</small>
  </aside>;
}

function ScoreBandBar({ activeIndex }: { activeIndex: number }) {
  const bands = ['Critico', 'Debole', 'Base', 'Buono', 'Forte'];
  return <div className={styles.scoreBandBar} aria-label="Fasce Score">{bands.map((band, index) => <span key={band} data-active={index === activeIndex}>{band}</span>)}</div>;
}

function ProblemNarrative() {
  return <section className={styles.problemSection}>
    <div className={styles.sectionHeading}><p>Il problema</p><h2>Il problema non è avere più CV. È arrivare alle persone giuste.</h2></div>
    <div className={styles.storyRows}>{storyBeats.map((beat, index) => <p key={beat}><span>{String(index + 1).padStart(2, '0')}</span>{beat}</p>)}</div>
    <div className={styles.targetStatement}><p>Annunci 10x nasce per chi sente l’impatto delle assunzioni sul lavoro quotidiano.</p><div>{targetLines.map((line) => <span key={line}>{line}</span>)}</div></div>
  </section>;
}

function CentralIdeaSection() {
  return <section className={styles.ideaSection}>
    <p className={styles.editorialQuote}>“L’annuncio inizia a selezionare prima ancora che arrivi il primo CV.”</p>
    <div><h2>Se il ruolo è vago, attirerà persone diverse da quelle che servono.</h2><p>Responsabilità, condizioni e risultato atteso non sono dettagli: sono il filtro iniziale. Annunci 10x controlla se quel filtro sta aiutando o confondendo.</p></div>
  </section>;
}

function InverseFunnelSection() {
  return <section className={styles.inverseFunnel}>
    <div className={styles.sectionHeading}><p>Funnel inverso</p><h2>Non devi piacere a tutti. Devi farti capire da chi può fare bene quel lavoro.</h2></div>
    <div className={styles.funnelVisual}>{funnelRows.map(([title, copy], index) => <article key={title} style={{ '--row': String(index + 1) } as CSSProperties}><strong>{title}</strong><span>{copy}</span></article>)}</div>
  </section>;
}

function CostProblemSection() {
  return <section className={styles.costSection}>
    <div className={styles.sectionHeading}><p>Costo nascosto</p><h2>Un annuncio poco chiaro costa prima ancora di una selezione sbagliata.</h2></div>
    <div className={styles.costGrid}>{costItems.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div>
  </section>;
}

function ProductExplainerSection() {
  return <section className={styles.explainerSection}>
    <div className={styles.sectionHeading}><p>Che cosa fa</p><h2>Annunci 10x guarda il testo come lo leggerà una persona reale.</h2><span>Non abbellisce l’offerta e non inventa benefit. Evidenzia cosa è chiaro, cosa manca e dove l’annuncio rischia di attrarre candidature sbagliate.</span></div>
    <div className={styles.explainerGrid}><article><h3>Capisce il ruolo</h3><p>Ricostruisce attività, risultato atteso e condizioni dichiarate.</p></article><article><h3>Misura la chiarezza</h3><p>Applica 20 controlli e distingue fatti presenti da informazioni mancanti.</p></article><article><h3>Indica priorità</h3><p>Mostra punti forti, rischi e prime correzioni pratiche.</p></article></div>
  </section>;
}

function ControlsSection() {
  return <section className={styles.controlsSection}>
    <div className={styles.sectionHeading}><p>20 controlli</p><h2>Ogni controllo serve a una domanda semplice.</h2><span>La persona giusta capisce che lavoro è, quali condizioni troverà e perché dovrebbe candidarsi?</span></div>
    <div className={styles.controlsGrid}>{controls.map((item, index) => <span key={item}>{String(index + 1).padStart(2, '0')} · {item}</span>)}</div>
  </section>;
}

function RoleStrip() {
  return <section className={styles.rolesSection}>
    <div className={styles.sectionHeading}><p>Esempi ruoli</p><h2>Funziona sui ruoli che assumono davvero le PMI.</h2></div>
    <div className={styles.roleChips}>{roles.map((role) => <span key={role}>{role}</span>)}</div>
  </section>;
}

function BeforeAfterSection() {
  return <section className={styles.beforeAfterSection}>
    <div className={styles.sectionHeading}><p>Prima / dopo</p><h2>Non promettiamo magie. Rendiamo il lavoro più leggibile.</h2></div>
    <div className={styles.beforeAfterGrid}><article><span>Prima</span><p>Un testo generico, pieno di formule comuni, con poche informazioni sul lavoro reale.</p></article><article><span>Dopo</span><p>Un annuncio più concreto: risultato atteso, attività, condizioni e candidatura diventano verificabili.</p></article></div>
  </section>;
}

function MethodSection() {
  return <section id="metodo" className={styles.methodSection}>
    <div className={styles.sectionHeading}><p>Metodo</p><h2>Prima la realtà del ruolo. Poi le parole.</h2><span>Annunci 10x è costruito con Horyzon in collaborazione con Performia: il testo viene valutato partendo da lavoro reale, persona necessaria e chiarezza operativa.</span></div>
    <div className={styles.methodFlow}>{methodSteps.map((step) => <span key={step}>{step}</span>)}</div>
  </section>;
}

function ProductChoiceSection({ onAnalyze, onCreate }: { onAnalyze: () => void; onCreate: () => void }) {
  return <section id="prodotti" className={styles.productChoice}>
    <div className={styles.sectionHeading}><p>Scegli il passo</p><h2>Parti gratis. Compra solo se vuoi trasformare il risultato.</h2></div>
    <div className={styles.productGrid}>
      <article data-featured="true"><p>Score gratuito</p><h3>Analizza un annuncio</h3><strong>0 €</strong><span>Score su 100, report via email, priorità di correzione.</span><button type="button" onClick={onAnalyze}>Analizza gratis</button></article>
      <article><p>Correzione leggera</p><h3>Migliora un annuncio esistente</h3><strong>7 €</strong><span>Per chi parte da un testo già analizzato e vuole renderlo più chiaro.</span><button type="button" disabled>In preparazione</button></article>
      <article><p>Da zero</p><h3>Crea l&apos;annuncio da zero</h3><strong>9 €</strong><span>Per chi deve partire dai fatti del ruolo prima di scrivere.</span><button type="button" onClick={onCreate}>Apri percorso</button></article>
      <article><p>Metodo completo</p><h3>Guida Premium</h3><strong>49 €</strong><span>Per capire il metodo e applicarlo su più annunci.</span><button type="button" disabled>In preparazione</button></article>
    </div>
  </section>;
}

function GuideSection() {
  return <section className={styles.guideSection}><div><p>Guida Premium</p><h2>La guida da 49 € ti aiuta a correggere anche i prossimi annunci.</h2></div><p>È pensata per imprenditori, HR e recruiter interni che vogliono smettere di riscrivere annunci a tentativi.</p></section>;
}

function GuaranteeSection() {
  return <section className={styles.guaranteeSection}><p>Garanzia semplice</p><h2>Se il materiale acquistato non ti dà indicazioni utilizzabili, lo rivediamo con te.</h2><span>L’obiettivo è che tu esca con un annuncio più chiaro, non con una promessa astratta.</span></section>;
}

function ConsultingSection() {
  return <section className={styles.consultingSection}><div className={styles.sectionHeading}><p>Quando serve aiuto</p><h2>Se il problema non è solo l’annuncio, Horyzon può aiutarti sul recruiting.</h2><span>Alcune difficoltà nascono prima del testo: ruolo poco definito, selezione disordinata, aspettative interne non allineate. In quel caso Annunci 10x diventa il primo segnale per aprire un lavoro più ampio.</span></div></section>;
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);
  return <section id="faq" className={styles.faqSection}>
    <div className={styles.sectionHeading}><p>FAQ</p><h2>Domande frequenti</h2></div>
    <div className={styles.faqList}>{faqItems.map(([question, answer], index) => {
      const isOpen = openIndex === index;
      const panelId = `annunci10x-faq-${index}`;
      return <article key={question} className={styles.faqItem}><button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpenIndex(isOpen ? -1 : index)}><span>{question}</span><b aria-hidden="true">{isOpen ? '−' : '+'}</b></button><div id={panelId} hidden={!isOpen}><p>{answer}</p></div></article>;
    })}</div>
  </section>;
}

function FinalCta({ onAnalyze, onCreate }: { onAnalyze: () => void; onCreate: () => void }) {
  return <section className={styles.finalCta}><p>Primo passo</p><h2>Inizia dal prossimo annuncio che devi pubblicare.</h2><div className={styles.heroActions}><button type="button" onClick={onAnalyze}>Analizza il mio annuncio — gratis</button><button type="button" onClick={onCreate}>Crea l&apos;annuncio da zero — 9 €</button></div></section>;
}

function CreateFlow(props: {
  state: CreateState | null;
  draft: CreateDraft;
  unknowns: Record<UnknownKey, boolean>;
  running: boolean;
  clarificationAnswer: string;
  editTarget: string;
  editValue: string;
  error: string | null;
  onStart: () => Promise<CreateState | null>;
  onDraft: (value: CreateDraft) => void;
  onUnknowns: (value: Record<UnknownKey, boolean>) => void;
  onSubmitStructured: (event: FormEvent<HTMLFormElement>) => void;
  onClarificationAnswer: (value: string) => void;
  onSubmitClarification: (skip?: boolean) => void;
  onEditTarget: (value: string) => void;
  onEditValue: (value: string) => void;
  onSubmitEdit: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
}) {
  return <section className={styles.createShell} aria-label="Crea da zero">
    {props.state && <div className={styles.createNotice}><div><p>Hai un lavoro in corso.</p><strong>{props.state.currentStep === 'COMMERCIAL' ? 'La posizione è confermata.' : props.state.currentStep === 'SUMMARY' ? 'La scheda è pronta da verificare.' : 'Stiamo raccogliendo i fatti.'}</strong></div><div><span>{props.state.completion.coverage}%</span><small>dati raccolti</small></div></div>}
    {!props.state?.paymentRequired && props.state?.currentStep !== 'SUMMARY' && <StructuredCreateForm draft={props.draft} unknowns={props.unknowns} running={props.running} error={props.error} onDraft={props.onDraft} onUnknowns={props.onUnknowns} onSubmit={props.onSubmitStructured} />}
    {props.state?.clarification && <div className={styles.clarification}><p>Chiarimento necessario</p><h3>{props.state.clarification.question}</h3><small>{props.state.clarification.reason}</small><Field label="Risposta" htmlFor="annunci10x-create-clarification"><textarea id="annunci10x-create-clarification" rows={3} value={props.clarificationAnswer} onChange={(event) => props.onClarificationAnswer(event.target.value)} disabled={props.running} /></Field><div className={styles.actions}><button type="button" onClick={() => props.onSubmitClarification(false)} disabled={props.running}>Salva chiarimento</button><button type="button" onClick={() => props.onSubmitClarification(true)} disabled={props.running}>Non lo so</button></div></div>}
    {props.state && (props.state.currentStep === 'SUMMARY' || props.state.currentStep === 'COMMERCIAL') && <CreateSummary state={props.state} running={props.running} editTarget={props.editTarget} editValue={props.editValue} onEditTarget={props.onEditTarget} onEditValue={props.onEditValue} onSubmitEdit={props.onSubmitEdit} onConfirm={props.onConfirm} />}
    {!props.state && <div className={styles.startCreate}><p>Puoi compilare i campi e preparare direttamente la scheda. Salviamo il percorso quando inizi.</p><button type="button" onClick={props.onStart} disabled={props.running}>Inizia da zero</button></div>}
  </section>;
}

function StructuredCreateForm(props: {
  draft: CreateDraft;
  unknowns: Record<UnknownKey, boolean>;
  running: boolean;
  error: string | null;
  onDraft: (value: CreateDraft) => void;
  onUnknowns: (value: Record<UnknownKey, boolean>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (key: keyof CreateDraft, value: string) => props.onDraft({ ...props.draft, [key]: value });
  const toggleUnknown = (key: UnknownKey) => props.onUnknowns({ ...props.unknowns, [key]: !props.unknowns[key] });
  return <form className={styles.form} onSubmit={props.onSubmit} aria-labelledby="create-title">
    <div className={styles.formHead}><p>Crea il tuo annuncio da zero</p><h2 id="create-title">Racconta il lavoro reale. L’annuncio arriva dopo.</h2></div>
    <FormSection number="01" title="Ruolo e risultato">
      <div className={styles.fieldGrid}>
        <Field label="Ruolo" htmlFor="create-role" required><input id="create-role" required value={props.draft.role} onChange={(event) => update('role', event.target.value)} disabled={props.running} placeholder="Es. Addetto customer care" /></Field>
        <Field label="Azienda / contesto" htmlFor="create-company" optional><input id="create-company" value={props.draft.companyContext} onChange={(event) => update('companyContext', event.target.value)} disabled={props.running} placeholder="Es. sede di Bari, team assistenza clienti" /></Field>
      </div>
      <Field label="Risultato principale" htmlFor="create-result" required><textarea id="create-result" required rows={4} value={props.draft.primaryResult} onChange={(event) => update('primaryResult', event.target.value)} disabled={props.running} placeholder="Che cosa deve produrre o far funzionare meglio questa persona?" /></Field>
      <Field label="Attività reali" htmlFor="create-activities" required><textarea id="create-activities" required rows={4} value={props.draft.activities} onChange={(event) => update('activities', event.target.value)} disabled={props.running} placeholder="Che cosa farà concretamente nel lavoro quotidiano?" /></Field>
    </FormSection>
    <FormSection number="02" title="Persona e lavoro">
      <div className={styles.requirementGrid}>
        <Field label="Indispensabili" htmlFor="create-required" required><textarea id="create-required" required rows={3} value={props.draft.requiredRequirements} onChange={(event) => update('requiredRequirements', event.target.value)} disabled={props.running} placeholder="Es. italiano scritto chiaro, precisione" /></Field>
        <Field label="Preferenziali" htmlFor="create-preferred" optional><textarea id="create-preferred" rows={3} value={props.draft.preferredRequirements} onChange={(event) => update('preferredRequirements', event.target.value)} disabled={props.running} placeholder="Es. esperienza CRM" /></Field>
        <Field label="Apprendibili" htmlFor="create-trainable" optional><textarea id="create-trainable" rows={3} value={props.draft.trainableRequirements} onChange={(event) => update('trainableRequirements', event.target.value)} disabled={props.running} placeholder="Es. software ticketing interno" /></Field>
      </div>
      <Field label="Vincoli escludenti" htmlFor="create-disqualifying" optional><input id="create-disqualifying" value={props.draft.disqualifyingRequirements} onChange={(event) => update('disqualifyingRequirements', event.target.value)} disabled={props.running} placeholder="Es. indisponibilità ai turni" /></Field>
      <Field label="Contesto operativo / interlocutori" htmlFor="create-context" required><textarea id="create-context" required rows={4} value={props.draft.operatingContext} onChange={(event) => update('operatingContext', event.target.value)} disabled={props.running} placeholder="Con chi lavora? Quali strumenti, team, clienti o funzioni coinvolge?" /></Field>
      <div className={styles.fieldGrid}>
        <Field label="Autonomia" htmlFor="create-autonomy" optional><input id="create-autonomy" value={props.draft.autonomy} onChange={(event) => update('autonomy', event.target.value)} disabled={props.running} placeholder="Es. segue casi standard in autonomia" /></Field>
        <Field label="Imprevisti / problemi" htmlFor="create-incidents" optional><input id="create-incidents" value={props.draft.incidents} onChange={(event) => update('incidents', event.target.value)} disabled={props.running} placeholder="Es. picchi di ticket, clienti complessi" /></Field>
      </div>
    </FormSection>
    <FormSection number="03" title="Condizioni e candidatura">
      <div className={styles.fieldGrid}>
        <Field label="Sede" htmlFor="create-location"><input id="create-location" value={props.draft.location} onChange={(event) => update('location', event.target.value)} disabled={props.running} placeholder="Es. Bari" /></Field>
        <Field label="Modalità" htmlFor="create-workmode"><input id="create-workmode" value={props.unknowns.workMode ? '' : props.draft.workMode} onChange={(event) => update('workMode', event.target.value)} disabled={props.running || props.unknowns.workMode} placeholder="Presenza, ibrido, remoto" /><UnknownToggle checked={props.unknowns.workMode} onChange={() => toggleUnknown('workMode')} /></Field>
        <Field label="Contratto" htmlFor="create-contract"><input id="create-contract" value={props.unknowns.contract ? '' : props.draft.contract} onChange={(event) => update('contract', event.target.value)} disabled={props.running || props.unknowns.contract} placeholder="Tempo determinato, indeterminato..." /><UnknownToggle checked={props.unknowns.contract} onChange={() => toggleUnknown('contract')} /></Field>
        <Field label="Orario" htmlFor="create-schedule"><input id="create-schedule" value={props.unknowns.schedule ? '' : props.draft.schedule} onChange={(event) => update('schedule', event.target.value)} disabled={props.running || props.unknowns.schedule} placeholder="Part-time, full-time, fasce..." /><UnknownToggle checked={props.unknowns.schedule} onChange={() => toggleUnknown('schedule')} /></Field>
        <Field label="Turni" htmlFor="create-shifts" optional><input id="create-shifts" value={props.draft.shifts} onChange={(event) => update('shifts', event.target.value)} disabled={props.running} placeholder="Es. turni mattina/pomeriggio" /></Field>
        <Field label="Reperibilità" htmlFor="create-availability" optional><input id="create-availability" value={props.draft.availability} onChange={(event) => update('availability', event.target.value)} disabled={props.running} placeholder="Es. non prevista" /></Field>
        <Field label="Compenso" htmlFor="create-compensation" optional><input id="create-compensation" value={props.unknowns.compensation ? '' : props.draft.compensation} onChange={(event) => update('compensation', event.target.value)} disabled={props.running || props.unknowns.compensation} placeholder="Es. RAL 24-28k" /><UnknownToggle checked={props.unknowns.compensation} onChange={() => toggleUnknown('compensation')} /></Field>
        <Field label="Canale" htmlFor="create-channel" optional><select id="create-channel" value={props.unknowns.channel ? '' : props.draft.channel} onChange={(event) => update('channel', event.target.value)} disabled={props.running || props.unknowns.channel}><option value="">Da definire</option><option value="LINKEDIN">LinkedIn</option><option value="INDEED">Indeed</option><option value="ATS">ATS aziendale</option><option value="EMAIL">Email</option><option value="CUSTOM">Altro</option></select><UnknownToggle checked={props.unknowns.channel} onChange={() => toggleUnknown('channel')} /></Field>
      </div>
      <div className={styles.fieldGrid}>
        <Field label="Benefit" htmlFor="create-benefits" optional><input id="create-benefits" value={props.unknowns.benefits ? '' : props.draft.benefits} onChange={(event) => update('benefits', event.target.value)} disabled={props.running || props.unknowns.benefits} placeholder="Solo fatti già veri" /><UnknownToggle checked={props.unknowns.benefits} onChange={() => toggleUnknown('benefits')} /></Field>
        <Field label="Formazione / crescita concreta" htmlFor="create-growth" optional><input id="create-growth" value={props.unknowns.growth ? '' : props.draft.growth} onChange={(event) => update('growth', event.target.value)} disabled={props.running || props.unknowns.growth} placeholder="Es. affiancamento iniziale" /><UnknownToggle checked={props.unknowns.growth} onChange={() => toggleUnknown('growth')} /></Field>
      </div>
      <Field label="Come ci si candida / destinazione" htmlFor="create-application" required><textarea id="create-application" required rows={3} value={props.draft.application} onChange={(event) => update('application', event.target.value)} disabled={props.running} placeholder="Es. candidatura via email con CV aggiornato" /></Field>
    </FormSection>
    <div className={styles.actions}><button type="submit" disabled={props.running}>{props.running ? 'Preparazione in corso' : 'Prepara la scheda'}</button></div>
    {props.error && <p className={styles.error} role="alert">{props.error}</p>}
  </form>;
}

function CreateSummary(props: {
  state: CreateState;
  running: boolean;
  editTarget: string;
  editValue: string;
  onEditTarget: (value: string) => void;
  onEditValue: (value: string) => void;
  onSubmitEdit: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
}) {
  const groups = groupRequirements(props.state.roleCard.requirements);
  return <section className={styles.result} aria-labelledby="create-summary-title">
    <div className={styles.resultHead}><div><p>Questa è la posizione che abbiamo capito.</p><h2 id="create-summary-title">{props.state.roleCard.title}</h2></div><div className={styles.scoreBox}><span>Dati raccolti</span><strong>{props.state.completion.coverage}%</strong></div><div className={styles.gateBox}><span>Stato</span><strong>{props.state.paymentRequired ? 'Pronta per il confine commerciale' : 'Da confermare'}</strong></div></div>
    <div className={styles.confirmationGrid}>
      <Panel title="Risultato" items={[props.state.roleCard.mission, ...props.state.roleCard.outcomes]} empty="Da definire." />
      <Panel title="Attività" items={props.state.roleCard.responsibilities} empty="Da definire." />
      <Panel title="Indispensabili" items={groups.REQUIRED} empty="Da definire." />
      <Panel title="Preferenziali" items={groups.PREFERRED} empty="Nessuno indicato." />
      <Panel title="Apprendibili" items={groups.TRAINABLE} empty="Nessuno indicato." />
      <Panel title="Vincoli" items={groups.DISQUALIFYING} empty="Nessuno indicato." />
      <Panel title="Contesto" items={props.state.roleCard.attractionEvidence} empty="Da definire." />
      <Panel title="Condizioni" items={[`Sede: ${displayValue(props.state.roleCard.location)}`, `Modalità: ${displayValue(props.state.roleCard.workMode)}`, `Contratto: ${displayValue(props.state.roleCard.contractType)}`, `Orario: ${displayValue(props.state.roleCard.schedule)}`, `Compenso: ${displayValue(props.state.roleCard.compensation)}`]} empty="Da definire." />
      <Panel title="Candidatura" items={[props.state.roleCard.channel ? `Canale: ${props.state.roleCard.channel}` : 'Canale: Da definire']} empty="Da definire." />
    </div>
    {props.state.strategy && <div className={styles.strategyPanel}><p>Strategia</p><h3>{props.state.strategy.summary}</h3><span>{props.state.strategy.candidateAngle}</span></div>}
    {!props.state.paymentRequired && <form className={styles.inlineEdit} onSubmit={props.onSubmitEdit}><Field label="Modifica" htmlFor="create-edit-target"><select id="create-edit-target" value={props.editTarget} onChange={(event) => props.onEditTarget(event.target.value)} disabled={props.running}><option value="title">Ruolo</option><option value="mission">Risultato</option><option value="responsibilities">Attività</option><option value="requirements">Requisiti</option><option value="attractionContext.location">Sede</option><option value="attractionContext.workMode">Modalità</option><option value="attractionContext.contractType">Contratto</option><option value="compensation.amountText">Compenso</option></select></Field><Field label="Nuovo valore" htmlFor="create-edit-value"><input id="create-edit-value" value={props.editValue} onChange={(event) => props.onEditValue(event.target.value)} disabled={props.running} /></Field><button type="submit" disabled={props.running}>Modifica</button></form>}
    {props.state.paymentRequired ? <section className={styles.commercialPanel}><p>Prossimo passo</p><h3>La posizione è pronta. Ora possiamo costruire il tuo Annuncio 10x.</h3><span>La generazione online sarà disponibile in una fase successiva.</span><OfferCards offers={props.state.commercial.availableOffers} empty="La generazione non è ancora disponibile per questo percorso." /></section> : <div className={styles.actions}><button type="button" onClick={props.onConfirm} disabled={props.running || !props.state.canConfirm}>Conferma</button><span>Puoi modificare i campi prima della conferma.</span></div>}
  </section>;
}

function OfferCards({ offers, empty }: { offers: CommercialOffer[]; empty: string }) {
  const visibleOffers = offers.filter((offer) => offer.productCode === 'AD_GENERATION');
  if (!visibleOffers.length) return <div className={styles.offerPanel}><h3>{empty}</h3><p>Ti guideremo al passo successivo quando sarà disponibile.</p><button type="button" disabled>In preparazione</button></div>;
  return <div className={styles.offerList} aria-label="Prossimo passo">{visibleOffers.map((offer) => <article key={offer.id} className={styles.offerPanel}><h3>{offer.displayName}</h3><p>{offer.description}</p><button type="button" disabled>In preparazione</button></article>)}</div>;
}

function Field(props: { label: string; htmlFor: string; required?: boolean; optional?: boolean; children: ReactNode }) {
  return <label className={styles.field} htmlFor={props.htmlFor}><span>{props.label}{props.required && <b> *</b>}{props.optional && <em>opzionale</em>}</span>{props.children}</label>;
}

function FormSection(props: { number: string; title: string; children: ReactNode }) {
  return <section className={styles.formSection}><header><span>{props.number}</span><h3>{props.title}</h3></header>{props.children}</section>;
}

function UnknownToggle(props: { checked: boolean; onChange: () => void }) {
  return <label className={styles.unknownToggle}><input type="checkbox" checked={props.checked} onChange={props.onChange} /><span>Non lo so / da definire</span></label>;
}

function Panel({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  const filtered = items.map(displayValue).filter((item) => item && item !== 'N/D');
  return <article className={styles.panel}><h3>{title}</h3>{filtered.length ? <ul>{filtered.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{empty}</p>}</article>;
}

function composeCreateAnswers(draft: CreateDraft, unknowns: Record<UnknownKey, boolean>): Record<CreateStepId, string> {
  const value = (key: keyof CreateDraft, fallback = 'Da definire') => cleanDraft(draft[key]) || fallback;
  const maybeUnknown = (key: UnknownKey, raw: string) => unknowns[key] ? 'Da definire' : cleanDraft(raw) || 'Da definire';
  return {
    ROLE_CONTEXT: `Ruolo: ${value('role')}. Azienda o contesto: ${value('companyContext')}.`,
    PRIMARY_CONTRIBUTION: `Risultato principale: ${value('primaryResult')}.`,
    WORK_REALITY: [`Attività reali: ${value('activities')}.`, `Contesto operativo e interlocutori: ${value('operatingContext')}.`, `Autonomia: ${value('autonomy')}.`, `Imprevisti o problemi da gestire: ${value('incidents')}.`].join('\n'),
    REQUIREMENTS: [`Indispensabili: ${value('requiredRequirements')}.`, `Preferenziali: ${value('preferredRequirements')}.`, `Apprendibili: ${value('trainableRequirements')}.`, `Vincoli: ${value('disqualifyingRequirements')}.`].join('\n'),
    ATTRACTION: [`Benefit: ${maybeUnknown('benefits', draft.benefits)}.`, `Formazione e crescita concreta: ${maybeUnknown('growth', draft.growth)}.`].join('\n'),
    OFFER: [`Sede: ${value('location')}.`, `Modalità: ${maybeUnknown('workMode', draft.workMode)}.`, `Contratto: ${maybeUnknown('contract', draft.contract)}.`, `Orario: ${maybeUnknown('schedule', draft.schedule)}.`, `Turni: ${value('shifts')}.`, `Reperibilità: ${value('availability')}.`, `Compenso: ${maybeUnknown('compensation', draft.compensation)}.`].join('\n'),
    CHANNEL_APPLICATION: `Canale: ${unknowns.channel ? 'Da definire' : draft.channel || 'Da definire'}.\nCandidatura: ${value('application')}.`,
  };
}

function groupRequirements(requirements: CreateState['roleCard']['requirements']) {
  return {
    REQUIRED: requirements.filter((item) => item.classification === 'REQUIRED').map((item) => item.label),
    PREFERRED: requirements.filter((item) => item.classification === 'PREFERRED').map((item) => item.label),
    TRAINABLE: requirements.filter((item) => item.classification === 'TRAINABLE').map((item) => item.label),
    DISQUALIFYING: requirements.filter((item) => item.classification === 'DISQUALIFYING').map((item) => item.label),
  };
}

function displayValue(value: string) {
  return value && value !== 'OPEN_DECISION' ? value : 'Da definire';
}

function cleanDraft(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function scrollToElement(element: HTMLElement) {
  element.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
