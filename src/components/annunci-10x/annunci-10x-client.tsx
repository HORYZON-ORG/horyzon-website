"use client";

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
import { Annunci10xLoader } from './annunci-10x-loader';
import { ANNUNCI10X_CREATE_EVENT } from './landing/create-cta';
import styles from './annunci-10x.module.css';

type Mode = 'ANALYZE' | 'CREATE';
type CreateStepId = 'ROLE_CONTEXT' | 'PRIMARY_CONTRIBUTION' | 'WORK_REALITY' | 'REQUIREMENTS' | 'ATTRACTION' | 'OFFER' | 'CHANNEL_APPLICATION';
type CreateWizardStepId = 'ROLE_RESULT' | 'PERSON_WORK' | 'CONDITIONS_APPLICATION';
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
    workModeDetail: string;
    contractType: string;
    schedule: string;
    shifts: string;
    onCall: string;
    companyDescription: string;
    operatingContext: string;
    autonomy: string;
    unexpectedEvents: string;
    compensation: string;
    applicationInstructions: string;
    attractionEvidence: string[];
    channel: string | null;
    missingFacts: string[];
  };
  conflicts: { id: string; targetPath: string; label: string; canonicalValue: string; conflictingValue: string; sourceStep: CreateStepId; sourceLabel: string; resolution: string }[];
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

interface CreateLoaderState {
  label: string;
  progress?: number | null;
  indeterminate?: boolean;
  complete?: boolean;
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
const createStepLoaderLabels: Record<CreateStepId, string> = {
  ROLE_CONTEXT: 'Salviamo ruolo e contesto',
  PRIMARY_CONTRIBUTION: 'Salviamo il risultato atteso',
  WORK_REALITY: 'Salviamo il lavoro reale',
  REQUIREMENTS: 'Salviamo i requisiti',
  ATTRACTION: 'Salviamo i dati di attrattività',
  OFFER: 'Salviamo condizioni e offerta',
  CHANNEL_APPLICATION: 'Salviamo canale e candidatura',
};
const createWizardSteps: readonly {
  id: CreateWizardStepId;
  number: '1' | '2' | '3';
  title: string;
  microcopy: string;
  nextLabel?: string;
  domainStepIds: readonly CreateStepId[];
  requiredFields: readonly { key: keyof CreateDraft; id: string }[];
}[] = [
  {
    id: 'ROLE_RESULT',
    number: '1',
    title: 'Ruolo e risultato',
    microcopy: 'Partiamo da ciò che questa persona dovrà fare davvero e dal risultato che dovrà produrre.',
    nextLabel: 'Avanti — Persona e lavoro',
    domainStepIds: ['ROLE_CONTEXT', 'PRIMARY_CONTRIBUTION'],
    requiredFields: [{ key: 'role', id: 'create-role' }, { key: 'primaryResult', id: 'create-result' }],
  },
  {
    id: 'PERSON_WORK',
    number: '2',
    title: 'Persona e lavoro',
    microcopy: 'Descrivi il lavoro reale e la persona che serve davvero per svolgerlo.',
    nextLabel: 'Avanti — Condizioni e candidatura',
    domainStepIds: ['WORK_REALITY', 'REQUIREMENTS'],
    requiredFields: [{ key: 'activities', id: 'create-activities' }, { key: 'requiredRequirements', id: 'create-required' }, { key: 'operatingContext', id: 'create-context' }],
  },
  {
    id: 'CONDITIONS_APPLICATION',
    number: '3',
    title: 'Condizioni e candidatura',
    microcopy: "Completa l'offerta e spiega con chiarezza come candidarsi.",
    domainStepIds: ['ATTRACTION', 'OFFER', 'CHANNEL_APPLICATION'],
    requiredFields: [{ key: 'application', id: 'create-application' }],
  },
];
const guaranteeCopy = '7 € per un annuncio, una versione e un canale. Dopo la conferma del pagamento generiamo il testo completo e te lo rendiamo disponibile. Se non ti è utile, puoi chiedere il rimborso integrale entro 14 giorni dalla consegna, senza motivazione, scrivendo a info@horyzon.it dall’email usata per l’acquisto.';

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
  const [createLoader, setCreateLoader] = useState<CreateLoaderState | null>(null);
  const [checkoutNotice] = useState<'success' | 'cancelled' | null>(() => initialCheckoutNotice());
  const [commerceRefreshToken, setCommerceRefreshToken] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
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

  const selectMode = useCallback((nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    window.setTimeout(() => {
      if (nextMode === 'CREATE' && createRef.current) {
        scrollToElement(createRef.current);
        return;
      }
      if (analyzeRef.current) scrollToElement(analyzeRef.current);
    }, 0);
  }, []);

  // The landing around this component is server-rendered: its "crea a 7 €" links open the create flow
  // through a window event, and #crea-annuncio works as a deep link.
  useEffect(() => {
    const openCreate = () => selectMode('CREATE');
    window.addEventListener(ANNUNCI10X_CREATE_EVENT, openCreate);
    const deepLink = window.location.hash === '#crea-annuncio' ? window.setTimeout(openCreate, 0) : null;
    return () => {
      window.removeEventListener(ANNUNCI10X_CREATE_EVENT, openCreate);
      if (deepLink !== null) window.clearTimeout(deepLink);
    };
  }, [selectMode]);

  // Back from the payment page the visitor lands at the top of a long page: bring the payment status into view.
  useEffect(() => {
    if (!checkoutNotice) return;
    const timer = window.setTimeout(() => { if (rootRef.current) scrollToElement(rootRef.current); }, 0);
    return () => window.clearTimeout(timer);
  }, [checkoutNotice]);

  async function startCreate(): Promise<CreateState | null> {
    setMode('CREATE');
    setError(null);
    setRunning(true);
    setCreateLoader({ label: 'Avviamo il percorso guidato', indeterminate: true });
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
      setCreateLoader(null);
    }
  }

  async function submitStructuredCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRunning(true);
    setCreateLoader({ label: 'Prepariamo la scheda', progress: 5 });
    try {
      let state = createState;
      if (!state) {
        setCreateLoader({ label: 'Avviamo il percorso guidato', indeterminate: true });
        const response = await fetch('/api/annunci-10x/create/start', { method: 'POST' });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Avvio non riuscito.');
        state = payload.result;
      }
      if (!state || state.paymentRequired) return;
      let nextState = state;
      const answers = composeCreateAnswers(createDraft, unknowns);
      for (const [index, stepId] of createStepOrder.entries()) {
        setCreateLoader({ label: createStepLoaderLabels[stepId], progress: Math.round((index / createStepOrder.length) * 92) });
        const response = await fetch('/api/annunci-10x/create/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stepId, answer: answers[stepId] }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Scheda non salvata.');
        nextState = payload.result;
        setCreateLoader({ label: createStepLoaderLabels[stepId], progress: Math.round(((index + 1) / createStepOrder.length) * 100) });
      }
      setCreateLoader({ label: 'Scheda pronta', progress: 100, complete: true });
      setCreateState(nextState);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Scheda non salvata.');
    } finally {
      setRunning(false);
      setCreateLoader(null);
    }
  }

  async function submitCreateClarification(skip = false) {
    if (!createState?.clarification) return;
    setError(null);
    setRunning(true);
    setCreateLoader({ label: skip ? 'Segniamo il chiarimento come da definire' : 'Salviamo il chiarimento', indeterminate: true });
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
      setCreateLoader(null);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRunning(true);
    setCreateLoader({ label: 'Aggiorniamo la scheda', indeterminate: true });
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
      setCreateLoader(null);
    }
  }

  async function confirmCreate() {
    setError(null);
    setRunning(true);
    setCreateLoader({ label: 'Confermiamo la posizione', indeterminate: true });
    try {
      const response = await fetch('/api/annunci-10x/create/confirm', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Conferma non riuscita.');
      setCreateState(payload.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conferma non riuscita.');
    } finally {
      setRunning(false);
      setCreateLoader(null);
    }
  }

  return <div ref={rootRef} className={styles.flowRoot}>
    {checkoutNotice === 'success' && <div className={styles.checkoutBanner} role="status" aria-live="polite"><strong>Pagamento ricevuto.</strong><span>Stiamo preparando il tuo accesso.</span><Annunci10xLoader variant="inline" indeterminate label="Verifichiamo il pagamento" /></div>}
    {checkoutNotice === 'cancelled' && <div className={styles.checkoutBanner} role="status" aria-live="polite"><strong>Pagamento annullato.</strong><span>Non è stato completato alcun acquisto.</span></div>}
    <Annunci10xFulfillmentPanel checkoutNotice={checkoutNotice} onCreateReturn={showCreateAfterCheckout} />

    <div ref={analyzeRef} className={styles.heroPanel} aria-label="Analisi gratuita Annunci 10x">
      <Annunci10xAnalyzeFlow commerceRefreshToken={commerceRefreshToken} />
    </div>
    {mode !== 'CREATE' && <p className={styles.createSwitch}>Non hai ancora un annuncio? <button type="button" onClick={() => selectMode('CREATE')}>Crealo a 7 € con un brief guidato</button></p>}

    {mode === 'CREATE' && <section ref={createRef} id="crea-annuncio" className={styles.createSection} aria-labelledby="create-route-title">
      <div className={styles.sectionHeading}>
        <p>Percorso guidato</p>
        <h2 id="create-route-title">Crea il tuo annuncio da zero</h2>
        <span>Se il testo non esiste ancora, parti dai fatti del ruolo. Raccogliamo i dati in tre blocchi progressivi, poi generiamo il testo completo solo dopo pagamento confermato.</span>
      </div>
      <CreateFlow state={createState} draft={createDraft} unknowns={unknowns} running={running} loading={createLoader} clarificationAnswer={clarificationAnswer} editTarget={editTarget} editValue={editValue} error={error} commerceRefreshToken={commerceRefreshToken} onStart={startCreate} onDraft={setCreateDraft} onUnknowns={setUnknowns} onSubmitStructured={submitStructuredCreate} onClarificationAnswer={setClarificationAnswer} onSubmitClarification={submitCreateClarification} onEditTarget={setEditTarget} onEditValue={setEditValue} onSubmitEdit={submitEdit} onConfirm={confirmCreate} />
    </section>}
  </div>;
}

function CreateFlow(props: {
  state: CreateState | null;
  draft: CreateDraft;
  unknowns: Record<UnknownKey, boolean>;
  running: boolean;
  loading: CreateLoaderState | null;
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
    {props.loading && <Annunci10xLoader variant="panel" label={props.loading.label} progress={props.loading.progress} indeterminate={props.loading.indeterminate} complete={props.loading.complete} />}
    {!props.state?.paymentRequired && props.state?.currentStep !== 'SUMMARY' && <StructuredCreateForm key={createWizardResumeKey(props.state)} state={props.state} draft={props.draft} unknowns={props.unknowns} running={props.running} error={props.error} onDraft={props.onDraft} onUnknowns={props.onUnknowns} onSubmit={props.onSubmitStructured} />}
    {props.state?.clarification && <div className={styles.clarification}><p>Chiarimento necessario</p><h3>{props.state.clarification.question}</h3><small>{props.state.clarification.reason}</small><Field label="Risposta" htmlFor="annunci10x-create-clarification"><textarea id="annunci10x-create-clarification" rows={3} value={props.clarificationAnswer} onChange={(event) => props.onClarificationAnswer(event.target.value)} disabled={props.running} /></Field><div className={styles.actions}><button type="button" onClick={() => props.onSubmitClarification(false)} disabled={props.running}>Salva chiarimento</button><button type="button" onClick={() => props.onSubmitClarification(true)} disabled={props.running}>Non lo so</button></div></div>}
    {props.state && (props.state.currentStep === 'SUMMARY' || props.state.currentStep === 'COMMERCIAL') && <CreateSummary state={props.state} running={props.running} editTarget={props.editTarget} editValue={props.editValue} commerceRefreshToken={props.commerceRefreshToken} onEditTarget={props.onEditTarget} onEditValue={props.onEditValue} onSubmitEdit={props.onSubmitEdit} onConfirm={props.onConfirm} />}
    {!props.state && <div className={styles.startCreate}><p>Puoi compilare i campi e preparare direttamente la scheda. Salviamo il percorso quando inizi.</p><button type="button" onClick={props.onStart} disabled={props.running}>Inizia da zero</button></div>}
  </section>;
}

function StructuredCreateForm(props: {
  state: CreateState | null;
  draft: CreateDraft;
  unknowns: Record<UnknownKey, boolean>;
  running: boolean;
  error: string | null;
  onDraft: (value: CreateDraft) => void;
  onUnknowns: (value: Record<UnknownKey, boolean>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [activeStep, setActiveStep] = useState<CreateWizardStepId>(() => inferCreateWizardStep(props.state));
  const formRef = useRef<HTMLFormElement | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const update = (key: keyof CreateDraft, value: string) => props.onDraft({ ...props.draft, [key]: value });
  const toggleUnknown = (key: UnknownKey) => props.onUnknowns({ ...props.unknowns, [key]: !props.unknowns[key] });
  const activeStepIndex = createWizardSteps.findIndex((step) => step.id === activeStep);
  const activeStepConfig = createWizardSteps[activeStepIndex] ?? createWizardSteps[0];
  const stepHeadingId = `create-wizard-step-${activeStepConfig.number}`;

  function moveToStep(stepId: CreateWizardStepId, focus: 'heading' | 'none' = 'heading') {
    setActiveStep(stepId);
    window.setTimeout(() => {
      if (formRef.current) scrollToElement(formRef.current);
      if (focus === 'heading') stepHeadingRef.current?.focus();
    }, 0);
  }

  function moveToStepAndFocusField(stepId: CreateWizardStepId, fieldId: string) {
    setActiveStep(stepId);
    window.setTimeout(() => {
      if (formRef.current) scrollToElement(formRef.current);
      focusCreateField(fieldId);
    }, 0);
  }

  function nextStep() {
    const invalid = validateCreateWizardStep(props.draft, activeStep);
    if (invalid) {
      focusCreateField(invalid.id);
      return;
    }
    const next = createWizardSteps[activeStepIndex + 1];
    if (next) moveToStep(next.id);
  }

  function previousStep() {
    const previous = createWizardSteps[activeStepIndex - 1];
    if (previous) moveToStep(previous.id);
  }

  function submitWizard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = firstInvalidCreateWizardField(props.draft);
    if (invalid) {
      moveToStepAndFocusField(invalid.stepId, invalid.id);
      return;
    }
    props.onSubmit(event);
  }

  return <form ref={formRef} className={styles.form} onSubmit={submitWizard} aria-labelledby="create-title" noValidate>
    <div className={styles.formHead}><p>Crea il tuo annuncio da zero</p><h2 id="create-title">Racconta il lavoro reale. L’annuncio arriva dopo.</h2></div>
    <ol className={styles.createStepIndicator} aria-label="Avanzamento creazione annuncio">
      {createWizardSteps.map((step, index) => {
        const isActive = step.id === activeStep;
        const isComplete = index < activeStepIndex || isCreateWizardStepComplete(props.draft, step.id) || isCreateWizardStepCompleteFromState(props.state, step.id);
        return <li key={step.id} data-state={isActive ? 'active' : isComplete ? 'complete' : 'idle'}>
          <span aria-hidden="true">{step.number}</span>
          <strong aria-current={isActive ? 'step' : undefined}>{step.title}</strong>
          {isComplete && !isActive && <small>Completato</small>}
        </li>;
      })}
    </ol>
    <p className={styles.createStepCount}>Step {activeStepIndex + 1}/3</p>
    <section className={styles.formSection} aria-labelledby={stepHeadingId}>
      <header><span>{activeStepConfig.number.padStart(2, '0')}</span><div><h3 id={stepHeadingId} ref={stepHeadingRef} tabIndex={-1}>{activeStepConfig.title}</h3><p>{activeStepConfig.microcopy}</p></div></header>
      <CreateGuidanceNote />
      {activeStep === 'ROLE_RESULT' && <>
        <div className={styles.fieldGrid}>
          <Field label="Ruolo" htmlFor="create-role" required><input id="create-role" required aria-required="true" value={props.draft.role} onChange={(event) => update('role', event.target.value)} disabled={props.running} placeholder="Es. Addetto customer care" /></Field>
          <Field label="Azienda / contesto" htmlFor="create-company" optional><input id="create-company" value={props.draft.companyContext} onChange={(event) => update('companyContext', event.target.value)} disabled={props.running} placeholder="Es. sede di Bari, team assistenza clienti" /></Field>
        </div>
        <Field label="Risultato principale" htmlFor="create-result" required><textarea id="create-result" required aria-required="true" rows={4} value={props.draft.primaryResult} onChange={(event) => update('primaryResult', event.target.value)} disabled={props.running} placeholder="Quale risultato deve riuscire a produrre o garantire questa persona?" /><FieldExample>Esempio: Gestire le richieste clienti entro 24 ore mantenendo aggiornato il CRM.</FieldExample></Field>
      </>}
      {activeStep === 'PERSON_WORK' && <>
        <Field label="Attività reali" htmlFor="create-activities" required><textarea id="create-activities" required aria-required="true" rows={4} value={props.draft.activities} onChange={(event) => update('activities', event.target.value)} disabled={props.running} placeholder="Quali attività svolgerà nel lavoro quotidiano?" /><FieldExample>Esempio: Rispondere ai ticket, aggiornare il CRM e richiamare i clienti con richieste aperte.</FieldExample></Field>
        <Field label="Contesto operativo / interlocutori" htmlFor="create-context" required><textarea id="create-context" required aria-required="true" rows={4} value={props.draft.operatingContext} onChange={(event) => update('operatingContext', event.target.value)} disabled={props.running} placeholder="Con chi lavora e con quali strumenti?" /><FieldExample>Esempio: Lavora con team customer care, commerciale e clienti già attivi.</FieldExample></Field>
        <div className={styles.fieldGrid}>
          <Field label="Autonomia" htmlFor="create-autonomy" optional><input id="create-autonomy" value={props.draft.autonomy} onChange={(event) => update('autonomy', event.target.value)} disabled={props.running} placeholder="Es. Gestisce casi standard in autonomia" /></Field>
          <Field label="Imprevisti / problemi" htmlFor="create-incidents" optional><input id="create-incidents" value={props.draft.incidents} onChange={(event) => update('incidents', event.target.value)} disabled={props.running} placeholder="Es. Picchi di ticket dopo campagne email" /></Field>
        </div>
        <div className={styles.requirementGrid}>
          <Field label="Indispensabili" htmlFor="create-required" required><textarea id="create-required" required aria-required="true" rows={3} value={props.draft.requiredRequirements} onChange={(event) => update('requiredRequirements', event.target.value)} disabled={props.running} placeholder="Che cosa deve saper fare già dal primo giorno?" /><FieldExample>Esempio: Uso CRM, italiano scritto chiaro e gestione di richieste clienti.</FieldExample></Field>
          <Field label="Preferenziali" htmlFor="create-preferred" optional><textarea id="create-preferred" rows={3} value={props.draft.preferredRequirements} onChange={(event) => update('preferredRequirements', event.target.value)} disabled={props.running} placeholder="Che cosa aiuta ma non è indispensabile?" /><FieldExample>Esempio: Esperienza con Zendesk.</FieldExample></Field>
          <Field label="Apprendibili" htmlFor="create-trainable" optional><textarea id="create-trainable" rows={3} value={props.draft.trainableRequirements} onChange={(event) => update('trainableRequirements', event.target.value)} disabled={props.running} placeholder="Che cosa può imparare dopo l’ingresso?" /><FieldExample>Esempio: Procedure interne di escalation.</FieldExample></Field>
        </div>
        <Field label="Vincoli escludenti" htmlFor="create-disqualifying" optional><input id="create-disqualifying" value={props.draft.disqualifyingRequirements} onChange={(event) => update('disqualifyingRequirements', event.target.value)} disabled={props.running} placeholder="Es. Indisponibilità ai turni del sabato" /></Field>
      </>}
      {activeStep === 'CONDITIONS_APPLICATION' && <>
        <div className={styles.fieldGrid}>
          <Field label="Benefit" htmlFor="create-benefits" optional><input id="create-benefits" value={props.unknowns.benefits ? '' : props.draft.benefits} onChange={(event) => update('benefits', event.target.value)} disabled={props.running || props.unknowns.benefits} placeholder="Es. Buoni pasto da 8 €" /><UnknownToggle checked={props.unknowns.benefits} onChange={() => toggleUnknown('benefits')} /></Field>
          <Field label="Formazione / crescita concreta" htmlFor="create-growth" optional><input id="create-growth" value={props.unknowns.growth ? '' : props.draft.growth} onChange={(event) => update('growth', event.target.value)} disabled={props.running || props.unknowns.growth} placeholder="Es. Affiancamento iniziale di 2 settimane" /><UnknownToggle checked={props.unknowns.growth} onChange={() => toggleUnknown('growth')} /></Field>
        </div>
        <div className={styles.fieldGrid}>
          <Field label="Sede" htmlFor="create-location"><input id="create-location" value={props.draft.location} onChange={(event) => update('location', event.target.value)} disabled={props.running} placeholder="Es. Bari" /></Field>
          <Field label="Modalità" htmlFor="create-workmode"><input id="create-workmode" value={props.unknowns.workMode ? '' : props.draft.workMode} onChange={(event) => update('workMode', event.target.value)} disabled={props.running || props.unknowns.workMode} placeholder="Es. Ibrido 2 giorni da remoto" /><UnknownToggle checked={props.unknowns.workMode} onChange={() => toggleUnknown('workMode')} /></Field>
          <Field label="Contratto" htmlFor="create-contract"><input id="create-contract" value={props.unknowns.contract ? '' : props.draft.contract} onChange={(event) => update('contract', event.target.value)} disabled={props.running || props.unknowns.contract} placeholder="Es. Tempo indeterminato" /><UnknownToggle checked={props.unknowns.contract} onChange={() => toggleUnknown('contract')} /></Field>
          <Field label="Orario" htmlFor="create-schedule"><input id="create-schedule" value={props.unknowns.schedule ? '' : props.draft.schedule} onChange={(event) => update('schedule', event.target.value)} disabled={props.running || props.unknowns.schedule} placeholder="Es. Full-time 9-18" /><UnknownToggle checked={props.unknowns.schedule} onChange={() => toggleUnknown('schedule')} /></Field>
          <Field label="Turni" htmlFor="create-shifts" optional><input id="create-shifts" value={props.draft.shifts} onChange={(event) => update('shifts', event.target.value)} disabled={props.running} placeholder="Es. Un sabato mattina al mese" /></Field>
          <Field label="Reperibilità" htmlFor="create-availability" optional><input id="create-availability" value={props.draft.availability} onChange={(event) => update('availability', event.target.value)} disabled={props.running} placeholder="Es. Non prevista" /></Field>
          <Field label="Compenso" htmlFor="create-compensation" optional><input id="create-compensation" value={props.unknowns.compensation ? '' : props.draft.compensation} onChange={(event) => update('compensation', event.target.value)} disabled={props.running || props.unknowns.compensation} placeholder="Es. RAL 24-28k" /><UnknownToggle checked={props.unknowns.compensation} onChange={() => toggleUnknown('compensation')} /></Field>
          <Field label="Canale" htmlFor="create-channel" optional><select id="create-channel" value={props.unknowns.channel ? '' : props.draft.channel} onChange={(event) => update('channel', event.target.value)} disabled={props.running || props.unknowns.channel}><option value="">Da definire</option><option value="LINKEDIN">LinkedIn</option><option value="INDEED">Indeed</option><option value="ATS">ATS aziendale</option><option value="EMAIL">Email</option><option value="CUSTOM">Altro</option></select><UnknownToggle checked={props.unknowns.channel} onChange={() => toggleUnknown('channel')} /></Field>
        </div>
        <Field label="Come ci si candida / destinazione" htmlFor="create-application" required><textarea id="create-application" required aria-required="true" rows={3} value={props.draft.application} onChange={(event) => update('application', event.target.value)} disabled={props.running} placeholder="Come deve candidarsi la persona?" /><FieldExample>Esempio: Invia CV a recruiting@azienda.it indicando “Addetto customer care” nell’oggetto.</FieldExample></Field>
      </>}
    </section>
    <div className={styles.actions}>
      {activeStepIndex > 0 && <button type="button" onClick={previousStep} disabled={props.running}>Indietro</button>}
      {activeStepConfig.nextLabel
        ? <button type="button" onClick={nextStep} disabled={props.running}>{activeStepConfig.nextLabel}</button>
        : <button type="submit" disabled={props.running}>{props.running ? 'Preparazione in corso' : 'Prepara la scheda'}</button>}
    </div>
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
      <Panel title="Azienda / contesto" items={[displayValue(props.state.roleCard.companyDescription)]} empty="Da definire." />
      <Panel title="Lavoro reale" items={[`Contesto operativo: ${displayValue(props.state.roleCard.operatingContext)}`, `Autonomia: ${displayValue(props.state.roleCard.autonomy)}`, `Imprevisti: ${displayValue(props.state.roleCard.unexpectedEvents)}`]} empty="Da definire." />
      <Panel title="Benefit e formazione" items={props.state.roleCard.attractionEvidence} empty="Da definire." />
      <Panel title="Condizioni" items={[`Sede: ${displayValue(props.state.roleCard.location)}`, `Modalità: ${displayValue(props.state.roleCard.workModeDetail || props.state.roleCard.workMode)}`, `Contratto: ${displayValue(props.state.roleCard.contractType)}`, `Orario: ${displayValue(props.state.roleCard.schedule)}`, `Turni: ${displayValue(props.state.roleCard.shifts)}`, `Reperibilità: ${displayValue(props.state.roleCard.onCall)}`, `Compenso: ${displayValue(props.state.roleCard.compensation)}`]} empty="Da definire." />
      <Panel title="Candidatura" items={[props.state.roleCard.channel ? `Canale: ${props.state.roleCard.channel}` : 'Canale: Da definire', `Istruzioni: ${displayValue(props.state.roleCard.applicationInstructions)}`]} empty="Da definire." />
    </div>
    {props.state.conflicts.length > 0 && <div className={styles.conflictPanel} role="status" aria-label="Conflitti risolti">
      <p>Conflitti risolti</p>
      <h3>Abbiamo trovato dati diversi in più punti.</h3>
      <span>Per ogni dato strutturato abbiamo mantenuto il valore del campo dedicato. Le alternative non vengono usate per generare l&apos;annuncio.</span>
      <ul>{props.state.conflicts.map((conflict) => <li key={conflict.id}><strong>{conflict.label}: {conflict.canonicalValue}</strong><span>In “{conflict.sourceLabel}” avevi anche indicato “{conflict.conflictingValue}”. {conflict.resolution}</span></li>)}</ul>
    </div>}
    {props.state.strategy && <div className={styles.strategyPanel}><p>Strategia</p><h3>{props.state.strategy.summary}</h3><span>{props.state.strategy.candidateAngle}</span></div>}
    {!props.state.paymentRequired && <form className={styles.inlineEdit} onSubmit={props.onSubmitEdit}><Field label="Modifica" htmlFor="create-edit-target"><select id="create-edit-target" value={props.editTarget} onChange={(event) => props.onEditTarget(event.target.value)} disabled={props.running}><option value="title">Ruolo</option><option value="mission">Risultato</option><option value="responsibilities">Attività</option><option value="requirements">Requisiti</option><option value="attractionContext.companyDescription">Azienda / contesto</option><option value="attractionContext.operatingContext">Contesto operativo</option><option value="attractionContext.autonomy">Autonomia</option><option value="attractionContext.unexpectedEvents">Imprevisti</option><option value="attractionContext.location">Sede</option><option value="attractionContext.workMode">Modalità</option><option value="attractionContext.contractType">Contratto</option><option value="attractionContext.schedule">Orario</option><option value="attractionContext.shifts">Turni</option><option value="attractionContext.onCall">Reperibilità</option><option value="compensation.amountText">Compenso</option><option value="applicationInstructions">Candidatura</option></select></Field><Field label="Nuovo valore" htmlFor="create-edit-value"><input id="create-edit-value" value={props.editValue} onChange={(event) => props.onEditValue(event.target.value)} disabled={props.running} /></Field><button type="submit" disabled={props.running}>Modifica</button></form>}
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
  if (!createOffer && status && /caricamento/i.test(status)) return <div className={styles.offerPanel}><Annunci10xLoader variant="compact" indeterminate label="Carichiamo l'offerta Annuncio 10x" /></div>;
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
    {loading && <Annunci10xLoader variant="compact" indeterminate label="Prepariamo il pagamento sicuro" />}
    {status && <span className={styles.offerStatus} aria-live="polite">{status}</span>}
  </article>;
}

function CreateGuidanceNote() {
  return <div className={styles.createGuidanceNote}>
    <p>Più informazioni ci dai, più completo e preciso sarà il tuo annuncio.</p>
    <span>Compila almeno i campi contrassegnati con *; aggiungi gli altri dettagli quando li conosci.</span>
    <small>* Campo necessario per continuare</small>
  </div>;
}

function Field(props: { label: string; htmlFor: string; required?: boolean; optional?: boolean; children: ReactNode }) {
  return <label className={styles.field} htmlFor={props.htmlFor}><span>{props.label}{props.required && <b aria-hidden="true"> *</b>}</span>{props.children}</label>;
}

function FieldExample(props: { children: ReactNode }) {
  return <small className={styles.fieldExample}>{props.children}</small>;
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

function inferCreateWizardStep(state: CreateState | null): CreateWizardStepId {
  if (!state) return 'ROLE_RESULT';
  if (state.currentStep === 'SUMMARY' || state.currentStep === 'COMMERCIAL') return 'CONDITIONS_APPLICATION';
  const currentDomainStep = state.currentStep as CreateStepId;
  const currentStep = createWizardSteps.find((step) => step.domainStepIds.includes(currentDomainStep));
  if (currentStep) return currentStep.id;
  const completed = new Set(state.completedSteps);
  return createWizardSteps.find((step) => !step.domainStepIds.every((domainStepId) => completed.has(domainStepId)))?.id ?? 'CONDITIONS_APPLICATION';
}

function createWizardResumeKey(state: CreateState | null): string {
  return ['create-wizard', state?.sessionId ?? 'new', state?.currentStep ?? 'draft', state?.completedSteps.join('|') ?? 'none'].join(':');
}

function isCreateWizardStepComplete(draft: CreateDraft, stepId: CreateWizardStepId): boolean {
  const step = createWizardSteps.find((item) => item.id === stepId);
  return Boolean(step && step.requiredFields.every((field) => cleanDraft(draft[field.key])));
}

function isCreateWizardStepCompleteFromState(state: CreateState | null, stepId: CreateWizardStepId): boolean {
  const step = createWizardSteps.find((item) => item.id === stepId);
  if (!state || !step) return false;
  const completed = new Set(state.completedSteps);
  return step.domainStepIds.every((domainStepId) => completed.has(domainStepId));
}

function validateCreateWizardStep(draft: CreateDraft, stepId: CreateWizardStepId): { stepId: CreateWizardStepId; id: string } | null {
  const step = createWizardSteps.find((item) => item.id === stepId);
  const invalid = step?.requiredFields.find((field) => !cleanDraft(draft[field.key]));
  return invalid && step ? { stepId: step.id, id: invalid.id } : null;
}

function firstInvalidCreateWizardField(draft: CreateDraft): { stepId: CreateWizardStepId; id: string } | null {
  for (const step of createWizardSteps) {
    const invalid = validateCreateWizardStep(draft, step.id);
    if (invalid) return invalid;
  }
  return null;
}

function focusCreateField(id: string) {
  const control = document.getElementById(id) as (HTMLElement & { reportValidity?: () => boolean }) | null;
  control?.focus();
  control?.reportValidity?.();
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
