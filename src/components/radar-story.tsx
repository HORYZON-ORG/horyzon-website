import { departments } from '@/content/site-narrative';
import { RadarGrid, radarPath, radarPoint } from '@/components/radar/radar-scope';

// Same radar as the /radar landing, static and on cream: a neutral example, never a company or a score.
const EXAMPLE = [0.76, 0.66, 0.6, 0.62, 0.7] as const;
export function RadarStory(): React.JSX.Element {
  return <figure style={{ margin: 0 }}>
    <svg viewBox="-70 -20 540 450" role="img" aria-labelledby="radar-title radar-description" style={{ display: 'block', width: '100%', maxWidth: 560, height: 'auto', overflow: 'visible' }}>
      <title id="radar-title">Le cinque direzioni del Radar d’Impresa</title>
      <desc id="radar-description">Esempio neutro, senza punteggi o dati aziendali, con gli assi Amministrazione, Produzione, Commerciale, Marketing e Persone.</desc>
      <RadarGrid />
      <path className="rd-shape" d={radarPath(EXAMPLE)} />
      {EXAMPLE.map((value, i) => { const [x, y] = radarPoint(i, value); return <circle key={i} className="rd-blip" cx={x} cy={y} r="5" style={{ animation: 'none' }} />; })}
    </svg>
    <figcaption className="rd-figcaption" style={{ marginTop: 24 }}><strong className="rd-statement" style={{ fontSize: 'clamp(26px,2.6vw,38px)', color: 'var(--fg)' }}>Cinque reparti, un profilo leggibile.</strong><span className="sr-only">I reparti osservati sono: {departments.map(({ name }) => name).join(', ')}.</span><span>La forma è illustrativa: non rappresenta un’azienda né un risultato reale.</span></figcaption>
  </figure>;
}
