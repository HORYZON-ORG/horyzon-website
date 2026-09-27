"use client";

import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './annunci-10x.module.css';

type SourceMode = 'PASTED_TEXT' | 'PUBLIC_URL';
type AnalysisStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
type AnalysisStage = 'SOURCE_VALIDATION' | 'PRECHECK' | 'EXTRACT' | 'PROFILE' | 'STRATEGY' | 'EVALUATE' | 'CLARIFY' | 'COMPLETE';
type BusinessRole = 'OWNER_ENTREPRENEUR' | 'HR' | 'INTERNAL_RECRUITER' | 'CONSULTANT' | 'OTHER';

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

export function Annunci10xAnalyzeFlow() {
  const [sourceMode, setSourceMode] = useState<SourceMode>('PASTED_TEXT');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [analysisRun, setAnalysisRun] = useState<AnalysisRunState | null>(null);
  const [contact, setContact] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    businessRole: 'HR' as BusinessRole,
    email: '',
    marketingConsent: false,
  });
  const [contactSaved, setContactSaved] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0);
  const [expiresInSeconds, setExpiresInSeconds] = useState(0);
  const [result, setResult] = useState<FreeResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const resultFetchRef = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const loadResult = useCallback(async (id: string) => {
    setBusy('result');
    try {
      const response = await fetch(`/api/annunci-10x/analysis/${id}/result`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Risultato non disponibile.');
      setResult(payload.result);
    } catch (cause) {
      resultFetchRef.current = null;
      setError(customerSafeError(cause, 'Risultato non disponibile.'));
    } finally {
      setBusy(null);
    }
  }, []);

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
    if (!result || !resultRef.current) return;
    resultRef.current.focus({ preventScroll: true });
    resultRef.current.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [result]);

  useEffect(() => {
    if (resendAfterSeconds <= 0 && expiresInSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendAfterSeconds((value) => Math.max(0, value - 1));
      setExpiresInSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAfterSeconds, expiresInSeconds]);

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

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy('contact');
    try {
      const response = await fetch('/api/annunci-10x/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(contact),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Dati non salvati.');
      setContactSaved(true);
      setEmailVerified(Boolean(payload.emailVerified));
      setAnalysisRun((current) => current ? { ...current, contactSaved: true, emailVerified: Boolean(payload.emailVerified), resultEligible: current.ready && Boolean(payload.emailVerified) } : current);
    } catch (cause) {
      setError(customerSafeError(cause, 'Dati non salvati.'));
    } finally {
      setBusy(null);
    }
  }

  async function requestCode() {
    setError(null);
    setBusy('request-code');
    try {
      const response = await fetch('/api/annunci-10x/email-verification/request', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.code ?? payload.error?.message ?? 'EMAIL_PROVIDER_UNAVAILABLE');
      setResendAfterSeconds(Number(payload.resendAfterSeconds ?? 0));
      setExpiresInSeconds(Number(payload.expiresInSeconds ?? 0));
      setStatusMessage(payload.sent ? 'Codice inviato.' : `Puoi richiedere un nuovo codice tra ${Number(payload.resendAfterSeconds ?? 0)} secondi.`);
    } catch (cause) {
      setError(customerSafeError(cause, 'La verifica email è temporaneamente non disponibile.'));
    } finally {
      setBusy(null);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!analysisRun?.id) return;
    setError(null);
    setBusy('verify-code');
    try {
      const response = await fetch('/api/annunci-10x/email-verification/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: otpCode, analysisRunId: analysisRun.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Codice non valido.');
      setEmailVerified(true);
      setAnalysisRun((current) => current ? { ...current, emailVerified: true, resultEligible: Boolean(payload.resultEligible) } : current);
      setStatusMessage(payload.resultEligible ? 'Email verificata. Il risultato è pronto.' : 'Email verificata. Stiamo completando l’analisi.');
    } catch (cause) {
      setError(customerSafeError(cause, 'Codice non valido.'));
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

    {canShowContact && <form className={styles.form} onSubmit={submitContact} aria-labelledby="analyze-contact-title">
      <div className={styles.formHead}>
        <p>Report via email</p>
        <h2 id="analyze-contact-title">Dove ti mandiamo il report?</h2>
        <span>Ti chiediamo questi dati per collegare il risultato alla tua richiesta e inviarti il report.</span>
      </div>
      <div className={styles.fieldGrid}>
        <Field label="Nome" htmlFor="lead-first-name" required><input id="lead-first-name" required value={contact.firstName} onChange={(event) => setContact({ ...contact, firstName: event.target.value })} disabled={contactSaved || busy === 'contact'} /></Field>
        <Field label="Cognome" htmlFor="lead-last-name" required><input id="lead-last-name" required value={contact.lastName} onChange={(event) => setContact({ ...contact, lastName: event.target.value })} disabled={contactSaved || busy === 'contact'} /></Field>
        <Field label="Azienda" htmlFor="lead-company" required><input id="lead-company" required value={contact.companyName} onChange={(event) => setContact({ ...contact, companyName: event.target.value })} disabled={contactSaved || busy === 'contact'} /></Field>
        <Field label="Ruolo aziendale" htmlFor="lead-role" required><select id="lead-role" required value={contact.businessRole} onChange={(event) => setContact({ ...contact, businessRole: event.target.value as BusinessRole })} disabled={contactSaved || busy === 'contact'}><option value="OWNER_ENTREPRENEUR">Titolare</option><option value="HR">HR</option><option value="INTERNAL_RECRUITER">Recruiter interno</option><option value="CONSULTANT">Consulente</option><option value="OTHER">Altro</option></select></Field>
      </div>
      <Field label="Email aziendale" htmlFor="lead-email" required><input id="lead-email" type="email" required value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} disabled={contactSaved || busy === 'contact'} /></Field>
      <label className={styles.unknownToggle}><input type="checkbox" checked={contact.marketingConsent} onChange={(event) => setContact({ ...contact, marketingConsent: event.target.checked })} disabled={contactSaved || busy === 'contact'} /><span>Voglio ricevere anche consigli e novità da Horyzon.</span></label>
      <p className={styles.formMicrocopy}>Niente spam. Ti cancelli con un clic.</p>
      <div className={styles.actions}><button type="submit" disabled={contactSaved || busy === 'contact'}>{contactSaved ? 'Dati salvati' : 'Salva contatto'}</button></div>
    </form>}

    {contactSaved && !emailVerified && <section className={styles.form} aria-labelledby="email-verification-title">
      <div className={styles.formHead}><p>Verifica email</p><h2 id="email-verification-title">Ti mandiamo un codice di 6 cifre: è l&apos;ultimo passo prima dello Score.</h2></div>
      <div className={styles.actions}>
        <button type="button" onClick={requestCode} disabled={busy === 'request-code' || resendAfterSeconds > 0}>{resendAfterSeconds > 0 ? `Nuovo codice tra ${resendAfterSeconds}s` : 'Invia codice'}</button>
        {expiresInSeconds > 0 && <span>Codice valido per circa {expiresInSeconds}s.</span>}
      </div>
      <form onSubmit={verifyCode} className={styles.inlineVerify}>
        <Field label="Codice OTP" htmlFor="lead-otp" required><input id="lead-otp" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={otpCode} onChange={(event) => setOtpCode(event.target.value)} disabled={busy === 'verify-code'} /></Field>
        <button type="submit" disabled={busy === 'verify-code' || otpCode.length !== 6}>Verifica email</button>
      </form>
    </section>}

    {showResultLocked && <div className={styles.lockedNotice} role="status"><strong>Il tuo risultato è pronto.</strong><span>Verifica la tua email per visualizzarlo.</span></div>}
    {showVerifiedWaiting && <div className={styles.lockedNotice} role="status"><strong>Email verificata.</strong><span>Stiamo completando l&apos;analisi.</span></div>}
    {analysisRun?.status === 'FAILED' && !sourceFailed && <div className={styles.error} role="alert">Non siamo riusciti a completare l&apos;analisi. Riprova.</div>}
    {statusMessage && <p className={styles.coverageNote} aria-live="polite">{statusMessage}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}

    {result && <div ref={resultRef} tabIndex={-1}><FreeResultCard result={result} /></div>}
  </section>;
}

function FreeResultCard({ result }: { result: FreeResult }) {
  const scoreText = formatFreeScore(result.score);
  const isPartialV2 = result.resultVersion === 'V2' && result.score.coverage < 100;
  const evaluableChecks = Math.round(result.score.coverage / 5);
  return <section className={styles.result} aria-labelledby="free-result-title">
    <div className={styles.freeResultLayout}>
      <div className={styles.freeScoreHero}>
        <p>Annunci 10x Score</p>
        <h2 id="free-result-title">Risultato gratuito</h2>
        <strong>{scoreText}</strong>
        {result.band && <span>{result.band.label}</span>}
        <ScoreBandBar activeLabel={result.band?.label} />
      </div>
      <div className={styles.freeResultCopy}>
        <h3>Interpretazione</h3>
        <p>{result.interpretation}</p>
        {isPartialV2 && <p className={styles.coverageNote}>Abbiamo potuto valutare {evaluableChecks} controlli su 20, perché nel testo mancano alcune informazioni.</p>}
        <section className={styles.improveCta}><p>Prossimo passo</p><h3>{result.nextAction.label}</h3><span>Potrai trasformare il testo in una versione più chiara e pronta da adattare al canale.</span></section>
      </div>
    </div>
  </section>;
}

function ScoreBandBar({ activeLabel }: { activeLabel?: string }) {
  const labels = ['Critico', 'Debole', 'Buona base', 'Forte', 'Eccellente'];
  return <div className={styles.scoreBandBar} aria-label="Fasce Score">{labels.map((label) => <span key={label} data-active={activeLabel === label}>{label}</span>)}</div>;
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

function formatFreeScore(score: FreeResult['score']): string {
  if (typeof score.value === 'number') return `${formatDecimal(score.value)} / ${score.max}`;
  if (score.range) return `${formatDecimal(score.range.min)}-${formatDecimal(score.range.max)} / ${score.max}`;
  return 'N/D';
}

function formatDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

function customerSafeError(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : fallback;
  if (/EMAIL_PROVIDER_UNAVAILABLE|EMAIL_VERIFICATION_UNAVAILABLE|provider email|verifica email/i.test(message)) return 'La verifica email è temporaneamente non disponibile.';
  return message || fallback;
}
