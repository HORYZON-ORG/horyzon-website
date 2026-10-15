'use client';
import { useEffect, useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { pilotAvailability, pilotExperience, pilotGoals } from '@/content/patrimonial-funnels';
import { architectProfiles } from '@/content/patrimonial-architect-session';
import styles from './patrimonial-architect.module.css';

// Presentation only. Submission, attribution, attempts and receipts stay owned
// by PilotLeadForm; this component never sends a request.
export function ArchitectApplicationForm({ step, setStep, selectedProfile, onProfileChange, onSubmit, status, notice, revisionRequired, onNewAttempt, v2 }: {
  step: 1 | 2; setStep: (step: 1 | 2) => void; selectedProfile: string; onProfileChange?: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; status: 'idle' | 'sending' | 'success' | 'error'; notice: string;
  revisionRequired: boolean; onNewAttempt: () => void; v2: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (step === 2) heading.current?.focus(); }, [step]);
  const selected = Object.values(architectProfiles).find(profile => profile.value === selectedProfile);
  const disabled = status === 'sending' || status === 'success';
  return <form className={styles.formCard} onSubmit={onSubmit} aria-labelledby="architect-path-form-title" aria-busy={status === 'sending'} data-pilot-form="architect-path">
    <h3 id="architect-path-form-title" className="sr-only" ref={heading} tabIndex={-1}>Raccontaci da dove parti. Passo {step} di 2</h3>
    <div className={styles.formProgress}><span>PASSO {step} DI 2</span><span>{step === 1 ? '30 secondi' : 'Il tuo percorso'}</span></div>
    <div className={styles.formTrack}><div className={step === 1 ? styles.formHalf : styles.formFull} /></div>
    {selected && <div className={styles.profileNote} id="profileNote"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7A5A22" strokeWidth="2" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg><span>Profilo: <strong>{selected.label}</strong> — prepariamo la sessione anche per te</span></div>}
    <fieldset className={styles.formFields} hidden={step !== 1} disabled={disabled}>
      <legend className="sr-only">I tuoi recapiti</legend>
      <div className={styles.formGrid}>
        <label>Nome<input name="firstName" type="text" autoComplete="given-name" required maxLength={120} /></label>
        <label>Cognome<input name="lastName" type="text" autoComplete="family-name" required maxLength={120} /></label>
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label>Telefono<input name="phone" type="tel" autoComplete="tel" required maxLength={40} /></label>
      </div>
      <label className={styles.formConsent}><input name="consent" type="checkbox" required /><span>Ho letto l&apos;<Link href="/privacy-policy" target="_blank" rel="noopener">informativa privacy</Link> e chiedo di essere ricontattato.</span></label>
    </fieldset>
    <fieldset className={styles.formFields} hidden={step !== 2} disabled={disabled || step === 1}>
      <legend className="sr-only">Il tuo profilo e le tue aspettative</legend>
      <div className={styles.formGrid}>
        <label>Provincia<input name="province" autoComplete="address-level2" required minLength={2} maxLength={80} /></label>
        <label>Profilo <span>(facoltativo)</span><select name="profile" value={selectedProfile} onChange={event => onProfileChange?.(event.target.value)}><option value="">Seleziona</option>{Object.values(architectProfiles).map(profile => <option key={profile.value} value={profile.value}>{profile.label}</option>)}</select></label>
        <label>Esperienza commerciale/relazionale <span>(facoltativo)</span><select name="experience" defaultValue=""><option value="">Seleziona</option>{pilotExperience.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Cosa stai cercando <span>(facoltativo)</span><select name="goal" defaultValue=""><option value="">Seleziona</option>{pilotGoals.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Disponibilità <span>(facoltativo)</span><select name="availability" defaultValue=""><option value="">Seleziona</option>{pilotAvailability.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <label className={styles.formQuestion}>Perché vuoi conoscere il Percorso Architetto Patrimoniale? <span>(facoltativo)</span><textarea name="message" rows={4} maxLength={1500} /></label>
      <label className={styles.formConsent}><input name="marketingConsent" type="checkbox" defaultChecked={false} /><span>Voglio ricevere anche consigli e novità da Horyzon.</span></label>
    </fieldset>
    <div hidden><label>Sito web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {step === 2 && <button type="button" className={styles.formBack} disabled={disabled} onClick={() => setStep(1)}>← Torna ai recapiti</button>}
    <button type="submit" className={styles.formSubmit} disabled={disabled || revisionRequired}>{status === 'sending' ? 'Invio in corso…' : status === 'success' ? 'Richiesta ricevuta.' : 'Sì, riservo il mio posto →'}</button>
    {notice && <p role={status === 'error' ? 'alert' : 'status'} className={styles.formNotice}>{notice}</p>}
    {v2 && revisionRequired && <button type="button" className={styles.formBack} disabled={status === 'sending'} onClick={onNewAttempt}>Ho verificato il precedente invio: avvia una nuova richiesta</button>}
    <p className={styles.formFine}>Gratuito e senza impegno. Puoi disdire con un clic.</p>
    <p className={styles.formFine}>{step === 1 ? 'Completa il passo 2 per inviare la richiesta.' : 'La richiesta non conferma una prenotazione. Ti ricontatteremo per i dettagli.'} Preferisci scriverci? <a href="mailto:info@horyzon.it">Contattaci via email</a>.</p>
  </form>;
}
