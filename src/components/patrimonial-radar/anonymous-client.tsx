'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { QUESTION_CATALOG, question } from '@/lib/patrimonial-radar/catalog';
import { resolveAnswers } from '@/lib/patrimonial-radar/answers';
import { validateValue } from '@/lib/patrimonial-radar/validation';
import { diagnose } from '@/lib/patrimonial-radar/result';
import type { AssessmentInput, CanonicalResult, QuestionId } from '@/lib/patrimonial-radar/types';
import { areaNames, confirmDraft, latestDraft, optionalTitles, route, type Draft } from '@/lib/patrimonial-radar-ui/presentation';
import { AnswerFields } from './answer-fields';
import { ResultPreview } from './result-preview';
import { RadarInstrument } from './radar-instrument';
import { radarSerif } from './fonts';
import styles from './radar.module.css';
import { publicQuestion } from '@/lib/patrimonial-radar-ui/public-copy';
import { customerProjection } from '@/lib/patrimonial-radar-server/customer-projection';
type Phase = 'INTRO' | 'QUESTIONS' | 'OPTIONAL' | 'PREVIEW';
const optional = QUESTION_CATALOG.filter(q => q.optional);
const subscribeToDocument=()=>()=>{};
const documentIsolated=()=>document.documentElement.dataset.radarIsolated==='true';
const serverDocumentIsolated=()=>false;
export function AnonymousRadarClient({ asOf }: { asOf: string }) {
  const isolated = useSyncExternalStore(subscribeToDocument, documentIsolated, serverDocumentIsolated);
  useEffect(() => {
    if(document.documentElement.dataset.radarIsolated!=='true') { window.location.replace('/radar-patrimoniale'); return; }
  }, []);
  const [input, setInput] = useState<AssessmentInput>({ asOf, answers: [] });
  const [phase, setPhase] = useState<Phase>('INTRO'), [current, setCurrent] = useState<QuestionId>('RP-S01');
  const [drafts, setDrafts] = useState<Partial<Record<QuestionId, Draft>>>({}), [error, setError] = useState('');
  const [result, setResult] = useState<CanonicalResult | null>(null), [pending, startTransition] = useTransition();
  const [resetAsked, setResetAsked] = useState(false), heading = useRef<HTMLHeadingElement>(null), serial = useRef(0);
  const answers = useMemo(() => resolveAnswers(input), [input]), ordinary = useMemo(() => route(input), [input]);
  const copy = publicQuestion(current, input);
  const q = question(current), position = ordinary.indexOf(current), isOptional = q.optional;
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
  function change(next: Draft) { setDrafts(d => ({ ...d, [current]: next })); setError(''); }
  function commit(): AssessmentInput | null {
    const next = confirmDraft(input, current, draft), resolved = resolveAnswers(next)[current];
    if (draft.state === 'VALUE' && (validateValue(current, next.answers.filter(a => a.id === current).at(-1)?.value).length || resolved.issues.length)) {
      setError(current === 'RP-X06' ? 'Controlla le categorie e le priorità: massimo tre obiettivi, con priorità diverse quando indicate. I dettagli facoltativi possono restare da completare.' : current === 'RP-X10' ? 'Scegli fino a tre esperienze, oppure nessuna. Controlla anche aspettative e dubbi; puoi lasciare ogni parte da completare.' : 'Controlla i campi evidenziati e le scelte richieste. Se il dato manca, puoi scegliere “Non so”, “Preferisco non rispondere” o proseguire lasciandolo vuoto.'); return null;
    }
    setInput(next); setDrafts(d => { const copy = { ...d }; delete copy[current]; return copy; }); setError(''); return next;
  }
  function showPreview(next = input) { startTransition(() => { try { setResult(diagnose(next)); setPhase('PREVIEW'); setError(''); } catch { setError('Non è stato possibile completare la lettura locale. Le risposte restano in questa scheda: puoi rivederle e riprovare.'); } }); }
  function next() { const updated = commit(); if (!updated) return; if (isOptional) { setPhase('OPTIONAL'); return; } const nextRoute = route(updated), index = nextRoute.indexOf(current); if (index >= nextRoute.length - 1) showPreview(updated); else setCurrent(nextRoute[index + 1] ?? nextRoute[0]); }
  function previous() { if (isOptional) { setPhase('OPTIONAL'); setError(''); return; } setCurrent(ordinary[Math.max(0, position - 1)]); setError(''); }
  function edit(id: QuestionId) { if (answers[id].applicability === 'NOT_APPLICABLE') return; setCurrent(id); setPhase('QUESTIONS'); setError(''); }
  function reset() { setInput({ asOf, answers: [] }); setDrafts({}); setResult(null); setPhase('INTRO'); setCurrent('RP-S01'); setResetAsked(false); setError(''); }
  let warning: string | null = null;
  if (draft.state === 'VALUE' && !validateValue(current, draft.value).length) {
    const candidate = diagnose(confirmDraft(input, current, draft));
    const relevant = candidate.incoherences.find(i => i.refs.some(r => r.id === current));
    if (relevant) warning = relevant.code === 'P_EXCEEDS_L' ? 'Gli accantonamenti superano la liquidità indicata. Rivedi le cifre: questo confronto resterà sospeso finché non sarà chiarito.' : 'Questa risposta richiede un chiarimento rispetto ad altre informazioni. Puoi correggerla o mantenere una lettura parziale; il motore sospenderà le conclusioni coinvolte.';
  }
  if(!isolated) return <main className={styles.root}><p role="status">Preparazione del percorso anonimo…</p></main>;
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Full document navigation is required to discard the isolated root before returning to third-party site scripts.
  return <div className={`${styles.root} ${radarSerif.variable}`} data-mode="PUBLIC_ANONYMOUS" data-assessment-date={input.asOf}><a className={styles.skip} href="#patrimonial-content">Vai al contenuto</a><header className={styles.header}><Link href="/" prefetch={false} onNavigate={e => { e.preventDefault(); window.location.assign('/'); }} aria-label="Horyzon, homepage"><Image src="/benessere-patrimoniale/horyzon-consulting-benessere-patrimoniale.png" alt="Horyzon Consulting · Benessere Patrimoniale" width={1200} height={354} sizes="(max-width: 760px) 170px, 230px" priority /></Link><span className={styles.demoPill}><i aria-hidden="true" />Anonimo · in memoria</span></header>
    <main id="patrimonial-content" className={styles.main} aria-busy={pending}>
      {phase === 'INTRO' ? <><section className={styles.hero}><div className={styles.heroCopy}><span className={styles.eyebrow}>Radar Patrimoniale · Horyzon</span><h1 ref={heading} tabIndex={-1}>Le tue risorse, <em>i tuoi progetti.</em></h1><p className={styles.lead}>Che cosa conta per te? Parti dai tuoi progetti: questo percorso ti aiuta a conoscere meglio la tua situazione e a riconoscere punti di forza e aspetti da approfondire.</p><button type="button" className={styles.primary} onClick={() => { setPhase('QUESTIONS'); setCurrent('RP-S01'); }}>Inizia la fotografia <span aria-hidden="true">→</span></button><p className={styles.hint}>Puoi usare stime, scegliere una fascia o non rispondere. Nessun acquisto, nessuna prenotazione.</p><p className={styles.hint}>Senza registrazione. Le risposte restano solo in memoria, non vengono inviate a Horyzon. Aggiornando o chiudendo la pagina puoi perderle.</p></div><RadarInstrument /></section><ol className={styles.steps}>{[['I', 'La tua situazione', 'Il tuo bilancio, osservato da sei prospettive.'], ['II', 'Ciò che conta', 'I tuoi obiettivi e, se vuoi, qualche dettaglio in più.'], ['III', 'Una prima lettura', 'Punti di forza e aspetti da approfondire.']].map(([n, title, text]) => <li key={n}><span>{n}</span><h2>{title}</h2><p>{text}</p></li>)}</ol><div className={styles.educational}><details><summary>Le risposte e la tua riservatezza</summary><p>Questa modalità non richiede email o dati identificativi. Il sito riceve le normali richieste tecniche di pagine, immagini e caratteri, ma il questionario non invia le risposte. In questo percorso non carichiamo analytics, session replay o servizi esterni. Non possiamo conservare o recuperare una compilazione anonima. Una futura versione con salvataggio richiederà informazioni e autorizzazioni distinte.</p><p>Testo informativo della candidata pilota, soggetto a revisione. Non costituisce una certificazione di conformità privacy.</p></details><p>Una lettura educativa per fare ordine, non una consulenza finanziaria o una certificazione di sicurezza. Il percorso si adatta alle risposte: fino a 29 domande ordinarie e 11 approfondimenti facoltativi.</p></div></> : null}
      <aside className={styles.demoNotice} aria-label="Come funziona la modalità anonima"><strong>Le tue risposte restano con te.</strong><span>Le risposte rimangono solo nella memoria di questa scheda durante la sessione. Non vengono inviate a Horyzon e non vengono salvate. Chiudendo o aggiornando la pagina puoi perdere risposte e risultato. Nessuna registrazione o email richiesta.</span></aside>
      {phase === 'QUESTIONS' ? <div className={styles.workspace}><aside className={styles.track}><span className={styles.eyebrow}>{isOptional ? 'Un dettaglio in più' : 'La tua fotografia'}</span><nav aria-label="Sezioni del percorso">{(['S', 'A', 'C', 'B', 'D', 'E', 'F'] as const).map(area => <button type="button" key={area} aria-current={!isOptional && current[3] === area ? 'step' : undefined} onClick={() => { const id = ordinary.find(id => id[3] === area); if (id) edit(id); }}><span aria-hidden="true">{current[3] === area ? '●' : '○'}</span>{areaNames[area]}</button>)}</nav><p className={styles.hint}>Ogni risposta si salva con “Conferma”. Se torni indietro, le bozze restano in memoria.</p>{reconfirm.length ? <p className={styles.notice}>{reconfirm.length} risposte da riconfermare dopo una modifica.</p> : null}<button type="button" className={styles.textButton} onClick={() => showPreview()}>Vedi una lettura parziale →</button></aside><section className={styles.question} data-question-id={current}><div className={styles.progressHeader}><span>{isOptional ? 'Approfondimento facoltativo' : `Domanda ${position + 1} di ${ordinary.length}`}</span><span>{isOptional ? 'Senza obbligo di dettaglio' : `${completed} risposte confermate`}</span></div>{!isOptional ? <progress value={completed} max={ordinary.length} aria-label="Risposte confermate nel percorso applicabile" /> : null}<span className={styles.eyebrow}>{areaNames[current[3] as keyof typeof areaNames]}</span><h1 ref={heading} tabIndex={-1}>{copy.text}</h1>{copy.purpose ? <p className={styles.purpose}>{copy.purpose}</p> : null}<details className={styles.help}><summary>Come rispondere</summary><p>{copy.help}</p></details>{answers[current].lifecycle === 'RECONFIRM' ? <div className={styles.notice} role="status">Il contesto è cambiato. Controlla questa risposta e confermala per il bilancio attuale. Finché non lo fai, non viene usata nelle conclusioni.</div> : null}
      <form autoComplete="off" onSubmit={e => { e.preventDefault(); next(); }}><AnswerFields key={`${current}:${answers[current].ref?.revision ?? 0}`} id={current} draft={draft} onChange={change} input={input} newId={() => `local-${++serial.current}`} />
      {warning ? <p className={styles.notice} role="status">{warning}</p> : null}{error ? <p className={styles.error} role="alert">{error}</p> : null}<div className={styles.formNav}><button type="button" className={styles.secondary} onClick={previous} disabled={!isOptional && position === 0}>{isOptional ? 'Torna agli approfondimenti' : '← Precedente'}</button><button className={styles.primary} type="submit" disabled={pending}>{isOptional ? 'Conferma approfondimento' : position === ordinary.length - 1 ? 'Conferma e vedi la lettura' : 'Conferma e continua'} <span aria-hidden="true">→</span></button></div></form></section></div> : null}
      {phase === 'OPTIONAL' ? <section className={styles.optional}><span className={styles.eyebrow}>Scegli tu quanto approfondire</span><h1 ref={heading} tabIndex={-1}>Più contesto.<br /><em>Solo se ti è utile.</em></h1><p>Puoi aggiungere obiettivi, vincoli e dettagli senza ricompilare il bilancio. Nessun approfondimento è necessario per ottenere la lettura ordinaria.</p><div className={styles.optionalGrid}>{optional.filter(q => answers[q.id].applicability !== 'NOT_APPLICABLE').map(q => <button type="button" key={q.id} className={styles.optionalCard} data-optional-id={q.id} onClick={() => edit(q.id)}><span className={styles.eyebrow}>{answers[q.id].lifecycle === 'RECONFIRM' ? 'Da riconfermare' : drafts[q.id] ? 'Bozza da confermare' : answers[q.id].state === 'VALUE' ? 'Già indicato' : answers[q.id].state === 'UNKNOWN' ? 'Dato non conosciuto' : answers[q.id].state === 'DECLINED' ? 'Hai scelto di non rispondere' : 'Facoltativo'}</span><strong>{optionalTitles[Number(q.id.slice(-2)) - 1]}</strong><span aria-hidden="true">↗</span></button>)}</div><button type="button" className={styles.primary} onClick={() => showPreview()}>Torna alla lettura locale →</button></section> : null}
      {phase === 'PREVIEW' && result ? <><ResultPreview anonymous result={customerProjection({result})} /><div className={styles.resultActions}><button type="button" className={styles.primary} onClick={() => setPhase('OPTIONAL')}>Approfondisci, se vuoi ↗</button><button type="button" className={styles.secondary} onClick={() => edit('RP-S01')}>Rivedi il percorso ordinario</button></div>{Object.keys(drafts).length ? <p className={styles.notice}>Hai {Object.keys(drafts).length} bozze non confermate. Questa lettura usa soltanto le risposte confermate. {Object.keys(drafts).map(id => <button className={styles.textButton} type="button" key={id} onClick={() => edit(id as QuestionId)}>Rivedi la bozza →</button>)}</p> : null}</> : null}
      {pending ? <p role="status">Preparo la lettura delle risposte confermate…</p> : null}{error && phase !== 'QUESTIONS' ? <p className={styles.error} role="alert">{error}</p> : null}
    </main><footer className={styles.footer}><span>Horyzon · Benessere Patrimoniale</span>{phase !== 'INTRO' ? <div>{resetAsked ? <><span>Azzerare tutte le risposte locali?</span><button type="button" onClick={reset}>Sì, ricomincia</button><button type="button" onClick={() => setResetAsked(false)}>Annulla</button></> : <button type="button" onClick={() => setResetAsked(true)}>Ricomincia da zero</button>}</div> : <span>Guardare insieme, prima di scegliere.</span>}</footer>
  </div>;
}
