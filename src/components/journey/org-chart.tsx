// The five departments of a company and what each one produces, from Horyzon's own organisation
// handbook ("Le basi dell'organizzazione d'impresa"): the general direction divides the work, each
// department owns its functions and delivers one product. The same five departments are read by the Radar.
// Static and complete without JS; under html.kinetic the chart is pinned and built by scroll (home-motion).

export const departments = [
 { name: 'Risorse umane', functions: ['Selezione', 'Mansionari', 'Formazione', 'Statistiche', 'Etica'], product: 'Persone produttive' },
 { name: 'Marketing', functions: ['Ricerche di mercato', 'Promozione', 'Pubblicità'], product: 'Clienti interessati' },
 { name: 'Amministrazione', functions: ['Fatturazione e incassi', 'Fornitori e acquisti', 'Contabilità e fisco', 'Segreteria'], product: 'Il denaro che serve all’azienda' },
 { name: 'Produzione', functions: ['Tutte le attività che creano clienti contenti'], product: 'Clienti contenti' },
 { name: 'Commerciale', functions: ['Vendita', 'Inserimento e gestione agenti'], product: 'Ordini redditizi' },
] as const;

export function OrgChart() {
 return <div className="org-chart">
  <div className="org-head"><span className="org-node" aria-hidden="true"/><strong>Direzione generale</strong><small>Suddivide il lavoro, assegna i ruoli, forma le persone.</small></div>
  <ol className="org-depts">
   {departments.map((dept, index) => <li key={dept.name} style={{ '--k': index } as React.CSSProperties}>
    <span className="org-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    <h3>{dept.name}</h3>
    <ul className="org-functions">{dept.functions.map(fn => <li key={fn}>{fn}</li>)}</ul>
    <p className="org-product"><span>Prodotto</span>{dept.product}</p>
   </li>)}
  </ol>
 </div>;
}
