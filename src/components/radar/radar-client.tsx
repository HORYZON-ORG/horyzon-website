'use client';

import { useEffect, useMemo, useState } from 'react';
import { RADAR_QUESTIONNAIRE_VERSION, radarSteps, type RadarAnswers, type RadarScores } from '@/lib/radar';
import { clearRecovery, createRecoveryEnvelope, loadActiveRecovery, saveRecovery } from './radar-recovery';
import { RadarPaymentGate } from './radar-payment-gate';
import { RadarQuestionnaire } from './radar-questionnaire';
import { RadarResult } from './radar-result';
import styles from './radar.module.css';

type Phase = 'QUALIFICATION' | 'QUESTIONS' | 'PAYMENT' | 'RESULT';

export function RadarClient() {
  const [phase, setPhase] = useState<Phase>('QUALIFICATION');
  const [assessmentId, setAssessmentId] = useState('');
  const [revision, setRevision] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<RadarAnswers>({});
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [scores, setScores] = useState<RadarScores | null>(null);
  const steps = useMemo(() => radarSteps(), []);

  async function resume() {
    const local = loadActiveRecovery(localStorage, RADAR_QUESTIONNAIRE_VERSION);
    if (local) {
      setAssessmentId(local.assessmentId);
      setRevision(local.revision);
      setStepIndex(Math.min(29, local.currentStep));
      setAnswers(local.answers);
      setPhase('QUESTIONS');
    }
    const response = await fetch('/api/radar/session/resume', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    const session = payload.session;
    let restored = { answers: session.answers ?? {}, currentStep: session.currentStep, revision: session.revision };
    if (local && local.assessmentId === session.id && local.revision >= session.revision) restored = local;
    setAssessmentId(session.id); setRevision(restored.revision); setStepIndex(Math.min(29, restored.currentStep)); setAnswers(restored.answers);
    setPhase(['PAYMENT_REQUIRED', 'PAID', 'COMPLETED'].includes(session.status) ? 'PAYMENT' : 'QUESTIONS');
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void resume(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function start(form: FormData) {
    const entries = Object.fromEntries(form.entries());
    const body = { ...entries, seasonal: entries.seasonal === 'true' };
    const response = await fetch('/api/radar/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) { setSyncError('Non è stato possibile avviare il Radar.'); return; }
    const payload = await response.json();
    const initialAnswers = { 'qualificazione#stagionale': body.seasonal ? 1 : 0 };
    setAssessmentId(payload.session.id); setRevision(payload.session.revision); setAnswers(initialAnswers); setPhase('QUESTIONS');
    saveRecovery(localStorage, createRecoveryEnvelope({ assessmentId: payload.session.id, revision: payload.session.revision, currentStep: 0, answers: initialAnswers, questionnaireVersion: RADAR_QUESTIONNAIRE_VERSION }));
  }

  async function answer(value: number | number[], advance = true) {
    const step = steps[stepIndex]!;
    const nextAnswers = { ...answers, [step.id]: value };
    setAnswers(nextAnswers); setSaving(true); setSyncError('');
    if (assessmentId) saveRecovery(localStorage, createRecoveryEnvelope({ assessmentId, revision, currentStep: stepIndex, answers: nextAnswers, questionnaireVersion: RADAR_QUESTIONNAIRE_VERSION }));
    try {
      const response = await fetch('/api/radar/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answerKey: step.id, value, expectedRevision: revision, currentStep: stepIndex + 1 }) });
      if (!response.ok) throw new Error('sync');
      const payload = await response.json();
      const nextStep = advance ? Math.min(30, stepIndex + 1) : stepIndex;
      setRevision(payload.progress.revision);
      if (assessmentId) saveRecovery(localStorage, createRecoveryEnvelope({ assessmentId, revision: payload.progress.revision, currentStep: nextStep, answers: nextAnswers, questionnaireVersion: RADAR_QUESTIONNAIRE_VERSION }));
      if (!advance) return;
      if (stepIndex === steps.length - 1) { const completed = await fetch('/api/radar/complete', { method: 'POST' }); if (!completed.ok) throw new Error('complete'); setPhase('PAYMENT'); }
      else setStepIndex((current) => current + 1);
    } catch { setSyncError('Risposta non ancora sincronizzata. Riprova prima di continuare.'); }
    finally { setSaving(false); }
  }

  async function loadResult() {
    const response = await fetch('/api/radar/result', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json(); setScores(payload.result.scores); setPhase('RESULT');
    if (assessmentId) clearRecovery(localStorage, assessmentId);
  }

  if (phase === 'QUALIFICATION') return <Qualification onStart={start} error={syncError}/>;
  if (phase === 'QUESTIONS') return <><RadarQuestionnaire stepIndex={stepIndex} value={answers[steps[stepIndex]?.id ?? '']} saving={saving} onAnswer={answer} onBack={() => setStepIndex((current) => Math.max(0, current - 1))}/>{syncError ? <p className={styles.syncError} role="alert">{syncError}</p> : null}</>;
  if (phase === 'PAYMENT') return <RadarPaymentGate onPreviewUnlocked={loadResult}/>;
  return scores ? <RadarResult scores={scores}/> : null;
}

function Qualification({ onStart, error }: { onStart: (form: FormData) => Promise<void>; error: string }) {
  return <section className={styles.panel} aria-labelledby="radar-start-title"><p className={styles.kicker}>Inizia il Radar</p><h2 id="radar-start-title">Raccontaci il contesto.</h2><form action={onStart} className={styles.form}><label>Nome e cognome<input name="referenteNome" required autoComplete="name"/></label><label>Azienda<input name="aziendaNome" required autoComplete="organization"/></label><label>Email<input name="referenteEmail" type="email" required autoComplete="email"/></label><label>Telefono<input name="referenteTelefono" required autoComplete="tel"/></label><label>Settore<input name="settore" required/></label><label>Volume d’affari<select name="volumeAffari" required><option value="">Seleziona</option><option>Meno di 250.000 €</option><option>250.000 – 1.000.000 €</option><option>1 – 5 milioni €</option><option>Oltre 5 milioni €</option></select></label><label>Dipendenti<select name="numeroDipendenti" required><option value="">Seleziona</option><option>Nessuno</option><option>1-5</option><option>6-20</option><option>21-50</option><option>Oltre 50</option></select></label><label>Attività stagionale<select name="seasonal"><option value="false">No</option><option value="true">Sì</option></select></label><button type="submit">Comincia</button>{error ? <p role="alert">{error}</p> : null}</form></section>;
}
