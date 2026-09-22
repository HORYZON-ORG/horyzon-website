import { departments } from '@/content/site-narrative';

export function BusinessOrganism({ compact = false }: { compact?: boolean }): React.JSX.Element {
 return <div className={`business-organism ${compact ? 'is-compact' : ''}`}>
  <div className="organism-stage" aria-hidden="true">
   <div className="organism-orbit organism-orbit-one" />
   <div className="organism-orbit organism-orbit-two" />
   <div className="organism-core"><span>Una sola direzione</span><strong>Impresa</strong></div>
   {departments.map((department,index)=><span className={`organism-node organism-node-${index+1}`} key={department.id}>{department.name}</span>)}
  </div>
  <div className="organism-departments">
   <p className="organism-instruction">Apri un reparto. Guarda che cosa accade agli altri.</p>
   {departments.map((department,index)=><details key={department.id} open={!compact && index===0}>
    <summary><span>{String(index+1).padStart(2,'0')}</span><strong>{department.name}</strong><i aria-hidden="true">+</i></summary>
    <div className="department-detail"><p className="department-purpose">{department.purpose}</p><div><h3>Quando manca chiarezza</h3><ul>{department.signals.map(signal=><li key={signal}>{signal}</li>)}</ul></div><p className="department-destination"><strong>La direzione</strong>{department.destination}</p></div>
   </details>)}
  </div>
 </div>;
}
