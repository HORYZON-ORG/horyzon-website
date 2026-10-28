'use client';
import type { AnswerState } from '@/lib/patrimonial-radar/types';
import styles from './radar.module.css';

export function SecondaryAnswers({ state, onChange, title = 'questa domanda' }: { state?: AnswerState; onChange: (state: 'UNKNOWN' | 'DECLINED' | 'UNANSWERED') => void; title?: string }) {
  return <div data-answer-scope={title === 'questa domanda' ? 'question' : 'field'} className={styles.secondaryAnswers} role="group" aria-label={`Se non hai il dato: ${title}`}>
    {([['UNKNOWN', 'Non so'], ['DECLINED', 'Preferisco non rispondere']] as const).map(([choice, text]) => <button type="button" key={choice} aria-label={text} aria-pressed={state === choice} onClick={() => onChange(state === choice ? 'UNANSWERED' : choice)}><span aria-hidden="true">{state === choice ? '✓ ' : ''}</span>{text}</button>)}
    {state === 'UNKNOWN' || state === 'DECLINED' ? <p className={styles.stateExplanation} role="status">{state === 'UNKNOWN' ? 'Il dato resterà sconosciuto, senza sostituirlo con una stima.' : 'Puoi proseguire senza comunicare questo dato.'} Puoi cambiare scelta compilando il campo sopra.</p> : null}
  </div>;
}
