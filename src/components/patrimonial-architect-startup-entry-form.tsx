'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { pilotUtmKeys, type PilotUtm } from '@/content/patrimonial-funnels';
import styles from './patrimonial-architect-preview.module.css';

function currentAttribution(): PilotUtm {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(pilotUtmKeys.flatMap(key => {
    const raw = params.get(key);
    if (!raw) return [];
    const value = raw.replace(/[\r\n]/g, '').trim().slice(0, 100);
    return value ? [[key, value]] : [];
  })) as PilotUtm;
}

const subscribeToHydration = () => () => {};

/** The public funnel asks for contact details only. A Hub candidate does not exist yet. */
export function ArchitectStartupEntryForm() {

  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/architect-startup/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          firstName: data.get('firstName'),
          lastName: data.get('lastName'),
          email: data.get('email'),
          phone: data.get('phone'),
          consent: data.get('consent') === 'on',
          website: data.get('website') || '',
          utm: currentAttribution(),
        }),
      });
      const body: { ok?: boolean; message?: string; nextStep?: { href?: string } } = await response.json();
      const href = body.nextStep?.href;
      if (!response.ok || body.ok !== true ||
        typeof href !== 'string' ||
        !/^\/candidature\/architetti-patrimoniali\/startup#token=[A-Za-z0-9_-]{43}$/.test(href)) {
        setError(body.message || 'Non è stato possibile proseguire. Riprova.');
        return;
      }
      // Full document navigation is required: on a Next.js client-side transition
      // the browser retains the source page's Content-Security-Policy, which does
      // not authorize the Horyzon video Blob. A document navigation applies the
      // Startup route's scoped media-src and preserves the personal #token.
      window.location.assign(href);
    } catch {
      setError('Connessione non disponibile. Verifica la rete e riprova.');
    } finally { setSending(false); }
  }

  return <form className={styles.formCard} data-pilot-form="architect-path" onSubmit={submit}
      aria-labelledby="architect-path-form-title" aria-busy={sending}>
    <h3 id="architect-path-form-title" className="sr-only">Accedi alla presentazione Startup Horyzon</h3>
    <div className={styles.formProgress}>
      <span>I TUOI RECAPITI</span>
      <span>UN SOLO PASSAGGIO</span>
    </div>
    <div className={styles.formTrack}><div className={styles.formFull} /></div>
    <fieldset className={styles.formFields} disabled={sending}>
      <legend className="sr-only">I tuoi recapiti</legend>
      <div className={styles.formGrid}>
        <label>Nome<input name="firstName" type="text" autoComplete="given-name" required maxLength={120} /></label>
        <label>Cognome<input name="lastName" type="text" autoComplete="family-name" required maxLength={120} /></label>
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label>Numero di telefono<input name="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={40} /></label>
      </div>
      <label className={styles.formConsent}>
        <input name="consent" type="checkbox" required />
        <span>Ho letto l&apos;<a href="https://www.iubenda.com/privacy-policy/64704330" target="_blank" rel="noopener noreferrer">informativa privacy</a> e acconsento all&apos;uso dei recapiti per accedere alla presentazione. Al termine del video potrò scegliere se chiedere di essere ricontattato.</span>
      </label>
    </fieldset>
    <div hidden aria-hidden="true"><label>Sito web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <button type="submit" className={styles.formSubmit} disabled={!hydrated || sending}>
      {sending ? 'Preparazione della presentazione…' : 'Confermo i recapiti e accedo alla startup →'}
    </button>
    {error && <p className={styles.formNotice} role="alert">{error}</p>}
  </form>;
}
