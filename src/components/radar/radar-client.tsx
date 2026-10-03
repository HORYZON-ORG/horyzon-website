'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RADAR_QUESTIONNAIRE_VERSION, type RadarAnswer, type RadarAnswers } from '@/lib/radar/types';
import type { RadarReport } from '@/lib/radar/report';
import { radarSteps } from '@/lib/radar/domain';
import { clearRecovery, createRecoveryEnvelope, loadActiveRecovery, saveRecovery } from './radar-recovery';
import { RadarPaymentGate } from './radar-payment-gate';
import { RADAR_PROCESSING_MS, RadarProcessing } from './radar-processing';
import { RadarQuestionnaire } from './radar-questionnaire';
import { RadarResult } from './radar-result';
import styles from './radar.module.css';

type Phase = 'QUALIFICATION' | 'QUESTIONS' | 'PROCESSING' | 'PAYMENT' | 'RESULT';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function RadarClient() {
  const [phase, setPhase] = useState<Phase>('QUALIFICATION');
  const [assessmentId, setAssessmentId] = useState('');
  const [questionnaireVersion, setQuestionnaireVersion] = useState<string>(RADAR_QUESTIONNAIRE_VERSION);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<RadarAnswers>({});
  const [finishing, setFinishing] = useState(false);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [report, setReport] = useState<RadarReport | null>(null);
  const [aziendaNome, setAziendaNome] = useState('');
  const steps = useMemo(() => radarSteps(questionnaireVersion), [questionnaireVersion]);

  // Answers sync in the background, one at a time (each save must carry the latest revision).
  // The next question shows at once; the browser copy (radar-recovery) covers a reload meanwhile.
  const sync = useRef({ revision: 0, queue: Promise.resolve(), pending: 0, failed: new Map<string, { value: RadarAnswer; currentStep: number }>(), answers: {} as RadarAnswers, step: 0, assessmentId: '', version: RADAR_QUESTIONNAIRE_VERSION as string });

  const finishRequested = useRef(false);

  function remember(nextAnswers: RadarAnswers, nextStep: number) {
    const state = sync.current;
    state.answers = nextAnswers; state.step = nextStep;
    if (state.assessmentId) saveRecovery(localStorage, createRecoveryEnvelope({ assessmentId: state.assessmentId, revision: state.revision, currentStep: nextStep, answers: nextAnswers, questionnaireVersion: state.version }));
  }

  async function postAnswer(answerKey: string, value: RadarAnswer, currentStep: number): Promise<boolean> {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await wait(500 * attempt);
      const response = await fetch('/api/radar/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answerKey, value, expectedRevision: sync.current.revision, currentStep }) }).catch(() => null);
      if (response?.ok) {
        const payload = await response.json();
        sync.current.revision = payload.progress.revision;
        remember(sync.current.answers, sync.current.step);
        return true;
      }
      // Another tab (or a lost response) moved the revision on: read it back and try again.
      if (response?.status === 409) {
        const resumed = await fetch('/api/radar/session/resume', { cache: 'no-store' }).catch(() => null);
        if (resumed?.ok) sync.current.revision = (await resumed.json()).session.revision;
      } else if (response && response.status < 500) return false;
    }
    return false;
  }

  function enqueue(answerKey: string, value: RadarAnswer, currentStep: number) {
    const state = sync.current;
    state.failed.delete(answerKey);
    state.pending += 1; setPending(state.pending);
    state.queue = state.queue.then(async () => {
      const ok = await postAnswer(answerKey, value, currentStep);
      if (!ok) state.failed.set(answerKey, { value, currentStep });
      state.pending -= 1; setPending(state.pending); setFailed(state.failed.size);
      if (!ok) setSyncError('Alcune risposte non sono ancora salvate. Controlla la connessione e premi Riprova.');
    });
  }

  function retryFailed() {
    setSyncError('');
    for (const [answerKey, entry] of [...sync.current.failed]) enqueue(answerKey, entry.value, entry.currentStep);
    // The failure stopped the last step: once the retry lands, finish goes on by itself.
    if (finishRequested.current) void finish();
  }

  async function resume() {
    const local = loadActiveRecovery(localStorage, RADAR_QUESTIONNAIRE_VERSION) ?? loadActiveRecovery(localStorage, 'radar-v1');
    if (local) {
      sync.current = { ...sync.current, revision: local.revision, assessmentId: local.assessmentId, version: local.questionnaireVersion, answers: local.answers, step: local.currentStep };
      setQuestionnaireVersion(local.questionnaireVersion);
      setAssessmentId(local.assessmentId);
      setStepIndex(Math.min(radarSteps(local.questionnaireVersion).length - 1, local.currentStep));
      setAnswers(local.answers);
      setPhase('QUESTIONS');
    }
    const response = await fetch('/api/radar/session/resume', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    const session = payload.session;
    const version = session.questionnaireVersion ?? 'radar-v1';
    let restored = { answers: (session.answers ?? {}) as RadarAnswers, currentStep: session.currentStep as number };
    const useLocal = Boolean(local && local.assessmentId === session.id && local.questionnaireVersion === version && local.revision >= session.revision);
    if (useLocal && local) restored = local;
    sync.current = { ...sync.current, revision: session.revision, assessmentId: session.id, version, answers: restored.answers, step: restored.currentStep };
    setQuestionnaireVersion(version);
    setAssessmentId(session.id); setStepIndex(Math.min(radarSteps(version).length - 1, restored.currentStep)); setAnswers(restored.answers);
    // A finished Radar opens its result (free); the payment gate shows only when the result stays locked.
    if (!['PAYMENT_REQUIRED', 'PAID', 'COMPLETED'].includes(session.status)) {
      setPhase('QUESTIONS');
      // Answers given offline or before a reload, not yet on the server: send them now.
      if (useLocal) for (const [key, value] of Object.entries(restored.answers)) if (JSON.stringify(session.answers?.[key]) !== JSON.stringify(value)) enqueue(key, value, restored.currentStep);
      return;
    }
    if (!(await loadResult(session.id))) setPhase('PAYMENT');
  }

  // The landing's step track (Contesto, Domande, Profilo) reads the current phase from its section.
  useEffect(() => { document.getElementById('radar-prodotto')?.setAttribute('data-phase', phase); }, [phase]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void resume(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Leaving the page with answers still in flight: let the browser warn.
  useEffect(() => {
    if (!pending) return;
    const onLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [pending]);

  async function start(form: FormData) {
    const entries = Object.fromEntries(form.entries());
    const body = { ...entries, seasonal: entries.seasonal === 'true' };
    const response = await fetch('/api/radar/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) { setSyncError('Non è stato possibile avviare il Radar.'); return; }
    const payload = await response.json();
    const initialAnswers = { 'qualificazione#stagionale': body.seasonal ? 1 : 0 };
    sync.current = { ...sync.current, revision: payload.session.revision, assessmentId: payload.session.id, version: questionnaireVersion, failed: new Map() };
    setAssessmentId(payload.session.id); setAnswers(initialAnswers); setAziendaNome(String(entries.aziendaNome ?? '').trim()); setSyncError(''); setPhase('QUESTIONS');
    remember(initialAnswers, 0);
  }

  // advance=false (AI multi-choice toggles) only updates the screen; the answer is saved on Continua.
  function answer(value: RadarAnswer, advance = true) {
    const step = steps[stepIndex]!;
    const nextAnswers = { ...answers, [step.id]: value };
    setAnswers(nextAnswers);
    if (!advance) return;
    const last = stepIndex === steps.length - 1;
    const nextStep = last ? stepIndex : stepIndex + 1;
    remember(nextAnswers, nextStep);
    enqueue(step.id, value, stepIndex + 1);
    if (last) void finish();
    else setStepIndex(nextStep);
  }

  // Last answer: wait for every save to land, then the processing animation runs while the Radar completes.
  async function finish() {
    finishRequested.current = true;
    setFinishing(true);
    await sync.current.queue;
    setFinishing(false);
    if (sync.current.failed.size) return;
    finishRequested.current = false;
    const startedAt = Date.now();
    setPhase('PROCESSING');
    document.getElementById('radar-prodotto')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    const completed = await fetch('/api/radar/complete', { method: 'POST' }).catch(() => null);
    if (!completed?.ok) { setPhase('QUESTIONS'); setSyncError('Non è stato possibile completare il Radar. Riprova tra un momento.'); return; }
    if (!(await loadResult(assessmentId, startedAt))) setPhase('PAYMENT');
  }

  // Start again from the qualification form: forget the session cookie and the local recovery copy.
  async function restart() {
    if (phase === 'QUESTIONS' && !window.confirm('Vuoi ricominciare il Radar da zero? Le risposte date finora non verranno usate.')) return;
    await fetch('/api/radar/session', { method: 'DELETE' }).catch(() => undefined);
    if (assessmentId) clearRecovery(localStorage, assessmentId);
    localStorage.removeItem('horyzon:radar:recovery:active');
    sync.current = { revision: 0, queue: Promise.resolve(), pending: 0, failed: new Map(), answers: {}, step: 0, assessmentId: '', version: RADAR_QUESTIONNAIRE_VERSION };
    setQuestionnaireVersion(RADAR_QUESTIONNAIRE_VERSION); setAssessmentId(''); setStepIndex(0); setAnswers({}); setReport(null); setAziendaNome(''); setPending(0); setFailed(0); setSyncError(''); setPhase('QUALIFICATION');
    document.getElementById('radar-prodotto')?.scrollIntoView({ block: 'start' });
  }

  // startedAt: keep the processing animation on screen for its whole timeline before the result replaces it.
  async function loadResult(id = assessmentId, startedAt?: number): Promise<boolean> {
    const response = await fetch('/api/radar/result', { cache: 'no-store' });
    if (!response.ok) return false;
    const payload = await response.json();
    if (startedAt) await wait(Math.max(0, RADAR_PROCESSING_MS - (Date.now() - startedAt)));
    setReport(payload.report); setPhase('RESULT');
    if (id) clearRecovery(localStorage, id);
    return true;
  }

  if (phase === 'QUALIFICATION') return <Qualification onStart={start} error={syncError}/>;
  if (phase === 'QUESTIONS') return <><RadarQuestionnaire questionnaireVersion={questionnaireVersion} stepIndex={stepIndex} value={answers[steps[stepIndex]?.id ?? '']} saving={finishing} syncing={pending > 0} onAnswer={answer} onBack={() => setStepIndex((current) => Math.max(0, current - 1))}/>{syncError ? <p className={styles.syncError} role="alert">{syncError}{failed ? <> <button type="button" className={styles.retry} onClick={retryFailed}>Riprova</button></> : null}</p> : null}<p className={styles.restartRow}><button type="button" className={styles.restart} onClick={restart}>Rifai il test da zero</button></p></>;
  if (phase === 'PROCESSING') return <RadarProcessing answers={answers} aziendaNome={aziendaNome}/>;
  if (phase === 'PAYMENT') return <RadarPaymentGate onPreviewUnlocked={async () => { await loadResult(); }} onRestart={restart}/>;
  return report ? <RadarResult report={report} onRestart={restart}/> : null;
}

function Qualification({ onStart, error }: { onStart: (form: FormData) => Promise<void>; error: string }) {
  return <section className={styles.panel} aria-labelledby="radar-start-title"><p className={styles.kicker}>Inizia il Radar</p><h2 id="radar-start-title">Raccontaci il contesto.</h2><form action={onStart} className={styles.form}><label>Nome e cognome<input name="referenteNome" required autoComplete="name"/></label><label>Azienda<input name="aziendaNome" required autoComplete="organization"/></label><label>Email<input name="referenteEmail" type="email" required autoComplete="email"/></label><label>Telefono<input name="referenteTelefono" required autoComplete="tel"/></label><label>Settore<input name="settore" required/></label><label>Volume d’affari<select name="volumeAffari" required><option value="">Seleziona</option><option>Meno di 250.000 €</option><option>250.000 – 1.000.000 €</option><option>1 – 5 milioni €</option><option>Oltre 5 milioni €</option></select></label><label>Dipendenti<select name="numeroDipendenti" required><option value="">Seleziona</option><option>Nessuno</option><option>1-5</option><option>6-20</option><option>21-50</option><option>Oltre 50</option></select></label><label>Attività stagionale<select name="seasonal"><option value="false">No</option><option value="true">Sì</option></select></label><button type="submit">Comincia</button>{error ? <p role="alert">{error}</p> : null}</form></section>;
}
