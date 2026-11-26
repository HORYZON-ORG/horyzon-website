"use client";
import { useEffect, useState } from 'react';
import type { CheckupReport } from '@/lib/annunci-10x/checkup';
import { checkupCalendarUrl, CHECKUP_INVITATION } from '@/lib/annunci-10x/checkup-copy';
import styles from './annunci-10x.module.css';
import { recruitingMetaTracker } from '@/lib/recruiting-meta';

export function Annunci10xCheckupResult({ analysisRunId }: { analysisRunId: string }) {
  const [state, setState] = useState<{ status: string; report: CheckupReport | null }>({ status: 'PREPARING', report: null });
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch(`/api/annunci-10x/checkup/${analysisRunId}`, { method: 'POST' });
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Risultato temporaneamente non disponibile.');
        setState(payload); setError('');
        if (payload.report) void recruitingMetaTracker()?.completed(analysisRunId, payload.report.createdAt);
        if (payload.status === 'PREPARING') timer = setTimeout(load, 8000);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Risultato temporaneamente non disponibile.'); }
    }
    void load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [analysisRunId, retry]);
  const report = state.report;
  const score = (n: number | null) => n === null ? 'N/D' : `${(n / 10).toLocaleString('it-IT', { maximumFractionDigits: 1 })}/10`;
  return <>
    <section className={styles.resultCard} aria-live="polite">
      <p>Il tuo check-up gratuito</p>
      <h2>{report ? 'Il PDF completo è pronto.' : state.status === 'FAILED' ? 'Il check-up richiede un nuovo tentativo.' : 'Stiamo preparando il tuo PDF.'}</h2>
      <p>{state.status === 'EMAIL_ACCEPTED' ? 'Il servizio email ha accettato il messaggio con il PDF. La consegna nella tua casella non è ancora confermata.' : state.status === 'EMAIL_ERROR' ? 'Il PDF è disponibile qui. L’invio email ha incontrato un problema; puoi riprovare senza generare un nuovo annuncio.' : report ? 'Puoi scaricare subito il PDF. L’invio email non risulta ancora confermato.' : 'Conserviamo il risultato: puoi riaprire questa pagina per riprendere la richiesta.'}</p>
      {(error || state.status === 'FAILED') && <p role="alert">{error || 'Non è stato generato un regalo completo. Riprova tra qualche minuto: il limite è di tre tentativi.'}</p>}
      {(error || state.status === 'FAILED' || state.status === 'EMAIL_ERROR') && <button type="button" onClick={() => setRetry(n => n + 1)}>Riprova la richiesta</button>}
      {report && <>
        <div className={styles.fieldGrid}><div><h3>Testo attuale</h3><strong>{score(report.before.score)}</strong></div><div><h3>Proposta migliorata</h3><strong>{score(report.after.score)}</strong></div></div>
        <p>{report.scoreMethod ? 'Il voto è la media dei criteri valutabili della stessa griglia di 20 controlli, senza tetti aggiuntivi. N/D è escluso dalla media e resta visibile nella copertura.' : 'Stessi 20 criteri per entrambi. Il voto su 10 è il punteggio su 100 diviso 10. Un testo già buono può mantenere il proprio voto.'}</p>
        <p>Copertura: originale {report.before.coverage}%, proposta {report.after.coverage}%. N/D indica un criterio non valutabile.</p>
        <div className={styles.actions}><a href={`/api/annunci-10x/checkup/${analysisRunId}/pdf`} download onClick={() => { void recruitingMetaTracker()?.download(analysisRunId); }}>Scarica il PDF completo gratuito</a></div>
        {report.improvementPlan && <section aria-label="Come fare un salto concreto">
          <h3>Come fare un salto concreto</h3>
          <p>{report.improvementPlan.summary}</p>
          <ol>{report.improvementPlan.priorities.map(c => <li key={c.checkId}>
            <h4>{c.title} · oggi {c.currentScore}/10</h4>
            <p>{c.toAdd}</p>
            <details><summary>Quali dati chiedere all’azienda</summary><p>{c.why}</p><ul>{c.questions.map(q => <li key={q}>{q}</li>)}</ul><p>Traccia da completare con dati confermati: {c.draft}</p></details>
          </li>)}</ol>
          <p>{report.improvementPlan.nextStep}</p>
        </section>}
        <details><summary>Confronta i due testi</summary><div className={styles.fieldGrid}><div><h3>Originale</h3><p style={{ whiteSpace: 'pre-wrap' }}>{report.originalText}</p></div><div><h3>Proposta</h3><p style={{ whiteSpace: 'pre-wrap' }}>{report.improvedText}</p></div></div></details>
        <details><summary>Modifiche e informazioni da chiarire</summary>{report.changes.length ? <ul>{report.changes.map((c, i) => <li key={i}>{c}</li>)}</ul> : <p>I punteggi sono rimasti invariati.</p>}<h3>Informazioni utili da approfondire</h3><ul>{report.missingInformation.map((c, i) => <li key={i}>{c}</li>)}</ul></details>
        <p>Valutazione automatica di chiarezza e completezza: non garantisce candidature o assunzioni. La proposta usa i fatti disponibili; verifica il testo prima di pubblicarlo.</p>
      </>}
    </section>
    {report && <section className={styles.checkupOffer}>
      <p>Un ulteriore miglioramento, se lo desideri</p>
      <h3>15 minuti gratuiti con Angelo</h3>
      {CHECKUP_INVITATION.slice(0, 3).map(p => <p key={p}>{p}</p>)}
      <a href={checkupCalendarUrl(analysisRunId)} target="_blank" rel="noopener noreferrer" onClick={() => {
        void recruitingMetaTracker()?.bookingClick(analysisRunId);
        void fetch(`/api/annunci-10x/checkup/${analysisRunId}/booking-click`, { method: 'POST' }).catch(() => undefined);
      }}>{CHECKUP_INVITATION[3]}</a>
      <p>La telefonata è facoltativa. Il regalo è già disponibile e non comporta alcun obbligo di acquisto.</p>
    </section>}
  </>;
}
