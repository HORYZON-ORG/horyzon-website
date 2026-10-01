"use client";

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Annunci10xLoader } from './annunci-10x-loader';
import styles from './annunci-10x.module.css';

type BusinessRole = 'OWNER_ENTREPRENEUR' | 'HR' | 'INTERNAL_RECRUITER' | 'CONSULTANT' | 'OTHER';

interface IdentityGateProps {
  title: string;
  eyebrow: string;
  description: string;
  submitLabel?: string;
  savedLabel?: string;
  otpTitle: string;
  analysisRunId?: string | null;
  idPrefix?: string;
  initialContactSaved?: boolean;
  initialEmailVerified?: boolean;
  onContactSaved?: (payload: { emailVerified: boolean }) => void;
  onVerified?: (payload: { resultEligible: boolean }) => void;
}

export function Annunci10xIdentityGate(props: IdentityGateProps) {
  const idPrefix = props.idPrefix ?? 'annunci10x-lead';
  const [contact, setContact] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    businessRole: '' as BusinessRole | '',
    email: '',
    marketingConsent: false,
  });
  const [contactSaved, setContactSaved] = useState(Boolean(props.initialContactSaved));
  const [emailVerified, setEmailVerified] = useState(Boolean(props.initialEmailVerified));
  const [otpCode, setOtpCode] = useState('');
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0);
  const [expiresInSeconds, setExpiresInSeconds] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resendAfterSeconds <= 0 && expiresInSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendAfterSeconds((value) => Math.max(0, value - 1));
      setExpiresInSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAfterSeconds, expiresInSeconds]);

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy('contact');
    try {
      const response = await fetch('/api/annunci-10x/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(contact),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Dati non salvati.');
      const verified = Boolean(payload.emailVerified);
      setContactSaved(true);
      setEmailVerified(verified);
      props.onContactSaved?.({ emailVerified: verified });
    } catch (cause) {
      setError(customerSafeIdentityError(cause, 'Dati non salvati.'));
    } finally {
      setBusy(null);
    }
  }

  async function requestCode() {
    setError(null);
    setBusy('request-code');
    try {
      const response = await fetch('/api/annunci-10x/email-verification/request', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.code ?? payload.error?.message ?? 'EMAIL_PROVIDER_UNAVAILABLE');
      setResendAfterSeconds(Number(payload.resendAfterSeconds ?? 0));
      setExpiresInSeconds(Number(payload.expiresInSeconds ?? 0));
      setStatusMessage(payload.sent ? 'Codice inviato.' : `Puoi richiedere un nuovo codice tra ${Number(payload.resendAfterSeconds ?? 0)} secondi.`);
    } catch (cause) {
      setError(customerSafeIdentityError(cause, 'La verifica email è temporaneamente non disponibile.'));
    } finally {
      setBusy(null);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy('verify-code');
    try {
      const response = await fetch('/api/annunci-10x/email-verification/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(props.analysisRunId ? { code: otpCode, analysisRunId: props.analysisRunId } : { code: otpCode }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Codice non valido.');
      setEmailVerified(true);
      props.onVerified?.({ resultEligible: Boolean(payload.resultEligible) });
      setStatusMessage(payload.resultEligible ? 'Email verificata. Il risultato è pronto.' : 'Email verificata.');
    } catch (cause) {
      setError(customerSafeIdentityError(cause, 'Codice non valido.'));
    } finally {
      setBusy(null);
    }
  }

  if (emailVerified) {
    return <p className={styles.verifiedRow} role="status"><b aria-hidden="true">✓</b>Email verificata.</p>;
  }

  return <>
    {!contactSaved && <form className={styles.form} onSubmit={submitContact} aria-labelledby={`${idPrefix}-identity-title`}>
      <div className={styles.formHead}>
        <p>{props.eyebrow}</p>
        <h2 id={`${idPrefix}-identity-title`}>{props.title}</h2>
        <span>{props.description}</span>
      </div>
      <div className={styles.fieldGrid}>
        <Field label="Nome" htmlFor={`${idPrefix}-first-name`} required><input id={`${idPrefix}-first-name`} required value={contact.firstName} onChange={(event) => setContact({ ...contact, firstName: event.target.value })} disabled={busy === 'contact'} /></Field>
        <Field label="Cognome" htmlFor={`${idPrefix}-last-name`} required><input id={`${idPrefix}-last-name`} required value={contact.lastName} onChange={(event) => setContact({ ...contact, lastName: event.target.value })} disabled={busy === 'contact'} /></Field>
      </div>
      <Field label="Email aziendale" htmlFor={`${idPrefix}-email`} required><input id={`${idPrefix}-email`} type="email" required value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} disabled={busy === 'contact'} /></Field>
      <details className={styles.optionalFields}>
        <summary>Dati facoltativi <span>azienda e ruolo</span></summary>
        <p>Puoi aggiungerli ora o lasciarli vuoti: non bloccano verifica email e Score.</p>
        <div className={styles.fieldGrid}>
          <Field label="Azienda" htmlFor={`${idPrefix}-company`} optional><input id={`${idPrefix}-company`} value={contact.companyName} onChange={(event) => setContact({ ...contact, companyName: event.target.value })} disabled={busy === 'contact'} /></Field>
          <Field label="Ruolo aziendale" htmlFor={`${idPrefix}-role`} optional><select id={`${idPrefix}-role`} value={contact.businessRole} onChange={(event) => setContact({ ...contact, businessRole: event.target.value as BusinessRole | '' })} disabled={busy === 'contact'}><option value="">Non indicato</option><option value="OWNER_ENTREPRENEUR">Titolare</option><option value="HR">HR</option><option value="INTERNAL_RECRUITER">Recruiter interno</option><option value="CONSULTANT">Consulente</option><option value="OTHER">Altro</option></select></Field>
        </div>
      </details>
      <label className={styles.unknownToggle}><input type="checkbox" checked={contact.marketingConsent} onChange={(event) => setContact({ ...contact, marketingConsent: event.target.checked })} disabled={busy === 'contact'} /><span>Voglio ricevere anche consigli e novità da Horyzon.</span></label>
      <p className={styles.formMicrocopy}>Niente spam. Ti cancelli con un clic.</p>
      <div className={styles.actions}><button type="submit" disabled={busy === 'contact'}>{busy === 'contact' ? 'Salvataggio in corso' : props.submitLabel ?? 'Salva contatto'}</button></div>
      {busy === 'contact' && <Annunci10xLoader variant="strip" indeterminate label="Salviamo i dati di contatto" />}
    </form>}

    {contactSaved && <section className={styles.form} aria-labelledby={`${idPrefix}-email-verification-title`}>
      <div className={styles.formHead}><p>Verifica email</p><h2 id={`${idPrefix}-email-verification-title`}>{props.otpTitle}</h2></div>
      <div className={styles.actions}>
        <button type="button" onClick={requestCode} disabled={busy === 'request-code' || resendAfterSeconds > 0}>{resendAfterSeconds > 0 ? `Nuovo codice tra ${resendAfterSeconds}s` : 'Invia codice'}</button>
        {expiresInSeconds > 0 && <span>Codice valido per circa {expiresInSeconds >= 120 ? `${Math.round(expiresInSeconds / 60)} minuti` : `${expiresInSeconds} secondi`}.</span>}
      </div>
      {busy === 'request-code' && <Annunci10xLoader variant="strip" indeterminate label="Prepariamo il codice email" />}
      <form onSubmit={verifyCode} className={styles.inlineVerify}>
        <Field label="Codice di 6 cifre" htmlFor={`${idPrefix}-otp`} required><input id={`${idPrefix}-otp`} className={styles.otpInput} placeholder="••••••" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={otpCode} onChange={(event) => setOtpCode(event.target.value)} disabled={busy === 'verify-code'} /></Field>
        <button type="submit" disabled={busy === 'verify-code' || otpCode.length !== 6}>Verifica email</button>
      </form>
      {busy === 'verify-code' && <Annunci10xLoader variant="strip" indeterminate label="Verifichiamo il codice" />}
    </section>}

    {statusMessage && <p className={styles.flowStatus} aria-live="polite">{statusMessage}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </>;
}

function Field(props: { label: string; htmlFor: string; required?: boolean; optional?: boolean; children: ReactNode }) {
  return <label className={styles.field} htmlFor={props.htmlFor}><span>{props.label}{props.required && <b> *</b>}{props.optional && <em>opzionale</em>}</span>{props.children}</label>;
}

function customerSafeIdentityError(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : fallback;
  if (/EMAIL_PROVIDER_UNAVAILABLE|EMAIL_VERIFICATION_UNAVAILABLE|provider email|verifica email/i.test(message)) return 'La verifica email è temporaneamente non disponibile.';
  return message || fallback;
}
