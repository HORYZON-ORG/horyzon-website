"use client";

import Link from 'next/link';
import type { FormEvent, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AuditPipelineState, AuditStreamEvent, FreeAuditResult, ReadinessCoverage } from '@/lib/ai-score/types';

const pipeline: { state: AuditPipelineState; label: string; shortLabel: string }[] = [
  { state: 'queued', label: 'Preparazione analisi', shortLabel: 'Preparazione' },
  { state: 'crawling', label: 'Verifica accessibilità', shortLabel: 'Accessibilità' },
  { state: 'analyzing', label: 'Analisi struttura e contenuti', shortLabel: 'Contenuti' },
  { state: 'visibility_check', label: 'Verifica visibilità', shortLabel: 'AI' },
  { state: 'scoring', label: 'Calcolo risultati', shortLabel: 'Risultato' },
  { state: 'completed', label: 'Risultato gratuito', shortLabel: 'Completato' },
];

const dateFormatter = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' });

export function AiScoreClient() {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<AuditStreamEvent[]>([]);
  const [activeState, setActiveState] = useState<AuditPipelineState | null>(null);
  const [audit, setAudit] = useState<FreeAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const resultRef = useRef<HTMLElement | null>(null);
  const reached = useMemo(() => new Set(events.filter(event => event.type === 'state').map(event => event.state)), [events]);
  const showProgress = (running || events.length > 0 || error) && !audit;

  useEffect(() => {
    if (!audit || !resultRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultRef.current.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [audit]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAudit(null);
    setEvents([]);
    const input = url.trim();
    if (!input) {
      setError('Inserisci un dominio o URL da analizzare.');
      return;
    }
    setRunning(true);
    try {
      const response = await fetch('/api/ai-score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: input }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Audit non avviato.' })) as { error?: string };
        throw new Error(payload.error ?? 'Audit non avviato.');
      }
      if (!response.body) throw new Error('Streaming non disponibile nel browser.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) handleLine(line);
      }
      if (buffer.trim()) handleLine(buffer);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Audit non riuscito.');
      setActiveState('failed');
    } finally {
      setRunning(false);
    }
  }

  function handleLine(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AuditStreamEvent;
    setEvents(previous => [...previous, event]);
    if (event.type === 'state') setActiveState(event.state);
    if (event.type === 'result') {
      setAudit(event.audit);
      setActiveState(event.audit.status);
    }
    if (event.type === 'error') {
      setError(event.message);
      setActiveState('failed');
    }
  }

  return <div className="ai-score-product" aria-live="polite">
    <form className={running ? 'ai-score-form is-running' : 'ai-score-form'} onSubmit={submit}>
      <label htmlFor="ai-score-url">Dominio o URL da analizzare</label>
      <div className="ai-score-input-row">
        <input id="ai-score-url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://azienda.it" inputMode="url" autoComplete="url" disabled={running} aria-describedby="ai-score-help" />
        <button className="button primary" type="submit" disabled={running}>{running ? 'Analisi in corso' : 'Analizza il sito'} <span aria-hidden="true">↗</span></button>
      </div>
      <div className="ai-score-form-meta" id="ai-score-help">
        <span>Analisi gratuita · Nessuna carta richiesta</span>
        <Link href="/ai-score/methodology">Come calcoliamo il punteggio ↗</Link>
      </div>
      <p className="ai-score-disclaimer">Horyzon AI Score utilizza una metodologia proprietaria basata su segnali verificabili.</p>
    </form>

    {showProgress && <AnalysisProgress activeState={activeState} reached={reached} error={error} />}
    {error && <p className="ai-score-error" role="alert">{error}</p>}
    {audit && <AuditResult audit={audit} resultRef={resultRef} />}
  </div>;
}

function AnalysisProgress({ activeState, reached, error }: { activeState: AuditPipelineState | null; reached: Set<AuditPipelineState>; error: string | null }) {
  const activeIndex = activeState ? pipeline.findIndex(step => step.state === activeState) : 0;
  const current = pipeline[Math.max(0, activeIndex)] ?? pipeline[0];

  return <section className="ai-score-progress" aria-label="Stato analisi">
    <div className="ai-score-progress-head">
      <p>{error ? 'Analisi non completata' : 'Analisi in corso'}</p>
      <strong>{error ? 'Controlla il dominio e riprova.' : current.label}</strong>
    </div>
    <ol>
      {pipeline.slice(0, -1).map((step, index) => {
        const done = reached.has(step.state) || (activeIndex > index && activeIndex !== -1);
        const active = activeState === step.state;
        return <li key={step.state} className={done ? 'is-done' : active ? 'is-active' : undefined} aria-current={active ? 'step' : undefined}>
          <span aria-hidden="true" />
          <strong>{step.shortLabel}</strong>
        </li>;
      })}
    </ol>
  </section>;
}

function AuditResult({ audit, resultRef }: { audit: FreeAuditResult; resultRef: RefObject<HTMLElement | null> }) {
  const isPartial = audit.status === 'partial';

  return <section ref={resultRef} className="ai-score-results" aria-labelledby="ai-score-risultato">
    <div className="ai-score-results-head">
      <div>
        <p className="section-kicker">Risultato</p>
        <h2 id="ai-score-risultato">{audit.domain}</h2>
      </div>
      <div className="ai-score-result-meta" aria-label="Dettagli analisi">
        <span>{dateFormatter.format(new Date(audit.analyzedAt))}</span>
        <span>{audit.pagesAnalyzed} pagine</span>
        <span>{audit.signalsAnalyzed} segnali</span>
        <span>{audit.methodologyVersion}</span>
      </div>
      <p className={isPartial ? 'ai-score-status is-partial' : 'ai-score-status'}>{isPartial ? 'Valutazione parziale' : 'Analisi completata'}</p>
    </div>

    <div className="ai-score-score-panel">
      <ReadinessMetric audit={audit} />
      <VisibilityMetric audit={audit} />
      <EvidenceConfidence audit={audit} />
    </div>

    {audit.readinessCoverage && <p className="ai-score-notice">Readiness coverage {audit.readinessCoverage.value}% sui controlli applicabili misurati.</p>}
    {audit.notice && <p className="ai-score-notice">{audit.notice}</p>}
    <p className="ai-score-interpretation">{audit.interpretation}</p>
    <PremiumPreview audit={audit} />
  </section>;
}

function ReadinessMetric({ audit }: { audit: FreeAuditResult }) {
  return <article className="ai-score-metric ai-score-metric-readiness">
    <span className="ai-score-metric-label">AI Readiness</span>
    <ScoreValue score={audit.readiness.score} />
    <strong className="ai-score-metric-state">{readinessSummary(audit.readiness.score, audit.readinessCoverage)}</strong>
    <p>Quanto il sito è predisposto.</p>
    {audit.readinessCoverage && <small>{readinessStateLabel(audit.readiness.state, audit.readinessCoverage)}</small>}
  </article>;
}

function VisibilityMetric({ audit }: { audit: FreeAuditResult }) {
  const measured = audit.visibility.score !== null;

  return <article className="ai-score-metric ai-score-metric-visibility">
    <span className="ai-score-metric-label">AI Visibility</span>
    {measured ? <ScoreValue score={audit.visibility.score} /> : <div className="ai-score-not-measured" aria-label="Not measured">—</div>}
    <strong className="ai-score-metric-state">{measured ? visibilityStateLabel(audit) : 'Non ancora misurata'}</strong>
    <p>Analizziamo la presenza del brand su diverse superfici di ricerca AI.</p>
    {!measured && <small>Misurazione disponibile quando i provider saranno attivati.</small>}
  </article>;
}

function EvidenceConfidence({ audit }: { audit: FreeAuditResult }) {
  return <article className={`ai-score-confidence is-${audit.confidence.label.toLowerCase()}`}>
    <span className="ai-score-metric-label">Evidence confidence</span>
    <strong><i aria-hidden="true" />{audit.confidence.label}</strong>
    <b>{audit.confidence.value}/100</b>
    <p>Quanto sono solide le evidenze disponibili per questa analisi.</p>
  </article>;
}

function PremiumPreview({ audit }: { audit: FreeAuditResult }) {
  return <div className="ai-score-premium">
    <div className="ai-score-opportunities">
      <p className="section-kicker">Analisi completa</p>
      <h3>{audit.opportunities.total} {audit.opportunities.total === 1 ? 'opportunità individuata' : 'opportunità individuate'}</h3>
      <div className="ai-score-severity" aria-label="Conteggio opportunità per severità">
        <span>{audit.opportunities.critical} critiche</span>
        <span>{audit.opportunities.important} importanti</span>
        <span>{audit.opportunities.optimization} ottimizzazioni</span>
      </div>
    </div>
    <div className="ai-score-locked-preview" aria-hidden="true">
      {['Critical', 'High', 'High'].map((severity, index) => <div key={`${severity}-${index}`}>
        <span>{severity}</span>
        <i />
        <i />
      </div>)}
    </div>
    <div className="ai-score-premium-copy">
      <h3>Scopri cosa limita il tuo AI Score</h3>
      <p>Accedi all’analisi completa per vedere controlli, evidenze, priorità e interventi collegati ai problemi rilevati.</p>
      <button className="button ghost-dark" type="button" disabled>Analisi completa in arrivo</button>
    </div>
  </div>;
}

function ScoreValue({ score }: { score: number | null }) {
  if (score === null) return <div className="ai-score-not-measured">—</div>;
  return <div className="ai-score-score-value"><strong>{score}</strong><span>/100</span></div>;
}

function readinessSummary(score: number | null, coverage?: ReadinessCoverage) {
  if (score === null) return 'Not measured';
  if (coverage?.label === 'limited') return 'Coverage limitata';
  if (coverage?.label === 'partial') return 'Buona base, verifica parziale';
  if (score >= 80) return 'Buona predisposizione';
  if (score >= 55) return 'Base migliorabile';
  return 'Priorità di ottimizzazione';
}

function readinessStateLabel(state: string, coverage?: ReadinessCoverage) {
  if (!coverage) return state.replaceAll('_', ' ');
  const label = coverage.label === 'complete' ? 'Valutazione completa' : coverage.label === 'partial' ? 'Valutazione parziale' : 'Coverage limitata';
  return `${label} · ${coverage.value}%`;
}

function visibilityStateLabel(audit: FreeAuditResult) {
  if (audit.visibility.state === 'not_measured') return 'Not measured';
  const planned = audit.visibility.coverageDetail?.plannedPrompts ?? 5;
  const executed = audit.visibility.coverageDetail?.successfulObservations ?? 0;
  return `Quick scan · ${executed}/${planned} query analizzate`;
}
