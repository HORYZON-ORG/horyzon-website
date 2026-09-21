"use client";

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import type { AuditPipelineState, AuditStreamEvent, FreeAuditResult } from '@/lib/ai-score/types';

const pipeline: { state: AuditPipelineState; label: string }[] = [
  { state: 'queued', label: 'Preparazione analisi' },
  { state: 'crawling', label: 'Verifica accessibilita' },
  { state: 'analyzing', label: 'Analisi struttura e contenuti' },
  { state: 'visibility_check', label: 'Verifica visibilita' },
  { state: 'scoring', label: 'Calcolo risultati' },
  { state: 'completed', label: 'Risultato gratuito' },
];

export function AiScoreClient() {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<AuditStreamEvent[]>([]);
  const [activeState, setActiveState] = useState<AuditPipelineState | null>(null);
  const [audit, setAudit] = useState<FreeAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const reached = useMemo(() => new Set(events.filter(event => event.type === 'state').map(event => event.state)), [events]);

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
    <form className="ai-score-form" onSubmit={submit}>
      <label htmlFor="ai-score-url">Dominio o URL da analizzare</label>
      <div className="ai-score-input-row">
        <input id="ai-score-url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://azienda.it" inputMode="url" autoComplete="url" disabled={running} />
        <button className="button primary" type="submit" disabled={running}>{running ? 'Analisi in corso' : 'Analizza il sito'} <span aria-hidden="true">↗</span></button>
      </div>
      <p>Analisi gratuita · Nessuna carta richiesta</p>
    </form>

    {(running || events.length > 0 || error) && <section className="ai-score-progress" aria-label="Stato analisi">
      {pipeline.map((step, index) => {
        const done = reached.has(step.state) || Boolean(audit && pipeline.findIndex(item => item.state === step.state) <= pipeline.findIndex(item => item.state === audit.status));
        const active = activeState === step.state;
        return <div key={step.state} className={done ? 'is-done' : active ? 'is-active' : undefined}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <strong>{step.label}</strong>
        </div>;
      })}
      {activeState === 'partial' && <div className="is-done"><span>!</span><strong>Analisi parziale completata</strong></div>}
      {activeState === 'failed' && <div className="is-failed"><span>!</span><strong>Analisi non completata</strong></div>}
    </section>}

    {error && <p className="ai-score-error" role="alert">{error}</p>}
    {audit && <AuditResult audit={audit} />}
  </div>;
}

function AuditResult({ audit }: { audit: FreeAuditResult }) {
  return <section className="ai-score-results" aria-labelledby="ai-score-risultato">
    <div className="ai-score-results-head">
      <p className="section-kicker">Risultato gratuito</p>
      <h2 id="ai-score-risultato">Horyzon AI Score</h2>
      <dl>
        <div><dt>Dominio</dt><dd>{audit.domain}</dd></div>
        <div><dt>Analisi</dt><dd>{new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(audit.analyzedAt))}</dd></div>
        <div><dt>Metodo</dt><dd>{audit.methodologyVersion}</dd></div>
      </dl>
    </div>
    <div className="ai-score-metrics">
      <Metric title="AI Readiness" value={formatScore(audit.readiness.score)} text="Quanto il sito e predisposto." state={audit.readiness.state} />
      <Metric title="AI Visibility" value={audit.visibility.score === null ? 'Not measured' : formatScore(audit.visibility.score)} text="Quanto appare realmente nelle risposte AI." state={audit.visibility.state} />
      <Metric title="Evidence confidence" value={audit.confidence.label} text="Quanto sono solide le evidenze disponibili per questa analisi." state={`${audit.confidence.value}/100`} />
    </div>
    {audit.notice && <p className="ai-score-notice">{audit.notice}</p>}
    <p className="ai-score-interpretation">{audit.interpretation}</p>
    <div className="ai-score-premium">
      <div>
        <p className="section-kicker">Analisi completa</p>
        <h3>{audit.opportunities.total > 0 ? `Abbiamo individuato ${audit.opportunities.total} opportunita di miglioramento` : 'Nessuna opportunita deterministica nel risultato gratuito'}</h3>
        <div className="ai-score-severity" aria-label="Conteggio opportunita per severita">
          <span>{audit.opportunities.critical} critiche</span>
          <span>{audit.opportunities.important} importanti</span>
          <span>{audit.opportunities.optimization} ottimizzazioni</span>
        </div>
      </div>
      <div>
        <h3>Scopri cosa limita il tuo AI Score</h3>
        <p>Accedi all’analisi completa per capire perche hai ottenuto questi risultati, quali problemi sono stati rilevati e quali interventi possono avere maggiore impatto.</p>
        <button className="button ghost-dark" type="button" disabled>Sblocca l’analisi completa</button>
        <small>Prezzi e pagamento saranno gestiti da configurazione/backend. Stato attuale: locked.</small>
      </div>
    </div>
  </section>;
}

function Metric({ title, value, text, state }: { title: string; value: string; text: string; state: string }) {
  return <article>
    <span>{title}</span>
    <strong>{value}</strong>
    <p>{text}</p>
    <small>{state.replace('_', ' ')}</small>
  </article>;
}

function formatScore(score: number | null) {
  return score === null ? 'Not measured' : `${score}/100`;
}
