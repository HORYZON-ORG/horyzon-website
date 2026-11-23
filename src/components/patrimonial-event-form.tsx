'use client';
import { createContext, useContext, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { eventProfiles, eventProfileValue } from '@/content/patrimonial-event-content';
import { italianProvinceGroups } from '@/content/italian-provinces';
import styles from './patrimonial-event.module.css';
import type { EventQualification } from '@/lib/public-leads/patrimonial-event-qualification';

export const EventNotesContext = createContext<{notes: string; qualification: Omit<EventQualification, 'consultationRequested'>}>({
  notes: '', qualification: {schemaVersion: 1, audienceProfile: null, sceneId: null, instruments: []},
});

// Event-only single-page presentation; the shared submission/CRM/Hub logic remains in PilotLeadForm.
export function PatrimonialEventForm({ selectedProfile, onProfileChange, onSubmit, status, notice, revisionRequired, onNewAttempt, v2 }: {
  selectedProfile: string; onProfileChange?: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; status: 'idle' | 'sending' | 'success' | 'error'; notice: string;
  revisionRequired: boolean; onNewAttempt: () => void; v2: boolean;
}) {
  const { notes, qualification } = useContext(EventNotesContext);
  const [architectCall, setArchitectCall] = useState(false);
  const [region, setRegion] = useState('');
  const [province, setProvince] = useState('');
  const availableProvinces = italianProvinceGroups.find(group => group.region === region)?.provinces ?? [];
  const disabled = status === 'sending' || status === 'success';
  return <form id="modulo-iscrizione" className={styles.formCard} onSubmit={onSubmit} aria-labelledby="patrimonial-event-form-title" aria-busy={status === 'sending'} data-pilot-form="patrimonial-event">
    <h3 id="patrimonial-event-form-title" className={styles.microTitle}>Iscriviti all’evento · 9 dicembre ore 21:00</h3>
    <fieldset className={styles.formFields} disabled={disabled}>
      <legend className={styles.formLegend}>Scegli il tuo profilo</legend>
      <div className={styles.profileChips}>{eventProfiles.map(profile => <button key={profile.label} type="button" className={`${styles.chip} ${selectedProfile === profile.label ? styles.on : ''}`} data-event-profile={profile.label} aria-pressed={selectedProfile === profile.label} onClick={() => onProfileChange?.(profile.label)}>{profile.label}</button>)}</div>
      <div className={styles.formLegend}>I tuoi dati</div>
      <div className={styles.formGrid}>
        <label>Nome<input name="firstName" type="text" autoComplete="given-name" required maxLength={120} /></label>
        <label>Cognome<input name="lastName" type="text" autoComplete="family-name" required maxLength={120} /></label>
      </div>
      <div className={styles.formGrid}>
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label><span className={styles["phone-label"]}>Numero di cellulare *</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="Es. 333 123 4567" required minLength={8} maxLength={40} pattern="[+0-9() ./\\-]{8,40}" title="Inserisci un numero di cellulare valido, con eventuale prefisso internazionale" aria-describedby="event-phone-help" /><span id="event-phone-help" className={styles.provinceHelp}>Necessario per confermare l’iscrizione e comunicarti gli aggiornamenti organizzativi dell’evento.</span></label>
      </div>
      <div className={styles.formGrid}>
        <label>Regione
          <select value={region} autoComplete="off" required onChange={event => {
            setRegion(event.target.value);
            setProvince('');
          }}>
            <option value="" disabled>Seleziona la regione</option>
            {italianProvinceGroups.map(group => <option key={group.region} value={group.region}>{group.region}</option>)}
          </select>
        </label>
        <label>Provincia
          <select name="province" value={province} onChange={event => setProvince(event.target.value)} autoComplete="off" required disabled={!region} aria-describedby="event-province-help">
            <option value="" disabled>{region ? 'Seleziona la provincia' : 'Prima scegli la regione'}</option>
            {availableProvinces.map(item => <option key={item.code} value={item.name}>{item.name} ({item.code})</option>)}
          </select>
          <span id="event-province-help" className={styles.provinceHelp}>Seleziona la provincia della regione scelta.</span>
        </label>
      </div>
      <p className={styles.privacySummary}>Usiamo i tuoi dati, compreso il cellulare, per registrarti all’evento del 9 dicembre, inviarti la conferma e i promemoria. Questo non autorizza comunicazioni commerciali non pertinenti.</p>
      <details className={styles.privacyDetails}>
        <summary>Leggi le informazioni sul trattamento dei dati</summary>
        <div className={styles.privacyDetailsBody}>
          <p><strong>Titolare:</strong> FELICITÀ S.r.l., Viale Papiniano 28, 20123 Milano. Contatto: <a href="mailto:info@horyzon.it">info@horyzon.it</a>.</p>
          <p><strong>Finalità:</strong> registrare la tua iscrizione all’evento del 9 dicembre 2026 alle 21:00, inviare conferma e promemoria il giorno prima e 30 minuti prima, e comunicazioni organizzative relative alla partecipazione.</p>
          <p><strong>Dati:</strong> nome, cognome, email, cellulare e provincia sono richiesti per gestire l’iscrizione. Eventuali preferenze e risposte sono usate per contestualizzare la partecipazione. Senza i dati obbligatori non possiamo registrarla.</p>
          <p><strong>Destinatari e diritti:</strong> i dati vengono trattati da Horyzon e dai fornitori dell’infrastruttura e del CRM per le finalità indicate. Puoi esercitare i diritti di accesso, rettifica, cancellazione e gli altri diritti previsti dal GDPR rivolgendoti al titolare, e presentare reclamo al Garante.</p>
          <p>Leggi l’<Link href="/privacy-policy" target="_blank" rel="noopener">informativa privacy completa</Link> per le basi giuridiche, la conservazione e gli ulteriori dettagli.</p>
        </div>
      </details>
      <label className={styles.formConsent}><input name="consent" type="checkbox" required /><span>Dichiaro di aver preso visione dell’<Link href="/privacy-policy" target="_blank" rel="noopener">informativa privacy</Link> e chiedo l’iscrizione all’evento, con email di conferma e promemoria ai recapiti indicati.</span></label>
      <label className={styles.formConsent}><input name="architectCall" type="checkbox" onChange={event => setArchitectCall(event.target.checked)} /><span>Sì, dopo l&apos;evento voglio il confronto gratuito di 40 minuti con un Architetto Patrimoniale.</span></label>
    </fieldset>
    <input name="profile" type="hidden" value={eventProfileValue(selectedProfile)} />
    <input name="qualification" type="hidden" value={JSON.stringify({...qualification, consultationRequested: architectCall})} />
    <input name="message" type="hidden" value={[notes, architectCall ? 'Confronto 40 minuti con Architetto Patrimoniale: sì' : ''].filter(Boolean).join(' | ')} />
    <div hidden><label>Sito web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <button type="submit" className={`${styles.cta} ${styles.formSubmit}`} disabled={disabled || revisionRequired}>
      <span>{status === 'sending' ? 'Invio in corso…' : status === 'success' ? 'Iscrizione confermata.' : 'Conferma la mia iscrizione gratuita'}</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
    {notice && <p role={status === 'error' ? 'alert' : 'status'} className={styles.formNotice}>{notice}</p>}
    {v2 && revisionRequired && <button type="button" className={styles.formBack} disabled={status === 'sending'} onClick={onNewAttempt}>Ho verificato il precedente invio: avvia una nuova richiesta</button>}
    <div className={styles.formFine}>L’invio conferma l’iscrizione all’evento del 9 dicembre, ore 21:00–22:00. Riceverai conferma e promemoria via email, con possibilità di aggiungere l’incontro al calendario. Nessuna newsletter senza consenso separato.</div>
  </form>;
}
