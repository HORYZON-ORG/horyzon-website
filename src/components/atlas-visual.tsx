import { HeroIndex } from '@/components/kit';
import { RadarScope } from '@/components/radar/radar-scope';

/** Hero visuals of the inner pages, on the kit: editorial metaphors, never customer data or product screenshots. */
export function AtlasVisual({ kind }: { kind: 'system' | 'method' | 'radar' }) {
 if (kind === 'radar') return <figure className="atlas-visual" aria-label="Cinque prospettive per leggere la tua impresa" style={{ margin: 0 }}>
  <RadarScope />
  <figcaption className="rd-figcaption">Ogni segnale cambia la lettura dell’insieme.<small>Illustrazione del metodo, senza dati aziendali.</small></figcaption>
 </figure>;
 if (kind === 'system') return <HeroIndex caption="Horyzon / I tre benesseri" words={['Organizzativo', 'Patrimoniale', 'Digitale']} note="Il valore nasce dalle connessioni." />;
 return <HeroIndex caption="Il percorso Horyzon" words={['Capire', 'Scegliere', 'Far accadere']} note="Una direzione. Un passo alla volta." />;
}
