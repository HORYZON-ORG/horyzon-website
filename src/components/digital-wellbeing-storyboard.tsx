'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export const digitalScenes = [
  { id: 'email', label: 'Email e richieste', title: 'Ogni mattina ricominci dalle stesse email?', pain: 'Leggi, cerchi un allegato, ricopi i dati. Poi arriva un’altra richiesta e ricominci.', benefit: 'Richieste ordinate, informazioni raccolte e bozze di risposta pronte da controllare.' },
  { id: 'fatture', label: 'Fatture e documenti', title: 'Gli stessi dati. Inseriti ancora una volta.', pain: 'Da un documento a un foglio, da un foglio al gestionale. E alla fine devi ricontrollare tutto.', benefit: 'Estrazione dei dati e preparazione dei controlli, collegando gli strumenti dove è possibile.' },
  { id: 'preventivi', label: 'Preventivi', title: 'Il cliente aspetta. Tu cerchi ancora il file giusto.', pain: 'Un vecchio preventivo, un listino, le note della chiamata. Le informazioni ci sono, ma sono sparse.', benefit: 'Una bozza ordinata a partire da modelli e listini approvati. A te resta la verifica finale.' },
  { id: 'contatti', label: 'Contatti e scadenze', title: 'Quante richieste restano senza un prossimo passo?', pain: 'Un appunto sul tavolo, un messaggio da rileggere, una telefonata da ricordare.', benefit: 'Contatti organizzati, attività assegnate e promemoria per sapere sempre chi deve fare cosa.' },
  { id: 'report', label: 'Report e riepiloghi', title: 'La giornata finisce. Il report deve ancora cominciare.', pain: 'Apri file, raccogli numeri, ricostruisci quello che è successo. Anche oggi.', benefit: 'Dati raccolti e riepiloghi da verificare, con decisioni e prossime attività in evidenza.' },
] as const;
type Selection = { selected: string[]; toggle: (id: string) => void; submitted: boolean; complete: () => void };
const SelectionContext = createContext<Selection | null>(null);
export function DigitalJourney({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  return <SelectionContext.Provider value={{ selected, toggle: id => setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]), submitted, complete: () => setSubmitted(true) }}>{children}</SelectionContext.Provider>;
}
export function useDigitalSelection() { return useContext(SelectionContext); }
export function SceneVideo({ id }: { id: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const update = () => { if (visible && !motion.matches && !document.hidden) { if (!video.src) video.src = `/digital-story/${id}.mp4`; void video.play().catch(() => {}); } else video.pause(); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: 0.15 });
    observer.observe(video); motion.addEventListener('change', update); document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); motion.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); video.pause(); };
  }, [id]);
  return <video ref={ref} className="bd-scene-video" muted loop playsInline preload="none" poster={`/digital-story/${id}.jpg`} aria-hidden="true"/>;
}
export function DigitalStoryboard() {
  const selection = useDigitalSelection();
  if (!selection) return null;
  return <div id="attivita" className="bd-story">
    <section className="bd-story-intro" aria-labelledby="story-intro-title"><div className="bd-wrap bd-story-intro-grid"><div><p className="bd-kicker">01 / IL TUO PUNTO DI PARTENZA</p><h2 id="story-intro-title">La tua giornata.<br/><em>Da semplificare.</em></h2></div><div className="bd-story-guide"><p>Cinque situazioni di tutti i giorni. Quali fanno parte del tuo lavoro?</p><div className="bd-story-instruction"><span aria-hidden="true">＋</span><p>Seleziona le attività in cui ti riconosci.<br/>Le ritroverai nella richiesta, pronte da approfondire insieme.</p></div><a className="bd-textlink" href="#parliamone">Sai già da dove partire? Raccontacelo <span aria-hidden="true">↗</span></a></div><div className="bd-story-cue" aria-hidden="true"><span>SCORRI E SCEGLI</span><span>↓</span></div></div></section>
    {digitalScenes.map((scene, index) => <section className="bd-scene" key={scene.id} aria-labelledby={`scene-${scene.id}`}>
      <SceneVideo id={scene.id}/><div className="bd-scene-shade"/>
      <div className="bd-wrap bd-scene-content"><p className="bd-kicker">0{index + 1} / {scene.label.toUpperCase()}</p><h2 id={`scene-${scene.id}`}>{scene.title}</h2><p className="bd-scene-pain">{scene.pain}</p><div className="bd-scene-benefit"><span>COME POSSIAMO SEMPLIFICARLO</span><p>{scene.benefit}</p></div><button type="button" className="bd-button bd-scene-select" aria-pressed={selection.selected.includes(scene.id)} onClick={() => selection.toggle(scene.id)}>{selection.selected.includes(scene.id) ? '✓ Nella tua richiesta' : '＋ Fa parte del mio lavoro'}</button></div>
    </section>)}
    {selection.selected.length > 0 && !selection.submitted && <aside className="bd-selection-bar" aria-label="La tua richiesta"><span role="status" aria-live="polite">{selection.selected.length} {selection.selected.length === 1 ? 'attività selezionata' : 'attività selezionate'}</span><a href="#parliamone">Rivedi la richiesta ↗</a></aside>}
  </div>;
}
