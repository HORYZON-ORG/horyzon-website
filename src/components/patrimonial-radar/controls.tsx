'use client';
import { useId, useState } from 'react';
import type { AssessmentInput, Period, QuestionId } from '@/lib/patrimonial-radar/types';
import { FLOW_BOUNDS, STOCK_BOUNDS, italianAmount, moneyErrors, periods } from '@/lib/patrimonial-radar/money';
import { array, defaultMoney, label, obj } from '@/lib/patrimonial-radar-ui/presentation';
import styles from './radar.module.css';
import { SecondaryAnswers } from './secondary-answers';
export function Choice({ value, options, onChange, multiple = false, questionId, legend }: { value: unknown; options: readonly string[]; onChange: (value: unknown) => void; multiple?: boolean; questionId?: QuestionId; legend?: string }) {
  const name = useId();
  return <fieldset className={styles.choices}>{legend ? <legend>{legend}</legend> : <legend className={styles.srOnly}>Scegli {multiple ? 'una o più risposte' : 'una risposta'}</legend>}{options.map(code => {
    const checked = multiple ? array(value).includes(code) : value === code;
    return <label key={code} className={`${styles.choice} ${checked ? styles.selected : ''}`}><input type={multiple ? 'checkbox' : 'radio'} name={name} value={code} checked={checked} onChange={() => {
      if (!multiple) return onChange(code);
      const exclusive = code === 'NONE' || code === 'NONE_DEFINED';
      onChange(checked ? array(value).filter(v => v !== code) : exclusive ? [code] : [...array(value).filter(v => v !== 'NONE' && v !== 'NONE_DEFINED'), code]);
    }} /><span>{label(code, questionId)}</span></label>;
  })}</fieldset>;
}
export function Select({ title, value, options, onChange, placeholder = 'Scegli una risposta' }: { title: string; value: unknown; options: readonly (readonly [string, string])[]; onChange: (value: string) => void; placeholder?: string }) {
  const id = useId(); return <div className={styles.control}><label htmlFor={id}>{title}</label><select id={id} value={typeof value === 'string' || typeof value === 'number' ? value : ''} onChange={e => onChange(e.target.value)}><option value="">{placeholder}</option>{options.map(([v, text]) => <option value={v} key={v}>{text}</option>)}</select></div>;
}
export const options = (codes: readonly string[], qid?: QuestionId) => codes.map(c => [c, label(c, qid)] as const);
export function FieldSelect({ title, value, codes, onChange, questionId, numbered = false }: { title: string; value: unknown; codes: readonly string[]; onChange: (value: unknown) => void; questionId?: QuestionId; numbered?: boolean }) {
  const f = obj(value), current = f.state === 'VALUE' ? String(f.value) : '';
  return <div><Select title={title} value={current} options={numbered ? codes.map(c => [c, c === '1' ? '1 · Principale' : `${c} · Secondario`] as const) : options(codes, questionId)} onChange={v => onChange(v ? { state: 'VALUE', value: numbered ? Number(v) : v } : { state: 'UNANSWERED' })} /><SecondaryAnswers title={title} state={f.state as 'UNKNOWN' | 'DECLINED'} onChange={state => onChange({ state })} /></div>;
}
export function Check({ title, checked, onChange }: { title: string; checked: boolean; onChange: (v: boolean) => void }) { return <label className={styles.check}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{title}</span></label>; }
export function MoneyInput({ value, onChange, input, period, title = 'Importo', idHint }: { value: unknown; onChange: (v: unknown) => void; input: AssessmentInput; period: Period; title?: string; idHint?: string }) {
  const id = useId(), raw = obj(value), [mode, setMode] = useState(raw.amount !== undefined ? 'POINT' : 'BAND');
  if (!defaultMoney(input, period).scope) return <fieldset className={styles.money}><legend>{title}</legend><p className={styles.notice}>Per attribuire un importo, scegli prima se descrivere la situazione individuale o il bilancio del nucleo. Puoi tornare alla sezione iniziale oppure lasciare questo dato non conosciuto o da completare.</p></fieldset>;
  const base: Record<string, unknown> = { ...defaultMoney(input, period), ...raw }, basis = String(base.basis), annual = basis === 'ANNUAL';
  const bounds = period === 'T0' ? STOCK_BOUNDS : FLOW_BOUNDS;
  const fmt = (n: string) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(Number(n) * (annual ? 12 : 1));
  const bands = Array.from({ length: bounds.length + 1 }, (_, n) => [String(n), n === 0 ? 'Zero euro' : n === 1 ? `Più di zero e meno di ${fmt(bounds[1])} €` : n === bounds.length ? `Almeno ${fmt(bounds[n - 1])} €` : `Da ${fmt(bounds[n - 1])} a meno di ${fmt(bounds[n])} €`] as const);
  const set = (patch: Record<string, unknown>) => onChange({ ...base, ...patch });
  const hasAmount = raw.amount !== undefined && raw.amount !== '';
  const bad = hasAmount && moneyErrors(base, period).length > 0;
  const dates = periods(input.asOf);
  return <fieldset className={styles.money} data-money={idHint}><legend>{title}</legend><p className={styles.hint}>{period === 'T12' ? `Periodo: ${new Date(dates.T12.start).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })} – ${new Date(dates.T12.end).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })}.` : period === 'Tnow' ? 'Budget di un mese, nella situazione attuale.' : 'Valore attuale, per il bilancio scelto.'} Una stima va bene.</p>
    <div className={styles.segment} role="group" aria-label={`Come indicare: ${title}`}><button type="button" aria-pressed={mode === 'BAND'} onClick={() => { setMode('BAND'); onChange({ ...base, amount: undefined, band: undefined, range: undefined, quality: 'BAND' }); }}>Una fascia</button><button type="button" aria-pressed={mode === 'POINT'} onClick={() => { setMode('POINT'); onChange({ ...base, amount: undefined, band: undefined, range: undefined, quality: 'ESTIMATED' }); }}>Un importo</button></div>
    {period === 'T12' ? <Select title="Come esprimere il dato" value={basis} options={[["MONTHLY", 'Media mensile dei dodici mesi'], ['ANNUAL', 'Totale dei dodici mesi']]} onChange={v => onChange({ ...base, basis: v, amount: undefined, band: undefined, range: undefined })} /> : null}
    {mode === 'BAND' ? <Select title={`Fascia · ${title}`} value={typeof raw.band === 'number' ? String(raw.band) : ''} options={bands} onChange={v => set({ amount: undefined, range: undefined, band: v === '' ? undefined : Number(v), quality: 'BAND' })} /> : <div className={styles.control}><label htmlFor={id}>{title} in euro</label><div className={styles.amount}><span aria-hidden="true">€</span><input id={id} inputMode="decimal" type="text" autoComplete="off" aria-invalid={bad || undefined} aria-describedby={`${id}-hint`} placeholder="Es. 1.250,50" value={typeof raw.amount === 'string' ? raw.amount.replace('.', ',') : ''} onChange={e => { let amount = e.target.value; try { amount = italianAmount(amount); } catch { /* Retain invalid text in memory so the user can correct it. */ } set({ amount, band: undefined, range: undefined, quality: raw.quality === 'REPORTED' ? 'REPORTED' : 'ESTIMATED' }); }} /></div><p id={`${id}-hint`} className={bad ? styles.error : styles.hint}>{bad ? 'Inserisci zero o un importo positivo, con la virgola e al massimo due decimali.' : 'Puoi indicare zero. Non usare un importo per rappresentare un dato che non conosci.'}</p><Select title="Precisione dichiarata" value={base.quality} options={[["ESTIMATED", 'È una stima'], ['REPORTED', 'L’ho ripreso da un riepilogo']]} onChange={v => set({ quality: v })} /></div>}
    {period === 'T12' ? <Check title="Conosco soltanto una parte dei dodici mesi indicati" checked={base.coverage === 'PARTIAL'} onChange={v => set({ coverage: v ? 'PARTIAL' : 'COMPLETE' })} /> : null}
  </fieldset>;
}
export function MoneyField({ title, value, onChange, input, period = 'T0' }: { title: string; value: unknown; onChange: (v: unknown) => void; input: AssessmentInput; period?: Period }) {
  const f = obj(value); return <div className={styles.subfield} data-money-field={title}><MoneyInput title={title} value={f.state === 'VALUE' ? f.value : undefined} onChange={value => onChange({ state: 'VALUE', value })} input={input} period={period} /><SecondaryAnswers title={title} state={f.state as 'UNKNOWN' | 'DECLINED'} onChange={state => onChange({ state })} /></div>;
}
