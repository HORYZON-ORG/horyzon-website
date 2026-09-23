import Link from 'next/link';
import type { Person } from '@/data/people';

export function PersonContribution({ person }: { person: Person }) {
 const nextAction = person.name === 'Angelo Ria Chetta' ? { href: '/libro/management-umano', label: 'Leggi Management Umano' } : person.name === 'Gianluca Buccoliero' ? { href: '/benessere-digitale', label: 'Esplora il benessere digitale' } : { href: '/radar-impresa', label: 'Scopri il Radar d’Impresa' };
 return <section className="person-contribution" aria-labelledby="person-contribution-title">
  <p className="section-kicker">Dove intervengo</p>
  <h2 id="person-contribution-title">Le decisioni che posso aiutarti a rendere più chiare.</h2>
  <ul>{person.skills.map(skill => <li key={skill}>{skill}</li>)}</ul>
  <Link className="text-link" href={nextAction.href}>{nextAction.label} ↗</Link>
 </section>;
}
