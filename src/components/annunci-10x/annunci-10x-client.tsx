"use client";

import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './annunci-10x.module.css';

type CheckStatus = 'PASS' | 'PARTIAL' | 'MISSING' | 'CONFLICT' | 'NOT_EVALUABLE';

interface PublicOperation {
  type: string;
  promptVersion: string;
  model: string;
  provider: 'MOCK' | 'OPENAI';
  latencyMs: number;
  totalTokens?: number | null;
  providerRequestId?: string | null;
  idempotencyHit: boolean;
}

interface PublicResult {
  sessionId: string;
  evaluationId: string;
  score: {
    value: number | null;
    minScore?: number;
    maxScore?: number;
    interval?: { min: number; max: number };
    coverage: number;
    checks: { id: string; label: string; status: CheckStatus; score: number | null; maxScore: number; evidence: string[] }[];
  };
  gate: { status: string; blockingReasons: string[]; warnings: string[] };
  roleSummary: { title: string; location: string; workMode: string; contractType: string; missingFacts: string[] };
  strengths: string[];
  priorities: string[];
  clarification?: { id: string; targetPath: string; question: string; reason: string; blocking: boolean; canSkip: boolean } | null;
  operations: PublicOperation[];
  provider: 'MOCK' | 'OPENAI';
  analyzedAt: string;
}

interface ResumePayload {
  ok: boolean;
  session: { id: string; entryMode: string } | null;
  snapshot?: { id: string; version: number; roleTitle: string | null; createdAt: string } | null;
  evaluation?: { id: string; score: PublicResult['score']; gate: PublicResult['gate']; createdAt: string } | null;
}

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
  const [rawAdText, setRawAdText] = useState('');
  const [roleHint, setRoleHint] = useState('');
  const [companyHint, setCompanyHint] = useState('');
  const [result, setResult] = useState<PublicResult | null>(null);
  const [resume, setResume] = useState<ResumePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const resultRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetch('/api/annunci-10x/session/resume', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: ResumePayload) => setResume(payload))
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

  return <div className={styles.experience}>
    <section className={styles.productGrid} aria-label="Percorsi Annunci 10x">
      <article className={styles.pathPanel}>
        <span>01</span>
        <h2>Analizza gratis</h2>
        <p>Valuta un annuncio esistente con score, copertura, priorita e chiarimenti mirati.</p>
      </article>
      <article className={styles.pathPanel}>
        <span>02</span>
        <h2>Crea da zero</h2>
        <p>Preparazione guidata in sei macro-step. In arrivo, senza checkout in questa fase.</p>
      </article>
      <article className={styles.pathPanel}>
        <span>03</span>
        <h2>Guida Annunci 10x</h2>
        <p>Prodotto standalone previsto. Prezzi e acquisto restano decisione aperta lato server.</p>
      </article>
    </section>

    {resume?.session && <aside className={styles.resume} aria-label="Sessione precedente">
      <strong>Sessione trovata</strong>
      <p>{resume.snapshot ? `Ultima scheda: ${resume.snapshot.roleTitle ?? 'ruolo da chiarire'} · v${resume.snapshot.version}` : 'Sessione iniziata, nessuna analisi salvata.'}</p>
      {resume.evaluation && <p>Ultima valutazione: {resume.evaluation.score.value ?? `${resume.evaluation.score.interval?.min ?? 'N/D'}-${resume.evaluation.score.interval?.max ?? 'N/D'}`}/100 · {resume.evaluation.gate.status}</p>}
    </aside>}

    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formHead}>
        <p>Analisi gratuita</p>
        <h2>Incolla un annuncio da verificare</h2>
      </div>
      <label htmlFor="annunci10x-ad">Testo annuncio</label>
      <textarea id="annunci10x-ad" value={rawAdText} onChange={(event) => setRawAdText(event.target.value)} placeholder={sampleAd} rows={12} disabled={running} aria-describedby="annunci10x-ad-help" />
      <p id="annunci10x-ad-help" className={styles.help}>Il testo incollato viene trattato come contenuto utente non attendibile, mai come istruzioni per il sistema.</p>
      <div className={styles.inlineFields}>
        <label>Ruolo, se vuoi precisarlo<input value={roleHint} onChange={(event) => setRoleHint(event.target.value)} disabled={running} placeholder="Es. Customer care specialist" /></label>
        <label>Azienda, opzionale<input value={companyHint} onChange={(event) => setCompanyHint(event.target.value)} disabled={running} placeholder="Nome azienda" /></label>
      </div>
      <div className={styles.actions}>
        <button type="submit" disabled={running}>{running ? 'Analisi in corso' : 'Analizza gratis'}</button>
        <button type="button" disabled={running} onClick={() => setRawAdText(sampleAd)}>Usa esempio</button>
      </div>
      {running && <Progress activeStage={activeStage} />}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>

    {result && <section className={styles.result} ref={resultRef} tabIndex={-1} aria-labelledby="annunci10x-result-title">
      <div className={styles.resultHead}>
        <div>
          <p>Risultato analisi</p>
          <h2 id="annunci10x-result-title">{result.roleSummary.title}</h2>
        </div>
        <div className={styles.scoreBox}>
          <span>Score</span>
          <strong>{scoreLabel}</strong>
          <small>Coverage {result.score.coverage}%</small>
        </div>
        <div className={styles.gateBox}>
          <span>Pubblicazione</span>
          <strong>{result.gate.status.replaceAll('_', ' ')}</strong>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <Metric label="Sede" value={result.roleSummary.location} />
        <Metric label="Modalita" value={result.roleSummary.workMode} />
        <Metric label="Contratto" value={result.roleSummary.contractType} />
        <Metric label="Provider" value={result.provider} />
      </div>

      <div className={styles.columns}>
        <Panel title="Punti forti" items={result.strengths} empty="Nessun punto forte solido ancora." />
        <Panel title="Tre priorita" items={result.priorities} empty="Nessuna priorita rilevata." />
      </div>

      {result.clarification && <div className={styles.clarification}>
        <p>Chiarimento utile</p>
        <h3>{result.clarification.question}</h3>
        <small>{result.clarification.reason}</small>
        <label htmlFor="annunci10x-clarification">Risposta</label>
        <textarea id="annunci10x-clarification" rows={3} value={clarificationAnswer} onChange={(event) => setClarificationAnswer(event.target.value)} disabled={running} />
        <div className={styles.actions}>
          <button type="button" onClick={() => answerClarification(false)} disabled={running}>Aggiorna analisi</button>
          <button type="button" onClick={() => answerClarification(true)} disabled={running}>Non lo so</button>
        </div>
      </div>}

      <details className={styles.details}>
        <summary>Vedi i 20 controlli</summary>
        <div className={styles.checks}>
          {result.score.checks.map((check) => <article key={check.id}>
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
          {result.operations.map((operation) => <article key={`${operation.type}-${operation.promptVersion}`}>
            <strong>{operation.type}</strong>
            <span>{operation.promptVersion}</span>
            <span>{operation.model}</span>
            <span>{operation.latencyMs} ms</span>
            <span>{operation.totalTokens ?? 'N/D'} token</span>
          </article>)}
        </div>
      </details>

      <section className={styles.offers} aria-label="Prossimi passi">
        <article><h3>Guida Annunci 10x</h3><p>Standalone previsto. Prezzo non definito in questa fase.</p><button type="button" disabled>In preparazione</button></article>
        <article><h3>Generazione annuncio</h3><p>Richiedera entitlement server-side. Nessun checkout attivo ora.</p><button type="button" disabled>Bloccato</button></article>
        <article><h3>Bundle</h3><p>Guida piu generazione, se abilitato in futuro lato server.</p><button type="button" disabled>Open decision</button></article>
      </section>
    </section>}
  </div>;
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
