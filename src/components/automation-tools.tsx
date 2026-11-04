'use client';
import { useState } from 'react';
import { automationExamples, monthlyManualHours } from '@/lib/automation-examples';

export function AutomationCost() {
  const [minutes, setMinutes] = useState(5);
  const [occurrences, setOccurrences] = useState(10);
  const [people, setPeople] = useState(1);
  const [days, setDays] = useState(22);
  const hours = monthlyManualHours(minutes, occurrences, people, days);
  const fields = [
    { label: 'Minuti per attività', value: minutes, set: setMinutes, max: 480 },
    { label: 'Ripetizioni al giorno, per persona', value: occurrences, set: setOccurrences, max: 500 },
    { label: 'Persone coinvolte', value: people, set: setPeople, max: 100 },
    { label: 'Giorni di lavoro al mese', value: days, set: setDays, max: 31 },
  ];
  return <section className="bd-section au-cost" id="tempo"><div className="bd-wrap au-cost-grid"><div><p className="bd-kicker">IL COSTO DEL RINVIO</p><h2>Il lavoro ripetitivo<br/><em>si ripresenta domani.</em></h2><p>Una risposta copiata, un dato reinserito, una scadenza da ricordare. Presi uno alla volta sembrano dettagli. Ripetuti ogni giorno occupano il tempo del tuo team.</p><p>Metti a fuoco una sola attività e fai il conto con i tuoi numeri.</p></div><div className="au-calculator"><p className="au-small-label">QUANTO TEMPO IMPEGNA OGGI?</p><div className="au-calculator-fields">{fields.map(field => <label key={field.label}>{field.label}<input type="number" min={0} max={field.max} step={1} value={field.value} onChange={e => field.set(Math.max(0, Math.min(field.max, Number(e.target.value) || 0)))}/></label>)}</div><output aria-live="polite"><strong>{hours.toLocaleString('it-IT', { maximumFractionDigits: 1 })}</strong><span>ore di lavoro al mese</span></output><p className="au-calculator-note">Tempo complessivo del team: minuti × ripetizioni × persone × giorni ÷ 60. Valori iniziali di esempio. È il tempo oggi impegnato, non una promessa di risparmio.</p><a href="#attivita" className="bd-textlink">Trova l’automazione da valutare ↓</a></div></div></section>;
}
export function AutomationDemo() {
  const [kind, setKind] = useState<keyof typeof automationExamples>('email');
  const [step, setStep] = useState(0);
  const example = automationExamples[kind];
  return <section className="bd-section au-demo" id="esempio"><div className="bd-wrap"><div className="au-demo-heading"><div><p className="bd-kicker">VEDI IL PASSAGGIO, CAPISCI L’UTILITÀ</p><h2>Da un’informazione sparsa.<br/><em>A un lavoro già preparato.</em></h2></div><p>Prova un esempio. L’automazione organizza le informazioni; tu controlli il risultato e decidi il prossimo passo.</p></div><div className="au-demo-panel"><div className="au-demo-toolbar"><label>Scegli un esempio<select value={kind} onChange={e => { setKind(e.target.value as keyof typeof automationExamples); setStep(0); }}>{Object.entries(automationExamples).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label><span>ESEMPIO DIMOSTRATIVO · DATI DI ESEMPIO</span></div><div className="au-demo-columns"><article><p className="au-small-label">01 / ARRIVA UN’INFORMAZIONE</p><blockquote>{example.input}</blockquote><button type="button" className="bd-button" onClick={() => setStep(1)} disabled={step > 0}>{step > 0 ? '✓ Informazioni organizzate' : 'Mostra il lavoro preparato →'}</button></article><article className={step > 0 ? 'au-demo-result is-ready' : 'au-demo-result'} aria-live="polite"><p className="au-small-label">02 / L’AUTOMAZIONE PREPARA</p>{step > 0 ? <><dl>{example.output.map((field, i) => <div key={`${kind}-${i}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl><p className="au-demo-action">{example.action}</p><button type="button" className="bd-button" onClick={() => setStep(2)} disabled={step === 2}>{step === 2 ? '✓ Verifica simulata completata' : 'Simula la verifica umana ✓'}</button>{step === 2 && <p className="au-demo-confirm">03 / La persona conferma il risultato. In questo esempio non vengono inviati messaggi né modificati sistemi esterni.</p>}</> : <div className="au-demo-empty"><span aria-hidden="true">↗</span><p>Qui vedrai i dati ordinati e il prossimo passo da verificare.</p></div>}</article></div><p className="au-demo-note">Simulazione guidata con contenuti predefiniti: mostra la logica del processo. Strumenti, controlli e integrazioni vengono progettati sul tuo caso reale.</p></div></div></section>;
}
