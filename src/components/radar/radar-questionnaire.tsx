'use client';

import { radarSteps, type RadarAnswer } from '@/lib/radar';
import styles from './radar.module.css';

export function RadarQuestionnaire({ stepIndex, value, saving, onAnswer, onBack }: { stepIndex: number; value?: RadarAnswer; saving: boolean; onAnswer: (value: RadarAnswer) => void; onBack: () => void }) {
  const step = radarSteps()[stepIndex];
  if (!step) return null;
  const choices = step.kind === 'LIKERT' ? ['Per nulla', 'Poco', 'Abbastanza', 'Molto', 'Completamente'] : step.kind === 'SEASONAL' ? ['No, continuativa', 'Sì, stagionale'] : step.options ?? [];
  return <section className={styles.panel} aria-labelledby="radar-question-title">
    <div className={styles.progress}><span style={{ width: `${Math.round(((stepIndex + 1) / 30) * 100)}%` }}/></div>
    <p className={styles.kicker}>Domanda {stepIndex + 1} di 30</p>
    <h2 id="radar-question-title">{step.title}</h2>
    <div className={styles.choices}>{choices.map((label, index) => {
      const answerValue = step.kind === 'LIKERT' ? index + 1 : index;
      const selected = Array.isArray(value) ? value.includes(answerValue) : value === answerValue;
      return <button key={label} type="button" className={selected ? styles.selected : undefined} disabled={saving} onClick={() => onAnswer(step.kind === 'AI_MULTI' ? toggle(value, answerValue) : answerValue)}>{label}</button>;
    })}</div>
    <div className={styles.actions}><button type="button" onClick={onBack} disabled={stepIndex === 0 || saving}>Indietro</button><span>{saving ? 'Salvataggio…' : 'Salvato'}</span></div>
  </section>;
}
function toggle(value: RadarAnswer | undefined, item: number): number[] {
  const current = Array.isArray(value) ? value : [];
  return current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item];
}
