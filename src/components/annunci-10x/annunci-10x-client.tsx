"use client";

import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './annunci-10x.module.css';

type CheckStatus = 'PASS' | 'PARTIAL' | 'MISSING' | 'CONFLICT' | 'NOT_EVALUABLE';
type Mode = 'ANALYZE' | 'CREATE';
type CreateStepId = 'ROLE_CONTEXT' | 'PRIMARY_CONTRIBUTION' | 'WORK_REALITY' | 'REQUIREMENTS' | 'ATTRACTION' | 'OFFER' | 'CHANNEL_APPLICATION';
type ProductCode = 'GUIDE' | 'AD_GENERATION' | 'GUIDE_PLUS_AD';

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
  roleSummary: { title: string; location: string; workMode: string; contractType: string; missingFacts: string[] };
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

const createSteps: { id: CreateStepId; label: string; question: string; placeholder: string }[] = [
  { id: 'ROLE_CONTEXT', label: 'Contesto ruolo', question: 'Che ruolo vuoi assumere e in quale contesto aziendale?', placeholder: 'Es. Cerchiamo un customer care specialist per azienda SaaS B2B a Bari...' },
  { id: 'PRIMARY_CONTRIBUTION', label: 'Contributo primario', question: 'Quale contributo deve portare la persona nei primi mesi?', placeholder: 'Es. Ridurre tempi di risposta, gestire ticket e migliorare la qualita delle risposte...' },
  { id: 'WORK_REALITY', label: 'Realta del lavoro', question: 'Com e fatto il lavoro quotidiano, tra routine, problemi e responsabilita?', placeholder: 'Es. Risponde ai ticket, aggiorna CRM, collabora con sales e segnala casi ricorrenti...' },
  { id: 'REQUIREMENTS', label: 'Requisiti', question: 'Quali requisiti sono obbligatori, preferenziali o apprendibili?', placeholder: 'Es. Obbligatorio: italiano scritto chiaro. Preferenziale: CRM. Apprendibile: procedure interne...' },
  { id: 'ATTRACTION', label: 'Attrazione', question: 'Perche una persona adatta dovrebbe scegliere questa opportunita?', placeholder: 'Es. Affiancamento iniziale, team stabile, obiettivi chiari, crescita su processi customer...' },
  { id: 'OFFER', label: 'Offerta', question: 'Quali condizioni vuoi dichiarare su sede, contratto, orari e compenso?', placeholder: 'Es. Sede Bari, ibrido 2 giorni, tempo determinato 12 mesi, RAL 24-28k...' },
  { id: 'CHANNEL_APPLICATION', label: 'Canale e candidatura', question: 'Dove verra pubblicato e come deve candidarsi la persona?', placeholder: 'Es. LinkedIn e ATS aziendale; candidatura tramite form con CV aggiornato...' },
];

const sampleAd = `Cerchiamo un addetto customer care per la sede di Bari.
La persona gestira richieste clienti, ticket e aggiornamento CRM.
Contratto part-time, presenza in sede, affiancamento iniziale.
Requisiti: italiano scritto chiaro, precisione, disponibilita al lavoro su turni.
Candidatura via email con CV aggiornato.`;

const statusLabels: Record<CheckStatus, string> = {
  PASS: 'Ok',
  PARTIAL: 'Parziale',
  MISSING: 'Manca',
  CONFLICT: 'Conflitto',
  NOT_EVALUABLE: 'N/D',
};

export function Annunci10xClient() {
  const [mode, setMode] = useState<Mode>('ANALYZE');
  const [rawAdText, setRawAdText] = useState('');
  const [roleHint, setRoleHint] = useState('');
  const [companyHint, setCompanyHint] = useState('');
  const [result, setResult] = useState<PublicResult | null>(null);
  const [resume, setResume] = useState<ResumePayload | null>(null);
  const [commercial, setCommercial] = useState<CommercialState | null>(null);
  const [createState, setCreateState] = useState<CreateState | null>(null);
  const [createAnswer, setCreateAnswer] = useState('');
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [editTarget, setEditTarget] = useState('title');
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [activeStage, setActiveStage] = useState<string | null>(null);
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
        if (payload.ok && payload.result) {
          setCreateState(payload.result);
          setMode('CREATE');
        }
      })
      .catch(() => undefined);
    fetch('/api/annunci-10x/commercial/offers', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: { ok: boolean; commercial?: CommercialState }) => {
        if (payload.ok && payload.commercial) setCommercial(payload.commercial);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!result || !resultRef.current) return;
    resultRef.current.focus({ preventScroll: true });
    resultRef.current.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [result]);

  const scoreLabel = useMemo(() => {
    if (!result) return 'N/D';
    if (typeof result.score.value === 'number') return `${result.score.value}/100`;
    if (result.score.interval) return `${result.score.interval.min}-${result.score.interval.max}/100`;
    return 'N/D';
  }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
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
        body: JSON.stringify({ rawAdText, roleHint, companyHint }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Analisi non riuscita.');
      setActiveStage('CLARIFY');
      setResult(payload.result);
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

  async function startCreate() {
    setMode('CREATE');
    setError(null);
    setRunning(true);
    try {
      const response = await fetch('/api/annunci-10x/create/start', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Avvio non riuscito.');
      setCreateState(payload.result);
      setCreateAnswer('');
      setResult(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Avvio non riuscito.');
    } finally {
      setRunning(false);
    }
  }

  async function submitCreateAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createState || createState.currentStep === 'SUMMARY' || createState.currentStep === 'COMMERCIAL') return;
    setError(null);
    setRunning(true);
    try {
      const response = await fetch('/api/annunci-10x/create/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stepId: createState.currentStep, answer: createAnswer }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Risposta non salvata.');
      setCreateState(payload.result);
      setCreateAnswer('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Risposta non salvata.');
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

  return <div className={styles.experience}>
    <section className={styles.productGrid} aria-label="Percorsi Annunci 10x">
      <article className={styles.pathPanel} data-active={mode === 'ANALYZE'}>
        <span>01</span>
        <h2>Analizza gratis</h2>
        <p>Valuta un annuncio esistente con score, copertura, priorita e chiarimenti mirati.</p>
        <button type="button" onClick={() => setMode('ANALYZE')}>Apri</button>
      </article>
      <article className={styles.pathPanel} data-active={mode === 'CREATE'}>
        <span>02</span>
        <h2>Crea da zero</h2>
        <p>Intervista guidata, scheda ruolo, strategia e schermata commerciale pre-payment.</p>
        <button type="button" onClick={() => createState ? setMode('CREATE') : startCreate()} disabled={running}>{createState ? 'Riprendi' : 'Inizia'}</button>
      </article>
      <article className={styles.pathPanel}>
        <span>03</span>
        <h2>{commercial?.availableOffers.find((offer) => offer.productCode === 'GUIDE')?.displayName ?? 'Guida Annunci 10x'}</h2>
        <p>{commercial?.availableOffers.find((offer) => offer.productCode === 'GUIDE')?.description ?? 'Prodotto standalone previsto. Prezzi e acquisto restano decisione aperta lato server.'}</p>
        <button type="button" disabled>Non attivo</button>
      </article>
    </section>

    {resume?.session && mode === 'ANALYZE' && <aside className={styles.resume} aria-label="Sessione precedente">
      <strong>Sessione trovata</strong>
      <p>{resume.snapshot ? `Ultima scheda: ${resume.snapshot.roleTitle ?? 'ruolo da chiarire'} · v${resume.snapshot.version}` : 'Sessione iniziata, nessuna analisi salvata.'}</p>
      {resume.evaluation && <p>Ultima valutazione: {resume.evaluation.score.value ?? `${resume.evaluation.score.interval?.min ?? 'N/D'}-${resume.evaluation.score.interval?.max ?? 'N/D'}`}/100 · {resume.evaluation.gate.status}</p>}
    </aside>}

    {mode === 'ANALYZE' ? <AnalyzeForm
      rawAdText={rawAdText}
      roleHint={roleHint}
      companyHint={companyHint}
      running={running}
      activeStage={activeStage}
      error={error}
      onSubmit={submit}
      onRawAdText={setRawAdText}
      onRoleHint={setRoleHint}
      onCompanyHint={setCompanyHint}
    /> : <CreateFlow
      state={createState}
      running={running}
      answer={createAnswer}
      clarificationAnswer={clarificationAnswer}
      editTarget={editTarget}
      editValue={editValue}
      error={error}
      onStart={startCreate}
      onAnswer={setCreateAnswer}
      onSubmitAnswer={submitCreateAnswer}
      onClarificationAnswer={setClarificationAnswer}
      onSubmitClarification={submitCreateClarification}
      onEditTarget={setEditTarget}
      onEditValue={setEditValue}
      onSubmitEdit={submitEdit}
      onConfirm={confirmCreate}
    />}

    {result && <div ref={resultRef} tabIndex={-1}>
      <AnalysisResult
        result={result}
        scoreLabel={scoreLabel}
        running={running}
        clarificationAnswer={clarificationAnswer}
        onClarificationAnswer={setClarificationAnswer}
        onAnswerClarification={answerClarification}
      />
    </div>}
  </div>;
}

function AnalyzeForm(props: {
  rawAdText: string;
  roleHint: string;
  companyHint: string;
  running: boolean;
  activeStage: string | null;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRawAdText: (value: string) => void;
  onRoleHint: (value: string) => void;
  onCompanyHint: (value: string) => void;
}) {
  return <form className={styles.form} onSubmit={props.onSubmit}>
    <div className={styles.formHead}>
      <p>Analisi gratuita</p>
      <h2>Incolla un annuncio da verificare</h2>
    </div>
    <label htmlFor="annunci10x-ad">Testo annuncio</label>
    <textarea id="annunci10x-ad" value={props.rawAdText} onChange={(event) => props.onRawAdText(event.target.value)} placeholder={sampleAd} rows={12} disabled={props.running} aria-describedby="annunci10x-ad-help" />
    <p id="annunci10x-ad-help" className={styles.help}>Il testo incollato viene trattato come contenuto utente non attendibile, mai come istruzioni per il sistema.</p>
    <div className={styles.inlineFields}>
      <label>Ruolo, se vuoi precisarlo<input value={props.roleHint} onChange={(event) => props.onRoleHint(event.target.value)} disabled={props.running} placeholder="Es. Customer care specialist" /></label>
      <label>Azienda, opzionale<input value={props.companyHint} onChange={(event) => props.onCompanyHint(event.target.value)} disabled={props.running} placeholder="Nome azienda" /></label>
    </div>
    <div className={styles.actions}>
      <button type="submit" disabled={props.running}>{props.running ? 'Analisi in corso' : 'Analizza gratis'}</button>
      <button type="button" disabled={props.running} onClick={() => props.onRawAdText(sampleAd)}>Usa esempio</button>
    </div>
    {props.running && <Progress activeStage={props.activeStage} />}
    {props.error && <p className={styles.error} role="alert">{props.error}</p>}
  </form>;
}

function CreateFlow(props: {
  state: CreateState | null;
  running: boolean;
  answer: string;
  clarificationAnswer: string;
  editTarget: string;
  editValue: string;
  error: string | null;
  onStart: () => void;
  onAnswer: (value: string) => void;
  onSubmitAnswer: (event: FormEvent<HTMLFormElement>) => void;
  onClarificationAnswer: (value: string) => void;
  onSubmitClarification: (skip?: boolean) => void;
  onEditTarget: (value: string) => void;
  onEditValue: (value: string) => void;
  onSubmitEdit: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
}) {
  if (!props.state) return <section className={styles.form}>
    <div className={styles.formHead}>
      <p>Crea da zero</p>
      <h2>Costruisci la scheda prima dell annuncio.</h2>
    </div>
    <p className={styles.help}>Il percorso raccoglie fatti, segnala conflitti e si ferma alla schermata commerciale. Nessun checkout e nessuna generazione finale sono attivi.</p>
    <div className={styles.actions}><button type="button" onClick={props.onStart} disabled={props.running}>Avvia Crea da zero</button></div>
    {props.error && <p className={styles.error} role="alert">{props.error}</p>}
  </section>;

  const current = createSteps.find((step) => step.id === props.state?.currentStep);
  return <section className={styles.createShell} aria-label="Crea da zero">
    <div className={styles.createHead}>
      <div>
        <p>Crea da zero</p>
        <h2>{props.state.paymentRequired ? 'Scheda confermata' : current ? current.label : 'Scheda ruolo pronta'}</h2>
      </div>
      <div className={styles.scoreBox}>
        <span>Copertura</span>
        <strong>{props.state.completion.coverage}%</strong>
        <small>{props.state.provider} / TEST</small>
      </div>
    </div>

    <div className={styles.createSteps}>
      {createSteps.map((step, index) => <span key={step.id} data-complete={props.state?.completedSteps.includes(step.id)} data-active={props.state?.currentStep === step.id}>{index + 1}</span>)}
    </div>

    {current && <form className={styles.form} onSubmit={props.onSubmitAnswer}>
      <div className={styles.formHead}>
        <p>{current.label}</p>
        <h2>{current.question}</h2>
      </div>
      <textarea value={props.answer} onChange={(event) => props.onAnswer(event.target.value)} placeholder={current.placeholder} rows={7} disabled={props.running} />
      <div className={styles.actions}><button type="submit" disabled={props.running}>{props.running ? 'Salvataggio' : 'Salva e continua'}</button></div>
    </form>}

    {props.state.clarification && <div className={styles.clarification}>
      <p>Chiarimento bloccante</p>
      <h3>{props.state.clarification.question}</h3>
      <small>{props.state.clarification.reason}</small>
      <textarea rows={3} value={props.clarificationAnswer} onChange={(event) => props.onClarificationAnswer(event.target.value)} disabled={props.running} />
      <div className={styles.actions}>
        <button type="button" onClick={() => props.onSubmitClarification(false)} disabled={props.running}>Salva chiarimento</button>
        <button type="button" onClick={() => props.onSubmitClarification(true)} disabled={props.running}>Non lo so</button>
      </div>
    </div>}

    {(props.state.currentStep === 'SUMMARY' || props.state.currentStep === 'COMMERCIAL') && <CreateSummary state={props.state} running={props.running} editTarget={props.editTarget} editValue={props.editValue} onEditTarget={props.onEditTarget} onEditValue={props.onEditValue} onSubmitEdit={props.onSubmitEdit} onConfirm={props.onConfirm} />}

    {props.error && <p className={styles.error} role="alert">{props.error}</p>}

    <details className={styles.details}>
      <summary>Audit runtime AI</summary>
      <div className={styles.operations}>
        {props.state.operations.length ? props.state.operations.map((operation) => <article key={`${operation.type}-${operation.promptVersion}-${operation.latencyMs}`}>
          <strong>{operation.type}</strong>
          <span>{operation.promptVersion}</span>
          <span>{operation.model}</span>
          <span>{operation.latencyMs} ms</span>
          <span>{operation.totalTokens ?? 'N/D'} token</span>
        </article>) : <p className={styles.help}>Nessuna operazione nuova in questa vista.</p>}
      </div>
    </details>
  </section>;
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
  return <div className={styles.result}>
    <div className={styles.resultHead}>
      <div>
        <p>Scheda ruolo</p>
        <h2>{props.state.roleCard.title}</h2>
      </div>
      <div className={styles.gateBox}><span>Stato</span><strong>{props.state.state.replaceAll('_', ' ')}</strong></div>
      <div className={styles.gateBox}><span>Canale</span><strong>{props.state.roleCard.channel ?? 'N/D'}</strong></div>
    </div>
    <div className={styles.summaryGrid}>
      <Metric label="Sede" value={props.state.roleCard.location} />
      <Metric label="Modalita" value={props.state.roleCard.workMode} />
      <Metric label="Contratto" value={props.state.roleCard.contractType} />
      <Metric label="Compenso" value={props.state.roleCard.compensation} />
    </div>
    <div className={styles.columns}>
      <Panel title="Contributo" items={[props.state.roleCard.mission, ...props.state.roleCard.outcomes]} empty="Da chiarire." />
      <Panel title="Requisiti" items={props.state.roleCard.requirements.map((item) => `${item.classification}: ${item.label}`)} empty="Da chiarire." />
    </div>
    {props.state.strategy && <div className={styles.panel}>
      <h3>Strategia</h3>
      <p>{props.state.strategy.summary}</p>
      <p>{props.state.strategy.candidateAngle}</p>
    </div>}
    {!props.state.paymentRequired && <form className={styles.inlineEdit} onSubmit={props.onSubmitEdit}>
      <label>Campo da modificare<select value={props.editTarget} onChange={(event) => props.onEditTarget(event.target.value)} disabled={props.running}>
        <option value="title">Titolo ruolo</option>
        <option value="mission">Missione</option>
        <option value="responsibilities">Responsabilita</option>
        <option value="requirements">Requisiti</option>
        <option value="attractionContext.location">Sede</option>
        <option value="attractionContext.workMode">Modalita</option>
        <option value="attractionContext.contractType">Contratto</option>
        <option value="compensation.amountText">Compenso</option>
      </select></label>
      <label>Nuovo valore<input value={props.editValue} onChange={(event) => props.onEditValue(event.target.value)} disabled={props.running} /></label>
      <button type="submit" disabled={props.running}>Aggiorna scheda</button>
    </form>}
    {props.state.paymentRequired ? <section className={styles.commercialPanel}>
      <p>Schermata commerciale</p>
      <h3>La scheda e pronta per la fase acquisto, non attiva in questa fase.</h3>
      <ul>
        <li>Checkout disabilitato</li>
        <li>Prezzo: open decision</li>
        <li>Entitlement: server verified, {props.state.commercial.entitlementSummary.guide ? 'guida attiva' : 'non acquistato'}</li>
        <li>Generazione finale non avviata</li>
      </ul>
      <OfferCards offers={props.state.commercial.availableOffers} empty="Nessuna offerta disponibile in questo stato." />
    </section> : <div className={styles.actions}><button type="button" onClick={props.onConfirm} disabled={props.running || !props.state.canConfirm}>Conferma scheda</button></div>}
  </div>;
}

function AnalysisResult(props: {
  result: PublicResult;
  scoreLabel: string;
  running: boolean;
  clarificationAnswer: string;
  onClarificationAnswer: (value: string) => void;
  onAnswerClarification: (skip?: boolean) => void;
}) {
  return <section className={styles.result} aria-labelledby="annunci10x-result-title">
    <div className={styles.resultHead}>
      <div>
        <p>Risultato analisi</p>
        <h2 id="annunci10x-result-title">{props.result.roleSummary.title}</h2>
      </div>
      <div className={styles.scoreBox}>
        <span>Score</span>
        <strong>{props.scoreLabel}</strong>
        <small>Coverage {props.result.score.coverage}%</small>
      </div>
      <div className={styles.gateBox}>
        <span>Pubblicazione</span>
        <strong>{props.result.gate.status.replaceAll('_', ' ')}</strong>
      </div>
    </div>

    <div className={styles.summaryGrid}>
      <Metric label="Sede" value={props.result.roleSummary.location} />
      <Metric label="Modalita" value={props.result.roleSummary.workMode} />
      <Metric label="Contratto" value={props.result.roleSummary.contractType} />
      <Metric label="Provider" value={props.result.provider} />
    </div>

    <div className={styles.columns}>
      <Panel title="Punti forti" items={props.result.strengths} empty="Nessun punto forte solido ancora." />
      <Panel title="Tre priorita" items={props.result.priorities} empty="Nessuna priorita rilevata." />
    </div>

    {props.result.clarification && <div className={styles.clarification}>
      <p>Chiarimento utile</p>
      <h3>{props.result.clarification.question}</h3>
      <small>{props.result.clarification.reason}</small>
      <label htmlFor="annunci10x-clarification">Risposta</label>
      <textarea id="annunci10x-clarification" rows={3} value={props.clarificationAnswer} onChange={(event) => props.onClarificationAnswer(event.target.value)} disabled={props.running} />
      <div className={styles.actions}>
        <button type="button" onClick={() => props.onAnswerClarification(false)} disabled={props.running}>Aggiorna analisi</button>
        <button type="button" onClick={() => props.onAnswerClarification(true)} disabled={props.running}>Non lo so</button>
      </div>
    </div>}

    <details className={styles.details}>
      <summary>Vedi i 20 controlli</summary>
      <div className={styles.checks}>
        {props.result.score.checks.map((check) => <article key={check.id}>
          <span>{check.id}</span>
          <strong>{check.label}</strong>
          <em data-status={check.status}>{statusLabels[check.status]}</em>
          <small>{check.score === null ? 'N/D' : `${check.score}/${check.maxScore}`}</small>
        </article>)}
      </div>
    </details>

    <details className={styles.details}>
      <summary>Audit runtime AI</summary>
      <div className={styles.operations}>
        {props.result.operations.map((operation) => <article key={`${operation.type}-${operation.promptVersion}`}>
          <strong>{operation.type}</strong>
          <span>{operation.promptVersion}</span>
          <span>{operation.model}</span>
          <span>{operation.latencyMs} ms</span>
          <span>{operation.totalTokens ?? 'N/D'} token</span>
        </article>)}
      </div>
    </details>

    <OfferCards offers={props.result.offers.availableOffers} empty="Nessuna offerta disponibile." />
  </section>;
}

function OfferCards({ offers, empty }: { offers: CommercialOffer[]; empty: string }) {
  if (!offers.length) return <section className={styles.offers} aria-label="Prossimi passi"><article><h3>{empty}</h3><p>Le offerte sono calcolate lato server in base allo stato del percorso.</p><button type="button" disabled>Non attivo</button></article></section>;
  return <section className={styles.offers} aria-label="Prossimi passi">
    {offers.map((offer) => <article key={offer.id}>
      <h3>{offer.displayName}</h3>
      <p>{offer.description}</p>
      <small>{offer.pricingStatus === 'OPEN_DECISION' ? 'Prezzo: open decision' : offer.pricingStatus}</small>
      <small>{offer.discountReason === 'GUIDE_OWNER' ? 'Condizione guida owner' : offer.discountReason === 'BUNDLE' ? 'Bundle previsto' : 'Nessuno sconto numerico'}</small>
      <button type="button" disabled>{offer.purchaseEnabled ? 'Continua' : 'Acquisto non attivo'}</button>
    </article>)}
  </section>;
}

function Progress({ activeStage }: { activeStage: string | null }) {
  const stages = ['PRECHECK', 'EXTRACT', 'PROFILE', 'STRATEGY', 'EVALUATE', 'CLARIFY'];
  return <div className={styles.progress} aria-live="polite" aria-label="Stato analisi">
    {stages.map((stage) => <span key={stage} data-active={stage === activeStage}>{stage}</span>)}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value || 'N/D'}</strong></article>;
}

function Panel({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <article className={styles.panel}><h3>{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{empty}</p>}</article>;
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
