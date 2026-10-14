"use client";

import { useState } from 'react';
import { priorityItems, reportLimits, safeSourceUrl } from '@/lib/ai-score/report';
import type { AuditCheck, AuditEvidence, FreeAuditResult } from '@/lib/ai-score/types';

const statusLabels = { pass: 'Superato', partial: 'Da migliorare', fail: 'Problema rilevato', unknown: 'Non misurato', not_applicable: 'Non applicabile' };
const priorityLabels = { critical: 'Critica', important: 'Importante', optimization: 'Ottimizzazione' };
const verificationLabels = { direct: 'Osservazione diretta', derived: 'Dato derivato', heuristic: 'Valutazione indicativa', external: 'Fonte esterna', provider: 'Risposta AI', not_measured: 'Non misurata' };

function SourceLink({ url, children }: { url?: string; children?: React.ReactNode }) {
  const safe = safeSourceUrl(url);
  return safe ? <a href={safe} target="_blank" rel="noopener noreferrer">{children ?? safe}</a> : <span>{children ?? url}</span>;
}

function EvidenceList({ evidence }: { evidence: AuditEvidence[] }) {
  return evidence.length ? <ul className="ai-report-evidence">{evidence.map((item, index) => <li key={`${item.id ?? item.label}-${index}`}>
    <strong>{item.label}</strong>
    <p>{item.value}</p>
    {item.excerpt && item.excerpt !== item.value && <blockquote>{item.excerpt}</blockquote>}
    <small>{item.verificationLevel ? verificationLabels[item.verificationLevel] : item.verification === 'inferred' ? 'Dato inferito' : 'Evidenza raccolta'}</small>
    {item.sourceUrl && <SourceLink url={item.sourceUrl} />}
  </li>)}</ul> : <p>Nessuna evidenza disponibile per questo controllo.</p>;
}

function CheckRow({ check }: { check: AuditCheck }) {
  const status = !check.measured && check.status !== 'not_applicable' ? 'unknown' : check.status;
  return <details className="ai-report-check">
    <summary><strong>{check.label}</strong><span className={`ai-report-badge is-${status}`}>{statusLabels[status]}</span></summary>
    <div className="ai-report-check-body">
      <p>{check.measured ? `${check.pointsEarned} punti ottenuti su ${check.pointsAvailable} disponibili nel controllo. I punti non sono un aumento previsto del punteggio finale.` : status === 'not_applicable' ? 'Questo controllo non è pertinente al sito analizzato.' : 'Non ci sono evidenze sufficienti per valutare questo controllo.'}</p>
      <EvidenceList evidence={check.evidence} />
    </div>
  </details>;
}

export function AiScoreReport({ audit }: { audit: FreeAuditResult }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const details = audit.details;
  const priorities = priorityItems(audit);
  const observations = audit.visibility.observations ?? audit.visibility.evidence;
  const checks = (details?.checks ?? []).filter(check => {
    const match = filter === 'all' || filter === 'issues' && check.measured && ['fail', 'partial'].includes(check.status) || filter === 'unknown' && !check.measured && check.status !== 'not_applicable' || filter === 'pass' && check.measured && check.status === 'pass' || filter === 'not_applicable' && check.status === 'not_applicable';
    return match && check.label.toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it'));
  });

  return <div className="ai-report">
    <header className="ai-report-head"><h3>Analisi dettagliata</h3><p>I controlli e le evidenze della scansione del {new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(new Date(audit.analyzedAt))}. Riaprire il report non avvia nuove ricerche.</p></header>
    <nav className="ai-report-nav" aria-label="Sezioni del report"><a href="#ai-report-priorities">Priorità</a><a href="#ai-report-checks">Controlli</a><a href="#ai-report-sources">Osservazioni AI</a><a href="#ai-report-limits">Limiti</a></nav>
    <section id="ai-report-limits" className="ai-report-section ai-report-limits" aria-labelledby="ai-report-limits-title">
      <h4 id="ai-report-limits-title">Cosa non è misurato o è parziale</h4>
      <ul>{reportLimits(audit).map(limit => <li key={limit.title}><strong>{limit.title}</strong><p>{limit.description}</p></li>)}</ul>
    </section>
    <section id="ai-report-priorities" className="ai-report-section" aria-labelledby="ai-report-priorities-title">
      <h4 id="ai-report-priorities-title">Da dove iniziare</h4><p>Le priorità iniziali selezionate dalla scansione, ordinate per importanza. L’elenco completo dei controlli da migliorare è consultabile qui sotto. Sono indicazioni di intervento, non risultati già ottenuti.</p>
      {!priorities.length && <p>{details ? 'Nessun intervento prioritario individuato nei controlli misurati. Consulta anche i limiti della scansione.' : 'Le priorità dettagliate non sono presenti in questo report precedente.'}</p>}
      <div className="ai-report-priorities">{priorities.map(item => <article key={item.checkId}>
        <span className={`ai-report-badge is-${item.priority}`}>{priorityLabels[item.priority]}</span><h5>{item.title}</h5><p>{item.whyItMatters}</p>
        {item.howToFix ? <p><strong>Intervento suggerito</strong>{item.howToFix}</p> : <p>L’intervento richiede una valutazione specifica: non è disponibile una procedura verificata per questo controllo.</p>}
        {item.verification && <p><strong>Come verificarlo</strong>{item.verification}</p>}
        <details><summary>Evidenze del problema</summary><EvidenceList evidence={details?.checks.find(check => check.id === item.checkId)?.evidence ?? []} /></details>
      </article>)}</div>
    </section>
    <section id="ai-report-checks" className="ai-report-section" aria-labelledby="ai-report-checks-title">
      <h4 id="ai-report-checks-title">Tutti i controlli</h4>
      <div className="ai-report-filters"><label>Cerca un controllo<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Es. dati strutturati" /></label><label>Mostra<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tutti</option><option value="issues">Da migliorare</option><option value="unknown">Non misurati</option><option value="pass">Superati</option><option value="not_applicable">Non applicabili</option></select></label></div>
      <p aria-live="polite">{checks.length} {checks.length === 1 ? 'controllo visualizzato' : 'controlli visualizzati'}</p>
      {!checks.length && <p>Nessun controllo corrisponde alla selezione.</p>}
      {details?.categoryScores.map(category => {
        const group = checks.filter(check => check.categoryId === category.id);
        return group.length > 0 && <div className="ai-report-category" key={category.id}><h5>{category.label}</h5><p>{category.score === null ? 'Contributo al punteggio non misurato' : `Contributo: ${category.score} su ${category.weight} punti`} · Copertura {category.coverage}%</p>{group.map(check => <CheckRow key={check.id} check={check} />)}</div>;
      })}
    </section>
    <section id="ai-report-sources" className="ai-report-section" aria-labelledby="ai-report-sources-title">
      <h4 id="ai-report-sources-title">Ricerche, risposte e fonti AI</h4><p>Le osservazioni riguardano il servizio e il momento indicati. Non rappresentano tutte le risposte possibili di tutti gli assistenti AI.</p>
      {!observations.length && <p>Nessuna osservazione AI verificabile disponibile. Questo non dimostra che il brand sia assente dalle risposte AI.</p>}
      {observations.map((item, index) => {
        const valid = item.status === 'SUCCESS' || item.status === 'PARTIAL';
        return <details className="ai-report-observation" key={item.id ?? `${item.promptId}-${index}`}><summary><strong>{item.query ?? audit.visibility.prompts.find(prompt => prompt.id === item.promptId)?.query ?? 'Ricerca AI'}</strong><span className="ai-report-badge">{valid ? 'Osservazione raccolta' : 'Non misurata'}</span></summary><div className="ai-report-check-body">
          <p>{item.engine} {item.model && `· ${item.model}`} · {new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.timestamp))}</p>
          {valid ? <p>{item.brandMentioned ? 'Brand menzionato nella risposta.' : 'Brand non menzionato nella risposta osservata.'} {item.domainCited ? 'Dominio citato.' : 'Dominio non citato nella risposta osservata.'}</p> : <p>Questa ricerca non ha prodotto una misura valida. Non viene interpretata come assenza del brand.</p>}
          {item.evidence && <blockquote>{item.evidence}</blockquote>}
          {item.sources?.length ? <ul>{item.sources.map(source => <li key={source.normalizedUrl}><SourceLink url={source.url}>{source.title ?? source.url}</SourceLink></li>)}</ul> : <p>Nessuna fonte citata disponibile in questa osservazione.</p>}
        </div></details>;
      })}
      {details && <details className="ai-report-observation"><summary><strong>Pagine del sito analizzate</strong><span>{details.crawlSummary.pagesFetched} pagine</span></summary><ul className="ai-report-evidence">{details.crawlSummary.pages.map(page => <li key={page.finalUrl}><SourceLink url={page.finalUrl}>{page.title ?? page.finalUrl}</SourceLink><small>HTTP {page.statusCode} · {page.wordCount} parole rilevate</small></li>)}</ul></details>}
    </section>
  </div>;
}
