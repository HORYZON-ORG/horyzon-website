'use client';
import type { AssessmentInput, QuestionId } from '@/lib/patrimonial-radar/types';
import { initialValue, type Draft } from '@/lib/patrimonial-radar-ui/presentation';
import { QuestionFields } from './question-fields';
import { SecondaryAnswers } from './secondary-answers';

// All forty widgets stay available, including after a missing-data choice. Editing a
// main field replaces that choice; no discarded financial payload is kept here.
export function AnswerFields({ id, draft, onChange, input, newId }: { id: QuestionId; draft: Draft; onChange: (draft: Draft) => void; input: AssessmentInput; newId: () => string }) {
  return <>
    <QuestionFields id={id} value={draft.state === 'VALUE' ? draft.value : initialValue(id, input)} onChange={value => onChange(value === undefined || value === '' ? { state: 'UNANSWERED' } : { state: 'VALUE', value })} input={input} newId={newId} />
    <SecondaryAnswers state={draft.state} onChange={state => onChange({ state })} />
  </>;
}
