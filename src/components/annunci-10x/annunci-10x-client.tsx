"use client";

import Image from 'next/image';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { formatAnnunci10xScore } from '@/lib/annunci-10x/presentation.ts';
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

interface CommercialState {
  availableOffers: CommercialOffer[];
  checkoutEnabled: false;
  pricingStatus: 'OPEN_DECISION';
  entitlements: { guide: boolean; adGenerationCredits: number; source: string };
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

interface PublicScore {
  value: number | null;
  interval?: { min: number; max: number };
  coverage: number;
  checks?: unknown[];
}

interface PublicGate {
  status: string;
  blockingReasons: string[];
  warnings: string[];
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

interface PremiumOutput {
  outputId: string;
  masterText: string;
  channelVariant: { channel: string; sections: { id: string; title: string; body: string }[] } | null;
  score: PublicScore;
  gate: PublicGate;
  validationState: string;
  claimCheck: { id: string; claim: string; status: string; publishable: boolean }[];
  comparison: { improvements: string[]; regressionsToReview: string[]; changes: { label: string; before?: string; after?: string }[] } | null;
  rationale: string[];
  checklist: string[];
  provider: 'MOCK' | 'OPENAI';
  generatedAt: string;
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

export function Annunci10xClient() {
  const [mode, setMode] = useState<Mode>('ANALYZE');
  const [, setCommercial] = useState<CommercialState | null>(null);
  const [premiumOutput, setPremiumOutput] = useState<PremiumOutput | null>(null);
  const [createState, setCreateState] = useState<CreateState | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(emptyDraft);
  const [unknowns, setUnknowns] = useState<Record<UnknownKey, boolean>>(defaultUnknowns);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [editTarget, setEditTarget] = useState('title');
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetch('/api/annunci-10x/create/state', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: { ok: boolean; result: CreateState | null }) => {
        if (payload.ok && payload.result) setCreateState(payload.result);
      })
      .catch(() => undefined);
    fetch('/api/annunci-10x/commercial/offers', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: { ok: boolean; commercial?: CommercialState }) => {
        if (payload.ok && payload.commercial) setCommercial(payload.commercial);
      })
      .catch(() => undefined);
    fetch('/api/annunci-10x/premium/output', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: { ok: boolean; result?: PremiumOutput | null }) => {
        if (payload.ok) setPremiumOutput(payload.result ?? null);
      })
      .catch(() => undefined);
  }, []);

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    window.setTimeout(() => {
      if (workspaceRef.current) scrollToElement(workspaceRef.current);
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

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return <div className={styles.page}>
    <section className={styles.hero}>
      <Image
        src="/annunci-10x/hero.jpeg"
        alt="Professionisti che camminano verso una citta al tramonto"
        fill
        sizes="100vw"
        preload
        className={styles.heroImage}
      />
      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.heroContent}>
        <p className={styles.eyebrow}>Horyzon / Annunci 10x</p>
        <h1>Le persone giuste esistono. Il tuo annuncio riesce ad attirarle?</h1>
        <p className={styles.heroLead}>Se ricevi CV fuori target, fai colloqui che non portano a nulla o rimandi una sostituzione perche temi di non trovare alternative, il problema puo iniziare da come stai presentando il ruolo. Scoprilo gratis con Annunci 10x Score.</p>
        <div className={styles.heroActions} aria-label="Percorsi iniziali">
          <button type="button" onClick={() => selectMode('ANALYZE')}>Calcola gratis il tuo Annunci 10x Score</button>
          <button type="button" onClick={() => selectMode('CREATE')}>Devo creare un annuncio da zero</button>
        </div>
      </div>
    </section>

    <PainSection />
    <ConsequenceSection />
    <AudienceSection />
    <SolutionSection />
    <HowItWorksSection />
    <PathChoiceSection onAnalyze={() => selectMode('ANALYZE')} onCreate={() => selectMode('CREATE')} />

    <section ref={workspaceRef} className={styles.workspace} aria-labelledby="annunci10x-workspace-title">
      <div className={styles.workspaceIntro}>
        <p>Workspace</p>
        <h2 id="annunci10x-workspace-title">Parti dal punto in cui sei.</h2>
        <p>Analizza un testo gia pronto oppure ricostruisci prima il ruolo reale. In entrambi i casi, il metodo resta lo stesso: prima i fatti, poi le parole.</p>
      </div>
      <div className={styles.workspaceBody}>
        <div className={styles.modeTabs} role="tablist" aria-label="Scegli percorso">
          <button type="button" role="tab" aria-selected={mode === 'ANALYZE'} data-active={mode === 'ANALYZE'} onClick={() => selectMode('ANALYZE')}>
            <span>Calcola lo Score</span>
            <small>Ho gia un annuncio</small>
          </button>
          <button type="button" role="tab" aria-selected={mode === 'CREATE'} data-active={mode === 'CREATE'} onClick={() => selectMode('CREATE')}>
            <span>Crea da zero</span>
            <small>Parto dal ruolo reale</small>
          </button>
        </div>

        {mode === 'ANALYZE'
          ? <Annunci10xAnalyzeFlow />
          : <CreateFlow
              state={createState}
              draft={createDraft}
              unknowns={unknowns}
              running={running}
              clarificationAnswer={clarificationAnswer}
              editTarget={editTarget}
              editValue={editValue}
              error={error}
              onStart={startCreate}
              onDraft={setCreateDraft}
              onUnknowns={setUnknowns}
              onSubmitStructured={submitStructuredCreate}
              onClarificationAnswer={setClarificationAnswer}
              onSubmitClarification={submitCreateClarification}
              onEditTarget={setEditTarget}
              onEditValue={setEditValue}
              onSubmitEdit={submitEdit}
              onConfirm={confirmCreate}
            />}
      </div>
    </section>

    {premiumOutput && <PremiumOutputPanel output={premiumOutput} copied={copied} onCopy={copyText} />}

    <MethodSection />
    <RolesSection />
    <RecruitingBridge />
    <FinalCta onAnalyze={() => selectMode('ANALYZE')} onCreate={() => selectMode('CREATE')} />
  </div>;
}

const painItems = [
  ['Tanti CV. Pochi candidati davvero adatti.', 'Tempo perso a leggere profili che non corrispondono al lavoro reale.'],
  ['Colloqui che non portano a una scelta.', 'Le candidature sembrano interessanti finche non emerge che ruolo e aspettative non erano stati capiti allo stesso modo.'],
  ['Hai bisogno di sostituire qualcuno, ma non trovi alternative.', 'Quando trovare una persona nuova sembra impossibile, anche una situazione che non funziona rischia di trascinarsi.'],
  ['La crescita si ferma perche manca la persona giusta.', 'Nuovi clienti, nuovi turni, nuove responsabilita o nuove sedi richiedono persone che l azienda non riesce a inserire.'],
];

const consequenceItems = ['tempo dell imprenditore', 'tempo dei manager', 'errori', 'ritardi', 'opportunita perse', 'team sovraccarico', 'crescita rallentata'];
const audienceSituations = [
  'Stai cercando da settimane e continuano ad arrivare candidati fuori target.',
  'Devi sostituire una persona ma temi di non trovare nessuno di meglio.',
  'La tua azienda potrebbe crescere, ma non riesci a inserire le persone necessarie.',
  'Il tuo HR o recruiter passa ore tra CV e colloqui senza arrivare alle persone giuste.',
  'Stai assumendo un ruolo operativo e vuoi spiegare bene fin dall inizio cosa dovra fare davvero.',
];
const methodSteps = ['Lavoro reale', 'Persona necessaria', 'Strategia', 'Annuncio', 'Verifica'];
const lenses = [
  ['Popolarita', 'Un ruolo raro non va raccontato come uno molto comune.'],
  ['Sfida / Routine', 'Cambia il peso tra stabilita, ritmo, autonomia e complessita.'],
  ['Qualificazione', 'Distingue cio che serve subito da cio che si puo imparare.'],
  ['Tecnicita', 'Evita di parlare a tutti quando serve parlare a chi capisce quel lavoro.'],
];
const checkCategories = ['chiarezza del ruolo', 'attivita reali', 'risultato atteso', 'requisiti', 'condizioni', 'offerta', 'candidatura', 'coerenza complessiva'];
const roles = ['Magazziniere', 'Cameriere', 'Cuoco', 'Venditore / Commerciale', 'Customer Care', 'Tecnico', 'Impiegato amministrativo', 'Automation Engineer'];

function PainSection() {
  return <section className={styles.sectionBlock}>
    <div className={styles.sectionHeading}>
      <p>Il problema</p>
      <h2>Il problema non e avere piu CV. E trovare la persona giusta.</h2>
    </div>
    <div className={styles.cardGrid}>{painItems.map(([title, copy], index) => <article key={title} className={styles.editorialCard}><span>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
  </section>;
}

function ConsequenceSection() {
  return <section className={styles.consequence}>
    <div>
      <p>Conseguenze</p>
      <h2>Una posizione scoperta o coperta dalla persona sbagliata non resta un problema HR.</h2>
    </div>
    <p>Assorbe tempo dell imprenditore, carica i manager, aumenta errori e ritardi, fa perdere opportunita e lascia il team a compensare finche la crescita rallenta.</p>
    <div className={styles.chips}>{consequenceItems.map((item) => <span key={item}>{item}</span>)}</div>
  </section>;
}

function AudienceSection() {
  return <section className={styles.audienceGrid}>
    <article>
      <p>Per chi e</p>
      <h2>Se assumere sta diventando un freno, Annunci 10x e per te.</h2>
      <ul>{audienceSituations.map((item) => <li key={item}>{item}</li>)}</ul>
      <span>Pensato soprattutto per imprenditori, responsabili HR e recruiter interni nelle PMI. I consulenti HR restano un pubblico secondario quando lavorano su ruoli concreti per i loro clienti.</span>
    </article>
  </section>;
}

function SolutionSection() {
  return <section className={styles.solutionBlock}>
    <div className={styles.sectionHeading}>
      <p>Da dove partire</p>
      <h2>Prima di cambiare portale, aumentare budget o concludere che i candidati non esistono, controlla il punto da cui tutto comincia: l annuncio.</h2>
    </div>
    <p>Annunci 10x Score analizza gratuitamente il testo per capire se sta spiegando il ruolo reale alla persona giusta: che lavoro c e da fare, quali requisiti servono davvero, quali condizioni sono chiare e perche una persona coerente dovrebbe scegliere quell opportunita.</p>
  </section>;
}

function HowItWorksSection() {
  return <section className={styles.sectionBlock}>
    <div className={styles.sectionHeading}>
      <p>Come funziona</p>
      <h2>Quattro passaggi semplici.</h2>
    </div>
    <div className={styles.steps}>
      {['Inserisci l annuncio', 'Lo analizziamo', 'Verifica la tua email', 'Visualizza il tuo Score'].map((item, index) => <article key={item}><span>{String(index + 1).padStart(2, '0')}</span><h3>{item}</h3></article>)}
    </div>
    <p className={styles.valueLine}>Il risultato gratuito ti aiuta a capire se il tuo annuncio e una base solida o se sta lasciando fuori informazioni decisive.</p>
  </section>;
}

function PathChoiceSection({ onAnalyze, onCreate }: { onAnalyze: () => void; onCreate: () => void }) {
  return <section className={styles.pathSplit}>
    <article data-primary="true">
      <p>Percorso 1</p>
      <h2>Ho gia un annuncio</h2>
      <span>Scopri cosa funziona e cosa sta limitando chiarezza e rilevanza.</span>
      <button type="button" onClick={onAnalyze}>Calcola lo Score</button>
    </article>
    <article>
      <p>Percorso 2</p>
      <h2>Parto da zero</h2>
      <span>Costruisci prima la realta del ruolo, poi l annuncio.</span>
      <button type="button" onClick={onCreate}>Crea da zero</button>
    </article>
  </section>;
}

function MethodSection() {
  return <section className={styles.methodSection}>
    <div className={styles.sectionHeading}>
      <p>Metodo Annunci 10x</p>
      <h2>Prima la realta del ruolo. Poi le parole.</h2>
    </div>
    <div className={styles.methodFlow}>{methodSteps.map((step) => <span key={step}>{step}</span>)}</div>
    <div className={styles.lensGrid}>{lenses.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div>
    <div className={styles.checksBand}><h3>20 controlli, senza mostrare la rubrica completa.</h3><div className={styles.chips}>{checkCategories.map((item) => <span key={item}>{item}</span>)}</div></div>
  </section>;
}

function RolesSection() {
  return <section className={styles.rolesSection}>
    <div className={styles.sectionHeading}>
      <p>Esempi ruoli</p>
      <h2>Funziona sui ruoli che assumono davvero le PMI.</h2>
    </div>
    <div className={styles.roleChips}>{roles.map((role) => <span key={role}>{role}</span>)}</div>
  </section>;
}

function RecruitingBridge() {
  return <section className={styles.bridge}>
    <p>Quando serve piu dell annuncio</p>
    <h2>Se il problema e piu ampio dell annuncio, possiamo aiutarti anche nel recruiting.</h2>
    <span>Annunci 10x resta il primo controllo. Se emergono problemi di fabbisogno, processo o selezione, Horyzon puo aiutarti a capire dove intervenire senza interrompere questo percorso.</span>
  </section>;
}

function FinalCta({ onAnalyze, onCreate }: { onAnalyze: () => void; onCreate: () => void }) {
  return <section className={styles.finalCta}>
    <h2>Inizia dal prossimo annuncio che devi pubblicare.</h2>
    <div className={styles.heroActions}>
      <button type="button" onClick={onAnalyze}>Calcola gratis il tuo Score</button>
      <button type="button" onClick={onCreate}>Crea un annuncio da zero</button>
    </div>
  </section>;
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
    {props.state && <div className={styles.createNotice}>
      <div><p>Hai un lavoro in corso.</p><strong>{props.state.currentStep === 'COMMERCIAL' ? 'La posizione e confermata.' : props.state.currentStep === 'SUMMARY' ? 'La scheda e pronta da verificare.' : 'Stiamo raccogliendo i fatti.'}</strong></div>
      <div><span>{props.state.completion.coverage}%</span><small>copertura raccolta</small></div>
    </div>}
    {!props.state?.paymentRequired && props.state?.currentStep !== 'SUMMARY' && <StructuredCreateForm draft={props.draft} unknowns={props.unknowns} running={props.running} error={props.error} onDraft={props.onDraft} onUnknowns={props.onUnknowns} onSubmit={props.onSubmitStructured} />}
    {props.state?.clarification && <div className={styles.clarification}>
      <p>Chiarimento necessario</p>
      <h3>{props.state.clarification.question}</h3>
      <small>{props.state.clarification.reason}</small>
      <Field label="Risposta" htmlFor="annunci10x-create-clarification">
        <textarea id="annunci10x-create-clarification" rows={3} value={props.clarificationAnswer} onChange={(event) => props.onClarificationAnswer(event.target.value)} disabled={props.running} />
      </Field>
      <div className={styles.actions}>
        <button type="button" onClick={() => props.onSubmitClarification(false)} disabled={props.running}>Salva chiarimento</button>
        <button type="button" onClick={() => props.onSubmitClarification(true)} disabled={props.running}>Non lo so</button>
      </div>
    </div>}
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
    <div className={styles.formHead}><p>Crealo</p><h2 id="create-title">Racconta il lavoro reale. L&apos;annuncio arriva dopo.</h2></div>
    <FormSection number="01" title="Ruolo e risultato">
      <div className={styles.fieldGrid}>
        <Field label="Ruolo" htmlFor="create-role" required><input id="create-role" required value={props.draft.role} onChange={(event) => update('role', event.target.value)} disabled={props.running} placeholder="Es. Addetto customer care" /></Field>
        <Field label="Azienda / contesto" htmlFor="create-company" optional><input id="create-company" value={props.draft.companyContext} onChange={(event) => update('companyContext', event.target.value)} disabled={props.running} placeholder="Es. sede di Bari, team assistenza clienti" /></Field>
      </div>
      <Field label="Risultato principale" htmlFor="create-result" required><textarea id="create-result" required rows={4} value={props.draft.primaryResult} onChange={(event) => update('primaryResult', event.target.value)} disabled={props.running} placeholder="Che cosa deve produrre o far funzionare meglio questa persona?" /></Field>
      <Field label="Attivita reali" htmlFor="create-activities" required><textarea id="create-activities" required rows={4} value={props.draft.activities} onChange={(event) => update('activities', event.target.value)} disabled={props.running} placeholder="Che cosa fara concretamente nel lavoro quotidiano?" /></Field>
    </FormSection>
    <FormSection number="02" title="Persona e lavoro">
      <div className={styles.requirementGrid}>
        <Field label="Indispensabili" htmlFor="create-required" required><textarea id="create-required" required rows={3} value={props.draft.requiredRequirements} onChange={(event) => update('requiredRequirements', event.target.value)} disabled={props.running} placeholder="Es. italiano scritto chiaro, precisione" /></Field>
        <Field label="Preferenziali" htmlFor="create-preferred" optional><textarea id="create-preferred" rows={3} value={props.draft.preferredRequirements} onChange={(event) => update('preferredRequirements', event.target.value)} disabled={props.running} placeholder="Es. esperienza CRM" /></Field>
        <Field label="Apprendibili" htmlFor="create-trainable" optional><textarea id="create-trainable" rows={3} value={props.draft.trainableRequirements} onChange={(event) => update('trainableRequirements', event.target.value)} disabled={props.running} placeholder="Es. software ticketing interno" /></Field>
      </div>
      <Field label="Vincoli escludenti" htmlFor="create-disqualifying" optional><input id="create-disqualifying" value={props.draft.disqualifyingRequirements} onChange={(event) => update('disqualifyingRequirements', event.target.value)} disabled={props.running} placeholder="Es. indisponibilita ai turni" /></Field>
      <Field label="Contesto operativo / interlocutori" htmlFor="create-context" required><textarea id="create-context" required rows={4} value={props.draft.operatingContext} onChange={(event) => update('operatingContext', event.target.value)} disabled={props.running} placeholder="Con chi lavora? Quali strumenti, team, clienti o funzioni coinvolge?" /></Field>
      <div className={styles.fieldGrid}>
        <Field label="Autonomia" htmlFor="create-autonomy" optional><input id="create-autonomy" value={props.draft.autonomy} onChange={(event) => update('autonomy', event.target.value)} disabled={props.running} placeholder="Es. segue casi standard in autonomia" /></Field>
        <Field label="Imprevisti / problemi" htmlFor="create-incidents" optional><input id="create-incidents" value={props.draft.incidents} onChange={(event) => update('incidents', event.target.value)} disabled={props.running} placeholder="Es. picchi di ticket, clienti complessi" /></Field>
      </div>
    </FormSection>
    <FormSection number="03" title="Condizioni e candidatura">
      <div className={styles.fieldGrid}>
        <Field label="Sede" htmlFor="create-location"><input id="create-location" value={props.draft.location} onChange={(event) => update('location', event.target.value)} disabled={props.running} placeholder="Es. Bari" /></Field>
        <Field label="Modalita" htmlFor="create-workmode"><input id="create-workmode" value={props.unknowns.workMode ? '' : props.draft.workMode} onChange={(event) => update('workMode', event.target.value)} disabled={props.running || props.unknowns.workMode} placeholder="Presenza, ibrido, remoto" /><UnknownToggle checked={props.unknowns.workMode} onChange={() => toggleUnknown('workMode')} /></Field>
        <Field label="Contratto" htmlFor="create-contract"><input id="create-contract" value={props.unknowns.contract ? '' : props.draft.contract} onChange={(event) => update('contract', event.target.value)} disabled={props.running || props.unknowns.contract} placeholder="Tempo determinato, indeterminato..." /><UnknownToggle checked={props.unknowns.contract} onChange={() => toggleUnknown('contract')} /></Field>
        <Field label="Orario" htmlFor="create-schedule"><input id="create-schedule" value={props.unknowns.schedule ? '' : props.draft.schedule} onChange={(event) => update('schedule', event.target.value)} disabled={props.running || props.unknowns.schedule} placeholder="Part-time, full-time, fasce..." /><UnknownToggle checked={props.unknowns.schedule} onChange={() => toggleUnknown('schedule')} /></Field>
        <Field label="Turni" htmlFor="create-shifts" optional><input id="create-shifts" value={props.draft.shifts} onChange={(event) => update('shifts', event.target.value)} disabled={props.running} placeholder="Es. turni mattina/pomeriggio" /></Field>
        <Field label="Reperibilita" htmlFor="create-availability" optional><input id="create-availability" value={props.draft.availability} onChange={(event) => update('availability', event.target.value)} disabled={props.running} placeholder="Es. non prevista" /></Field>
        <Field label="Compenso" htmlFor="create-compensation" optional><input id="create-compensation" value={props.unknowns.compensation ? '' : props.draft.compensation} onChange={(event) => update('compensation', event.target.value)} disabled={props.running || props.unknowns.compensation} placeholder="Es. RAL 24-28k" /><UnknownToggle checked={props.unknowns.compensation} onChange={() => toggleUnknown('compensation')} /></Field>
        <Field label="Canale" htmlFor="create-channel" optional><select id="create-channel" value={props.unknowns.channel ? '' : props.draft.channel} onChange={(event) => update('channel', event.target.value)} disabled={props.running || props.unknowns.channel}><option value="">Da definire</option><option value="LINKEDIN">LinkedIn</option><option value="INDEED">Indeed</option><option value="ATS">ATS aziendale</option><option value="EMAIL">Email</option><option value="CUSTOM">Altro</option></select><UnknownToggle checked={props.unknowns.channel} onChange={() => toggleUnknown('channel')} /></Field>
      </div>
      <div className={styles.fieldGrid}>
        <Field label="Benefit" htmlFor="create-benefits" optional><input id="create-benefits" value={props.unknowns.benefits ? '' : props.draft.benefits} onChange={(event) => update('benefits', event.target.value)} disabled={props.running || props.unknowns.benefits} placeholder="Solo fatti gia veri" /><UnknownToggle checked={props.unknowns.benefits} onChange={() => toggleUnknown('benefits')} /></Field>
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
    <div className={styles.resultHead}>
      <div><p>Questa e la posizione che abbiamo capito.</p><h2 id="create-summary-title">{props.state.roleCard.title}</h2></div>
      <div className={styles.scoreBox}><span>Copertura raccolta</span><strong>{props.state.completion.coverage}%</strong></div>
      <div className={styles.gateBox}><span>Stato</span><strong>{props.state.paymentRequired ? 'Pronta per il confine commerciale' : 'Da confermare'}</strong></div>
    </div>
    <div className={styles.confirmationGrid}>
      <Panel title="Risultato" items={[props.state.roleCard.mission, ...props.state.roleCard.outcomes]} empty="Da definire." />
      <Panel title="Attivita" items={props.state.roleCard.responsibilities} empty="Da definire." />
      <Panel title="Indispensabili" items={groups.REQUIRED} empty="Da definire." />
      <Panel title="Preferenziali" items={groups.PREFERRED} empty="Nessuno indicato." />
      <Panel title="Apprendibili" items={groups.TRAINABLE} empty="Nessuno indicato." />
      <Panel title="Vincoli" items={groups.DISQUALIFYING} empty="Nessuno indicato." />
      <Panel title="Contesto" items={props.state.roleCard.attractionEvidence} empty="Da definire." />
      <Panel title="Condizioni" items={[`Sede: ${displayValue(props.state.roleCard.location)}`, `Modalita: ${displayValue(props.state.roleCard.workMode)}`, `Contratto: ${displayValue(props.state.roleCard.contractType)}`, `Orario: ${displayValue(props.state.roleCard.schedule)}`, `Compenso: ${displayValue(props.state.roleCard.compensation)}`]} empty="Da definire." />
      <Panel title="Candidatura" items={[props.state.roleCard.channel ? `Canale: ${props.state.roleCard.channel}` : 'Canale: Da definire']} empty="Da definire." />
    </div>
    {props.state.strategy && <div className={styles.strategyPanel}><p>Strategia</p><h3>{props.state.strategy.summary}</h3><span>{props.state.strategy.candidateAngle}</span></div>}
    {!props.state.paymentRequired && <form className={styles.inlineEdit} onSubmit={props.onSubmitEdit}>
      <Field label="Modifica" htmlFor="create-edit-target"><select id="create-edit-target" value={props.editTarget} onChange={(event) => props.onEditTarget(event.target.value)} disabled={props.running}><option value="title">Ruolo</option><option value="mission">Risultato</option><option value="responsibilities">Attivita</option><option value="requirements">Requisiti</option><option value="attractionContext.location">Sede</option><option value="attractionContext.workMode">Modalita</option><option value="attractionContext.contractType">Contratto</option><option value="compensation.amountText">Compenso</option></select></Field>
      <Field label="Nuovo valore" htmlFor="create-edit-value"><input id="create-edit-value" value={props.editValue} onChange={(event) => props.onEditValue(event.target.value)} disabled={props.running} /></Field>
      <button type="submit" disabled={props.running}>Modifica</button>
    </form>}
    {props.state.paymentRequired ? <section className={styles.commercialPanel}><p>Prossimo passo</p><h3>La posizione e pronta. Ora possiamo costruire il tuo Annuncio 10x.</h3><span>La generazione online sara disponibile in una fase successiva.</span><OfferCards offers={props.state.commercial.availableOffers} empty="La generazione non e ancora disponibile per questo percorso." /></section> : <div className={styles.actions}><button type="button" onClick={props.onConfirm} disabled={props.running || !props.state.canConfirm}>Conferma</button><span>Puoi modificare i campi prima della conferma.</span></div>}
  </section>;
}

function PremiumOutputPanel(props: { output: PremiumOutput; copied: string | null; onCopy: (label: string, value: string) => void }) {
  const score = formatAnnunci10xScore(props.output.score);
  const channelText = props.output.channelVariant ? props.output.channelVariant.sections.map((section) => `${section.title}\n${section.body}`).join('\n\n') : '';
  return <section className={styles.result} aria-labelledby="annunci10x-premium-title"><div className={styles.resultHead}><div><p>Output premium</p><h2 id="annunci10x-premium-title">Master generato</h2></div><div className={styles.scoreBox}><span>Score</span><strong>{score}</strong><small>Coverage {props.output.score.coverage}%</small></div><div className={styles.gateBox}><span>Validazione</span><strong>{props.output.validationState.replaceAll('_', ' ')}</strong></div></div><div className={styles.panel}><h3>Master</h3><pre className={styles.outputText}>{props.output.masterText}</pre><div className={styles.actions}><button type="button" onClick={() => props.onCopy('master', props.output.masterText)}>{props.copied === 'master' ? 'Copiato' : 'Copia master'}</button></div></div>{props.output.channelVariant && <div className={styles.panel}><h3>Variante {props.output.channelVariant.channel}</h3><pre className={styles.outputText}>{channelText}</pre><div className={styles.actions}><button type="button" onClick={() => props.onCopy('channel', channelText)}>{props.copied === 'channel' ? 'Copiato' : 'Copia variante'}</button></div></div>}<div className={styles.columns}><Panel title="Decisioni" items={props.output.rationale} empty="Nessuna decisione disponibile." /><Panel title="Controlli finali" items={props.output.checklist} empty="Nessun controllo da rivedere." /></div></section>;
}

function OfferCards({ offers, empty }: { offers: CommercialOffer[]; empty: string }) {
  const visibleOffers = offers.filter((offer) => offer.productCode === 'AD_GENERATION');
  if (!visibleOffers.length) return <div className={styles.offerPanel}><h3>{empty}</h3><p>Ti guideremo al passo successivo quando sara disponibile.</p><button type="button" disabled>In preparazione</button></div>;
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
    WORK_REALITY: [`Attivita reali: ${value('activities')}.`, `Contesto operativo e interlocutori: ${value('operatingContext')}.`, `Autonomia: ${value('autonomy')}.`, `Imprevisti o problemi da gestire: ${value('incidents')}.`].join('\n'),
    REQUIREMENTS: [`Indispensabili: ${value('requiredRequirements')}.`, `Preferenziali: ${value('preferredRequirements')}.`, `Apprendibili: ${value('trainableRequirements')}.`, `Vincoli: ${value('disqualifyingRequirements')}.`].join('\n'),
    ATTRACTION: [`Benefit: ${maybeUnknown('benefits', draft.benefits)}.`, `Formazione e crescita concreta: ${maybeUnknown('growth', draft.growth)}.`].join('\n'),
    OFFER: [`Sede: ${value('location')}.`, `Modalita: ${maybeUnknown('workMode', draft.workMode)}.`, `Contratto: ${maybeUnknown('contract', draft.contract)}.`, `Orario: ${maybeUnknown('schedule', draft.schedule)}.`, `Turni: ${value('shifts')}.`, `Reperibilita: ${value('availability')}.`, `Compenso: ${maybeUnknown('compensation', draft.compensation)}.`].join('\n'),
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
