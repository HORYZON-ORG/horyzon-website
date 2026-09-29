"use client";

import type { FormEvent, ReactNode } from 'react';
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
import styles from './annunci-10x.module.css';

type SourceMode = 'PASTED_TEXT' | 'PUBLIC_URL';
type AnalysisStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
type AnalysisStage = 'SOURCE_VALIDATION' | 'PRECHECK' | 'EXTRACT' | 'PROFILE' | 'STRATEGY' | 'EVALUATE' | 'CLARIFY' | 'COMPLETE';

interface AnalysisRunState {
  id: string;
  status: AnalysisStatus;
  stage?: AnalysisStage;
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
  const resultFetchRef = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const loadCommercialOffers = useCallback(async () => {
    setCommercialStatus('Caricamento offerte in corso.');
    try {
      setCommercial(await fetchAnnunci10xCommercialOffers());
      setCommercialStatus(null);
    } catch (cause) {
      setCommercialStatus(customerSafeCheckoutError(cause));
    }
  }, []);

  const loadResult = useCallback(async (id: string) => {
    setBusy('result');
    try {
      const response = await fetch(`/api/annunci-10x/analysis/${id}/result`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Risultato non disponibile.');
      setResult(payload.result);
      await loadCommercialOffers();
    } catch (cause) {
      resultFetchRef.current = null;
      setError(customerSafeError(cause, 'Risultato non disponibile.'));
    } finally {
      setBusy(null);
    }
  }, [loadCommercialOffers]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/annunci-10x/session/resume', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || !payload.ok || !payload.analysisRun) return;
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

    async function poll() {
      try {
        const response = await fetch(`/api/annunci-10x/analysis/${analysisRun?.id}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!cancelled && response.ok && payload.ok) setAnalysisRun(normalizeRun(payload.run));
      } catch {
        if (!cancelled) setStatusMessage('Aggiorneremo lo stato tra qualche secondo.');
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
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
    loadResult(analysisRun.id);
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
    resultRef.current.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [result]);

  async function submitSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);
    setResult(null);
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
      setAnalysisRun(normalizeRun(payload.run));
      setStatusMessage('Analisi avviata. Puoi lasciare i dati per ricevere il report via email.');
    } catch (cause) {
      setError(customerSafeError(cause, 'Analisi non avviata.'));
    } finally {
      setBusy(null);
    }
  }

  const analysisReady = Boolean(analysisRun?.ready);
  const canShowContact = Boolean(analysisRun?.id);
  const sourceFailed = analysisRun?.sourceStatus === 'URL_FETCH_FAILED' || analysisRun?.failureCode === 'URL_FETCH_FAILED';
  const showResultLocked = analysisReady && !emailVerified;
  const showVerifiedWaiting = emailVerified && !analysisReady && analysisRun?.status !== 'FAILED';

  return <section className={styles.createShell} aria-label="Analizza gratis il tuo annuncio">
    <form className={styles.form} onSubmit={submitSource} aria-labelledby="analyze-source-title">
      <div className={styles.formHead}>
        <p>Score gratuito</p>
        <h2 id="analyze-source-title">Analizza gratis il tuo annuncio</h2>
      </div>
      <div className={styles.sourceToggle} role="radiogroup" aria-label="Sorgente annuncio">
        <button type="button" data-active={sourceMode === 'PASTED_TEXT'} onClick={() => setSourceMode('PASTED_TEXT')} disabled={busy === 'source'}>Testo</button>
        <button type="button" data-active={sourceMode === 'PUBLIC_URL'} onClick={() => setSourceMode('PUBLIC_URL')} disabled={busy === 'source'}>Link</button>
      </div>
      {sourceMode === 'PASTED_TEXT'
        ? <Field label="Testo annuncio" htmlFor="annunci10x-source-text" required>
            <textarea id="annunci10x-source-text" className={styles.sourceTextarea} data-empty={!text.trim()} required value={text} onChange={(event) => setText(event.target.value)} placeholder="Incolla qui il testo del tuo annuncio" rows={text.trim() ? 10 : 3} disabled={busy === 'source'} />
          </Field>
        : <Field label="URL annuncio" htmlFor="annunci10x-source-url" required>
            <input id="annunci10x-source-url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Incolla il link pubblico dell'annuncio" disabled={busy === 'source'} />
          </Field>}
      <div className={styles.actions}>
        <button type="submit" disabled={busy === 'source'}>{busy === 'source' ? 'Avvio in corso' : 'Analizza il mio annuncio — gratis'}</button>
        {sourceMode === 'PASTED_TEXT' && <button type="button" disabled={busy === 'source'} onClick={() => setText(sampleAd)}>Usa esempio</button>}
      </div>
      <p className={styles.formMicrocopy}>Gratis · 2 minuti · nessuna carta di credito</p>
    </form>

    {analysisRun && <div className={styles.progressCard} aria-live="polite">
      <div>
        <p>Analisi in corso</p>
        <strong>{analysisRun.status === 'FAILED' ? 'Analisi non completata' : analysisRun.progressLabel}</strong>
      </div>
      <div className={styles.progressRail} aria-hidden="true">
        <span data-active="true" />
        <span data-active={analysisRun.ready || emailVerified ? 'true' : 'false'} />
        <span data-active={analysisRun.ready ? 'true' : 'false'} />
      </div>
    </div>}

    {sourceFailed && <div className={styles.warningPanel} role="status">
      <p>Non siamo riusciti a leggere automaticamente questo annuncio.</p>
      <button type="button" onClick={() => setSourceMode('PASTED_TEXT')}>Incolla il testo</button>
    </div>}

    {canShowContact && <Annunci10xIdentityGate
      eyebrow="Report via email"
      title="Dove ti mandiamo il report?"
      description="Ti chiediamo questi dati per collegare il risultato alla tua richiesta e inviarti il report."
      otpTitle="Ti mandiamo un codice di 6 cifre: è l'ultimo passo prima dello Score."
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
        setStatusMessage(resultEligible ? 'Email verificata. Il risultato è pronto.' : 'Email verificata. Stiamo completando l’analisi.');
      }}
    />}

    {showResultLocked && <div className={styles.lockedNotice} role="status"><strong>Il tuo risultato è pronto.</strong><span>Verifica la tua email per visualizzarlo.</span></div>}
    {showVerifiedWaiting && <div className={styles.lockedNotice} role="status"><strong>Email verificata.</strong><span>Stiamo completando l&apos;analisi.</span></div>}
    {analysisRun?.status === 'FAILED' && !sourceFailed && <div className={styles.error} role="alert">Non siamo riusciti a completare l&apos;analisi. Riprova.</div>}
    {statusMessage && <p className={styles.coverageNote} aria-live="polite">{statusMessage}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}

    {result && <div ref={resultRef} tabIndex={-1}><FreeResultCard result={result} offers={commercial?.availableOffers ?? []} commercialStatus={commercialStatus} /></div>}
  </section>;
}

function FreeResultCard({ result, offers, commercialStatus }: { result: FreeResult; offers: Annunci10xCommercialOffer[]; commercialStatus: string | null }) {
  const displayScore = getDisplayScore(result.score);
  const scoreText = formatFreeScore(result.score);
  const activeBandLabel = result.band?.label ?? scoreBandLabelForValue(displayScore);
  const isPartialV2 = result.resultVersion === 'V2' && result.score.coverage < 100;
  const evaluableChecks = Math.round(result.score.coverage / 5);
  const rewriteOffer = offers.find((offer) => offer.offerCode === 'ANNUNCI10X_REWRITE');
  return <section className={styles.result} aria-labelledby="free-result-title">
    <div className={styles.freeResultLayout}>
      <div className={styles.freeScoreHero}>
        <p>Score di chiarezza</p>
        <h2 id="free-result-title">Risultato gratuito</h2>
        <strong>{scoreText}</strong>
        <ScoreBandBar activeLabel={activeBandLabel} />
        <small>Le fasce descrivono chiarezza e completamento delle informazioni disponibili, non la probabilità di assunzione.</small>
      </div>
      <div className={styles.freeResultCopy}>
        <h3>Interpretazione</h3>
        <p>{result.interpretation}</p>
        <p className={styles.disclaimer}>Il punteggio valuta la chiarezza e la completezza delle informazioni disponibili nell’annuncio. Non prevede il numero di candidature né sostituisce la valutazione delle persone.</p>
        {isPartialV2 && <p className={styles.coverageNote}>Abbiamo potuto valutare {evaluableChecks} controlli su 20, perché nel testo mancano alcune informazioni.</p>}
        <section className={styles.improveCta} aria-labelledby="rewrite-offer-title">
          <p>Vuoi trasformarlo?</p>
          <h3 id="rewrite-offer-title">Annuncio 10x — 7 €</h3>
          {rewriteOffer
            ? <CommerceOfferCard offer={rewriteOffer} tone="primary" detail="1 annuncio · 1 versione · 1 canale" />
            : <span>{commercialStatus ?? 'Caricamento offerta in corso.'}</span>}
        </section>
      </div>
    </div>
  </section>;
}

function CommerceOfferCard({ offer, tone, detail }: { offer: Annunci10xCommercialOffer; tone: 'primary' | 'secondary'; detail: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function checkout() {
    if (!offer.purchaseEnabled) return;
    setLoading(true);
    setStatus('Preparazione pagamento…');
    try {
      await startAnnunci10xCheckout(offer.offerCode);
    } catch (cause) {
      setStatus(customerSafeCheckoutError(cause));
      setLoading(false);
    }
  }

  return <article className={styles.offerPanel} data-secondary={tone === 'secondary'}>
    <div className={styles.offerMeta}><strong>{offerPriceLabel(offer)}</strong><span>{detail}</span></div>
    <p>{offer.description}</p>
    <small>Output completo dopo pagamento confermato. Rimborso integrale entro 14 giorni dalla consegna, senza motivazione, scrivendo a info@horyzon.it dall’email usata per l’acquisto.</small>
    <button type="button" onClick={checkout} disabled={!offer.purchaseEnabled || loading}>{loading ? 'Preparazione pagamento…' : checkoutCtaLabel(offer)}</button>
    {status && <span className={styles.offerStatus} aria-live="polite">{status}</span>}
  </article>;
}

function ScoreBandBar({ activeLabel }: { activeLabel?: string }) {
  const labels = ['Critico', 'Debole', 'Buona base', 'Forte', 'Eccellente'];
  return <div className={styles.scoreBandBar} aria-label="Fasce Score">
    {labels.map((label) => {
      const active = activeLabel === label;
      return <span key={label} data-active={active} aria-current={active ? 'true' : undefined}>{label}</span>;
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

function fallbackProgressLabel(stage?: AnalysisStage): string {
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

function formatFreeScore(score: FreeResult['score']): string {
  const value = getDisplayScore(score);
  return value === null ? 'N/D' : `${formatDecimal(value)} / ${score.max}`;
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
