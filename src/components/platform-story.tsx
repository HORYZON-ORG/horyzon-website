import { Tiles } from '@/components/kit';

const layers = [
 { title: 'Capire', label: 'Il punto di partenza', text: 'Raccogliamo le informazioni utili e mettiamo a fuoco la priorità.' },
 { title: 'Condividere', label: 'Un piano comprensibile', text: 'Definiamo chi fa cosa, con quali strumenti e verso quale obiettivo.' },
 { title: 'Lavorare', label: 'Responsabilità chiare', text: 'Le persone operano nei sistemi approvati. Ogni collegamento viene prima verificato.' },
 { title: 'Osservare', label: 'La vista Platform', text: 'KPI, report e avanzamento aiutano a leggere i risultati e decidere il passo successivo.' },
];
export function PlatformStory(): React.JSX.Element {
 return <figure style={{ margin: 0 }}>
  <Tiles columns={2} items={layers.map((layer, index) => ({ tag: `0${index + 1} · ${layer.label}`, title: layer.title, text: layer.text }))} />
  <figcaption><details className="rd-more"><summary>Che cosa collega questi ambienti?</summary><p>Hub raccoglie evidenze e Blueprint; ChatGPT Work e i sistemi approvati sostengono il lavoro. Horyzon MCP riporta gli output autorizzati. Platform mostra KPI, report, sincronizzazione e stato di attivazione. Ogni collegamento richiede configurazione e prove nel contesto aziendale.</p></details></figcaption>
 </figure>;
}
