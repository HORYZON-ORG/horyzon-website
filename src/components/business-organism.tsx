'use client';

import { departments } from '@/content/site-narrative';
import { useState } from 'react';

export function BusinessOrganism({ compact = false }: { compact?: boolean }): React.JSX.Element {
 const [activeDepartment, setActiveDepartment] = useState<string | null>(compact ? null : departments[0].id);

 return <div className={`business-organism ${compact ? 'is-compact' : ''}`}>
  <div className="organism-stage" aria-label="Mappa dei cinque reparti dell'impresa">
   <div className="organism-orbit organism-orbit-one" />
   <div className="organism-orbit organism-orbit-two" />
   <div className="organism-core"><span>Una sola direzione</span><strong>Impresa</strong></div>
   {departments.map((department,index)=><button type="button" className={`organism-node organism-node-${index+1}${activeDepartment===department.id ? ' is-active' : ''}`} key={department.id} onClick={()=>setActiveDepartment(department.id)} aria-pressed={activeDepartment===department.id}>{department.name}</button>)}
  </div>
  <div className="organism-departments">
   <p className="organism-instruction">Apri un reparto. Guarda che cosa accade agli altri.</p>
   {departments.map((department,index)=>{const isActive=activeDepartment===department.id; return <details key={department.id} open={isActive}>
    <summary onClick={event=>{event.preventDefault();setActiveDepartment(current=>current===department.id?null:department.id)}}><span>{String(index+1).padStart(2,'0')}</span><strong>{department.name}</strong><i aria-hidden="true">+</i></summary>
    <div className="department-detail"><p className="department-purpose">{department.purpose}</p><div><h3>Quando manca chiarezza</h3><ul>{department.signals.map(signal=><li key={signal}>{signal}</li>)}</ul></div><p className="department-destination"><strong>La direzione</strong>{department.destination}</p></div>
   </details>})}
  </div>
 </div>;
}
