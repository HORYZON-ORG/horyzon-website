"use client";

import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  customerSafeCheckoutError,
  fetchAnnunci10xCommercialOffers,
  startAnnunci10xCheckout,
  checkoutCtaLabel,
  offerPriceLabel,
  type Annunci10xCommercialOffer,
  type Annunci10xCommercialState,
} from './annunci-10x-commerce-client';
import { Annunci10xIdentityGate } from './annunci-10x-identity-gate';
import { Annunci10xLoader } from './annunci-10x-loader';
import { annunci10xProgressForAnalysisStage, type Annunci10xAnalysisStage } from '@/lib/annunci-10x/loading';
import styles from './annunci-10x.module.css';

type SourceMode = 'PASTED_TEXT' | 'PUBLIC_URL';
type AnalysisStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';

interface AnalysisRunState {
  id: string;
  status: AnalysisStatus;
  stage?: Annunci10xAnalysisStage;
  sourceStatus: 'READY' | 'URL_FETCH_FAILED' | 'INVALID_SOURCE';
  ready: boolean;
  progressLabel: string;
  contactSaved: boolean;
  emailVerified: boolean;
  resultEligible: boolean;
  failureCode?: string;
}

interface FreeResult {
  analysisRunId: string;
  resultVersion: 'V1_COMPAT' | 'V2';
  score: {
    value: number | null;
    max: 100;
    range?: { min: number; max: number };
    coverage: number;
  };
  band: { code: string; label: string } | null;
  interpretation: string;
  nextAction: { type: 'REWRITE_EXISTING_AD'; label: string };
}

const sampleAd = `Cerchiamo un addetto customer care per la sede di Bari.
La persona gestirà richieste clienti, ticket e aggiornamento CRM.
Contratto part-time, presenza in sede, affiancamento iniziale.
Requisiti: italiano scritto chiaro, precisione, disponibilità al lavoro su turni.
Candidatura via email con CV aggiornato.`;

const POLL_MS = 2500;

export function Annunci10xAnalyzeFlow({ commerceRefreshToken = 0 }: { commerceRefreshToken?: number }) {
  const [sourceMode, setSourceMode] = useState<SourceMode>('PASTED_TEXT');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [analysisRun, setAnalysisRun] = useState<AnalysisRunState | null>(null);
  const [contactSaved, setContactSaved] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [result, setResult] = useState<FreeResult | null>(null);
  const [commercial, setCommercial] = useState<Annunci10xCommercialState | null>(null);
  const [commercialStatus, setCommercialStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [identityResetKey, setIdentityResetKey] = useState(0);
  const resultFetchRef = useRef<string | null>(null);
  const flowCycleRef = useRef(0);
  const textRadioRef = useRef<HTMLButtonElement | null>(null);
  const linkRadioRef = useRef<HTMLButtonElement | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  const loadCommercialOffers = useCallback(async (cycle = flowCycleRef.current) => {
    setCommercialStatus('Caricamento offerte in corso.');
    try {
      const nextCommercial = await fetchAnnunci10xCommercialOffers();
      if (cycle !== flowCycleRef.current) return;
      setCommercial(nextCommercial);
      setCommercialStatus(null);
    } catch (cause) {
      if (cycle !== flowCycleRef.current) return;
      setCommercialStatus(customerSafeCheckoutError(cause));
    }
  }, []);

  const loadResult = useCallback(async (id: string, cycle = flowCycleRef.current) => {
    setBusy('result');
    try {
      const response = await fetch(`/api/annunci-10x/analysis/${id}/result`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Risultato non disponibile.');
      if (cycle !== flowCycleRef.current) return;
      setResult(payload.result);
      await loadCommercialOffers(cycle);
    } catch (cause) {
      if (cycle !== flowCycleRef.current) return;
      resultFetchRef.current = null;
      setError(customerSafeError(cause, 'Risultato non disponibile.'));
    } finally {
      if (cycle === flowCycleRef.current) setBusy(null);
    }
  }, [loadCommercialOffers]);

  useEffect(() => {
    let cancelled = false;
    const cycle = flowCycleRef.current;
    fetch('/api/annunci-10x/session/resume', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || cycle !== flowCycleRef.current || !payload.ok || !payload.analysisRun) return;
        setAnalysisRun(payload.analysisRun);
        setContactSaved(Boolean(payload.analysisRun.contactSaved));
        setEmailVerified(Boolean(payload.analysisRun.emailVerified));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!analysisRun?.id || analysisRun.status === 'READY' || analysisRun.status === 'FAILED') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cycle = flowCycleRef.current;
    const runId = analysisRun.id;

    async function poll() {
      try {
        const response = await fetch(`/api/annunci-10x/analysis/${runId}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!cancelled && cycle === flowCycleRef.current && response.ok && payload.ok) setAnalysisRun(normalizeRun(payload.run));
      } catch {
        if (!cancelled && cycle === flowCycleRef.current) setStatusMessage('Aggiorneremo lo stato tra qualche secondo.');
      } finally {
        if (!cancelled && cycle === flowCycleRef.current) timer = setTimeout(poll, POLL_MS);
      }
    }

    timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [analysisRun?.id, analysisRun?.status]);

  useEffect(() => {
    if (!analysisRun?.resultEligible || !analysisRun.id || resultFetchRef.current === analysisRun.id) return;
    resultFetchRef.current = analysisRun.id;
    loadResult(analysisRun.id, flowCycleRef.current);
  }, [analysisRun?.resultEligible, analysisRun?.id, loadResult]);

  useEffect(() => {
    if (!commerceRefreshToken || !result) return;
    const timer = window.setTimeout(() => {
      void loadCommercialOffers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [commerceRefreshToken, result, loadCommercialOffers]);

  useEffect(() => {
    if (!result || !resultRef.current) return;
    resultRef.current.focus({ preventScroll: true });
  }, [result]);

  async function submitSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cycle = flowCycleRef.current + 1;
    flowCycleRef.current = cycle;
    setError(null);
    setStatusMessage(null);
    setResult(null);
    setAnalysisRun(null);
    setContactSaved(false);
    setEmailVerified(false);
    setCommercial(null);
    setCommercialStatus(null);
    setIdentityResetKey((value) => value + 1);
    resultFetchRef.current = null;
    setBusy('source');
    try {
      const response = await fetch('/api/annunci-10x/analysis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sourceMode === 'PUBLIC_URL' ? { sourceKind: 'PUBLIC_URL', url } : { sourceKind: 'PASTED_TEXT', text }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Analisi non avviata.');
      if (cycle !== flowCycleRef.current) return;
      const nextRun = normalizeRun(payload.run);
      setAnalysisRun(nextRun);
      setContactSaved(Boolean(nextRun.contactSaved));
      setEmailVerified(Boolean(nextRun.emailVerified));
    } catch (cause) {
      if (cycle !== flowCycleRef.current) return;
      setError(customerSafeError(cause, 'Analisi non avviata.'));
    } finally {
      if (cycle === flowCycleRef.current) setBusy(null);
    }
  }

  const analysisReady = Boolean(analysisRun?.ready);
  const sourceFailed = analysisRun?.sourceStatus === 'URL_FETCH_FAILED' || analysisRun?.failureCode === 'URL_FETCH_FAILED';
  const canShowContact = Boolean(analysisRun?.id && !sourceFailed);
  const showResultLocked = analysisReady && !emailVerified;
  const showVerifiedWaiting = emailVerified && !analysisReady && analysisRun?.status !== 'FAILED';
  const analysisProgress = analysisRun
    ? annunci10xProgressForAnalysisStage({
        stage: analysisRun.stage,
        status: analysisRun.status,
      })
    : null;
  const hasWorkspace = Boolean(busy === 'source' || analysisRun || sourceFailed || statusMessage || error || result);

  const currentStep = result || emailVerified ? 3 : analysisRun ? 2 : 1;
  // Once the ad is in, the form folds into one line so the progress, the code and the score take the stage.
  const submitted = Boolean(analysisRun || result) && busy !== 'source';
  const sourceSummary = sourceMode === 'PUBLIC_URL' ? url.trim() : text.trim().replace(/\s+/g, ' ');

  function analyzeAnother() {
    flowCycleRef.current += 1;
    setSourceMode('PASTED_TEXT');
    setText('');
    setUrl('');
    setAnalysisRun(null);
    setContactSaved(false);
    setEmailVerified(false);
    setResult(null);
    setCommercial(null);
    setCommercialStatus(null);
    setStatusMessage(null);
    setError(null);
    setBusy(null);
    setIdentityResetKey((value) => value + 1);
    resultFetchRef.current = null;
    focusSourceTextarea();
  }

  function recoverUrlAsText() {
    flowCycleRef.current += 1;
    setSourceMode('PASTED_TEXT');
    setAnalysisRun(null);
    setContactSaved(false);
    setEmailVerified(false);
    setResult(null);
    setCommercial(null);
    setCommercialStatus(null);
    setStatusMessage(null);
    setError(null);
    setBusy(null);
    setIdentityResetKey((value) => value + 1);
    resultFetchRef.current = null;
    focusSourceTextarea();
  }

  function focusSourceTextarea() {
    window.requestAnimationFrame(() => sourceTextareaRef.current?.focus());
  }

  function focusSourceRadio(nextMode: SourceMode) {
    window.requestAnimationFrame(() => {
      if (nextMode === 'PASTED_TEXT') textRadioRef.current?.focus();
      if (nextMode === 'PUBLIC_URL') linkRadioRef.current?.focus();
    });
  }

  function selectSourceMode(nextMode: SourceMode, options: { focusRadio?: boolean; focusTextarea?: boolean } = {}) {
    setSourceMode(nextMode);
    if (options.focusRadio) {
      focusSourceRadio(nextMode);
      return;
    }
    if (nextMode === 'PASTED_TEXT' && options.focusTextarea !== false) focusSourceTextarea();
  }

  function handleSourceToggleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'Home') {
      event.preventDefault();
      selectSourceMode('PASTED_TEXT', { focusRadio: true, focusTextarea: false });
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'End') {
      event.preventDefault();
      selectSourceMode('PUBLIC_URL', { focusRadio: true, focusTextarea: false });
    }
  }
  const showProgress = Boolean(!result && (busy === 'source' || (analysisRun && analysisProgress)));

  return <section className={styles.createShell} data-flow="analyze" data-has-workspace={hasWorkspace} aria-label="Analizza gratis il tuo annuncio">
    <ol className={styles.flowSteps} aria-label="Passaggi dello Score gratuito">
      {FLOW_STEPS.map(([title, detail], index) => {
        const step = index + 1;
        const state = step < currentStep ? 'done' : step === currentStep ? 'current' : 'next';
        return <li key={title} data-state={state} aria-current={state === 'current' ? 'step' : undefined}><b>{state === 'done' ? '✓' : `0${step}`}</b><span>{title}</span><small>{detail}</small></li>;
      })}
    </ol>

    <form className={styles.form} data-submitted={submitted} onSubmit={submitSource} aria-labelledby="analyze-source-title">
      <div className={styles.formHead}>
        <p>{!submitted ? 'Score gratuito' : result ? 'Annuncio analizzato' : 'Annuncio inviato'}</p>
        <h2 id="analyze-source-title">Analizza gratis il tuo annuncio</h2>
      </div>
      {submitted ? <div className={styles.sourceSummary}>
        <p>{sourceSummary ? `“${sourceSummary.length > 110 ? `${sourceSummary.slice(0, 110)}…` : sourceSummary}”` : result ? 'Analisi completata.' : 'Il tuo annuncio è in analisi.'}</p>
        <button type="button" className={styles.flowLink} onClick={analyzeAnother}>Analizza un altro annuncio</button>
      </div> : <>
      <div className={styles.sourceToggle} role="radiogroup" aria-label="Sorgente annuncio" onKeyDown={handleSourceToggleKeyDown}>
        <button ref={textRadioRef} type="button" role="radio" aria-checked={sourceMode === 'PASTED_TEXT'} tabIndex={sourceMode === 'PASTED_TEXT' ? 0 : -1} data-active={sourceMode === 'PASTED_TEXT'} onClick={() => selectSourceMode('PASTED_TEXT')} disabled={busy === 'source'}>Testo</button>
        <button ref={linkRadioRef} type="button" role="radio" aria-checked={sourceMode === 'PUBLIC_URL'} tabIndex={sourceMode === 'PUBLIC_URL' ? 0 : -1} data-active={sourceMode === 'PUBLIC_URL'} onClick={() => selectSourceMode('PUBLIC_URL')} disabled={busy === 'source'}>Link</button>
      </div>
      {sourceMode === 'PASTED_TEXT'
        ? <Field label="Testo annuncio" htmlFor="annunci10x-source-text" required>
            <textarea ref={sourceTextareaRef} id="annunci10x-source-text" className={styles.sourceTextarea} data-empty={!text.trim()} required value={text} onChange={(event) => setText(event.target.value)} placeholder="Incolla qui il testo del tuo annuncio" rows={text.trim() ? 10 : 3} disabled={busy === 'source'} />
          </Field>
        : <Field label="URL annuncio" htmlFor="annunci10x-source-url" required>
            <input id="annunci10x-source-url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Incolla il link pubblico dell'annuncio" disabled={busy === 'source'} />
          </Field>}
      <div className={styles.actions}>
        <button type="submit" disabled={busy === 'source'}>{busy === 'source' ? 'Avvio in corso' : 'Analizza il mio annuncio — gratis'}<span aria-hidden="true">→</span></button>
        {sourceMode === 'PASTED_TEXT' && <button type="button" className={styles.flowLink} disabled={busy === 'source'} onClick={() => setText(sampleAd)}>Usa esempio</button>}
      </div>
      <p className={styles.formMicrocopy}>Gratis · 2 minuti · nessuna carta di credito</p>
      </>}
    </form>

    {hasWorkspace && <div ref={workspaceRef} className={styles.analysisWorkspace} aria-label="Workspace analisi Annunci 10x">
      {showProgress && <div className={styles.progressCard} aria-live="polite">
        <p>{analysisRun?.status === 'READY' ? 'Analisi completata' : 'Analisi in corso'}</p>
        {busy === 'source'
          ? <Annunci10xLoader variant="strip" indeterminate label="Avviamo l'analisi" />
          : analysisRun?.status === 'FAILED'
            ? <strong>Analisi non completata</strong>
            : analysisProgress && <Annunci10xLoader
                variant="strip"
                label={analysisProgress.label}
                progress={analysisProgress.progress}
                complete={analysisProgress.complete}
              />}
      </div>}

      {sourceFailed && <div className={styles.warningPanel} role="status">
        <p>Non siamo riusciti a leggere automaticamente questo annuncio.</p>
        <button type="button" onClick={recoverUrlAsText}>Incolla il testo</button>
      </div>}

      {showResultLocked && <div className={styles.lockedNotice} role="status"><strong>Il tuo risultato è pronto.</strong><span>Verifica la tua email per visualizzarlo.</span></div>}

      {canShowContact && !result && <Annunci10xIdentityGate
        key={identityResetKey}
        eyebrow="Report via email"
        title="Dove ti mandiamo il report?"
        description="Ti chiediamo questi dati per collegare il risultato alla tua richiesta e inviarti il report."
        otpTitle="Ti mandiamo un codice di 6 cifre: è l'ultimo passo prima dello Score."
        submitLabel="Continua"
        analysisRunId={analysisRun?.id}
        idPrefix="analyze-lead"
        initialContactSaved={contactSaved}
        initialEmailVerified={emailVerified}
        onContactSaved={({ emailVerified: verified }) => {
          setContactSaved(true);
          setEmailVerified(verified);
          setAnalysisRun((current) => current ? { ...current, contactSaved: true, emailVerified: verified, resultEligible: current.ready && verified } : current);
        }}
        onVerified={({ resultEligible }) => {
          setEmailVerified(true);
          setAnalysisRun((current) => current ? { ...current, emailVerified: true, resultEligible } : current);
          setStatusMessage(null);
        }}
      />}

      {showVerifiedWaiting && <Annunci10xLoader variant="strip" indeterminate label="Stiamo completando l'analisi" />}
      {busy === 'result' && <Annunci10xLoader variant="strip" indeterminate label="Carichiamo il risultato" />}
      {analysisRun?.status === 'FAILED' && !sourceFailed && <div className={styles.error} role="alert">Non siamo riusciti a completare l&apos;analisi. Riprova.</div>}
      {statusMessage && !result && <p className={styles.flowStatus} aria-live="polite">{statusMessage}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      {result && <div ref={resultRef} tabIndex={-1} className={styles.resultStack}>
        <FreeResultCard result={result} />
        <RewriteOfferCard offer={commercial?.availableOffers.find((offer) => offer.offerCode === 'ANNUNCI10X_REWRITE')} commercialStatus={commercialStatus} />
      </div>}
    </div>}
  </section>;
}

const FLOW_STEPS = [
  ['Incolla', 'Testo o link dell’annuncio'],
  ['Verifica', 'Un codice di 6 cifre via email'],
  ['Score', 'Il risultato, qui e via email'],
] as const;

// The free result reads as a report: one big number, the band on a five-step scale, the interpretation and
// a single caveat. The paid rewrite is a separate card under it, so the score never looks like a sales pitch.
function FreeResultCard({ result }: { result: FreeResult }) {
  const displayScore = getDisplayScore(result.score);
  const activeBandLabel = result.band?.label ?? scoreBandLabelForValue(displayScore);
  const isPartialV2 = result.resultVersion === 'V2' && result.score.coverage < 100;
  const evaluableChecks = Math.round(result.score.coverage / 5);
  return <section className={styles.result} aria-labelledby="free-result-title">
    <header className={styles.scoreHead}>
      <p>Score di chiarezza</p>
      {activeBandLabel && <span className={styles.scoreBadge}>{activeBandLabel}</span>}
    </header>
    <h2 id="free-result-title" className={styles.scoreValue}>
      <span className={styles.srOnly}>Risultato gratuito: </span>
      <strong>{displayScore === null ? 'N/D' : formatDecimal(displayScore)}</strong>
      {displayScore !== null && <span>/ {result.score.max}</span>}
    </h2>
    <ScoreBandBar activeLabel={activeBandLabel} />
    <p className={styles.scoreReading}>{result.interpretation}</p>
    {isPartialV2 && <p className={styles.scoreCoverage}>Abbiamo potuto valutare {evaluableChecks} controlli su 20, perché nel testo mancano alcune informazioni.</p>}
    <p className={styles.disclaimer}>Il punteggio valuta la chiarezza e la completezza delle informazioni disponibili nell’annuncio. Non prevede il numero di candidature né sostituisce la valutazione delle persone.</p>
  </section>;
}

function RewriteOfferCard({ offer, commercialStatus }: { offer?: Annunci10xCommercialOffer; commercialStatus: string | null }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function checkout() {
    if (!offer?.purchaseEnabled) return;
    setLoading(true);
    setStatus(null);
    try {
      await startAnnunci10xCheckout(offer.offerCode);
    } catch (cause) {
      setStatus(customerSafeCheckoutError(cause));
      setLoading(false);
    }
  }

  return <section className={styles.offerCard} aria-labelledby="rewrite-offer-title">
    <div className={styles.offerCopy}>
      <p>Vuoi trasformarlo?</p>
      <h3 id="rewrite-offer-title">Riscriviamo questo annuncio, <em>riga per riga.</em></h3>
      <ul>
        <li>Partiamo dal tuo testo e dal risultato dello Score.</li>
        <li>Solo fatti che confermi tu: niente dati inventati.</li>
        <li>1 annuncio · 1 versione · 1 canale.</li>
      </ul>
    </div>
    <div className={styles.offerBuy}>
      <span>Annuncio 10x</span>
      <strong>{offer ? offerPriceLabel(offer) : '7 €'}</strong>
      {offer
        ? offer.purchaseEnabled
          ? <button type="button" onClick={checkout} disabled={loading}>{loading ? 'Preparazione pagamento…' : checkoutCtaLabel(offer)}<span aria-hidden="true">→</span></button>
          : <p className={styles.offerUnavailable} role="status">{checkoutCtaLabel(offer)}</p>
        : commercialStatus && !/caricamento/i.test(commercialStatus)
          ? <p className={styles.offerUnavailable} role="status">{commercialStatus}</p>
          : <Annunci10xLoader variant="strip" indeterminate label="Carichiamo l'offerta Annuncio 10x" />}
      {loading && <Annunci10xLoader variant="strip" indeterminate label="Prepariamo il pagamento sicuro" />}
      {status && <span className={styles.offerStatus} aria-live="polite">{status}</span>}
    </div>
    <p className={styles.offerFine}>Output completo dopo pagamento confermato. Rimborso integrale entro 14 giorni dalla consegna, senza motivazione, scrivendo a info@horyzon.it dall’email usata per l’acquisto.</p>
  </section>;
}

function ScoreBandBar({ activeLabel }: { activeLabel?: string }) {
  const labels = ['Critico', 'Debole', 'Buona base', 'Forte', 'Eccellente'];
  const activeIndex = activeLabel ? labels.indexOf(activeLabel) : -1;
  return <div className={styles.scoreBandBar} aria-label="Fasce Score">
    {labels.map((label, index) => {
      const active = index === activeIndex;
      return <span key={label} data-active={active} data-passed={activeIndex >= 0 && index < activeIndex} aria-current={active ? 'true' : undefined}>{label}</span>;
    })}
  </div>;
}

function Field(props: { label: string; htmlFor: string; required?: boolean; children: ReactNode }) {
  return <label className={styles.field} htmlFor={props.htmlFor}><span>{props.label}{props.required && <b> *</b>}</span>{props.children}</label>;
}

function normalizeRun(run: AnalysisRunState): AnalysisRunState {
  return {
    ...run,
    progressLabel: run.progressLabel ?? fallbackProgressLabel(run.stage),
    contactSaved: Boolean(run.contactSaved),
    emailVerified: Boolean(run.emailVerified),
    resultEligible: Boolean(run.resultEligible),
  };
}

function fallbackProgressLabel(stage?: Annunci10xAnalysisStage): string {
  if (!stage) return 'Stiamo leggendo il tuo annuncio';
  if (stage === 'SOURCE_VALIDATION' || stage === 'PRECHECK' || stage === 'EXTRACT') return 'Stiamo leggendo il tuo annuncio';
  if (stage === 'PROFILE' || stage === 'STRATEGY') return 'Stiamo ricostruendo il ruolo';
  if (stage === 'EVALUATE' || stage === 'CLARIFY') return 'Stiamo applicando i 20 controlli';
  return 'Il risultato è pronto';
}

function getDisplayScore(score: FreeResult['score']): number | null {
  if (typeof score.value === 'number') return score.value;
  if (score.range) return score.range.min;
  return null;
}

function scoreBandLabelForValue(value: number | null): string | undefined {
  if (value === null) return undefined;
  if (value < 50) return 'Critico';
  if (value < 70) return 'Debole';
  if (value < 85) return 'Buona base';
  if (value < 95) return 'Forte';
  return 'Eccellente';
}

function formatDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

function customerSafeError(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : fallback;
  if (/EMAIL_PROVIDER_UNAVAILABLE|EMAIL_VERIFICATION_UNAVAILABLE|provider email|verifica email/i.test(message)) return 'La verifica email è temporaneamente non disponibile.';
  return message || fallback;
}
