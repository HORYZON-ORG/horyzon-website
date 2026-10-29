'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { QUESTION_CATALOG, question } from '@/lib/patrimonial-radar/catalog';
import { resolveAnswers, value } from '@/lib/patrimonial-radar/answers';
import { validateValue } from '@/lib/patrimonial-radar/validation';
import { diagnose } from '@/lib/patrimonial-radar/result';
import type { AssessmentInput, QuestionId } from '@/lib/patrimonial-radar/types';
import { areaNames, confirmDraft, latestDraft, optionalTitles, route, stateLabels, type Draft } from '@/lib/patrimonial-radar-ui/presentation';
import { radarApi, RadarApiError } from '@/lib/patrimonial-radar-ui/api';
import type { CustomerSnapshot } from '@/lib/patrimonial-radar-ui/customer-result';
import type { Assessment, VerifiedSession } from '@/lib/patrimonial-radar-server/contracts';
import { SERVICE_NOTICE_VERSION } from '@/lib/patrimonial-radar-server/contracts';
import { EventRadarLink } from './event-link';
import { RadarInstrument } from './radar-instrument';
import { radarSerif } from './fonts';
import { editorialQuestion } from '@/lib/patrimonial-radar-ui/editorial-copy';
import { QuestionFields } from './question-fields';
import { AnswerFields } from './answer-fields';
import { ResultPreview } from './result-preview';
import styles from './radar.module.css';
type Phase = 'INTRO' | 'IDENTITY' | 'HISTORY' | 'QUESTIONS' | 'OPTIONAL' | 'REVIEW' | 'PREVIEW';
type HistoryItem = { id: string; revision: number; status: string; createdAt: string; updatedAt: string };
type Session = VerifiedSession & { csrf: string };
type Operation = { path: string; body: unknown; success: (reply: unknown) => Promise<void> };
const optional = QUESTION_CATALOG.filter(q => q.optional);
export function PatrimonialRadarClient({ asOf, foundation = false, protectedService = false, accountAuth = false,referralCode }: { asOf: string; foundation?: boolean; protectedService?: boolean; accountAuth?: boolean;referralCode?:string|null }) {
  const [referralReady,setReferralReady]=useState(!accountAuth||referralCode===undefined);
  const [referralState,setReferralState]=useState<'VALID'|'REVIEW_REQUIRED'|'CURRENT_OWNER'|null>(null);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [firstName,setFirstName]=useState(''),[lastName,setLastName]=useState('');
  const [eventTicket, setEventTicket] = useState(''), [reconciliationId, setReconciliationId] = useState('');
  const [input, setInput] = useState<AssessmentInput>({ asOf, answers: [] });
  const [phase, setPhase] = useState<Phase>('INTRO'), [current, setCurrent] = useState<QuestionId>('RP-S01');
  const [drafts, setDrafts] = useState<Partial<Record<QuestionId, Draft>>>({}), [error, setError] = useState('');
  const [result, setResult] = useState<CustomerSnapshot | null>(null), [pending, setPending] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null), [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]), [email, setEmail] = useState(''), [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<{ challengeId: string; csrf: string } | null>(null), [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState('Verifica della sessione…'), [conflict, setConflict] = useState(false), [retryable, setRetryable] = useState(false), [comparison, setComparison] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), busy = useRef(false), failed = useRef<Operation | null>(null);
  const sessionRef = useRef<Session | null>(null), personRef = useRef<string | null>(null), resendAt = useRef(0);
  const locked = pending || conflict || retryable || !referralReady;
  function acceptSession(next: Session) {
    if (personRef.current && personRef.current !== next.personId) { setDrafts({}); setInput({ asOf, answers: [] }); setAssessment(null); setReconciliationId(''); setNoticeAccepted(false); failed.current = null; setRetryable(false); setConflict(false); }
    personRef.current = next.personId; sessionRef.current = next; setSession(next); setEmail(''); setCode(''); setChallenge(null);
  }
  async function listEpisodes() { setHistory(await radarApi<HistoryItem[]>('/assessments')); setPhase('HISTORY'); }
  async function loadEpisode(id: string, keepDrafts = false) {
    const reply = await radarApi<{ assessment: Assessment }>(`/assessments/${id}`);
    if (reply.assessment.status === 'COMPLETED') { setResult(await radarApi<CustomerSnapshot>(`/assessments/${id}/snapshot`)); setAssessment(null); setPhase('PREVIEW'); return reply.assessment; }
    setAssessment(reply.assessment); setInput(reply.assessment.input); setResult(null);
    setComparison(keepDrafts);
    if (!keepDrafts) setDrafts({});
    const resolved = resolveAnswers(reply.assessment.input), ids = route(reply.assessment.input);
    const needed = ids.find(id => !resolved[id].ref || resolved[id].lifecycle === 'RECONFIRM' || resolved[id].issues.length);
    if (keepDrafts) { setPhase('QUESTIONS'); setCurrent(id => ids.includes(id) || question(id).optional && resolved[id].applicability !== 'NOT_APPLICABLE' ? id : needed ?? ids[0]); }
    else { setCurrent(needed ?? ids[0]); setPhase(needed ? 'QUESTIONS' : 'REVIEW'); }
    return reply.assessment;
  }
  function reportFailure(cause: unknown, operation?: Operation) {
    const failure = cause instanceof RadarApiError ? cause.code : 'UNAVAILABLE';
    if (failure === 'UNAUTHENTICATED' || failure === 'FORBIDDEN') {
      sessionRef.current = null; setSession(null); failed.current = null; setRetryable(false); setPhase('IDENTITY'); setChallenge(null);
      setError('Sessione scaduta o accesso non valido. Verifica di nuovo la stessa email; le bozze non confermate restano in memoria in questa scheda.');
    } else if (failure === 'CONFLICT') {
      failed.current = null; setRetryable(false); setConflict(true);
      setError('La compilazione è cambiata in un’altra scheda o dispositivo. La tua risposta non ha sovrascritto i dati più recenti. Aggiorna dal server e confronta la bozza conservata prima di confermarla.');
    } else {
      const retry = ['NETWORK', 'UNAVAILABLE'].includes(failure) ? operation ?? null : null;
      failed.current = retry; setRetryable(!!retry);
      setError(failure === 'INCOMPLETE' ? 'Prima di completare, conferma tutte le domande applicabili e le risposte da riconfermare.' : failure === 'VERSION_MISMATCH' ? 'Questa compilazione usa una versione diversa. Non può essere modificata con il questionario corrente.' : failure === 'INVALID' ? 'Controlla i dati inseriti e riprova.' : 'Connessione o servizio non disponibile. Le risposte già salvate restano sul server; la bozza non confermata resta in questa scheda. Riprova prima di proseguire.');
    }
    setStatus('Salvataggio non concluso');
  }
  async function work(job: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await job(); } catch (cause) { reportFailure(cause); } finally { busy.current = false; setPending(false); }
  }
  async function perform(operation: Operation) {
    if (busy.current || !sessionRef.current) return;
    busy.current = true; setPending(true); setError(''); setStatus('Salvataggio in corso…');
    failed.current = operation; setRetryable(false);
    try {
      const reply = await radarApi(operation.path, operation.body, sessionRef.current.csrf);
      await operation.success(reply); failed.current = null; setRetryable(false); setStatus('Salvato sul server');
    } catch (cause) { reportFailure(cause, operation); } finally { busy.current = false; setPending(false); }
  }
  useEffect(() => {
    let alive = true;
    async function boot() {
      if(accountAuth&&referralCode!==undefined){
        try{const r=await radarApi<{state:'VALID'|'REVIEW_REQUIRED'}>('/referral',{code:referralCode},'referral-context');if(!alive)return;setReferralState(r.state);setReferralReady(true);window.history.replaceState(null,'',window.location.pathname+window.location.hash);}
        catch{if(alive){setStatus('Link non verificato');setError('Non è stato possibile conservare la provenienza. Ricarica la pagina per riprovare prima di iniziare.');}return;}
      }
      if (foundation && !accountAuth) {
        const match = window.location.hash.match(/^#event=([A-Za-z0-9_-]{43})$/);
        if (match) { setEventTicket(match[1]); window.history.replaceState(null, '', window.location.pathname); }
      }
      try {
        const verified = await radarApi<Session>('/session'); if (!alive) return; acceptSession(verified);
        const items = await radarApi<HistoryItem[]>('/assessments'); if (!alive) return; setHistory(items);
        const draft = items.find(item => item.status === 'DRAFT');
        if (draft) await loadEpisode(draft.id); else if (items.length) setPhase('HISTORY');
        setStatus(draft ? 'Bozza recuperata dal server' : 'Identità verificata');
      } catch (cause) { if (alive) { if (cause instanceof RadarApiError && cause.code === 'UNAUTHENTICATED') setStatus('Identificati per salvare e riprendere'); else { setStatus('Servizio non disponibile'); setError('Impossibile verificare la sessione. Puoi riprovare con “Inizia la fotografia”.'); } } }
    }
    void boot(); return () => { alive = false; };
    // One session bootstrap per mounted page; no browser persistence or auto-create.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!cooldown) return; const timer = setInterval(() => setCooldown(Math.max(0, Math.ceil((resendAt.current - Date.now()) / 1000))), 1000); return () => clearInterval(timer); }, [cooldown]);
  useEffect(() => {
    function protect(event: BeforeUnloadEvent) { if (Object.keys(drafts).length || busy.current || failed.current) event.preventDefault(); }
    window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect);
  }, [drafts]);
  function begin() { if (locked) return; if (sessionRef.current) void work(listEpisodes); else { setPhase('IDENTITY'); setError(''); } }
  function requestCode() { void work(async () => { const reply = await radarApi<{ challengeId: string; csrf: string; message: string }>('/identity/request', { email, ...(accountAuth?{firstName,lastName}:{}) }, 'request-code'); setChallenge(reply); setCode(''); resendAt.current = Date.now() + 60000; setCooldown(60); setStatus(reply.message); }); }
  function verifyCode() { if (!challenge) return; void work(async () => {
    try { const verified = await radarApi<Session>('/identity/verify', { challengeId: challenge.challengeId, code }, challenge.csrf); const resume = personRef.current === verified.personId && assessment; acceptSession(verified); if (resume) await loadEpisode(resume.id, true); else await listEpisodes(); setStatus('Identità verificata'); }
    catch (cause) { if (cause instanceof RadarApiError && ['UNAUTHENTICATED','FORBIDDEN'].includes(cause.code)) { setCode(''); setError('Codice non valido, scaduto o già utilizzato. Controllalo oppure richiedine uno nuovo.'); } else throw cause; }
  }); }
  function mayLeaveDraft() { return !Object.keys(drafts).length || window.confirm('Le modifiche non confermate sono solo in questa scheda. Vuoi scartarle prima di aprire un altro episodio? Le risposte salvate restano sul server.'); }
  function acknowledgeNotice(checked:boolean) {
    if(!checked){setNoticeAccepted(false);return;}
    if(assessment)void work(async()=>{await radarApi(`/assessments/${assessment.id}/notice`,{noticeVersion:SERVICE_NOTICE_VERSION},sessionRef.current?.csrf);setNoticeAccepted(true);});
    else setNoticeAccepted(true);
  }
  function createEpisode() {
    if (locked || !mayLeaveDraft()) return;
    if (foundation && !noticeAccepted) { setError('Leggi e conferma l’informativa sul salvataggio prima di compilare.'); return; }
    void perform({ path: '/assessments', body: { requestId: crypto.randomUUID(), entryMode: reconciliationId ? 'EVENT' : 'DIRECT', ...(foundation ? { noticeVersion: SERVICE_NOTICE_VERSION } : {}) }, success: async reply => {
      const id = (reply as { id: string }).id;
      const attribution=(reply as {attributionStatus?:string}).attributionStatus;
      if(attribution?.endsWith('REVIEW'))setReferralState('REVIEW_REQUIRED');
      else if(attribution==='EXISTING_OTHER_OWNER')setReferralState('CURRENT_OWNER');
      if (reconciliationId) await radarApi('/event/link-assessment', { assessmentId: id, reconciliationId }, sessionRef.current?.csrf);
      await loadEpisode(id);
    } });
  }
  function openEpisode(item: HistoryItem) { if (locked || item.id !== assessment?.id && !mayLeaveDraft()) return; void work(async () => { if (item.status === 'COMPLETED') { setResult(await radarApi<CustomerSnapshot>(`/assessments/${item.id}/snapshot`)); setPhase('PREVIEW'); setAssessment(null); setDrafts({}); } else await loadEpisode(item.id, item.id === assessment?.id); setStatus('Compilazione recuperata dal server'); }); }
  function logout(allDevices: boolean) { if (locked) return; void work(async () => { await radarApi('/session/revoke', { allDevices }, sessionRef.current?.csrf); sessionRef.current = null; setSession(null); setReconciliationId(''); setNoticeAccepted(false); setInput({ asOf, answers: [] }); setDrafts({}); setAssessment(null); setResult(null); setHistory([]); setPhase('IDENTITY'); setStatus('Accesso revocato'); }); }

  const answers = useMemo(() => resolveAnswers(input), [input]), ordinary = useMemo(() => route(input), [input]);
  const q = question(current), position = ordinary.indexOf(current), isOptional = q.optional;
  const copy = editorialQuestion(current, value<string[]>(answers, 'RP-S03'));
  const draft: Draft = drafts[current] ?? latestDraft(input, current) ?? { state: 'UNANSWERED' };
  const completed = ordinary.filter(id => answers[id].lifecycle === 'ACTIVE' && !answers[id].issues.length && !['UNANSWERED', 'NOT_APPLICABLE'].includes(answers[id].state)).length;
  const reconfirm = ordinary.filter(id => answers[id].lifecycle === 'RECONFIRM');
  useEffect(() => {
    const title = phase === 'PREVIEW' ? document.querySelector<HTMLHeadingElement>('[data-result-preview] h1') : heading.current;
    title?.focus({ preventScroll: true });
    if (phase === 'INTRO') window.scrollTo({ top: 0, behavior: 'instant' });
    else if (phase === 'QUESTIONS') title?.closest('[data-question-id]')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    else (title?.closest('section') ?? title)?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [current, phase]);
  function change(next: Draft) { if (locked) return; setDrafts(d => ({ ...d, [current]: next })); setError(''); }
  function commit(): AssessmentInput | null {
    const next = confirmDraft(input, current, draft), resolved = resolveAnswers(next)[current];
    if (draft.state === 'VALUE' && (validateValue(current, next.answers.filter(a => a.id === current).at(-1)?.value).length || resolved.issues.length)) {
      setError(current === 'RP-X06' ? 'Controlla le categorie e le priorità: massimo tre obiettivi, con priorità diverse quando indicate. I dettagli facoltativi possono restare da completare.' : current === 'RP-X10' ? 'Scegli fino a tre esperienze, oppure nessuna. Controlla anche aspettative e dubbi; puoi lasciare ogni parte da completare.' : 'Controlla i campi evidenziati e le scelte richieste. Se il dato manca, puoi scegliere “Non so”, “Preferisco non rispondere” o proseguire lasciandolo vuoto.'); return null;
    }
    return next;
  }
  function showPreview() { if (!locked) { setPhase('REVIEW'); setError(''); } }
  function next() {
    if(foundation&&!noticeAccepted){setError('Leggi e conferma l’informativa sul salvataggio prima di proseguire.');return;}
    if (locked || !assessment) return;
    const updated = commit(); if (!updated) return;
    const confirmed = updated.answers.filter(a => a.id === current).at(-1); if (!confirmed) return;
    const qid = current;
    void perform({ path: `/assessments/${assessment.id}/answer`, body: { requestId: crypto.randomUUID(), expectedRevision: assessment.revision, questionId: qid, state: confirmed.state, ...(confirmed.state === 'VALUE' ? { value: confirmed.value } : {}) }, success: async () => {
      const reply = await radarApi<{ assessment: Assessment }>(`/assessments/${assessment.id}`);
      setAssessment(reply.assessment); setInput(reply.assessment.input); setComparison(false);
      setDrafts(d => { const copy = { ...d }; delete copy[qid]; return copy; });
      if (question(qid).optional) { setPhase('OPTIONAL'); return; }
      const ids = route(reply.assessment.input), index = ids.indexOf(qid);
      if (index >= ids.length - 1) setPhase('REVIEW'); else setCurrent(ids[index + 1] ?? ids[0]);
    } });
  }
  function complete() {
    if(foundation&&!noticeAccepted){setError('Leggi e conferma l’informativa sul salvataggio prima di proseguire.');return;}
    if (locked || !assessment || Object.keys(drafts).length) return;
    void perform({ path: `/assessments/${assessment.id}/complete`, body: { requestId: crypto.randomUUID(), expectedRevision: assessment.revision }, success: async reply => { setResult(reply as CustomerSnapshot); setPhase('PREVIEW'); setAssessment(null); } });
  }
  function previous() { if (locked) return; if (isOptional) { setPhase('OPTIONAL'); setError(''); return; } setCurrent(ordinary[Math.max(0, position - 1)]); setError(''); }
  function edit(id: QuestionId) { if (locked || answers[id].applicability === 'NOT_APPLICABLE') return; setCurrent(id); setPhase('QUESTIONS'); setError(''); }
  let warning: string | null = null;
  if (draft.state === 'VALUE' && !validateValue(current, draft.value).length) {
    const candidate = diagnose(confirmDraft(input, current, draft));
    const relevant = candidate.incoherences.find(i => i.refs.some(r => r.id === current));
    if (relevant) warning = relevant.code === 'P_EXCEEDS_L' ? 'Gli accantonamenti superano la liquidità indicata. Rivedi le cifre: questo confronto resterà sospeso finché non sarà chiarito.' : 'Questa risposta richiede un chiarimento rispetto ad altre informazioni. Puoi correggerla o mantenere una lettura parziale; il motore sospenderà le conclusioni coinvolte.';
  }
  return <div className={`${styles.root} ${radarSerif.variable}`} data-assessment-date={input.asOf}><a className={styles.skip} href="#patrimonial-content">Vai al contenuto</a><header className={styles.header}><Link href="/" prefetch={false} aria-label="Horyzon, homepage"><Image src="/benessere-patrimoniale/horyzon-consulting-benessere-patrimoniale.png" alt="Horyzon Consulting · Benessere Patrimoniale" width={1200} height={354} sizes="(max-width: 760px) 170px, 230px" priority /></Link>{!protectedService ? <span className={styles.demoPill}><i aria-hidden="true" />Demo locale</span> : null}</header>
    <main id="patrimonial-content" className={styles.main} aria-busy={pending}>
      {accountAuth&&referralCode!==undefined ? <aside className={styles.demoNotice} role="status" aria-label="Provenienza del Radar"><strong>{!referralReady?'Verifica del link personale…':referralState==='REVIEW_REQUIRED'?'Il collegamento richiede una verifica.':referralState==='CURRENT_OWNER'?'Responsabile attuale conservato.':'Link personale riconosciuto.'}</strong><span>{referralState==='REVIEW_REQUIRED'?'Puoi compilare il Radar con la tua email verificata. Il dossier non viene attribuito automaticamente dal link.':'Un responsabile già assegnato viene mantenuto. Il link non autentica la persona e non concede accesso ai report.'}</span></aside> : null}
      {foundation ? <aside className={styles.consent} aria-label="Informativa sul salvataggio"><details className={styles.consentDetails}><summary><span className={styles.consentTitle}>Prima di compilare</span><span className={styles.consentLead}>Come conserviamo e consultiamo le tue risposte</span><span className={styles.consentToggle} aria-hidden="true" /></summary><div className={styles.consentBody}><p>Horyzon conserva le risposte confermate e i report, così puoi riprendere il percorso e seguirne l’evoluzione nel tempo. Gli incaricati con permessi dedicati possono consultare i dati strettamente necessari; la lettura patrimoniale è riservata all’Advisor assegnato e autorizzato. Il consenso al marketing non autorizza la lettura del dossier.</p><p>Il risultato è una sintesi educativa delle risposte e delle informazioni mancanti: non promette risultati finanziari e non costituisce consulenza. Per informazioni sui tuoi dati e per esercitare i tuoi diritti puoi scrivere a <a href="mailto:info@horyzon.it">info@horyzon.it</a>. Il marketing e un eventuale servizio di consulenza hanno finalità e condizioni distinte.</p><p>{protectedService ? null : 'Questo ambiente locale usa soltanto dati inventati. '}I normali dati tecnici di accesso sono tenuti distinti dalle risposte patrimoniali.</p>{!protectedService ? <small>Versione dell’informativa: {SERVICE_NOTICE_VERSION}</small> : null}</div></details><label className={styles.consentCheck}><input type="checkbox" checked={noticeAccepted} disabled={pending} onChange={e => acknowledgeNotice(e.target.checked)} /><span>Ho letto come vengono conservate e consultate le risposte.</span></label></aside> : null}
      {foundation && !accountAuth && phase === 'HISTORY' && session && eventTicket ? <EventRadarLink ticket={eventTicket} csrf={session.csrf} onLinked={setReconciliationId} /> : null}
      {phase === 'INTRO' ? <><section className={styles.hero}><div className={styles.heroCopy}><span className={styles.eyebrow}>Radar Patrimoniale</span><h1 ref={heading} tabIndex={-1}>Il tuo patrimonio. <em>Una visione d’insieme.</em></h1><p className={styles.lead}>Entrate, riserve, impegni e progetti, letti insieme in un’unica fotografia. Per capire da dove partire, prima di decidere dove andare.</p><div className={styles.heroActions}><button type="button" className={styles.primary} onClick={begin} disabled={pending || !referralReady}>Inizia la fotografia <span aria-hidden="true">→</span></button></div><ul className={styles.assurances}><li>Bastano stime o fasce di importo</li><li>Puoi saltare ogni domanda</li><li>Nessun acquisto, nessun impegno</li></ul></div><RadarInstrument /></section><ol className={styles.steps}>{[['I', 'Una fotografia', 'Il tuo bilancio, osservato da sei prospettive.'], ['II', 'Ciò che conta', 'I tuoi obiettivi e, se vuoi, qualche dettaglio in più.'], ['III', 'Una prima lettura', 'Una sintesi descrittiva, senza punteggi né voti.']].map(([n, title, text]) => <li key={n}><span>{n}</span><h2>{title}</h2><p>{text}</p></li>)}</ol><p className={styles.educational}>Il Radar è uno strumento educativo per fare ordine: non è una consulenza finanziaria né una certificazione di sicurezza. Il percorso si adatta alle tue risposte, con al massimo 29 domande e 11 approfondimenti facoltativi.</p></> : null}
      {!protectedService ? <aside className={styles.testRibbon} aria-label="Come funziona questa demo"><strong>Ambiente di prova · usa soltanto dati inventati.</strong><span>Le risposte confermate vengono salvate nel database di prova e puoi riprenderle dopo una nuova verifica dell’email. Le modifiche non confermate restano solo in questa scheda.</span></aside> : null}
      <div className={styles.connection} data-connection-state><p role="status" aria-live="polite">{status}{assessment ? ` · Revisione ${assessment.revision}` : ''}</p>{error ? <p className={styles.error} role="alert">{error}</p> : null}
        {retryable ? <button className={styles.primary} disabled={pending} onClick={() => { if (failed.current) void perform(failed.current); }}>Riprova la stessa richiesta</button> : null}
        {conflict && assessment ? <button className={styles.primary} disabled={pending} onClick={() => void work(async () => { const fresh = await radarApi<{ assessment: Assessment }>(`/assessments/${assessment.id}`); if (fresh.assessment.status === 'COMPLETED') { setResult(await radarApi<CustomerSnapshot>(`/assessments/${assessment.id}/snapshot`)); setPhase('PREVIEW'); setAssessment(null); setStatus('Episodio già completato: la bozza locale non è stata applicata.'); } else { await loadEpisode(assessment.id, true); setStatus('Versione aggiornata. La bozza locale è conservata: confrontala con la risposta salvata prima di confermare.'); } setConflict(false); })}>Aggiorna dal server e conserva la bozza</button> : null}
      </div>
      {phase === 'IDENTITY' ? <section className={`${styles.question} ${styles.identity}`}><span className={styles.eyebrow}>Salva e riprendi</span><h1 ref={heading} tabIndex={-1}>Verifica la tua email.</h1><p>{protectedService ? 'Inserisci la tua email: riceverai un codice di accesso. Nessun report viene inviato per email.' : 'Usa una casella di prova che termina in .invalid: questo ambiente simula il recapito.'} Il codice vale dieci minuti e si può usare una sola volta.</p><form onSubmit={e => { e.preventDefault(); requestCode(); }}><div className={styles.control}>{accountAuth ? <><label htmlFor="pr-first-name">Nome</label><input id="pr-first-name" autoComplete="given-name" required maxLength={100} value={firstName} disabled={pending || !!challenge} onChange={e=>setFirstName(e.target.value)} /><label htmlFor="pr-last-name">Cognome</label><input id="pr-last-name" autoComplete="family-name" required maxLength={100} value={lastName} disabled={pending || !!challenge} onChange={e=>setLastName(e.target.value)} /></> : null}<label htmlFor="pr-email">{protectedService ? "Email" : "Email di test"}</label><input id="pr-email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={pending || !!challenge} onChange={e => setEmail(e.target.value)} /></div>{!challenge ? <button className={styles.primary} disabled={pending}>Richiedi codice</button> : null}</form>{challenge ? <><form onSubmit={e => { e.preventDefault(); verifyCode(); }}><div className={styles.control}><label htmlFor="pr-code">{accountAuth ? "Codice ricevuto via email" : "Codice a otto cifre"}</label><input id="pr-code" inputMode="numeric" autoComplete="one-time-code" pattern={accountAuth ? "[0-9]{6,8}" : "[0-9]{8}"} maxLength={8} required value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))} disabled={pending} /></div><button className={styles.primary} disabled={pending}>Verifica codice</button></form><div className={styles.formNav}><button className={styles.secondary} disabled={pending || cooldown > 0} onClick={requestCode}>{cooldown ? `Nuovo codice tra ${cooldown} s` : 'Richiedi un nuovo codice'}</button><button className={styles.textButton} disabled={pending} onClick={() => { setChallenge(null); setCode(''); setError(''); }}>Cambia email</button></div></> : null}</section> : null}
      {phase === 'HISTORY' ? <section className={styles.optional}><h1 ref={heading} tabIndex={-1}>Le tue compilazioni.</h1><p>Riprendi una bozza o consulta una fotografia già completata. Una nuova compilazione parte solo se lo scegli tu. {accountAuth ? "La scheda Evento viene riconosciuta automaticamente quando i dati sono coerenti e univoci; eventuali conflitti richiedono una verifica separata." : "Il collegamento Evento richiede un riferimento valido e la tua conferma esplicita."}</p><div className={styles.optionalGrid}>{history.map((item, i) => <button className={styles.optionalCard} key={item.id} disabled={locked} onClick={() => openEpisode(item)}><span className={styles.eyebrow}>{item.status === 'DRAFT' ? 'Bozza in corso' : 'Compilazione completata'}</span><strong>{item.status === 'DRAFT' ? 'Riprendi la bozza' : 'Consulta il risultato'} {i + 1}</strong><span>{new Date(item.createdAt).toLocaleDateString('it-IT')} · Revisione {item.revision}</span></button>)}</div><button className={styles.primary} disabled={locked} onClick={createEpisode}>{history.length ? 'Inizia una nuova compilazione' : 'Inizia la prima compilazione'}</button></section> : null}
      {phase === 'REVIEW' ? <section className={styles.optional}><h1 ref={heading} tabIndex={-1}>Prima di completare.</h1><p>Le risposte confermate sono già salvate. Puoi aggiungere qualche approfondimento o rivedere le risposte: una volta completata, la fotografia non sarà più modificabile.</p><div className={styles.resultActions}><button className={styles.secondary} disabled={locked} onClick={() => setPhase('OPTIONAL')}>Aggiungi approfondimenti</button><button className={styles.primary} disabled={locked || Object.keys(drafts).length > 0} onClick={complete}>Completa e salva il risultato</button></div><div className={styles.optionalGrid}>{ordinary.map(id => <button className={styles.optionalCard} key={id} data-review-id={id} disabled={locked} onClick={() => edit(id)}><span>{answers[id].lifecycle === 'RECONFIRM' ? 'Da riconfermare' : !answers[id].ref ? 'Non ancora confermata' : stateLabels[answers[id].state]}</span><strong>{editorialQuestion(id, value<string[]>(answers, 'RP-S03')).text}</strong></button>)}</div>{Object.keys(drafts).length ? <p className={styles.notice}>Hai bozze non confermate, conservate solo in questa scheda. Rivedile prima del completamento. {Object.keys(drafts).map(id => <button className={styles.textButton} key={id} onClick={() => edit(id as QuestionId)}>Rivedi la bozza</button>)}</p> : null}</section> : null}
      {phase === 'QUESTIONS' ? <div className={styles.workspace} inert={locked}><aside className={styles.track}><span className={styles.eyebrow}>{isOptional ? 'Un dettaglio in più' : 'La tua fotografia'}</span><nav aria-label="Sezioni del percorso">{(['S', 'A', 'C', 'B', 'D', 'E', 'F'] as const).map(area => <button type="button" key={area} aria-current={!isOptional && current[3] === area ? 'step' : undefined} onClick={() => { const id = ordinary.find(id => id[3] === area); if (id) edit(id); }}><span aria-hidden="true">{current[3] === area ? '●' : '○'}</span>{areaNames[area]}</button>)}</nav><p className={styles.hint}>Ogni risposta si salva con “Conferma”. Se torni indietro, le bozze restano in memoria.</p>{reconfirm.length ? <p className={styles.notice}>{reconfirm.length} risposte da riconfermare dopo una modifica.</p> : null}<button type="button" className={styles.textButton} onClick={showPreview}>Vai al riepilogo →</button></aside><section className={styles.question} data-question-id={current}><div className={styles.progressHeader}><span>{isOptional ? 'Approfondimento facoltativo' : `Domanda ${position + 1} di ${ordinary.length}`}</span><span>{isOptional ? 'Senza obbligo di dettaglio' : `${completed} risposte confermate`}</span></div>{!isOptional ? <progress value={completed} max={ordinary.length} aria-label="Risposte confermate nel percorso applicabile" /> : null}<span className={styles.eyebrow}>{areaNames[current[3] as keyof typeof areaNames]}</span><h1 ref={heading} tabIndex={-1}>{copy.text}</h1>{copy.purpose ? <p className={styles.purpose}>{copy.purpose}</p> : null}<details className={styles.help}><summary>Come rispondere</summary><p>{copy.help}</p></details>{answers[current].lifecycle === 'RECONFIRM' ? <div className={styles.notice} role="status">Il contesto è cambiato: controlla questa risposta e confermala per il bilancio attuale. Fino ad allora non sarà usata nelle conclusioni.</div> : null}
      {comparison && drafts[current] ? <details className={styles.panel} open><summary>Risposta attualmente salvata sul server</summary><p>{stateLabels[(latestDraft(input, current) ?? { state: 'UNANSWERED' }).state]}</p>{latestDraft(input, current)?.state === 'VALUE' ? <fieldset disabled><QuestionFields id={current} value={latestDraft(input, current)?.value} onChange={() => {}} input={input} newId={() => 'read-only'} /></fieldset> : null}<button className={styles.secondary} disabled={locked} onClick={() => { setDrafts(d => { const copy = { ...d }; delete copy[current]; return copy; }); setComparison(false); }}>Usa la risposta salvata e scarta questa bozza</button></details> : null}
      <form autoComplete="off" onSubmit={e => { e.preventDefault(); next(); }}><AnswerFields key={`${current}:${answers[current].ref?.revision ?? 0}`} id={current} draft={draft} onChange={change} input={input} newId={() => crypto.randomUUID()} />
      {warning ? <p className={styles.notice} role="status">{warning}</p> : null}<div className={styles.formNav}><button type="button" className={styles.secondary} onClick={previous} disabled={!isOptional && position === 0}>{isOptional ? 'Torna agli approfondimenti' : '← Precedente'}</button><button className={styles.primary} type="submit" disabled={pending}>{isOptional ? 'Conferma l’approfondimento' : position === ordinary.length - 1 ? 'Conferma e vai al riepilogo' : 'Conferma e continua'} <span aria-hidden="true">→</span></button></div></form></section></div> : null}
      {phase === 'OPTIONAL' ? <section className={styles.optional} inert={locked}><span className={styles.eyebrow}>Scegli tu quanto approfondire</span><h1 ref={heading} tabIndex={-1}>Più contesto.<br /><em>Solo se ti è utile.</em></h1><p>Puoi aggiungere obiettivi, vincoli e dettagli senza ricompilare il bilancio. Nessun approfondimento è necessario per ottenere la prima lettura.</p><div className={styles.optionalGrid}>{optional.filter(q => answers[q.id].applicability !== 'NOT_APPLICABLE').map(q => <button type="button" key={q.id} className={styles.optionalCard} data-optional-id={q.id} onClick={() => edit(q.id)}><span className={styles.eyebrow}>{answers[q.id].lifecycle === 'RECONFIRM' ? 'Da riconfermare' : drafts[q.id] ? 'Bozza da confermare' : answers[q.id].state === 'VALUE' ? 'Già indicato' : answers[q.id].state === 'UNKNOWN' ? 'Dato non conosciuto' : answers[q.id].state === 'DECLINED' ? 'Hai scelto di non rispondere' : 'Facoltativo'}</span><strong>{optionalTitles[Number(q.id.slice(-2)) - 1]}</strong><span aria-hidden="true">↗</span></button>)}</div><button type="button" className={styles.primary} onClick={showPreview}>Torna al riepilogo →</button></section> : null}
      {phase === 'PREVIEW' && result ? <><p className={styles.notice}>Fotografia completata il {new Date(result.completedAt).toLocaleDateString('it-IT')} · Revisione approvata {result.approvedRevision}. Non è più modificabile.</p><ResultPreview result={result.customer} /><div className={styles.resultActions}><button className={styles.primary} disabled={locked} onClick={() => void work(listEpisodes)}>Vai alle tue compilazioni</button></div></> : null}
    </main><footer className={styles.footer}><span>Horyzon · Benessere Patrimoniale</span>{session ? <div><button disabled={locked} onClick={() => void work(listEpisodes)}>Le tue compilazioni</button><button disabled={locked} onClick={() => logout(false)}>Esci da questo dispositivo</button><button disabled={locked} onClick={() => logout(true)}>Esci da tutti i dispositivi</button></div> : <span>Guardare insieme, prima di scegliere.</span>}</footer>
  </div>;
}
