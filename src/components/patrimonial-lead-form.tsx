'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { patrimonialInterest, patrimonialInterests, type PatrimonialInterest } from '@/content/patrimonial';
import { pilotAvailability, pilotExperience, pilotForms, pilotGoals, pilotUtmKeys, type PilotMode, type PilotUtm } from '@/content/patrimonial-funnels';
import { PATRIMONIAL_V2, PatrimonialClientAttempt, PatrimonialRevisionRequiredError } from '@/lib/public-leads/patrimonial-contract';
import { ArchitectApplicationForm } from './patrimonial-architect-form';
import { architectCvProblem } from '@/content/architect-cv';
import { PatrimonialEventForm } from './patrimonial-event-form';
import { eventReferralFromSearch } from '@/lib/public-leads/patrimonial-event-referral';

type ArchitectPresentation = { presentation?: 'architect' | 'event'; selectedProfile?: string; onProfileChange?: (value: string) => void };
export function PatrimonialLeadForm({ mode = 'legacy/public', contractVersion, ...presentation }: { mode?: 'legacy/public' | PilotMode; contractVersion?: typeof PATRIMONIAL_V2 } & ArchitectPresentation) {
  return mode === 'legacy/public' ? <PublicLeadForm /> : <PilotLeadForm mode={mode} contractVersion={contractVersion} {...presentation} />;
}
function PublicLeadForm() {
  const params = useSearchParams();
  const selected = patrimonialInterest(params.get('interesse')) ?? 'evento-patrimoniale';
  const requested = patrimonialInterest(params.get('interesse'));
  useEffect(() => {
    if (!requested) return;
    const frame = requestAnimationFrame(() => document.getElementById('richiesta-patrimoniale')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [requested]);
  return <LeadForm key={selected} initialInterest={selected} />;
}

// Same per-tab attribution pattern as Radar, scoped to each pilot funnel.
function pilotAttribution(mode: PilotMode, persist = true): PilotUtm {
  const key = `horyzon:patrimonial:${mode}:utm`;
  const params = new URLSearchParams(window.location.search);
  const found = Object.fromEntries(pilotUtmKeys.flatMap(name => params.get(name) ? [[name, params.get(name)!.replace(/[\r\n]/g, '').slice(0, 100)]] : [])) as PilotUtm;
  // V2 persists only the opaque request reference, never attribution/form data.
  if (!persist) return found;
  try {
    if (Object.keys(found).length) { sessionStorage.setItem(key, JSON.stringify(found)); return found; }
    const stored: unknown = JSON.parse(sessionStorage.getItem(key) ?? '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) return Object.fromEntries(pilotUtmKeys.flatMap(name => {
      const value = (stored as Record<string, unknown>)[name];
      return typeof value === 'string' ? [[name, value.replace(/[\r\n]/g, '').slice(0, 100)]] : [];
    })) as PilotUtm;
  } catch { /* Attribution must never prevent a request when storage is unavailable. */ }
  return found;
}

function PilotLeadForm({ mode, contractVersion, presentation, selectedProfile = '', onProfileChange }: { mode: PilotMode; contractVersion?: typeof PATRIMONIAL_V2 } & ArchitectPresentation) {
  const router = useRouter();
  const form = pilotForms[mode];
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [notice, setNotice] = useState('');
  const sending = useRef(false);
  const v2 = contractVersion === PATRIMONIAL_V2;
  const v2Attempt = useRef<PatrimonialClientAttempt | null>(null);
  const referral = useRef<string | null | undefined>(undefined);
  const [revisionRequired, setRevisionRequired] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  // Un CV già caricato non viene ricaricato a ogni nuovo tentativo con lo stesso file.
  const uploadedCv = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => { if (!v2) pilotAttribution(mode); }, [mode, v2]);
  useEffect(() => { if (mode === 'patrimonial-event') referral.current = eventReferralFromSearch(window.location.search); }, [mode]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    if (mode === 'patrimonial-event' && referral.current === null) {
      setStatus('error'); setNotice('Il link personale non è valido. Chiedi al tuo referente un link aggiornato.'); return;
    }
    if (presentation === 'architect' && mode === 'architect-path' && step === 1) {
      if (event.currentTarget.reportValidity()) setStep(2);
      return;
    }
    sending.current = true;
    const data = new FormData(event.currentTarget);
    let cvId: string | undefined;
    if (mode === 'architect-path' && !v2) {
      const file = data.get('cv');
      const problem = architectCvProblem(file);
      if (problem || !(file instanceof File)) { sending.current = false; setStatus('error'); setNotice(problem ?? 'Allega il tuo curriculum in PDF.'); return; }
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (uploadedCv.current?.key === key) cvId = uploadedCv.current.id;
      else {
        setStatus('sending'); setNotice('Caricamento del CV…');
        try {
          const uploaded = await fetch('/api/public-leads/cv', { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file, signal: AbortSignal.timeout(60000) });
          const result = await uploaded.json();
          if (!uploaded.ok || result.ok !== true || typeof result.cvId !== 'string') {
            sending.current = false; setStatus('error'); setNotice(typeof result.message === 'string' ? result.message : 'Non riusciamo a caricare il CV. Riprova.'); return;
          }
          cvId = result.cvId; uploadedCv.current = { key, id: result.cvId };
        } catch { sending.current = false; setStatus('error'); setNotice('Caricamento del CV non riuscito. Controlla la connessione e riprova.'); return; }
      }
    }
    let eventQualification: unknown;
    if (mode === 'patrimonial-event' && !v2) {
      const raw = data.get('qualification');
      if (typeof raw !== 'string' || raw.length > 2500) {
        sending.current = false; setStatus('error'); setNotice('Non riusciamo a leggere le informazioni dell’evento. Aggiorna la pagina.'); return;
      }
      try { eventQualification = JSON.parse(raw); }
      catch {
        sending.current = false; setStatus('error'); setNotice('Le risposte dell’evento non sono valide. Aggiorna la pagina.'); return;
      }
    }
    const payload = {
      mode, sourcePath: form.path, firstName: data.get('firstName'), lastName: data.get('lastName'),
      email: data.get('email'), phone: data.get('phone'), province: data.get('province'), profile: data.get('profile'),
      message: data.get('message'), consent: data.get('consent') === 'on', marketingConsent: data.get('marketingConsent') === 'on',
      website: data.get('website'), utm: pilotAttribution(mode, !v2),
      ...(mode === 'architect-path' ? { experience: data.get('experience'), goal: data.get('goal'), availability: data.get('availability') } : {}),
      ...(cvId ? { cvId } : {}),
      ...(mode === 'patrimonial-event' && !v2 && eventQualification !== undefined ? {qualification: eventQualification} : {}),
      ...(mode === 'patrimonial-event' && referral.current !== undefined ? {referralCode: referral.current} : {}),
    };
    setStatus('sending'); setNotice('');
    try {
      let requestId: string | undefined;
      if (v2) {
        if (!v2Attempt.current) {
          let storage: Storage | undefined;
          try { storage = window.sessionStorage; } catch { /* Keep the reference in memory. */ }
          v2Attempt.current = new PatrimonialClientAttempt(mode, storage);
        }
        requestId = v2Attempt.current.prepare({ ...payload, contractVersion: PATRIMONIAL_V2 });
      }
      const response = await fetch('/api/public-leads', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(requestId ? { 'Idempotency-Key': requestId } : {}) }, signal: AbortSignal.timeout(35000), body: JSON.stringify(v2 ? { ...payload, contractVersion: PATRIMONIAL_V2, requestId } : payload) });
      const result = await response.json();
      if (!response.ok || result.ok !== true || (v2 && !v2Attempt.current?.acceptReceipt(response.status, result))) {
        if (response.status === 400 && cvId) uploadedCv.current = null; // CV scaduto: al prossimo invio si ricarica
        if (v2 && response.status === 409) setRevisionRequired(true);
        setStatus('error'); setNotice(typeof result.message === 'string' ? result.message : 'Invio non confermato. Riprova oppure scrivici.');
        sending.current = false; return;
      }
      setStatus('success'); setNotice(form.success);
      if (v2 && mode === 'patrimonial-event' && typeof result.radarNextStep?.href === 'string' && /^\/radar-patrimoniale#event=[A-Za-z0-9_-]{43}$/.test(result.radarNextStep.href)) { router.push(`${form.path}/grazie#radar=${result.radarNextStep.href.split('=')[1]}`); return; }
      router.push(`${form.path}/grazie`);
    } catch (error) {
      sending.current = false; setStatus('error');
      if (v2 && error instanceof PatrimonialRevisionRequiredError) {
        setRevisionRequired(true); setNotice('I dati sono cambiati. Il precedente invio potrebbe essere già arrivato: verificalo prima di inviare una nuova richiesta.');
      } else setNotice(v2 ? 'Invio non confermato. Riprova mantenendo gli stessi dati oppure scrivici per verificare la ricezione.' : 'Invio non confermato. Riprova oppure scrivici via email.');
    }
  }
  if (presentation === 'architect' && mode === 'architect-path') return <ArchitectApplicationForm step={step} setStep={setStep} selectedProfile={selectedProfile} onProfileChange={onProfileChange}
    onSubmit={submit} status={status} notice={notice} revisionRequired={revisionRequired} v2={v2} onNewAttempt={() => {
      v2Attempt.current?.beginNewAttempt(); setRevisionRequired(false); setStatus('idle');
      setNotice('Nuova richiesta pronta. Premi il pulsante di invio per trasmettere i dati aggiornati.');
    }} />;
  if (presentation === 'event' && mode === 'patrimonial-event') return <PatrimonialEventForm selectedProfile={selectedProfile} onProfileChange={onProfileChange}
    onSubmit={submit} status={status} notice={notice} revisionRequired={revisionRequired} v2={v2} onNewAttempt={() => {
      v2Attempt.current?.beginNewAttempt(); setRevisionRequired(false); setStatus('idle');
      setNotice('Nuova richiesta pronta. Premi il pulsante di invio per trasmettere i dati aggiornati.');
    }} />;
  return <form className="rd-form" onSubmit={submit} aria-labelledby={`${mode}-form-title`} aria-busy={status === 'sending'} data-pilot-form={mode}>
    <fieldset disabled={status === 'sending' || status === 'success'} className="patrimonial-form-fields">
      <legend className="sr-only">{form.title}</legend>
      <h3 id={`${mode}-form-title`}>{form.title}</h3><p>{form.intro}</p>
      <div className="rd-form-fields">
        <label>Nome<input name="firstName" autoComplete="given-name" required maxLength={120} /></label>
        <label>Cognome<input name="lastName" autoComplete="family-name" required maxLength={120} /></label>
      </div>
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <div className="rd-form-fields">
        <label>Telefono {mode === 'patrimonial-event' && <span>(facoltativo)</span>}<input name="phone" type="tel" autoComplete="tel" required={mode === 'architect-path'} maxLength={40} /></label>
        <label>Provincia<input name="province" autoComplete="address-level2" required minLength={2} maxLength={80} /></label>
      </div>
      <label>Profilo <span>(facoltativo)</span><select name="profile" defaultValue=""><option value="">Seleziona</option>{form.profiles.map(value => <option key={value}>{value}</option>)}</select></label>
      {mode === 'architect-path' && <>
        <label>Esperienza commerciale/relazionale <span>(facoltativo)</span><select name="experience" defaultValue=""><option value="">Seleziona</option>{pilotExperience.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Cosa stai cercando <span>(facoltativo)</span><select name="goal" defaultValue=""><option value="">Seleziona</option>{pilotGoals.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Disponibilità <span>(facoltativo)</span><select name="availability" defaultValue=""><option value="">Seleziona</option>{pilotAvailability.map(value => <option key={value}>{value}</option>)}</select></label>
      </>}
      <label>{form.question} <span>(facoltativo)</span><textarea name="message" rows={4} maxLength={1500} /></label>
      <div hidden><label>Sito web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="patrimonial-consent"><input name="consent" type="checkbox" required /> <span>Ho letto l’<Link href="/privacy-policy" target="_blank" rel="noopener">informativa privacy</Link> e chiedo di essere ricontattato per questa richiesta.</span></label>
      <label className="patrimonial-consent"><input name="marketingConsent" type="checkbox" defaultChecked={false} /> <span>Voglio ricevere anche consigli e novità da Horyzon.</span></label>
      <button type="submit" className="rd-cta">{status === 'sending' ? 'Invio in corso…' : status === 'success' ? form.success : form.submit}<span aria-hidden="true">↗︎</span></button>
    </fieldset>
    {notice && <p role={status === 'error' ? 'alert' : 'status'} className="rd-form-note">{notice}</p>}
    {v2 && revisionRequired && <button type="button" className="rd-cta" disabled={status === 'sending'} onClick={() => {
      v2Attempt.current?.beginNewAttempt(); setRevisionRequired(false); setStatus('idle');
      setNotice('Nuova richiesta pronta. Premi il pulsante di invio per trasmettere i dati aggiornati.');
    }}>Ho verificato il precedente invio: avvia una nuova richiesta</button>}
    <p className="rd-form-note">{v2 ? 'La ricevuta conferma solo la registrazione della richiesta, in attesa della gestione da parte di Horyzon. ' : 'I dati della richiesta sono trasmessi al CRM HighLevel di Horyzon per gestire il ricontatto. '}{mode === 'patrimonial-event' && 'La richiesta non conferma una registrazione definitiva all’evento. '}Preferisci scriverci? <a href="mailto:info@horyzon.it">Contattaci via email ↗︎</a>.</p>
  </form>;
}
function LeadForm({ initialInterest }: { initialInterest: PatrimonialInterest }) {
  const [interest, setInterest] = useState(initialInterest);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [notice, setNotice] = useState('');
  const content = patrimonialInterests[interest];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending' || status === 'success') return;
    const data = new FormData(event.currentTarget);
    setStatus('sending'); setNotice('');
    try {
      const response = await fetch('/api/public-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(35000), body: JSON.stringify({ interest, name: data.get('name'), email: data.get('email'), phone: data.get('phone'), message: data.get('message'), consent: data.get('consent') === 'on', website: data.get('website') }) });
      const result = await response.json();
      if (!response.ok || result.ok !== true) { setStatus('error'); setNotice(typeof result.message === 'string' ? result.message : 'Invio non confermato. Riprova oppure scrivici.'); return; }
      setStatus('success'); setNotice('Richiesta ricevuta. Ti ricontatteremo per il percorso che hai scelto.');
    } catch { setStatus('error'); setNotice('Invio non confermato. Riprova oppure scrivici via email.'); }
  }
  return <form className="rd-form" onSubmit={submit} aria-labelledby="patrimonial-contact-title">
    <fieldset disabled={status === 'sending' || status === 'success'} className="patrimonial-form-fields">
      <legend>Di quale percorso vuoi informazioni?</legend>
      <div className="patrimonial-interest-options">{Object.entries(patrimonialInterests).map(([key, item]) => <label key={key}><input type="radio" name="interest-choice" value={key} checked={interest === key} onChange={() => { setInterest(key as PatrimonialInterest); setStatus('idle'); setNotice(''); }} />{item.label}</label>)}</div>
      <h3 id="patrimonial-contact-title">{content.title}</h3><p>{content.intro}</p>
      <div className="rd-form-fields"><label>Nome e cognome<input name="name" autoComplete="name" required maxLength={120} /></label><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label></div>
      <label>Telefono <span>(facoltativo)</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
      <label>{interest === 'percorso-consulenti' ? 'La tua esperienza e che cosa cerchi' : 'Che cosa vorresti approfondire'} <span>(facoltativo)</span><textarea name="message" rows={4} maxLength={1500} /></label>
      <div hidden><label>Sito web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="patrimonial-consent"><input name="consent" type="checkbox" required /> <span>Ho letto l’<Link href="/privacy-policy">informativa privacy</Link> e chiedo di essere ricontattato per questa richiesta.</span></label>
      <p className="rd-form-note">I dati della richiesta sono trasmessi al CRM HighLevel di Horyzon per gestire il ricontatto. Questo modulo non iscrive a campagne marketing e non prenota un posto all’evento.</p>
      <button type="submit" className="rd-cta">{status === 'sending' ? 'Invio in corso…' : status === 'success' ? 'Richiesta ricevuta' : 'Invia la richiesta'} <span aria-hidden="true">↗︎</span></button>
    </fieldset>
    {notice && <p role={status === 'error' ? 'alert' : 'status'} className="rd-form-note">{notice}</p>}
    <p className="rd-form-note">Preferisci scriverci? <a href={`mailto:info@horyzon.it?subject=${encodeURIComponent(content.subject)}`}>Contattaci via email ↗︎</a>.</p>
  </form>;
}
