import Image from 'next/image';

/** Editorial metaphors, never customer data or product screenshots. */
export function AtlasVisual({ kind }: { kind: 'system' | 'method' | 'radar' | 'platform' | 'contact' }) {
 if (kind === 'radar') return <figure className="atlas-visual atlas-radar" aria-label="Cinque prospettive per leggere la tua impresa">
  <svg viewBox="0 0 500 500" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="250" cy="250" r="190"/><circle cx="250" cy="250" r="130"/><circle cx="250" cy="250" r="70"/>{[0,72,144,216,288].map(angle=><path key={angle} d="M250 250V60" transform={`rotate(${angle} 250 250)`}/>)}</g><path className="atlas-radar-area" d="M250 92 393 204 331 361 143 397 113 205Z"/><circle cx="250" cy="250" r="5" fill="currentColor"/></svg>
  <figcaption>Ogni segnale cambia la lettura dell’insieme.<small>Illustrazione del metodo, senza dati aziendali.</small></figcaption>
 </figure>;
 if (kind === 'platform') return <figure className="atlas-visual atlas-platform">
  <div className="atlas-platform-line" aria-hidden="true"/>
  <div className="atlas-window"><span>La tua impresa, a colpo d’occhio</span><strong>Una visione condivisa.</strong><div className="atlas-window-rows"><p>Priorità <span>Da mettere a fuoco</span></p><p>Responsabilità <span>Da condividere</span></p><p>Avanzamento <span>Da verificare</span></p></div></div>
  <figcaption>Dal lavoro quotidiano alle decisioni.<small>Schema illustrativo, senza risultati o dati reali.</small></figcaption>
 </figure>;
 return <figure className={`atlas-visual atlas-photo atlas-${kind}`}><Image src={kind==='system'?'/atlas/organismo.webp':'/atlas/percorso.webp'} alt="" width={1440} height={960} sizes="(max-width:850px) 100vw, 55vw" preload/><figcaption>{kind==='system'?'Il valore nasce dalle connessioni.':kind==='contact'?'Il primo passo è una conversazione.':'Una direzione. Un passo alla volta.'}</figcaption></figure>;
}
