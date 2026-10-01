import { Rows } from '@/components/kit';
import { operatingJourney } from '@/content/site-narrative';

const chapters = [
 { title: 'Mettere a fuoco', text: 'La direzione e il punto di partenza.', start: 0 },
 { title: 'Dare una forma', text: 'Le persone, i vincoli e la priorità.', start: 3 },
 { title: 'Far accadere', text: 'Il lavoro, le prove e il passo successivo.', start: 6 },
];

// The nine stages of the method in three chapters, all visible: no accordion, complete without JavaScript.
export function OperatingJourney(): React.JSX.Element {
 return <div className="rd-stack">{chapters.map((chapter, index) => <div className="rd-split" key={chapter.title}>
  <header className="rd-head rd-reveal"><span className="rd-tile-tag" aria-hidden="true">0{index + 1}</span><h3 className="rd-statement">{chapter.title}</h3><p className="rd-head-lead">{chapter.text}</p></header>
  <Rows start={chapter.start + 1} items={operatingJourney.slice(chapter.start, chapter.start + 3).map(stage => ({ title: stage.title, text: stage.description }))} />
 </div>)}</div>;
}
