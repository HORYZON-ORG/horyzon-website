import { operatingJourney } from '@/content/site-narrative';
const chapters = [
 { title: 'Mettere a fuoco', text: 'La direzione e il punto di partenza.', start: 0 },
 { title: 'Dare una forma', text: 'Le persone, i vincoli e la priorità.', start: 3 },
 { title: 'Far accadere', text: 'Il lavoro, le prove e il passo successivo.', start: 6 },
];
export function OperatingJourney({ compact = false }: { compact?: boolean }): React.JSX.Element {
 return <div className={`method-chapters ${compact ? 'is-compact' : ''}`}>{chapters.map((chapter,index)=><details key={chapter.title} open={index===0}><summary><span className="method-chapter-number">0{index+1}</span><span><strong>{chapter.title}</strong><small>{chapter.text}</small></span><span className="method-chapter-toggle" aria-hidden="true">+</span></summary><ol className="operating-journey" start={chapter.start+1}>{operatingJourney.slice(chapter.start,chapter.start+3).map((stage,step)=><li key={stage.title}><span className="journey-stage-number">{String(chapter.start+step+1).padStart(2,'0')}</span><div><h3>{stage.title}</h3><p>{stage.description}</p></div></li>)}</ol></details>)}</div>;
}
