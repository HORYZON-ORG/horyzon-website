'use client';

import { useState } from 'react';
import { italyOutline, performiaOffices } from '@/content/performia-offices';
import styles from './recruiting.module.css';

export function PerformiaMap() {
 const [country, setCountry] = useState('IT');
 const office = performiaOffices.find(({ code }) => code === country)!;

 return <div>
  <svg className={styles.worldMap} viewBox="0 0 1000 400" role="group" aria-label="Mappa delle sedi Performia">
   <image href="/maps/performia-world.svg" width="1000" height="400" />
   <path d={italyOutline} className={styles.italyOutline} />
   {performiaOffices.map(({ code, name, x, y }) =>
    <g key={code} role="button" tabIndex={0} aria-label={name} aria-pressed={country === code}
     className={styles.mapPin} data-italy={code === 'IT' || undefined}
     transform={`translate(${x} ${y})`}
     onClick={() => setCountry(code)}
     onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') {
       event.preventDefault();
       setCountry(code);
      }
     }}>
     <title>{name}</title>
     <circle r="8" fill="transparent" />
     <circle r={code === 'IT' ? 5 : 3.5} className={styles.mapDot} />
    </g>
   )}
  </svg>
  <div className={styles.mapControls}>
   <label>Paese
    <select value={country} onChange={event => setCountry(event.target.value)}>
     {performiaOffices.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
    </select>
   </label>
   <p role="status"><strong>{office.name} · {office.city}</strong>
    {office.code === 'IT' && <span>HORYZON Consulting è il riferimento italiano.</span>}
   </p>
  </div>
 </div>;
}
