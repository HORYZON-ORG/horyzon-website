'use client';

import { useEffect, useState } from 'react';
import { RADAR_AREAS, radarSteps } from '@/lib/radar/domain';
import type { RadarAnswer, RadarStep } from '@/lib/radar/types';
import styles from './radar.module.css';

const LIKERT = ['Per nulla', 'Poco', 'Abbastanza', 'Molto', 'Completamente'];
const HINTS: Record<RadarStep['kind'], string> = {
  LIKERT: 'Quanto è vera questa frase per la tua impresa, oggi?',
  SEASONAL: 'Scegli la risposta che descrive la tua attività.',
  AI_MULTI: 'Puoi scegliere più risposte, poi premi Continua.',
  OWNER_HOURS: 'Considera una settimana media dell’anno, inclusi telefonate, messaggi e lavoro da casa. Per attività stagionali, fai la media anche sui periodi di chiusura.',
  COMPANY_PROFIT: 'Inserisci l’utile prima delle imposte: ricavi meno tutti i costi, inclusi interessi e ammortamenti. Puoi usare una stima e inserire zero o un valore negativo se l’azienda è in perdita.',
};

// The questionnaire walks the five departments of the organisation chart, then context and AI.
// Groups drive the track at the top: one segment per group, as wide as its number of questions.
type Group = { id: string; label: string; from: number; count: number };
function groups(steps: RadarStep[]): Group[] {
  const list: Group[] = [];
  steps.forEach((step, index) => {
    const id = step.areaId ?? (step.kind === 'SEASONAL' ? 'contesto' : step.id.startsWith('economia#') ? 'economia' : 'ai');
    const label = RADAR_AREAS.find((area) => area.id === step.areaId)?.label ?? (id === 'contesto' ? 'Contesto' : id === 'economia' ? 'Tempo e utile' : 'Intelligenza artificiale');
    const last = list[list.length - 1];
    if (last?.id === id) last.count++;
    else list.push({ id, label, from: index, count: 1 });
  });
  return list;
}

export function RadarQuestionnaire({ questionnaireVersion, stepIndex, value, saving, onAnswer, onBack }: { questionnaireVersion?: string; stepIndex: number; value?: RadarAnswer; saving: boolean; onAnswer: (value: RadarAnswer, advance?: boolean) => void; onBack: () => void }) {
  const steps = radarSteps(questionnaireVersion);
  const step = steps[stepIndex];
  const choices = !step ? [] : step.kind === 'LIKERT' ? LIKERT : step.kind === 'SEASONAL' ? ['No, continuativa', 'Sì, stagionale'] : step.options ?? [];
  const valueOf = (index: number) => step?.kind === 'LIKERT' ? index + 1 : index;
  const choose = (index: number) => {
    if (!step || saving) return;
    const answer = valueOf(index);
    onAnswer(step.kind === 'AI_MULTI' ? toggle(value, answer) : answer, step.kind !== 'AI_MULTI');
  };

  // Number keys answer the current question; ignored while typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select')) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < choices.length) { event.preventDefault(); choose(index); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!step) return null;
  const all = groups(steps);
  const group = all.find((g) => stepIndex >= g.from && stepIndex < g.from + g.count)!;
  return <section className={styles.panel} aria-labelledby="radar-question-title">
    <ol className={styles.track} aria-label="Avanzamento per reparto">
      {all.map((g) => {
        const done = Math.max(0, Math.min(g.count, stepIndex - g.from));
        const current = g === group;
        return <li key={g.id} style={{ flexGrow: g.count }} className={current ? styles.trackCurrent : done === g.count ? styles.trackDone : undefined} aria-current={current ? 'step' : undefined}>
          <span className={styles.trackBar}><i style={{ width: `${(done + (current ? .5 : 0)) / g.count * 100}%` }}/></span>
          <span className={styles.trackLabel}>{g.label}</span>
        </li>;
      })}
    </ol>

    <div key={step.id} className={styles.question}>
      <p className={styles.kicker}>
        <span>{group.label}{group.count > 1 ? ` · ${stepIndex - group.from + 1} di ${group.count}` : ''}</span>
        <span className={styles.counter}>Domanda {stepIndex + 1} di {steps.length}</span>
      </p>
      <h2 id="radar-question-title">{step.title}</h2>
      {step.autonomy ? <p className={styles.tag}>Misura quanto il reparto va avanti senza di te</p> : null}
      <p className={styles.hint} id="radar-question-hint">{HINTS[step.kind]}</p>
      {step.kind === 'OWNER_HOURS' || step.kind === 'COMPANY_PROFIT'
        ? <EconomicAnswerForm key={step.id} kind={step.kind} value={value} saving={saving} onAnswer={onAnswer} />
        : <div className={step.kind === 'LIKERT' ? styles.scale : styles.choices} role="group" aria-labelledby="radar-question-title" aria-describedby="radar-question-hint">
        {choices.map((label, index) => {
          const answer = valueOf(index);
          const selected = Array.isArray(value) ? value.includes(answer) : value === answer;
          return <button key={label} type="button" aria-pressed={selected} className={selected ? styles.selected : undefined} disabled={saving} onClick={() => choose(index)}>
            <span className={styles.key} aria-hidden="true">{index + 1}</span><span>{label}</span>
          </button>;
        })}
      </div>}
    </div>

    <div className={styles.actions}>
      <button type="button" className={styles.ghost} onClick={onBack} disabled={stepIndex === 0 || saving}>← Indietro</button>
      <span className={saving ? styles.saving : styles.saved}>{saving ? 'Salvataggio…' : 'Risposte salvate'}</span>
      {step.kind === 'AI_MULTI' ? <button type="button" disabled={saving || !Array.isArray(value) || value.length === 0} onClick={() => onAnswer(value!, true)}>Continua</button> : null}
    </div>
  </section>;
}

function EconomicAnswerForm({ kind, value, saving, onAnswer }: { kind: 'OWNER_HOURS' | 'COMPANY_PROFIT'; value?: RadarAnswer; saving: boolean; onAnswer: (value: RadarAnswer) => void }) {
  const saved = Array.isArray(value) ? value : [];
  const [period, setPeriod] = useState(saved[0] ?? 0);
  const hours = kind === 'OWNER_HOURS';
  return <form className={styles.form} aria-labelledby="radar-question-title" aria-describedby="radar-question-hint" onSubmit={(event) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const amount = Number(data.get('amount'));
    onAnswer(hours ? [period, amount, period === 1 ? Number(data.get('days')) : 0] : [period, amount]);
  }}>
    <label>{hours ? 'Come preferisci indicare le ore?' : 'A quale periodo si riferisce l’utile?'}
      <select value={period} disabled={saving} onChange={(event) => setPeriod(Number(event.target.value))}>
        <option value={0}>{hours ? 'Ore a settimana' : 'Un anno'}</option>
        <option value={1}>{hours ? 'Ore al giorno' : 'Un mese'}</option>
      </select>
    </label>
    <label>{hours ? period === 1 ? 'Ore medie al giorno' : 'Ore medie a settimana' : 'Utile prima delle tasse (€)'}
      <input key={period} name="amount" type="number" inputMode={hours ? 'decimal' : undefined} required disabled={saving} step={hours ? 'any' : '0.01'} min={hours ? '0.01' : undefined} max={hours ? period === 1 ? 24 : 168 : undefined} defaultValue={saved[0] === period ? saved[1] : undefined} placeholder={hours ? period === 1 ? 'Es. 10' : 'Es. 60' : 'Es. 30000'} />
    </label>
    {hours && period === 1 ? <label>Giorni medi lavorati a settimana<input name="days" type="number" inputMode="numeric" required disabled={saving} min={1} max={7} step={1} defaultValue={saved[0] === 1 ? saved[2] : undefined} placeholder="Es. 6" /></label> : null}
    {!hours ? <p className={styles.economicHint}>Il fatturato è già nel tuo profilo. Qui serve ciò che resta dopo i costi, prima delle imposte: un valore diverso da fatturato, incassi ed EBITDA. Per l’importo annuale, usa lo stesso anno cui si riferisce la media delle ore.</p> : null}
    <button type="submit" disabled={saving}>Continua</button>
  </form>;
}

function toggle(value: RadarAnswer | undefined, item: number): number[] {
  const current = Array.isArray(value) ? value : [];
  return current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item];
}
