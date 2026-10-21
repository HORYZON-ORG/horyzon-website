'use client';
import { createContext, useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { eventProfiles, eventProfileValue } from '@/content/patrimonial-event-content';
import type { EventQualification } from '@/lib/public-leads/patrimonial-event-qualification';
import styles from './patrimonial-event.module.css';

// Page answers (profile, quiz) reach the CRM notes through the existing message field; the shared form stays untouched.
export const EventNotesContext = createContext<{ notes: string; qualification: Omit<EventQualification, 'consultationRequested'> }>({
  notes: '', qualification: { schemaVersion: 1, audienceProfile: null, sceneId: null, instruments: [] },
});

// Presentation only: transport, attempts, attribution and receipts belong to PilotLeadForm.
export function PatrimonialEventForm({ step, setStep, selectedProfile, onProfileChange, onSubmit, status, notice, revisionRequired, onNewAttempt, v2 }: {
  step: 1 | 2; setStep: (step: 1 | 2) => void; selectedProfile: string; onProfileChange?: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; status: 'idle' | 'sending' | 'success' | 'error'; notice: string;
  revisionRequired: boolean; onNewAttempt: () => void; v2: boolean;
}) {
  const { notes, qualification } = useContext(EventNotesContext);
  const [architectCall, setArchitectCall] = useState(false);
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
      <label><span className={styles["phone-label"]}>Cellulare <span className={styles.optional}>(facoltativo)</span></span><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
      <label className={styles.formConsent}><input name="consent" type="checkbox" required /><span>Ho letto l&apos;<Link href="/privacy-policy" target="_blank" rel="noopener">informativa privacy</Link> e accetto di essere ricontattato per questo evento.</span></label>
      <label className={styles.formConsent}><input name="architectCall" type="checkbox" onChange={event => setArchitectCall(event.target.checked)} /><span>Sì, dopo l&apos;evento voglio il confronto gratuito di 40 minuti con un Architetto Patrimoniale.</span></label>
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
    <input name="qualification" type="hidden" value={JSON.stringify({ ...qualification, consultationRequested: architectCall })} />
    <input name="message" type="hidden" value={[notes, architectCall ? 'Confronto 40 minuti con Architetto Patrimoniale: sì' : ''].filter(Boolean).join(' | ')} />
    <div hidden><label>Sito web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <button type="submit" className={`${styles.cta} ${styles.formSubmit}`} disabled={disabled || revisionRequired}>
      <span>{status === 'sending' ? 'Invio in corso…' : status === 'success' ? 'Richiesta ricevuta.' : step === 1 ? 'Riserva il mio posto' : 'Conferma la richiesta'}</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
    {notice && <p role={status === 'error' ? 'alert' : 'status'} className={styles.formNotice}>{notice}</p>}
    {v2 && revisionRequired && <button type="button" className={styles.formBack} disabled={status === 'sending'} onClick={onNewAttempt}>Ho verificato il precedente invio: avvia una nuova richiesta</button>}
    <div className={styles.formFine}>La richiesta sarà verificata rispetto alla disponibilità dell’edizione. Riceverai data, orario e link quando la partecipazione sarà confermata.</div>
    
  </form>;
}
