import Link from 'next/link';
import type { ServiceEditorial, ServiceRoute } from '@/content/editorial-routes';

type Props = {
 route: ServiceRoute;
 title: string;
 intro: string;
 content: ServiceEditorial;
};

export function ServiceEditorialPage({ route, title, intro, content }: Props) {
 return <div className="service-editorial" data-service={route}>
  <section className="service-diagnostic" aria-labelledby="service-urgent">
   <p className="section-kicker">Quando diventa urgente</p>
   <h2 id="service-urgent">{title} merita attenzione quando il lavoro comincia a tornare indietro.</h2>
   <p className="service-lead">{intro}</p>
   <ul>{content.urgency.map((item, index) => <li key={item}><span>0{index + 1}</span><p>{item}</p></li>)}</ul>
  </section>
  <section className="service-interventions" aria-labelledby="service-work">
   <p className="section-kicker">Su cosa lavoriamo</p>
   <h2 id="service-work">Diamo una forma praticabile alla priorità.</h2>
   <ol>{content.interventions.map((item, index) => <li key={item}><span>0{index + 1}</span><p>{item}</p></li>)}</ol>
  </section>
  <section className="service-evidence" aria-labelledby="service-visible">
   <p className="section-kicker">Cosa diventa visibile</p>
   <h2 id="service-visible">Decisioni e progressi che il team può riconoscere.</h2>
   <ul>{content.evidence.map(item => <li key={item}>{item}</li>)}</ul>
   <Link href={`/${content.parent}`} className="text-link">← {content.nextLabel}</Link>
  </section>
 </div>;
}
