'use client';
import { useEffect, useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { eventProfiles, eventProfileValue } from '@/content/patrimonial-event-content';
import styles from './patrimonial-event.module.css';

// Presentation only: transport, attempts, attribution and receipts belong to PilotLeadForm.
export function PatrimonialEventForm({ step, setStep, selectedProfile, onProfileChange, onSubmit, status, notice, revisionRequired, onNewAttempt, v2 }: {
  step: 1 | 2; setStep: (step: 1 | 2) => void; selectedProfile: string; onProfileChange?: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; status: 'idle' | 'sending' | 'success' | 'error'; notice: string;
  revisionRequired: boolean; onNewAttempt: () => void; v2: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const firstName = useRef<HTMLInputElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (step === 2) heading.current?.focus();
    else if (previousStep.current === 2) firstName.current?.focus();
    previousStep.current = step;
  }, [step]);
  const disabled = status === 'sending' || status === 'success';
  return <form className={styles.formCard} onSubmit={onSubmit} aria-labelledby="patrimonial-event-form-title" aria-busy={status === 'sending'} data-pilot-form="patrimonial-event">
    <h3 id="patrimonial-event-form-title" className={step === 1 ? 'sr-only' : styles.microTitle} ref={heading} tabIndex={-1}>{step === 1 ? 'La tua richiesta di partecipazione' : 'Ci manca solo questo'}</h3>
    <fieldset className={styles.formFields} hidden={step !== 1} disabled={disabled}>
      <legend className={styles.formLegend}>1 · Chi sei?</legend>
      <div className={styles.profileChips}>{eventProfiles.map(profile => <button key={profile.label} type="button" className={`${styles.chip} ${selectedProfile === profile.label ? styles.on : ''}`} data-event-profile={profile.label} aria-pressed={selectedProfile === profile.label} onClick={() => onProfileChange?.(profile.label)}>{profile.label}</button>)}</div>
      <div className={styles.formLegend}>2 · Dove ti mandiamo il link</div>
      <div className={styles.formGrid}>
        <label>Nome<input ref={firstName} name="firstName" type="text" autoComplete="given-name" required maxLength={120} /></label>
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      </div>
      <label>Cellulare <span className={styles.optional}>(facoltativo)</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
      <label className={styles.formConsent}><input name="consent" type="checkbox" required /><span>Ho letto l&apos;<Link href="/privacy-policy" target="_blank" rel="noopener">informativa privacy</Link> e accetto di essere ricontattato per questo evento.</span></label>
    </fieldset>
    <fieldset className={styles.formFields} hidden={step !== 2} disabled={disabled || step === 1}>
      <legend className="sr-only">Completa la richiesta con cognome e provincia</legend>
      <div className={styles.formGrid}>
        <label>Cognome<input name="lastName" type="text" autoComplete="family-name" required maxLength={120} /></label>
        <label>Provincia<input name="province" autoComplete="address-level2" required minLength={2} maxLength={80} /></label>
      </div>
      <button type="button" className={styles.formBack} onClick={() => setStep(1)}>← Torna ai recapiti</button>
    </fieldset>
    <input name="profile" type="hidden" value={eventProfileValue(selectedProfile)} />
    <input name="message" type="hidden" value="" />
    <div hidden><label>Sito web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <button type="submit" className={`${styles['btn-gold']} ${styles.formSubmit}`} disabled={disabled || revisionRequired}>
      <span>{status === 'sending' ? 'Invio in corso…' : status === 'success' ? 'Richiesta ricevuta.' : step === 1 ? 'Riserva il mio posto gratuito' : 'Conferma la richiesta'}</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
    {notice && <p role={status === 'error' ? 'alert' : 'status'} className={styles.formNotice}>{notice}</p>}
    {v2 && revisionRequired && <button type="button" className={styles.formBack} disabled={status === 'sending'} onClick={onNewAttempt}>Ho verificato il precedente invio: avvia una nuova richiesta</button>}
    <div className={styles.formFine}>Ricevi subito la checklist e il link all&apos;evento via email.</div>
    <p className={styles.formFine}>La richiesta non conferma ancora la partecipazione definitiva.</p>
  </form>;
}
