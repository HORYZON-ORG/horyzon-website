const layers = [
 { title: 'Capire', label: 'Il punto di partenza', text: 'Raccogliamo le informazioni utili e mettiamo a fuoco la priorità.' },
 { title: 'Condividere', label: 'Un piano comprensibile', text: 'Definiamo chi fa cosa, con quali strumenti e verso quale obiettivo.' },
 { title: 'Lavorare', label: 'Responsabilità chiare', text: 'Le persone operano nei sistemi approvati. Ogni collegamento viene prima verificato.' },
 { title: 'Osservare', label: 'La vista Platform', text: 'KPI, report e avanzamento aiutano a leggere i risultati e decidere il passo successivo.' },
];
export function PlatformStory(): React.JSX.Element {
 return <figure className="platform-story"><div className="platform-story-rail"><div className="platform-story-axis" aria-hidden="true"><span>Domanda</span><i/><span>Decisione</span></div><ol>{layers.map((layer,index)=><li key={layer.title}><span className="platform-layer-number">0{index+1}</span><div><p>{layer.label}</p><h3>{layer.title}</h3><span>{layer.text}</span></div></li>)}</ol></div><figcaption><details><summary>Che cosa collega questi ambienti?</summary><p>Hub raccoglie evidenze e Blueprint; ChatGPT Work e i sistemi approvati sostengono il lavoro. Horyzon MCP riporta gli output autorizzati. Platform mostra KPI, report, sincronizzazione e stato di attivazione. Ogni collegamento richiede configurazione e prove nel contesto aziendale.</p></details></figcaption></figure>;
}
