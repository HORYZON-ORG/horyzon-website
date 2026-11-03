import Image from 'next/image';
import styles from './operating-units.module.css';

export const operatingUnits = [
  { name: 'Lecce', country: 'Italia' },
  { name: 'Brindisi', country: 'Italia' },
  { name: 'Taranto', country: 'Italia' },
  { name: 'Bari', country: 'Italia' },
  { name: 'BAT', country: 'Italia', area: 'Barletta-Andria-Trani' },
  { name: 'Milano', country: 'Italia' },
  { name: 'Venezia', country: 'Italia' },
  { name: 'Lugano', country: 'Svizzera' },
  { name: 'Atene', country: 'Grecia' },
];

export function OperatingUnits() {
  return <div className={styles.units}>
    <div className={styles.maps}>
      <figure><Image src="/maps/horyzon-operating-units.svg" width={880} height={660} sizes="(max-width:850px) 88vw, 50vw" alt="Mappa delle unità operative: Milano e Venezia in Italia, Lugano in Svizzera, Atene in Grecia e area pugliese." /><figcaption>Italia, Svizzera e Grecia</figcaption></figure>
      <figure><Image src="/maps/horyzon-puglia.svg" width={680} height={440} sizes="(max-width:850px) 88vw, 35vw" alt="Dettaglio Puglia con le unità operative di Lecce, Brindisi, Taranto, Bari e BAT." /><figcaption>Puglia · BAT indica l’area di Barletta-Andria-Trani</figcaption></figure>
    </div>
    <ul className={styles.list} aria-label="Unità operative Horyzon">{operatingUnits.map(unit => <li key={unit.name}><strong>{unit.name}</strong><span>{unit.area ? `${unit.area} · ${unit.country}` : unit.country}</span></li>)}</ul>
  </div>;
}
