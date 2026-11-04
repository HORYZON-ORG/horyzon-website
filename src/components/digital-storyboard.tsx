'use client';

import Image from 'next/image';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export const digitalScenes = [
  { id: 'email', label: 'Email e richieste', title: 'Ogni richiesta ricomincia da una casella piena?', pain: 'Leggi la mail, trovi l’allegato, ricopi i dati e prepari una risposta. Nel frattempo, le richieste successive aspettano.', benefit: 'Un flusso che classifica la richiesta, raccoglie i dati utili e prepara una bozza di risposta con la prossima attività.', cost: 'Il costo si accumula nelle interruzioni e nei tempi di risposta.', flow: ['Arriva un’email con una richiesta.', 'Dati e allegati vengono organizzati; si prepara la bozza.', 'La persona verifica e approva la risposta.'] },
  { id: 'fatture', label: 'Fatture e documenti', title: 'Gli stessi dati, inseriti due volte. E poi ricontrollati.', pain: 'Dal PDF al foglio, dal foglio al gestionale. Ogni passaggio manuale richiede tempo e un altro controllo.', benefit: 'Un flusso che legge i dati del documento, segnala i campi da controllare e prepara l’inserimento negli strumenti compatibili.', cost: 'Il costo si nasconde nei reinserimenti e nelle correzioni.', flow: ['Arriva una fattura o un documento.', 'I dati vengono estratti e i campi mancanti segnalati.', 'La persona verifica prima della registrazione.'] },
  { id: 'preventivi', label: 'Preventivi', title: 'Il cliente ha chiesto un prezzo. Tu cerchi ancora i file.', pain: 'Listino, vecchia offerta, appunti della chiamata. Prima di preparare il preventivo devi ricostruire tutte le informazioni.', benefit: 'Una bozza costruita dai dati della richiesta, dai modelli e dai listini approvati. Più ordine prima della revisione commerciale.', cost: 'Il costo è il tempo tra la richiesta e una proposta pronta da verificare.', flow: ['Si raccolgono richiesta e informazioni del cliente.', 'Si prepara la bozza con modelli e listini autorizzati.', 'Il commerciale verifica prezzo, condizioni e invio.'] },
  { id: 'contatti', label: 'Contatti e scadenze', title: 'Chi doveva richiamare quel cliente?', pain: 'Un nome in chat, una nota sul tavolo, un appuntamento da confermare. Se il prossimo passo resta nella memoria, basta un imprevisto per perderlo.', benefit: 'Un flusso che raccoglie il contatto, prepara l’attività e attiva promemoria secondo le regole condivise dal team.', cost: 'Il costo è rincorrere informazioni e lasciare richieste senza seguito.', flow: ['Arriva un contatto o viene fissata una scadenza.', 'Si prepara un’attività con responsabile e promemoria.', 'Il team controlla e aggiorna l’esito.'] },
  { id: 'report', label: 'Report e riepiloghi', title: 'Per sapere come va, devi prima ricomporre cinque file?', pain: 'Raccogli numeri, aggiorni fogli e cerchi differenze. Il report richiede lavoro prima ancora di aiutarti a decidere.', benefit: 'Un flusso che raccoglie i dati dalle fonti autorizzate e prepara un riepilogo con elementi da verificare e approfondire.', cost: 'Il costo è il tempo speso a preparare i dati invece di leggerli.', flow: ['Si raccolgono dati dalle fonti concordate.', 'Si prepara il riepilogo e si evidenziano le anomalie.', 'Il responsabile verifica e decide le azioni.'] },
  { id: 'ordini', label: 'Ordini e conferme', title: 'L’ordine è arrivato. Il lavoro di ricopiarlo è appena iniziato.', pain: 'Prodotti, quantità, indirizzo, date. Se un dato manca, parte un altro scambio di messaggi e l’ordine resta fermo.', benefit: 'Un flusso che raccoglie i dati dell’ordine, segnala quelli mancanti e prepara la conferma o la richiesta di chiarimento.', cost: 'Il costo cresce tra ricopiature e richieste incomplete.', flow: ['Arriva un ordine da email o modulo.', 'Si organizzano quantità e dati, segnalando le informazioni mancanti.', 'La persona verifica disponibilità e conferma l’ordine.'], imageOnly: true },
  { id: 'riunioni', label: 'Riunioni e attività', title: 'La riunione è finita. Le attività sono ancora negli appunti.', pain: 'Decisioni in un quaderno, scadenze dette a voce, responsabilità da ricostruire. Per ripartire serve un altro giro di messaggi.', benefit: 'Un flusso che trasforma appunti o una trascrizione autorizzata in riepilogo, azioni e scadenze da confermare.', cost: 'Il costo è chiarire di nuovo ciò che il team aveva già discusso.', flow: ['Si caricano appunti o una trascrizione autorizzata.', 'Si preparano riepilogo, attività e scadenze.', 'I partecipanti confermano contenuti e assegnazioni.'], imageOnly: true },
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
    <section className="bd-story-intro" aria-labelledby="story-intro-title"><div className="bd-wrap bd-story-intro-grid"><div><p className="bd-kicker">LE AUTOMAZIONI CHE POSSIAMO COSTRUIRE</p><h2 id="story-intro-title">Il tuo problema.<br/><em>Un processo da cambiare.</em></h2></div><div className="bd-story-guide"><p>Riconosci il passaggio che rallenta il tuo team. Guarda come può funzionare un’automazione e aggiungila alla tua richiesta.</p><a className="bd-textlink" href="#esempio">Prima vuoi vedere un esempio? Provalo ↗</a></div><nav className="au-scene-nav" aria-label="Esplora le automazioni">{digitalScenes.map(scene => <a key={scene.id} href={`#automation-${scene.id}`}>{scene.label} ↓</a>)}</nav></div></section>
    {digitalScenes.map((scene, index) => <section className="bd-scene au-scene" id={`automation-${scene.id}`} key={scene.id} aria-labelledby={`scene-${scene.id}`}>
      {'imageOnly' in scene ? <Image src={`/digital-story/${scene.id}.webp`} alt="" fill sizes="100vw" className="bd-scene-video"/> : <SceneVideo id={scene.id}/>}<div className="bd-scene-shade"/>
      <div className="bd-wrap bd-scene-content"><p className="bd-kicker">0{index + 1} / {scene.label.toUpperCase()}</p><h2 id={`scene-${scene.id}`}>{scene.title}</h2><p className="bd-scene-pain">{scene.pain}</p><p className="au-scene-cost">{scene.cost}</p><div className="bd-scene-benefit"><span>L’AUTOMAZIONE CHE VALUTIAMO CON TE</span><p>{scene.benefit}</p></div><details className="au-flow"><summary>Come si usa, in pratica <span aria-hidden="true">＋</span></summary><ol>{scene.flow.map((item, i) => <li key={item}><span>0{i + 1}</span>{item}</li>)}</ol></details><button type="button" className="bd-button bd-scene-select" aria-pressed={selection.selected.includes(scene.id)} onClick={() => selection.toggle(scene.id)}>{selection.selected.includes(scene.id) ? '✓ Aggiunta alla mia richiesta' : '＋ Voglio valutare questa automazione'}</button></div>
    </section>)}
    {selection.selected.length > 0 && !selection.submitted && <aside className="bd-selection-bar" aria-label="La tua richiesta"><span role="status" aria-live="polite">{selection.selected.length} {selection.selected.length === 1 ? 'automazione selezionata' : 'automazioni selezionate'}</span><a href="#parliamone">Rivedi la richiesta ↗</a></aside>}
  </div>;
}
