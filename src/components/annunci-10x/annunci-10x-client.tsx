"use client";

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatAnnunci10xScore, formatCheckScore, priorityHeading, publicationCopy } from '@/lib/annunci-10x/presentation.ts';
import styles from './annunci-10x.module.css';

type CheckStatus = 'PASS' | 'PARTIAL' | 'MISSING' | 'CONFLICT' | 'NOT_EVALUABLE';
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

interface PublicResult {
  sessionId: string;
  evaluationId: string;
  score: {
    value: number | null;
    interval?: { min: number; max: number };
    coverage: number;
    checks: { id: string; label: string; status: CheckStatus; score: number | null; maxScore: number; evidence: string[] }[];
  };
  gate: { status: string; blockingReasons: string[]; warnings: string[] };
  roleSummary: {
    title: string;
    titleSource: 'OBSERVED' | 'DECLARED_CONTEXT' | 'UNKNOWN';
    observedTitle: string | null;
    declaredTitle: string | null;
    roleMismatch: { status: 'MATCH' | 'POSSIBLE_MISMATCH' | 'UNKNOWN'; message: string | null; evidence: string[] };
    companyName: string;
    location: string;
    workMode: string;
    contractType: string;
    missingFacts: string[];
  };
  strengths: string[];
  priorities: string[];
  clarification?: { id: string; targetPath: string; question: string; reason: string; blocking: boolean; canSkip: boolean } | null;
  offers: {
    checkoutEnabled: false;
    pricingStatus: 'OPEN_DECISION';
    availableOffers: CommercialOffer[];
    entitlements: { guide: boolean; adGenerationCredits: number; source: string };
  };
  operations: PublicOperation[];
  provider: 'MOCK' | 'OPENAI';
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

interface ResumePayload {
  ok: boolean;
  session: { id: string; entryMode: string } | null;
  snapshot?: { id: string; version: number; roleTitle: string | null; createdAt: string } | null;
  evaluation?: { id: string; score: PublicResult['score']; gate: PublicResult['gate']; createdAt: string } | null;
}

interface PremiumOutput {
  outputId: string;
  masterText: string;
  channelVariant: { channel: string; sections: { id: string; title: string; body: string }[] } | null;
  score: PublicResult['score'];
  gate: PublicResult['gate'];
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

const sampleAd = `Cerchiamo un addetto customer care per la sede di Bari.
La persona gestira richieste clienti, ticket e aggiornamento CRM.
Contratto part-time, presenza in sede, affiancamento iniziale.
Requisiti: italiano scritto chiaro, precisione, disponibilita al lavoro su turni.
Candidatura via email con CV aggiornato.`;

const createStepOrder: CreateStepId[] = ['ROLE_CONTEXT', 'PRIMARY_CONTRIBUTION', 'WORK_REALITY', 'REQUIREMENTS', 'ATTRACTION', 'OFFER', 'CHANNEL_APPLICATION'];

const statusLabels: Record<CheckStatus, string> = {
  PASS: 'Ok',
  PARTIAL: 'In parte',
  MISSING: 'Manca',
  CONFLICT: 'Contraddizione',
  NOT_EVALUABLE: 'N/D',
};

export function Annunci10xClient() {
  const [mode, setMode] = useState<Mode>('ANALYZE');
  const [rawAdText, setRawAdText] = useState('');
  const [roleHint, setRoleHint] = useState('');
  const [companyHint, setCompanyHint] = useState('');
  const [channelHint, setChannelHint] = useState<AnalyzeChannel>('');
  const [result, setResult] = useState<PublicResult | null>(null);
  const [resume, setResume] = useState<ResumePayload | null>(null);
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
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/annunci-10x/session/resume', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: ResumePayload) => {
        if (payload.ok) setResume(payload);
      })
      .catch(() => undefined);
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

  useEffect(() => {
    if (!result || !resultRef.current) return;
    resultRef.current.focus({ preventScroll: true });
    scrollToElement(resultRef.current);
  }, [result]);

  const scoreLabel = useMemo(() => result ? formatAnnunci10xScore(result.score) : 'N/D', [result]);

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    window.setTimeout(() => {
      if (workspaceRef.current) scrollToElement(workspaceRef.current);
    }, 0);
  }

  async function loadPremiumOutput() {
    try {
      const response = await fetch('/api/annunci-10x/premium/output', { cache: 'no-store' });
      const payload = await response.json();
      if (payload.ok) setPremiumOutput(payload.result ?? null);
    } catch {
      setPremiumOutput(null);
    }
  }

  async function submitAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setRunning(true);
    setActiveStage('PRECHECK');
    try {
      for (const stage of ['PRECHECK', 'EXTRACT', 'PROFILE', 'STRATEGY', 'EVALUATE']) {
        setActiveStage(stage);
        await pause(90);
      }
      const response = await fetch('/api/annunci-10x/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rawAdText, roleHint, companyHint, channelHint: channelHint || undefined }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Analisi non riuscita.');
      setActiveStage('CLARIFY');
      setResult(payload.result);
      loadPremiumOutput();
      setResume(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Analisi non riuscita.');
      setActiveStage(null);
    } finally {
      setRunning(false);
    }
  }

  async function answerClarification(skip = false) {
    if (!result?.clarification) return;
    setError(null);
    setRunning(true);
    try {
      const response = await fetch('/api/annunci-10x/clarify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clarificationId: result.clarification.id,
          targetPath: result.clarification.targetPath,
          answer: skip ? 'Non lo so' : clarificationAnswer,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Risposta non salvata.');
      setResult(payload.result);
      setClarificationAnswer('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Risposta non salvata.');
    } finally {
      setRunning(false);
    }
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
      setResult(null);
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
      <div className={styles.heroContent}>
        <p className={styles.eyebrow}>Horyzon / Annunci 10x</p>
        <h1>Trova candidati migliori partendo da un annuncio migliore.</h1>
        <p className={styles.heroLead}>Valuta un testo gia scritto oppure costruisci da zero la scheda del ruolo. Prima mettiamo in ordine i fatti, poi decidiamo se l&apos;annuncio e pronto o cosa va chiarito.</p>
        <div className={styles.heroActions} aria-label="Percorsi iniziali">
          <button type="button" onClick={() => selectMode('ANALYZE')}>Valuta il tuo annuncio</button>
          <button type="button" onClick={() => selectMode('CREATE')}>Crea da zero</button>
        </div>
        <p className={styles.validation}>Modalita test visibile. Nessun checkout attivo in questa fase.</p>
      </div>
      <aside className={styles.heroPanel} aria-label="Cosa ottieni">
        <p>Il tuo output</p>
        <ul>
          <li>Score Annunci 10x</li>
          <li>Punti forti</li>
          <li>Priorita da risolvere</li>
          <li>Controllo pubblicazione</li>
        </ul>
        <span>La generazione finale resta bloccata dietro autorizzazione server-side.</span>
      </aside>
    </section>

    <section className={styles.problem}>
      <p className={styles.eyebrowDark}>Perche serve</p>
      <h2>Molti annunci chiedono tutto. E spiegano troppo poco.</h2>
      <div className={styles.concepts}>
        <article><span>01</span><h3>Ruolo</h3><p>Il candidato deve capire subito quale lavoro reale trovera, non solo il titolo.</p></article>
        <article><span>02</span><h3>Persona</h3><p>I requisiti devono distinguere cio che e indispensabile, preferibile o apprendibile.</p></article>
        <article><span>03</span><h3>Contesto</h3><p>Condizioni, interlocutori e candidatura riducono ambiguita e false aspettative.</p></article>
      </div>
    </section>

    <section ref={workspaceRef} className={styles.workspace} aria-labelledby="annunci10x-workspace-title">
      <div className={styles.workspaceIntro}>
        <p>Prodotto</p>
        <h2 id="annunci10x-workspace-title">Parti dal punto in cui sei.</h2>
        <p>Se hai gia un annuncio, lo leggiamo con i 20 controlli. Se parti da zero, raccogliamo i fatti e ti facciamo confermare la posizione prima del confine commerciale.</p>
      </div>
      <div className={styles.workspaceBody}>
        <div className={styles.modeTabs} role="tablist" aria-label="Scegli percorso">
          <button type="button" role="tab" aria-selected={mode === 'ANALYZE'} data-active={mode === 'ANALYZE'} onClick={() => selectMode('ANALYZE')}>
            <span>Valutalo</span>
            <small>Ho gia un annuncio</small>
          </button>
          <button type="button" role="tab" aria-selected={mode === 'CREATE'} data-active={mode === 'CREATE'} onClick={() => selectMode('CREATE')}>
            <span>Crealo</span>
            <small>Parto dal ruolo reale</small>
          </button>
        </div>

        {resume?.session && mode === 'ANALYZE' && <ResumeNotice resume={resume} onContinue={() => selectMode('ANALYZE')} />}

        {mode === 'ANALYZE'
          ? <AnalyzeForm
              rawAdText={rawAdText}
              roleHint={roleHint}
              companyHint={companyHint}
              channelHint={channelHint}
              running={running}
              activeStage={activeStage}
              error={error}
              onSubmit={submitAnalyze}
              onRawAdText={setRawAdText}
              onRoleHint={setRoleHint}
              onCompanyHint={setCompanyHint}
              onChannelHint={setChannelHint}
            />
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

    {result && <div ref={resultRef} tabIndex={-1}>
      <AnalysisResult result={result} scoreLabel={scoreLabel} running={running} clarificationAnswer={clarificationAnswer} onClarificationAnswer={setClarificationAnswer} onAnswerClarification={answerClarification} />
    </div>}

    {premiumOutput && <PremiumOutputPanel output={premiumOutput} copied={copied} onCopy={copyText} />}

    <BeforeAfter />
    <MethodStatement />
    <FaqSection />
  </div>;
}

function AnalyzeForm(props: {
  rawAdText: string;
  roleHint: string;
  companyHint: string;
  channelHint: AnalyzeChannel;
  running: boolean;
  activeStage: string | null;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRawAdText: (value: string) => void;
  onRoleHint: (value: string) => void;
  onCompanyHint: (value: string) => void;
  onChannelHint: (value: AnalyzeChannel) => void;
}) {
  return <form className={styles.form} onSubmit={props.onSubmit} aria-labelledby="analyze-title">
    <div className={styles.formHead}><p>Valutalo</p><h2 id="analyze-title">Incolla un annuncio da verificare.</h2></div>
    <Field label="Il tuo annuncio" htmlFor="annunci10x-ad" required>
      <textarea id="annunci10x-ad" required value={props.rawAdText} onChange={(event) => props.onRawAdText(event.target.value)} placeholder={sampleAd} rows={12} disabled={props.running} aria-describedby="annunci10x-ad-help" />
      <small id="annunci10x-ad-help">Il testo incollato viene trattato come dato utente, non come istruzione.</small>
    </Field>
    <div className={styles.fieldGrid}>
      <Field label="Ruolo" htmlFor="annunci10x-role" optional>
        <input id="annunci10x-role" value={props.roleHint} onChange={(event) => props.onRoleHint(event.target.value)} disabled={props.running} placeholder="Es. Customer care specialist" />
        <small>Aiuta a interpretare correttamente l&apos;annuncio. Non aumenta il punteggio da solo.</small>
      </Field>
      <Field label="Azienda" htmlFor="annunci10x-company" optional>
        <input id="annunci10x-company" value={props.companyHint} onChange={(event) => props.onCompanyHint(event.target.value)} disabled={props.running} placeholder="Nome o contesto aziendale" />
        <small>Serve come contesto per l&apos;analisi. Il nome dell&apos;azienda non aumenta il punteggio.</small>
      </Field>
      <Field label="Canale" htmlFor="annunci10x-channel" optional>
        <select id="annunci10x-channel" value={props.channelHint} onChange={(event) => props.onChannelHint(event.target.value as AnalyzeChannel)} disabled={props.running}>
          <option value="">Da definire</option>
          <option value="LINKEDIN">LinkedIn</option>
          <option value="INDEED">Indeed</option>
          <option value="ATS">ATS aziendale</option>
          <option value="EMAIL">Email</option>
          <option value="CUSTOM">Altro</option>
        </select>
        <small>Se non lo sai, resta N/D. Non viene inventato.</small>
      </Field>
    </div>
    <div className={styles.actions}>
      <button type="submit" disabled={props.running}>{props.running ? 'Analisi in corso' : 'Valuta gratis'}</button>
      <button type="button" disabled={props.running} onClick={() => props.onRawAdText(sampleAd)}>Usa esempio</button>
    </div>
    {props.running && <Progress activeStage={props.activeStage} />}
    {props.error && <p className={styles.error} role="alert">{props.error}</p>}
  </form>;
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
    {!props.state && <div className={styles.startCreate}><p>Puoi compilare i campi e preparare direttamente la scheda. La sessione viene creata al salvataggio.</p><button type="button" onClick={props.onStart} disabled={props.running}>Crea una sessione</button></div>}
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
    {props.state.paymentRequired ? <section className={styles.commercialPanel}><p>Confine commerciale</p><h3>La posizione e pronta. Ora possiamo costruire il tuo Annuncio 10x.</h3><span>Checkout non attivo in questa fase. La generazione finale resta protetta da autorizzazione server-side.</span><OfferCards offers={props.state.commercial.availableOffers} empty="La generazione non e disponibile in questo stato." /></section> : <div className={styles.actions}><button type="button" onClick={props.onConfirm} disabled={props.running || !props.state.canConfirm}>Conferma</button><span>Puoi modificare i campi prima della conferma.</span></div>}
  </section>;
}

function AnalysisResult(props: {
  result: PublicResult;
  scoreLabel: string;
  running: boolean;
  clarificationAnswer: string;
  onClarificationAnswer: (value: string) => void;
  onAnswerClarification: (skip?: boolean) => void;
}) {
  const publication = publicationCopy(props.result.gate.status);
  const prioritiesTitle = priorityHeading(props.result.priorities.length);
  const showRoleMismatch = props.result.roleSummary.roleMismatch.status === 'POSSIBLE_MISMATCH' && props.result.roleSummary.roleMismatch.message;
  return <section className={styles.result} aria-labelledby="annunci10x-result-title">
    {props.result.provider === 'MOCK' && <div className={styles.testNotice} role="status"><strong>Modalita test - valutazione dimostrativa</strong><span>Il risultato usa una configurazione di test per sviluppo e verifica. Non e una validazione live del servizio finale.</span></div>}
    <div className={styles.resultHead}>
      <div><p>Ruolo osservato</p><h2 id="annunci10x-result-title">{props.result.roleSummary.title}</h2><small>{props.result.roleSummary.titleSource === 'OBSERVED' ? "Trovato nell'annuncio" : props.result.roleSummary.titleSource === 'DECLARED_CONTEXT' ? 'Dichiarato come contesto' : 'Da chiarire'}</small></div>
      <div className={styles.scoreBox}><span>Score Annunci 10x</span><strong>{props.scoreLabel}</strong><small>Forza del testo, separata dal gate.</small></div>
      <div className={styles.scoreBox}><span>Copertura analisi</span><strong>{props.result.score.coverage}%</strong><small>Quanto e valutabile sui 20 controlli.</small></div>
      <div className={styles.gateBox}><span>Stato pubblicazione</span><strong>{publication.label}</strong><small>{publication.description}</small></div>
    </div>
    {showRoleMismatch && <div className={styles.warningPanel} role="status" aria-live="polite"><p>Possibile incoerenza sul ruolo</p><strong>{props.result.roleSummary.roleMismatch.message}</strong></div>}
    <div className={styles.metricGrid}>
      <Metric label="Ruolo dichiarato" value={props.result.roleSummary.declaredTitle ?? 'N/D'} />
      <Metric label="Azienda" value={props.result.roleSummary.companyName} />
      <Metric label="Sede" value={props.result.roleSummary.location} />
      <Metric label="Modalita" value={props.result.roleSummary.workMode} />
      <Metric label="Contratto" value={props.result.roleSummary.contractType} />
    </div>
    {props.result.score.coverage < 100 && <p className={styles.coverageNote}>N/D significa che il controllo non e valutabile con le informazioni disponibili. Non equivale a zero.</p>}
    <div className={styles.columns}>
      <Panel title="Punti forti" items={props.result.strengths} empty="Nessun punto forte solido ancora." />
      <Panel title={props.result.priorities.length > 0 ? prioritiesTitle : 'Priorita'} items={props.result.priorities} empty="Nessuna priorita rilevata." />
    </div>
    {props.result.clarification && <div className={styles.clarification}><p>Chiarimento utile</p><h3>{props.result.clarification.question}</h3><small>{props.result.clarification.reason}</small><Field label="Risposta" htmlFor="annunci10x-clarification"><textarea id="annunci10x-clarification" rows={3} value={props.clarificationAnswer} onChange={(event) => props.onClarificationAnswer(event.target.value)} disabled={props.running} /></Field><div className={styles.actions}><button type="button" onClick={() => props.onAnswerClarification(false)} disabled={props.running}>Aggiorna analisi</button><button type="button" onClick={() => props.onAnswerClarification(true)} disabled={props.running}>Non lo so</button></div></div>}
    <section className={styles.checkSection} aria-labelledby="annunci10x-checks-title"><div className={styles.sectionHeading}><p>20 controlli</p><h3 id="annunci10x-checks-title">Dove l&apos;annuncio regge e dove si ferma.</h3></div><div className={styles.checks}>{props.result.score.checks.map((check) => <article key={check.id}><span>{check.id}</span><strong>{check.label}</strong><em data-status={check.status}>{statusLabels[check.status]}</em><small>{formatCheckScore(check.score, check.maxScore)}</small></article>)}</div></section>
    <section className={styles.improveCta}><p>Vuoi trasformare queste priorita in un Annuncio 10x?</p><h3>Migliora il mio annuncio</h3><OfferCards offers={props.result.offers.availableOffers} empty="La generazione non e disponibile in questo stato." /></section>
  </section>;
}

function PremiumOutputPanel(props: { output: PremiumOutput; copied: string | null; onCopy: (label: string, value: string) => void }) {
  const score = formatAnnunci10xScore(props.output.score);
  const channelText = props.output.channelVariant ? props.output.channelVariant.sections.map((section) => `${section.title}\n${section.body}`).join('\n\n') : '';
  return <section className={styles.result} aria-labelledby="annunci10x-premium-title"><div className={styles.resultHead}><div><p>Output premium</p><h2 id="annunci10x-premium-title">Master generato</h2></div><div className={styles.scoreBox}><span>Score</span><strong>{score}</strong><small>Coverage {props.output.score.coverage}%</small></div><div className={styles.gateBox}><span>Validazione</span><strong>{props.output.validationState.replaceAll('_', ' ')}</strong></div></div><div className={styles.panel}><h3>Master</h3><pre className={styles.outputText}>{props.output.masterText}</pre><div className={styles.actions}><button type="button" onClick={() => props.onCopy('master', props.output.masterText)}>{props.copied === 'master' ? 'Copiato' : 'Copia master'}</button></div></div>{props.output.channelVariant && <div className={styles.panel}><h3>Variante {props.output.channelVariant.channel}</h3><pre className={styles.outputText}>{channelText}</pre><div className={styles.actions}><button type="button" onClick={() => props.onCopy('channel', channelText)}>{props.copied === 'channel' ? 'Copiato' : 'Copia variante'}</button></div></div>}<div className={styles.columns}><Panel title="Decisioni" items={props.output.rationale} empty="Nessuna decisione disponibile." /><Panel title="Controlli finali" items={props.output.checklist} empty="Nessun controllo da rivedere." /></div></section>;
}

function OfferCards({ offers, empty }: { offers: CommercialOffer[]; empty: string }) {
  const visibleOffers = offers.filter((offer) => offer.productCode === 'AD_GENERATION');
  if (!visibleOffers.length) return <div className={styles.offerPanel}><h3>{empty}</h3><p>La disponibilita viene calcolata lato server in base allo stato del percorso.</p><button type="button" disabled>Non attivo</button></div>;
  return <div className={styles.offerList} aria-label="Prossimo passo">{visibleOffers.map((offer) => <article key={offer.id} className={styles.offerPanel}><h3>{offer.displayName}</h3><p>{offer.description}</p><button type="button" disabled>{offer.purchaseEnabled ? 'Continua' : 'Acquisto non attivo'}</button></article>)}</div>;
}

function ResumeNotice({ resume, onContinue }: { resume: ResumePayload; onContinue: () => void }) {
  return <aside className={styles.resume} aria-label="Lavoro in corso"><div><strong>Hai un lavoro in corso.</strong><p>{resume.snapshot ? `Ultima scheda: ${resume.snapshot.roleTitle ?? 'ruolo da chiarire'}` : 'Sessione iniziata, nessuna analisi salvata.'}</p></div>{resume.evaluation && <span>{formatAnnunci10xScore(resume.evaluation.score)}</span>}<button type="button" onClick={onContinue}>Continua</button></aside>;
}

function BeforeAfter() {
  return <section className={styles.beforeAfter}><header><p className={styles.eyebrowDark}>Prima / Dopo</p><h2>Da una richiesta generica a un ruolo riconoscibile.</h2></header><div className={styles.comparison}><article><span>Prima</span><p>Cerchiamo persona dinamica, motivata, flessibile, capace di lavorare in team e gestire attivita diverse.</p></article><article><span>Dopo</span><p>Cerchiamo un addetto customer care per gestire ticket, aggiornare il CRM e dare risposte scritte chiare ai clienti nella sede di Bari.</p></article></div></section>;
}

function MethodStatement() {
  return <section className={styles.method}><div><p>Metodo</p><h2>Prima la realta del ruolo. Poi le parole.</h2></div><p>Lavoro reale, persona necessaria, strategia e annuncio devono stare nello stesso ordine. Quando un fatto manca, resta da definire: non diventa una promessa.</p></section>;
}

function FaqSection() {
  return <section className={styles.faq}><p className={styles.eyebrowDark}>FAQ</p><h2>Domande frequenti</h2>{[['Serve avere gia un annuncio?', 'No. Puoi valutare un testo esistente oppure partire da zero con il percorso Crealo.'], ['Cosa include la valutazione gratuita?', 'Score, copertura, stato pubblicazione, punti forti, priorita, controlli e chiarimenti quando servono.'], ['Cosa devo sapere per crearne uno da zero?', 'Ruolo, risultato atteso, attivita, requisiti, condizioni e modalita di candidatura. I dettagli non noti possono restare da definire.'], ['Posso modificare le informazioni prima della generazione?', 'Si. Prima del confine commerciale vedi la scheda capita dal sistema e puoi correggere i campi strutturati.'], ['Quando viene richiesto il pagamento?', 'Valutalo e raccolta dati sono gratuiti. La richiesta commerciale arriva solo prima della generazione premium, che non ha checkout attivo in questa fase.'], ['Il sistema inventa informazioni mancanti?', 'No. Le informazioni mancanti restano N/D, da definire o diventano chiarimenti quando bloccano la pubblicazione.']].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>;
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

function Progress({ activeStage }: { activeStage: string | null }) {
  const stages = ['PRECHECK', 'EXTRACT', 'PROFILE', 'STRATEGY', 'EVALUATE', 'CLARIFY'];
  return <div className={styles.progress} aria-live="polite" aria-label="Stato analisi">{stages.map((stage) => <span key={stage} data-active={stage === activeStage}>{stage}</span>)}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{displayValue(value)}</strong></article>;
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

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
