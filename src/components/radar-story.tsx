import { departments } from '@/content/site-narrative';

export function RadarStory(): React.JSX.Element {
  return <figure className="radar-story">
    <svg viewBox="0 0 320 310" role="img" aria-labelledby="radar-title radar-description">
      <title id="radar-title">Le cinque direzioni del Radar d’Impresa</title>
      <desc id="radar-description">Esempio neutro, senza punteggi o dati aziendali, con gli assi Amministrazione, Produzione, Commerciale, Marketing e Persone.</desc>
      <g className="radar-grid" aria-hidden="true"><polygon points="160,40 274,123 231,257 89,257 46,123"/><polygon points="160,72 245,134 213,234 107,234 75,134"/><polygon points="160,104 217,145 196,211 124,211 103,145"/><path d="M160 40V257M46 123l185 134M274 123L89 257M46 123h228M160 40L89 257"/></g>
      <polygon className="radar-example" points="160,76 236,132 207,218 111,220 80,132" aria-hidden="true"/>
      <g className="radar-labels" aria-hidden="true"><text x="160" y="20" textAnchor="middle">Amministrazione</text><text x="307" y="116" textAnchor="end">Produzione</text><text x="265" y="286" textAnchor="middle">Commerciale</text><text x="55" y="286" textAnchor="middle">Marketing</text><text x="13" y="116">Persone</text></g>
    </svg>
    <figcaption><strong>Cinque reparti, un profilo leggibile.</strong><span className="sr-only">I reparti osservati sono: {departments.map(({ name }) => name).join(', ')}.</span><span>La forma è illustrativa: non rappresenta un’azienda né un risultato reale.</span></figcaption>
  </figure>;
}
