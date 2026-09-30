'use client';

import { useEffect, useMemo, useState } from 'react';
import { RADAR_QUESTIONNAIRE_VERSION, type RadarAnswers, type RadarScores } from '@/lib/radar/types';
import { radarSteps } from '@/lib/radar/domain';
import { clearRecovery, createRecoveryEnvelope, loadActiveRecovery, saveRecovery } from './radar-recovery';
import { RadarPaymentGate } from './radar-payment-gate';
import { RadarQuestionnaire } from './radar-questionnaire';
import { RadarResult } from './radar-result';
import styles from './radar.module.css';

type Phase = 'QUALIFICATION' | 'QUESTIONS' | 'PAYMENT' | 'RESULT';

export function RadarClient() {
  const [phase, setPhase] = useState<Phase>('QUALIFICATION');
  const [assessmentId, setAssessmentId] = useState('');
  const [questionnaireVersion, setQuestionnaireVersion] = useState<string>(RADAR_QUESTIONNAIRE_VERSION);
  const [revision, setRevision] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<RadarAnswers>({});
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [scores, setScores] = useState<RadarScores | null>(null);
  const steps = useMemo(() => radarSteps(questionnaireVersion), [questionnaireVersion]);

  async function resume() {
    const local = loadActiveRecovery(localStorage, RADAR_QUESTIONNAIRE_VERSION) ?? loadActiveRecovery(localStorage, 'radar-v1');
    if (local) {
      setQuestionnaireVersion(local.questionnaireVersion);
      setAssessmentId(local.assessmentId);
      setRevision(local.revision);
      setStepIndex(Math.min(radarSteps(local.questionnaireVersion).length - 1, local.currentStep));
      setAnswers(local.answers);
      setPhase('QUESTIONS');
    }
    const response = await fetch('/api/radar/session/resume', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    const session = payload.session;
    let restored = { answers: session.answers ?? {}, currentStep: session.currentStep, revision: session.revision };
    if (local && local.assessmentId === session.id && local.questionnaireVersion === (session.questionnaireVersion ?? 'radar-v1') && local.revision >= session.revision) restored = local;
    setQuestionnaireVersion(session.questionnaireVersion ?? 'radar-v1');
    setAssessmentId(session.id); setRevision(restored.revision); setStepIndex(Math.min(radarSteps(session.questionnaireVersion ?? 'radar-v1').length - 1, restored.currentStep)); setAnswers(restored.answers);
    setPhase(['PAYMENT_REQUIRED', 'PAID', 'COMPLETED'].includes(session.status) ? 'PAYMENT' : 'QUESTIONS');
  }

  // The landing's step track (Contesto, Domande, Profilo) reads the current phase from its section.
  useEffect(() => { document.getElementById('radar-prodotto')?.setAttribute('data-phase', phase); }, [phase]);

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
    saveRecovery(localStorage, createRecoveryEnvelope({ assessmentId: payload.session.id, revision: payload.session.revision, currentStep: 0, answers: initialAnswers, questionnaireVersion }));
  }

  async function answer(value: number | number[], advance = true) {
    const step = steps[stepIndex]!;
    const nextAnswers = { ...answers, [step.id]: value };
    setAnswers(nextAnswers); setSaving(true); setSyncError('');
    if (assessmentId) saveRecovery(localStorage, createRecoveryEnvelope({ assessmentId, revision, currentStep: stepIndex, answers: nextAnswers, questionnaireVersion }));
    try {
      const response = await fetch('/api/radar/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answerKey: step.id, value, expectedRevision: revision, currentStep: stepIndex + 1 }) });
      if (!response.ok) throw new Error('sync');
      const payload = await response.json();
      const nextStep = advance ? Math.min(steps.length, stepIndex + 1) : stepIndex;
      setRevision(payload.progress.revision);
      if (assessmentId) saveRecovery(localStorage, createRecoveryEnvelope({ assessmentId, revision: payload.progress.revision, currentStep: nextStep, answers: nextAnswers, questionnaireVersion }));
      if (!advance) return;
      if (stepIndex === steps.length - 1) { const completed = await fetch('/api/radar/complete', { method: 'POST' }); if (!completed.ok) throw new Error('complete'); setPhase('PAYMENT'); }
      else setStepIndex((current) => current + 1);
    } catch { setSyncError('Risposta non ancora sincronizzata. Riprova prima di continuare.'); }
    finally { setSaving(false); }
  }

  // Start again from the qualification form: forget the session cookie and the local recovery copy.
  async function restart() {
    if (phase === 'QUESTIONS' && !window.confirm('Vuoi ricominciare il Radar da zero? Le risposte date finora non verranno usate.')) return;
    await fetch('/api/radar/session', { method: 'DELETE' }).catch(() => undefined);
    if (assessmentId) clearRecovery(localStorage, assessmentId);
    localStorage.removeItem('horyzon:radar:recovery:active');
    setQuestionnaireVersion(RADAR_QUESTIONNAIRE_VERSION); setAssessmentId(''); setRevision(0); setStepIndex(0); setAnswers({}); setScores(null); setSyncError(''); setPhase('QUALIFICATION');
    document.getElementById('radar-prodotto')?.scrollIntoView({ block: 'start' });
  }

  async function loadResult() {
    const response = await fetch('/api/radar/result', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json(); setScores(payload.result.scores); setPhase('RESULT');
    if (assessmentId) clearRecovery(localStorage, assessmentId);
  }

  if (phase === 'QUALIFICATION') return <Qualification onStart={start} error={syncError}/>;
  if (phase === 'QUESTIONS') return <><RadarQuestionnaire questionnaireVersion={questionnaireVersion} stepIndex={stepIndex} value={answers[steps[stepIndex]?.id ?? '']} saving={saving} onAnswer={answer} onBack={() => setStepIndex((current) => Math.max(0, current - 1))}/>{syncError ? <p className={styles.syncError} role="alert">{syncError}</p> : null}<p className={styles.restartRow}><button type="button" className={styles.restart} onClick={restart}>Rifai il test da zero</button></p></>;
  if (phase === 'PAYMENT') return <RadarPaymentGate onPreviewUnlocked={loadResult} onRestart={restart}/>;
  return scores ? <RadarResult scores={scores} onRestart={restart}/> : null;
}

function Qualification({ onStart, error }: { onStart: (form: FormData) => Promise<void>; error: string }) {
  return <section className={styles.panel} aria-labelledby="radar-start-title"><p className={styles.kicker}>Inizia il Radar</p><h2 id="radar-start-title">Raccontaci il contesto.</h2><form action={onStart} className={styles.form}><label>Nome e cognome<input name="referenteNome" required autoComplete="name"/></label><label>Azienda<input name="aziendaNome" required autoComplete="organization"/></label><label>Email<input name="referenteEmail" type="email" required autoComplete="email"/></label><label>Telefono<input name="referenteTelefono" required autoComplete="tel"/></label><label>Settore<input name="settore" required/></label><label>Volume d’affari<select name="volumeAffari" required><option value="">Seleziona</option><option>Meno di 250.000 €</option><option>250.000 – 1.000.000 €</option><option>1 – 5 milioni €</option><option>Oltre 5 milioni €</option></select></label><label>Dipendenti<select name="numeroDipendenti" required><option value="">Seleziona</option><option>Nessuno</option><option>1-5</option><option>6-20</option><option>21-50</option><option>Oltre 50</option></select></label><label>Attività stagionale<select name="seasonal"><option value="false">No</option><option value="true">Sì</option></select></label><button type="submit">Comincia</button>{error ? <p role="alert">{error}</p> : null}</form></section>;
}
