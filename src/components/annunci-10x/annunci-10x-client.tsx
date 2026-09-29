"use client";

import Image from 'next/image';
import Link from 'next/link';
import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Annunci10xAnalyzeFlow } from './annunci-10x-analyze-flow';
import {
  checkoutCtaLabel,
  customerSafeCheckoutError,
  fetchAnnunci10xCommercialOffers,
  offerPriceLabel,
  startAnnunci10xCheckout,
  type Annunci10xCommercialOffer,
  type Annunci10xCommercialState,
} from './annunci-10x-commerce-client';
import { Annunci10xIdentityGate } from './annunci-10x-identity-gate';
import { Annunci10xFulfillmentPanel } from './annunci-10x-fulfillment-panel';
import styles from './annunci-10x.module.css';

type Mode = 'ANALYZE' | 'CREATE';
type CreateStepId = 'ROLE_CONTEXT' | 'PRIMARY_CONTRIBUTION' | 'WORK_REALITY' | 'REQUIREMENTS' | 'ATTRACTION' | 'OFFER' | 'CHANNEL_APPLICATION';
type AnalyzeChannel = '' | 'LINKEDIN' | 'INDEED' | 'ATS' | 'EMAIL' | 'CUSTOM';
type UnknownKey = 'workMode' | 'contract' | 'schedule' | 'compensation' | 'benefits' | 'growth' | 'channel';

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
  contactSaved?: boolean;
  emailVerified?: boolean;
  commercial: {
    checkoutEnabled: boolean;
    pricingStatus: 'FIXED';
    availableOffers: Annunci10xCommercialOffer[];
    entitlementSummary: {
      guide: boolean;
      rewriteCredits: number;
      createCredits: number;
      agentRecruiterAccess: boolean;
      source: string;
    };
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
const scoreDisclaimer = 'Il punteggio valuta la chiarezza e la completezza delle informazioni disponibili nell’annuncio. Non prevede il numero di candidature né sostituisce la valutazione delle persone.';
const guaranteeCopy = '7 € per un annuncio, una versione e un canale. Dopo la conferma del pagamento generiamo il testo completo e te lo rendiamo disponibile. Se non ti è utile, puoi chiedere il rimborso integrale entro 14 giorni dalla consegna, senza motivazione, scrivendo a info@horyzon.it dall’email usata per l’acquisto.';
const proofItems = ['Horyzon Consulting Recruiting', 'Score di chiarezza', '20 controlli editoriali'];
const storyBeats = [
  'Pubblichi un annuncio e arrivano CV fuori target: persone motivate, magari, ma lontane dal lavoro reale.',
  'Aumenti il budget o cambi portale, però il problema resta: poche candidature utili e candidati che avevano capito un altro ruolo.',
  'Fai colloqui per chiarire ciò che l’annuncio non aveva spiegato: attività, condizioni, ritmo, responsabilità, aspettative.',
  'La sostituzione slitta, il team compensa, i manager si caricano urgenze che non dovrebbero più gestire.',
  'Alla fine assumi di fretta e il rischio è scoprire dopo pochi mesi che la persona non era davvero allineata.',
];
const targetLines = [
  'Se sei un imprenditore e una posizione scoperta sta rallentando l’azienda.',
  'Se gestisci HR o recruiting e passi ore tra candidature e colloqui poco utili.',
  'Se devi sostituire qualcuno ma continui a rimandare perché trovare un’alternativa sembra impossibile.',
  'Se l’azienda potrebbe crescere, ma non riesci a inserire le persone necessarie.',
];
const funnelExamples = [
  {
    title: 'ANNUNCIO VAGO',
    rows: ['Filtro largo', 'Messaggio ambiguo', 'Poca coerenza tra CV e lavoro reale'],
  },
  {
    title: 'ANNUNCIO CHIARO',
    rows: ['Filtro più selettivo', 'Lavoro comprensibile', 'Maggiore coerenza tra aspettative e ruolo'],
  },
];
const roleGroups: Array<[string, string[]]> = [
  ['Produzione', ['Operaio di produzione', 'Saldatore', 'Manutentore meccanico', 'Elettricista', 'Tecnico installatore']],
  ['Logistica', ['Magazziniere carrellista', 'Autista patente C']],
  ['Commerciale e ufficio', ['Commerciale B2B', 'Impiegato amministrativo', 'Addetto alla contabilità']],
  ['Ristorazione', ['Cuoco', 'Cameriere di sala']],
];
const methodSteps = ['Lavoro reale', 'Persona necessaria', 'Strategia', 'Annuncio', 'Verifica'];
const faqItems = [
  ['Quanto costa?', 'Lo Score è gratuito. Annuncio 10x costa 7 €: un annuncio, una versione e un canale. Puoi arrivarci partendo da un testo esistente o da un brief guidato.'],
  ['Cosa ricevo con lo Score gratuito?', 'Ricevi uno Score di chiarezza su 100, la fascia, le aree prioritarie, la motivazione e le informazioni da chiarire. Il risultato si vede dopo la verifica email.'],
  ['Che cosa misura lo Score?', 'Misura chiarezza, completezza delle informazioni disponibili, distinzione tra dati presenti e mancanti e valutazione editoriale. Non prevede candidature, qualità futura dei candidati o successo dell’assunzione.'],
  ['Perché mi chiedete l’email?', 'Serve per collegare il report alla tua richiesta e inviartelo. Comunicazioni marketing solo con consenso separato.'],
  ['Che differenza c’è tra i due percorsi?', 'Se hai già un annuncio, parti dallo Score gratuito e poi puoi trasformarlo in Annuncio 10x. Se non hai ancora un testo, parti dal brief guidato e arrivi allo stesso prodotto.'],
  ['Che cosa include Annuncio 10x?', 'Un testo completo generato dopo pagamento confermato: un annuncio, una versione e un canale, senza inventare fatti professionali non confermati.'],
  ['Usate l’intelligenza artificiale?', 'Sì. L’intelligenza artificiale applica i controlli del metodo. Il sistema è progettato per non riempire informazioni mancanti con fatti professionali inventati.'],
  ['Funziona anche per ruoli operativi?', 'Sì. Annunci 10x è pensato anche per ruoli operativi, tecnici, logistici, amministrativi, commerciali e di ristorazione.'],
  ['Ho già un’agenzia o un consulente. Mi serve comunque?', 'Può esserti utile come controllo sul testo e sul modo in cui il ruolo viene spiegato. Non sostituisce il processo di selezione o il lavoro consulenziale.'],
  ['Mi garantite più candidature?', 'No. Le candidature dipendono da mercato, canale, condizioni e attrattività dell’offerta. Annunci 10x lavora su chiarezza e coerenza dell’annuncio.'],
  ['Come funziona "soddisfatti o rimborsati"?', 'Puoi chiedere il rimborso integrale entro 14 giorni dalla consegna, senza motivazione, scrivendo a info@horyzon.it dall’email usata per l’acquisto.'],
  ['Chi c’è dietro Annunci 10x?', 'Annunci 10x è un prodotto di Horyzon Consulting Recruiting.'],
  ['E se il problema non è l’annuncio?', 'A volte l’annuncio è solo il primo segnale. Il blocco può riguardare fabbisogno, canale, processo di selezione o attrattività dell’offerta. In quel caso puoi parlarne con Horyzon.'],
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
  const [checkoutNotice] = useState<'success' | 'cancelled' | null>(() => initialCheckoutNotice());
  const [commerceRefreshToken, setCommerceRefreshToken] = useState(0);
  const analyzeRef = useRef<HTMLDivElement | null>(null);
  const createRef = useRef<HTMLElement | null>(null);
  const showCreateAfterCheckout = useCallback(() => {
    setMode('CREATE');
    window.setTimeout(() => {
      if (createRef.current) scrollToElement(createRef.current);
    }, 0);
  }, []);

  useEffect(() => {
    fetch('/api/annunci-10x/create/state', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: { ok: boolean; result: CreateState | null }) => {
        if (!payload.ok || !payload.result) return;
        setCreateState(payload.result);
        if (checkoutNotice === 'success' || checkoutNotice === 'cancelled') setMode('CREATE');
      })
      .catch(() => undefined);
  }, [checkoutNotice]);

  useEffect(() => {
    if (checkoutNotice !== 'success') return;

    const delays = [0, 1500, 3000, 5000];
    let cancelled = false;
    let baselineFingerprint: string | null = null;
    const timers: number[] = [];
    const stopPolling = () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
    delays.forEach((delay) => {
      const timer = window.setTimeout(async () => {
        if (cancelled) return;
        try {
          const commercial = await fetchAnnunci10xCommercialOffers();
          const fingerprint = commerceStateFingerprint(commercial);
          if (baselineFingerprint === null) {
            baselineFingerprint = fingerprint;
            return;
          }
          if (fingerprint !== baselineFingerprint) {
            setCommerceRefreshToken((value) => value + 1);
            stopPolling();
          }
        } catch {
          // Query params are UX only; failed refresh must not unlock anything.
        }
      }, delay);
      timers.push(timer);
    });
    return stopPolling;
  }, [checkoutNotice]);

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
            <p className={styles.eyebrow}>Annunci 10x · Horyzon Consulting Recruiting</p>
            <h1 id="annunci10x-hero-title">Il tuo annuncio fa capire il lavoro alle persone giuste?</h1>
            <p className={styles.heroLead}>Incolla il link o il testo dell’annuncio. Ricevi uno Score di chiarezza su 100 e i punti da migliorare dopo la verifica dell’email.</p>
            <p className={styles.heroMicroLead}>Gratis · 2 minuti · nessuna carta di credito</p>
            <div className={styles.heroActions} aria-label="Percorsi iniziali">
              <button type="button" onClick={() => selectMode('ANALYZE')}>Valuta gratis il mio annuncio</button>
              <button type="button" className={styles.heroSecondaryAction} onClick={() => selectMode('CREATE')}>Non ho ancora un annuncio: crealo a 7 €</button>
            </div>
            <HeroProofStrip />
          </div>
          <div ref={analyzeRef} className={styles.heroPanel} aria-label="Analisi gratuita Annunci 10x">
            <Annunci10xAnalyzeFlow commerceRefreshToken={commerceRefreshToken} />
          </div>
        </div>
      </section>

      {checkoutNotice === 'success' && <div className={styles.checkoutBanner} role="status" aria-live="polite"><strong>Pagamento ricevuto.</strong><span>Stiamo preparando il tuo accesso.</span></div>}
      {checkoutNotice === 'cancelled' && <div className={styles.checkoutBanner} role="status" aria-live="polite"><strong>Pagamento annullato.</strong><span>Non è stato completato alcun acquisto.</span></div>}
      <Annunci10xFulfillmentPanel checkoutNotice={checkoutNotice} onCreateReturn={showCreateAfterCheckout} />

      <ProblemNarrative />
      <CentralIdeaSection />
      <InverseFunnelSection />
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
          <span>Se il testo non esiste ancora, parti dai fatti del ruolo. Raccogliamo i dati in tre blocchi progressivi, poi generiamo il testo completo solo dopo pagamento confermato.</span>
        </div>
        <CreateFlow state={createState} draft={createDraft} unknowns={unknowns} running={running} clarificationAnswer={clarificationAnswer} editTarget={editTarget} editValue={editValue} error={error} commerceRefreshToken={commerceRefreshToken} onStart={startCreate} onDraft={setCreateDraft} onUnknowns={setUnknowns} onSubmitStructured={submitStructuredCreate} onClarificationAnswer={setClarificationAnswer} onSubmitClarification={submitCreateClarification} onEditTarget={setEditTarget} onEditValue={setEditValue} onSubmitEdit={submitEdit} onConfirm={confirmCreate} />
      </section>}

      <GuaranteeSection />
      <ConsultingSection />
      <FaqSection />
      <FinalCta onAnalyze={() => selectMode('ANALYZE')} />
    </main>
    <FunnelFooter />
  </div>;
}

function FunnelHeader({ onAnalyze }: { onAnalyze: () => void }) {
  return <header className={styles.funnelHeader} aria-label="Annunci 10x">
    <Link href="/" className={styles.brand} aria-label="Horyzon Consulting Recruiting"><Image src="/annunci-10x/horyzon-consulting-recruiting.png" alt="" width={640} height={240} sizes="(max-width: 640px) 160px, 220px" className={styles.brandLogo} aria-hidden="true" /></Link>
    <button type="button" onClick={onAnalyze}>Valuta gratis</button>
  </header>;
}

function FunnelFooter() {
  return <footer className={styles.funnelFooter}>
    <div><strong>Horyzon Consulting Recruiting</strong><p>FELICITÀ srl · Viale Papiniano 28, 20123 Milano · P.IVA 05120660757 · SDI SU9YNJA</p></div>
    <nav aria-label="Link legali Annunci 10x"><Link href="/privacy-policy">Privacy</Link><Link href="/cookie-policy">Cookie</Link><a href="mailto:info@horyzon.it">info@horyzon.it</a></nav>
  </footer>;
}

function HeroProofStrip() {
  return <div className={styles.proofStrip} aria-label="Prove del metodo">{proofItems.map((item) => <span key={item}>{item}</span>)}</div>;
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
    <div className={styles.funnelVisual}>{funnelExamples.map((example) => <article key={example.title}><h3>{example.title}</h3>{example.rows.map((row) => <span key={row}>{row}</span>)}</article>)}</div>
  </section>;
}

function ProductExplainerSection() {
  return <section className={styles.explainerSection}>
    <div className={styles.sectionHeading}><p>Score di chiarezza</p><h2>Annunci 10x guarda il testo come lo leggerà una persona reale.</h2><span>Non abbellisce l’offerta e non inventa benefit. Evidenzia cosa è chiaro, cosa manca e dove l’annuncio rischia di lasciare dubbi materiali.</span></div>
    <div className={styles.explainerGrid}><article><h3>Valuta chiarezza</h3><p>Controlla se ruolo, attività e condizioni sono comprensibili.</p></article><article><h3>Valuta completezza</h3><p>Distingue informazioni presenti, mancanti e non valutabili.</p></article><article><h3>Applica valutazione editoriale</h3><p>Mostra punti forti, priorità e significato del risultato. Le indicazioni operative arrivano nel report via email.</p></article></div>
    <p className={styles.disclaimer}>{scoreDisclaimer}</p>
  </section>;
}

function ControlsSection() {
  return <section className={styles.controlsSection}>
    <div className={styles.sectionHeading}><p>20 controlli</p><h2>Ogni controllo serve a una domanda semplice.</h2><span>La persona giusta capisce che lavoro è, quali condizioni troverà e perché dovrebbe candidarsi?</span></div>
  </section>;
}

function RoleStrip() {
  return <section className={styles.rolesSection}>
    <div className={styles.sectionHeading}><p>Esempi ruoli</p><h2>Funziona sui ruoli che assumono davvero le PMI.</h2></div>
    <div className={styles.roleGroups}>{roleGroups.map(([group, items]) => <article key={group}><h3>{group}</h3><p>{items.join(' · ')}</p></article>)}</div>
  </section>;
}

function BeforeAfterSection() {
  return <section className={styles.beforeAfterSection}>
    <div className={styles.sectionHeading}><p>Anteprima del report</p><h2>La struttura reale del risultato gratuito.</h2></div>
    <div className={styles.casePending}>
      <span>Esempio illustrativo dal sample ad</span>
      <ul>
        <li><strong>Score di chiarezza</strong><p>Valore su 100 calcolato sui controlli valutabili.</p></li>
        <li><strong>Fascia</strong><p>Critico, Debole, Buona base, Forte o Eccellente descrivono chiarezza e completamento, non probabilità di assunzione.</p></li>
        <li><strong>Aree prioritarie</strong><p>I controlli che frenano di più la comprensione del ruolo.</p></li>
        <li><strong>Motivazione</strong><p>Perché quel punto è debole rispetto alle informazioni disponibili.</p></li>
        <li><strong>Informazioni da chiarire</strong><p>Dati mancanti da confermare prima di generare un testo completo.</p></li>
      </ul>
      <p>{scoreDisclaimer}</p>
    </div>
  </section>;
}

function MethodSection() {
  return <section id="metodo" className={styles.methodSection}>
    <div className={styles.sectionHeading}><p>Metodo</p><h2>Prima la realtà del ruolo. Poi le parole.</h2><span>Il testo viene valutato partendo da lavoro reale, persona necessaria, informazioni disponibili e chiarezza operativa.</span></div>
    <div className={styles.methodFlow}>{methodSteps.map((step) => <span key={step}>{step}</span>)}</div>
  </section>;
}

function ProductChoiceSection({ onAnalyze, onCreate }: { onAnalyze: () => void; onCreate: () => void }) {
  return <section id="prodotti" className={styles.productChoice}>
    <div className={styles.sectionHeading}><p>Prodotto</p><h2>Un solo prodotto: Annuncio 10x.</h2></div>
    <div className={styles.productPaths}>
      <article data-featured="true"><p>ANNUNCIO 10X</p><h3>Annuncio 10x</h3><strong>7 €</strong><span>Potenzia un testo esistente o creane uno nuovo partendo dai fatti del ruolo. Una versione per il canale scelto.</span><div className={styles.heroActions}><button type="button" onClick={onAnalyze}>Valuta gratis il mio annuncio</button><button type="button" onClick={onCreate}>Non ho ancora un annuncio: crealo a 7 €</button></div><small>Output completo solo dopo pagamento confermato.</small></article>
    </div>
  </section>;
}

function GuaranteeSection() {
  return <section className={styles.guaranteeSection}><p>Garanzia commerciale</p><h2>Rimborso integrale entro 14 giorni dalla consegna.</h2><span>{guaranteeCopy}</span></section>;
}

function ConsultingSection() {
  return <section className={styles.consultingSection}><div className={styles.sectionHeading}><p>Quando serve aiuto</p><h2>E se il problema non è l&apos;annuncio?</h2><span>A volte l’annuncio è buono e le persone giuste non arrivano comunque. Il blocco può essere nel fabbisogno, nel canale, nel processo di selezione o nell’attrattività dell’offerta.</span><Link href="/contatti" className={styles.textCta}>Parla con Horyzon</Link></div></section>;
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

function FinalCta({ onAnalyze }: { onAnalyze: () => void }) {
  return <section className={styles.finalCta}><p>Primo passo</p><h2>Vuoi capire se il tuo annuncio è abbastanza chiaro?</h2><span>Parti dallo Score gratuito, poi decidi se trasformarlo in Annuncio 10x.</span><div className={styles.heroActions}><button type="button" onClick={onAnalyze}>Valuta gratis il mio annuncio</button></div><small>Gratis · 2 minuti · nessuna carta di credito</small></section>;
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
  commerceRefreshToken: number;
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
    {props.state && (props.state.currentStep === 'SUMMARY' || props.state.currentStep === 'COMMERCIAL') && <CreateSummary state={props.state} running={props.running} editTarget={props.editTarget} editValue={props.editValue} commerceRefreshToken={props.commerceRefreshToken} onEditTarget={props.onEditTarget} onEditValue={props.onEditValue} onSubmitEdit={props.onSubmitEdit} onConfirm={props.onConfirm} />}
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
  commerceRefreshToken: number;
  onEditTarget: (value: string) => void;
  onEditValue: (value: string) => void;
  onSubmitEdit: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
}) {
  const groups = groupRequirements(props.state.roleCard.requirements);
  const [contactSavedLocally, setContactSavedLocally] = useState(false);
  const [emailVerifiedLocally, setEmailVerifiedLocally] = useState(false);
  const [commercial, setCommercial] = useState<Annunci10xCommercialState | null>(null);
  const [commercialStatus, setCommercialStatus] = useState<string | null>(null);
  const contactSaved = contactSavedLocally || Boolean(props.state.contactSaved);
  const emailVerified = emailVerifiedLocally || Boolean(props.state.emailVerified);

  useEffect(() => {
    if (!props.state.paymentRequired || !emailVerified) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCommercialStatus('Caricamento offerte in corso.');
      fetchAnnunci10xCommercialOffers()
        .then((nextCommercial) => {
          if (cancelled) return;
          setCommercial(nextCommercial);
          setCommercialStatus(null);
        })
        .catch((cause) => {
          if (!cancelled) setCommercialStatus(customerSafeCheckoutError(cause));
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [props.state.paymentRequired, emailVerified, props.commerceRefreshToken]);

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
    {props.state.paymentRequired ? <section className={styles.commercialPanel} aria-labelledby="create-commercial-title">
      <p>Prossimo passo</p>
      <h3 id="create-commercial-title">Annuncio 10x</h3>
      <ul>
        <li>7 €</li>
        <li>1 annuncio</li>
        <li>1 versione</li>
        <li>1 canale</li>
      </ul>
      <span>{guaranteeCopy}</span>
      {!emailVerified
        ? <Annunci10xIdentityGate
            eyebrow="Prima del pagamento"
            title="Dove ti mandiamo il tuo annuncio?"
            description="Verifichiamo l'email aziendale prima di mostrarti le opzioni di acquisto."
            submitLabel="Salva contatto"
            otpTitle="Ti mandiamo un codice di 6 cifre per proseguire."
            idPrefix="create-lead"
            initialContactSaved={contactSaved}
            initialEmailVerified={emailVerified}
            onContactSaved={({ emailVerified: verified }) => {
              setContactSavedLocally(true);
              setEmailVerifiedLocally(verified);
            }}
            onVerified={() => setEmailVerifiedLocally(true)}
          />
        : <OfferCards offers={commercial?.availableOffers ?? []} status={commercialStatus} empty="Le opzioni di acquisto non sono disponibili in questo momento." />}
    </section> : <div className={styles.actions}><button type="button" onClick={props.onConfirm} disabled={props.running || !props.state.canConfirm}>Conferma</button><span>Puoi modificare i campi prima della conferma.</span></div>}
  </section>;
}

function OfferCards({ offers, status, empty }: { offers: Annunci10xCommercialOffer[]; status: string | null; empty: string }) {
  const createOffer = offers.find((offer) => offer.offerCode === 'ANNUNCI10X_CREATE');
  if (!createOffer) return <div className={styles.offerPanel}><h3>{empty}</h3><p>{status ?? 'Riprova tra qualche minuto.'}</p><button type="button" disabled>Pagamento temporaneamente non disponibile</button></div>;
  return <div className={styles.offerList} aria-label="Opzioni di acquisto Annunci 10x">
    <CheckoutOfferCard offer={createOffer} detail="1 annuncio · 1 versione · 1 canale" primary />
  </div>;
}

function CheckoutOfferCard({ offer, detail, primary = false }: { offer: Annunci10xCommercialOffer; detail: string; primary?: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function checkout() {
    if (!offer.purchaseEnabled || offer.reasonUnavailable === 'EMAIL_NOT_VERIFIED') {
      setStatus(offer.reasonUnavailable === 'EMAIL_NOT_VERIFIED' ? 'Verifica prima la tua email' : null);
      return;
    }
    setLoading(true);
    setStatus('Preparazione pagamento…');
    try {
      await startAnnunci10xCheckout(offer.offerCode);
    } catch (cause) {
      setStatus(customerSafeCheckoutError(cause));
      setLoading(false);
    }
  }

  return <article className={styles.offerPanel} data-featured={primary} data-secondary={!primary}>
    <h3>{offer.displayName}</h3>
    <div className={styles.offerMeta}><strong>{offerPriceLabel(offer)}</strong><span>{detail}</span></div>
    <p>{offer.description}</p>
    <small>Output completo dopo pagamento confermato. Rimborso integrale entro 14 giorni dalla consegna.</small>
    <button type="button" onClick={checkout} disabled={!offer.purchaseEnabled || loading}>{loading ? 'Preparazione pagamento…' : checkoutCtaLabel(offer)}</button>
    {status && <span className={styles.offerStatus} aria-live="polite">{status}</span>}
  </article>;
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

function initialCheckoutNotice(): 'success' | 'cancelled' | null {
  if (typeof window === 'undefined') return null;
  const checkout = new URLSearchParams(window.location.search).get('checkout');
  return checkout === 'success' || checkout === 'cancelled' ? checkout : null;
}

function commerceStateFingerprint(commercial: Annunci10xCommercialState): string {
  return JSON.stringify({
    checkoutEnabled: commercial.checkoutEnabled,
    guide: Boolean(commercial.entitlements?.guide),
    rewriteCredits: Number(commercial.entitlements?.rewriteCredits ?? 0),
    createCredits: Number(commercial.entitlements?.createCredits ?? 0),
    agentRecruiterAccess: Boolean(commercial.entitlements?.agentRecruiterAccess),
    offers: commercial.availableOffers.map((offer) => ({
      offerCode: offer.offerCode,
      eligibility: offer.eligibility,
      reasonUnavailable: offer.reasonUnavailable ?? null,
    })),
  });
}

function scrollToElement(element: HTMLElement) {
  element.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
