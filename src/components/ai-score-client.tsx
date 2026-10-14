"use client";

import Link from 'next/link';
import type { FormEvent, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AiScoreReport } from './ai-score-report';
import { exportReport, importReport, isReport, MAX_REPORTS, REPORT_ARCHIVE_KEY, readReports, saveReport, writeReports } from '@/lib/ai-score/report-archive';
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
const archiveEvent = 'ai-score-archive-change';
function subscribeArchive(callback: () => void) {
  window.addEventListener('storage', callback); window.addEventListener(archiveEvent, callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(archiveEvent, callback); };
}
function archiveSnapshot() {
  try { return window.localStorage.getItem(REPORT_ARCHIVE_KEY) ?? ''; }
  catch { return 'unavailable'; }
}
function subscribeHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}
const emptySnapshot = () => '';
const hashSnapshot = () => window.location.search;

export function AiScoreClient() {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<AuditStreamEvent[]>([]);
  const [activeState, setActiveState] = useState<AuditPipelineState | null>(null);
  const [currentAudit, setAudit] = useState<FreeAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const storedJson = useSyncExternalStore(subscribeArchive, archiveSnapshot, emptySnapshot);
  const { reports, error: archiveError } = useMemo(() => readReports({ getItem: () => storedJson, setItem: () => {} }), [storedJson]);
  const hash = useSyncExternalStore(subscribeHash, hashSnapshot, emptySnapshot);
  const requestedReportId = new URLSearchParams(hash).get('report');
  const archivedReport = reports.find(item => item.auditId === requestedReportId);
  const audit = currentAudit ?? archivedReport ?? null;
  const [archiveMessage, setArchiveMessage] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const showDetails = detailsOpen || Boolean(!currentAudit && archivedReport);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  const requestRef=useRef<AbortController|null>(null);
  const reached = useMemo(() => new Set(events.filter(event => event.type === 'state').map(event => event.state)), [events]);
  const showProgress = (running || events.length > 0 || error) && !audit;

  useEffect(() => {
    if (!audit || !resultRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultRef.current.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [audit]);

  useEffect(()=>()=>requestRef.current?.abort(),[]);
  useEffect(() => {
    if (showDetails && detailRef.current) {
      detailRef.current.focus({ preventScroll: true });
      detailRef.current.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }, [showDetails]);

  function preserveReport(report: FreeAuditResult) {
    try {
      const saved = saveReport(window.localStorage, report);
      window.dispatchEvent(new Event(archiveEvent));
      setArchiveMessage(saved.error ?? 'Report salvato in questo browser.');
    } catch { setArchiveMessage('Salvataggio nel browser non disponibile. Esporta il report per conservarlo.'); }
  }
  function reopenReport(report: FreeAuditResult) {
    setAudit(report); setDetailsOpen(true); setError(null); setEvents([]);
    const address = new URL(window.location.href); address.searchParams.set('report', report.auditId); address.hash = '';
    window.history.replaceState(null, '', address);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  function downloadReport() {
    if (!audit) return;
    const blob = new Blob([exportReport(audit)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href; anchor.download = `ai-score-${audit.domain.replace(/[^a-zA-Z0-9.-]/g, '-')}-${audit.auditId}.json`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(requestRef.current)return;
    setError(null);
    setAudit(null);
    setDetailsOpen(false);
    const address = new URL(window.location.href); address.searchParams.delete('report'); address.hash = '';
    window.history.replaceState(null, '', address);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    setEvents([]);
    const input = url.trim();
    if (!input) {
      setError('Inserisci un dominio o URL da analizzare.');
      return;
    }
    setRunning(true);
    const controller=new AbortController();requestRef.current=controller;
    const timeout=setTimeout(()=>controller.abort(),60000);
    let terminal=false;
    try {
      const response = await fetch('/api/ai-score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: input }),
        signal:controller.signal,
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
        if(buffer.length>1000000)throw new Error('Risposta troppo grande. Analisi interrotta.');
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) terminal=handleLine(line)||terminal;
      }
      if (buffer.trim()) terminal=handleLine(buffer)||terminal;
      if(!terminal)throw new Error('La risposta è stata interrotta prima del risultato. Riprova tra poco.');
    } catch (cause) {
      setError(controller.signal.aborted?'Analisi interrotta o tempo massimo raggiunto. Riprova tra poco.':cause instanceof Error ? cause.message : 'Audit non riuscito.');
      setActiveState('failed');
    } finally {
      clearTimeout(timeout);requestRef.current=null;
      setRunning(false);
    }
  }

  function handleLine(line: string) {
    if (!line.trim()) return false;
    const event = JSON.parse(line) as AuditStreamEvent;
    if(!event||!['state','result','error'].includes(event.type))throw new Error('Risposta di analisi non valida. Riprova tra poco.');
    setEvents(previous => [...previous, event]);
    if (event.type === 'state') setActiveState(event.state);
    if (event.type === 'result') {
      if(!isReport(event.audit))throw new Error('Risultato di analisi non valido.');
      setAudit(event.audit);
      preserveReport(event.audit);
      const address = new URL(window.location.href); address.searchParams.set('report', event.audit.auditId); address.hash = '';
      window.history.replaceState(null, '', address);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      setActiveState(event.audit.status);
    }
    if (event.type === 'error') {
      setError(event.message);
      setActiveState('failed');
    }
    return event.type==='result'||event.type==='error';
  }

  return <div id="ai-score-audit" className="ai-score-product" aria-live="polite">
    <form className={running ? 'ai-score-form is-running' : 'ai-score-form'} onSubmit={submit}>
      <label htmlFor="ai-score-url">Dominio o URL da analizzare</label>
      <div className="ai-score-input-row">
        <input id="ai-score-url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://azienda.it" inputMode="url" autoComplete="url" disabled={running} aria-invalid={Boolean(error)} aria-describedby={error?'ai-score-help ai-score-error':'ai-score-help'} />
        <button className="rd-cta ai-score-submit" type="submit" disabled={running}>{running ? 'Analisi in corso' : 'Analizza il sito'} <span aria-hidden="true">↗︎</span></button>
      </div>
      <div className="ai-score-form-meta" id="ai-score-help">
        <span>Analisi gratuita · Nessuna carta richiesta</span>
        <Link href="/ai-score/methodology">Come calcoliamo il punteggio ↗︎</Link>
      </div>
      <p className="ai-score-disclaimer">Horyzon AI Score utilizza una metodologia proprietaria basata su segnali verificabili.</p>
    </form>

    {showProgress && <AnalysisProgress activeState={activeState} reached={reached} error={error} />}
    {error && <p id="ai-score-error" className="ai-score-error" role="alert">{error}</p>}
    <section className="ai-report-archive" aria-labelledby="ai-report-archive-title">
      <header><h2 id="ai-report-archive-title">I tuoi report salvati</h2><p>Conserviamo fino a {MAX_REPORTS} report recenti in questo browser, nei limiti dello spazio disponibile. Per portarli su un altro dispositivo, esporta e importa il file. Cancellando i dati del browser si perde l’archivio locale.</p></header>
      <label className="ai-report-import">Importa un report<input type="file" accept=".json,application/json" disabled={running} onChange={async event => {
        const input = event.currentTarget; const file = input.files?.[0]; if (!file) return;
        try { if (file.size > 1_500_000) throw new Error('File troppo grande. Il limite è 1,5 MB.'); const report = importReport(await file.text()); preserveReport(report); reopenReport(report); }
        catch (cause) { setArchiveMessage(cause instanceof Error ? cause.message : 'Importazione non riuscita.'); }
        finally { input.value = ''; }
      }} /></label>
      {archiveMessage && <p role="status">{archiveMessage}</p>}
      {archiveError && <p role="status">{archiveError}</p>}
      {requestedReportId && !archivedReport && <p role="status">Questo report non è presente in questo browser. Puoi importare il file esportato; non avviamo una nuova scansione.</p>}
      {!reports.length && <p>Le nuove analisi saranno salvate qui. Nessuna ricerca viene avviata aprendo un report.</p>}
      <ul>{reports.map(report => <li key={report.auditId}><button type="button" disabled={running} onClick={() => reopenReport(report)}><strong>{report.domain}</strong><span>{dateFormatter.format(new Date(report.analyzedAt))}{!report.details && ' · Solo riepilogo'}</span></button><button className="ai-report-remove" type="button" disabled={running} aria-label={`Elimina il report di ${report.domain} del ${dateFormatter.format(new Date(report.analyzedAt))}`} onClick={() => {
        try { const saved = writeReports(window.localStorage, reports.filter(item => item.auditId !== report.auditId)); if (saved.error) setArchiveMessage(saved.error); else { window.dispatchEvent(new Event(archiveEvent)); setArchiveMessage('Report eliminato dall’archivio locale.'); } }
        catch { setArchiveMessage('Impossibile aggiornare l’archivio del browser.'); }
      }}>Elimina</button></li>)}</ul>
    </section>
    {audit && <>
      <AuditResult audit={audit} resultRef={resultRef} detailsOpen={showDetails} onDetails={() => { setAudit(audit); setDetailsOpen(!showDetails); }} onExport={downloadReport} />
      {showDetails && <div id="ai-score-details" ref={detailRef} tabIndex={-1}><AiScoreReport key={audit.auditId} audit={audit} /></div>}
    </>}
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

function AuditResult({ audit, resultRef, detailsOpen, onDetails, onExport }: { audit: FreeAuditResult; resultRef: RefObject<HTMLElement | null>; detailsOpen: boolean; onDetails: () => void; onExport: () => void }) {
  const isPartial = audit.status === 'partial';

  return <section ref={resultRef} className="ai-score-results" aria-labelledby="ai-score-risultato">
    <div className="ai-score-results-head">
      <div>
        <p className="section-kicker">Risultato</p>
        <h2 id="ai-score-risultato">{audit.domain}</h2>
      </div>
      <div className="ai-score-result-meta" aria-label="Dettagli analisi">
        <span>{dateFormatter.format(new Date(audit.analyzedAt))}</span>
        <span>{audit.pagesAnalyzed} {audit.pagesAnalyzed === 1 ? 'pagina' : 'pagine'}</span>
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
    {audit.visibility.blocker && <p className="ai-score-notice">{audit.visibility.blocker}</p>}
    <p className="ai-score-interpretation">{audit.interpretation}</p>
    <DetailEntry audit={audit} open={detailsOpen} onDetails={onDetails} onExport={onExport} />
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
    {!measured && <small>Servono osservazioni verificabili e un servizio disponibile entro i limiti della scansione.</small>}
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

function DetailEntry({ audit, open, onDetails, onExport }: { audit: FreeAuditResult; open: boolean; onDetails: () => void; onExport: () => void }) {
  return <div className="ai-score-detail-entry">
    <div className="ai-score-opportunities">
      <p className="section-kicker">Dalle evidenze agli interventi</p>
      <h3>{audit.opportunities.total} {audit.opportunities.total === 1 ? 'opportunità individuata' : 'opportunità individuate'}</h3>
      <div className="ai-score-severity" aria-label="Conteggio opportunità per severità">
        <span>{audit.opportunities.critical} critiche</span>
        <span>{audit.opportunities.important} importanti</span>
        <span>{audit.opportunities.optimization} ottimizzazioni</span>
      </div>
    </div>
    <div className="ai-score-premium-copy">
      <h3>Scopri cosa limita il tuo AI Score</h3>
      <p>Leggi controlli, evidenze e priorità già raccolti. Il report indica anche le parti non misurate, senza avviare altre scansioni.</p>
      <div className="ai-report-actions"><button className="button ghost-dark" type="button" aria-expanded={open} aria-controls="ai-score-details" onClick={onDetails}>{open ? 'Chiudi analisi dettagliata' : 'Vedi analisi dettagliata'}</button><button className="button ghost-dark" type="button" onClick={onExport}>Esporta report</button></div>
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
