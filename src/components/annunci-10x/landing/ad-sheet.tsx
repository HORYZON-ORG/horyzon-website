// "L’annuncio sotto la lente": a generic job ad drawn as a sheet of paper. The five sentences are the
// clichés that leave a candidate with doubts; they carry the red squiggle of a spell-checker. Illustrative
// only: no role from a real client, no score. Server-safe, so the hero and the static story render
// without JavaScript.

export const AD_DOUBTS = [
  { phrase: 'Cerchiamo una figura dinamica e motivata.', area: 'Attività', doubt: 'Che cosa farò, concretamente, ogni giorno?' },
  { phrase: 'Orari e contratto da definire al colloquio.', area: 'Condizioni', doubt: 'Turni e contratto li scopro solo al colloquio.' },
  { phrase: 'Retribuzione commisurata all’esperienza.', area: 'Retribuzione', doubt: 'Non so se vale la pena candidarmi.' },
  { phrase: 'Richiesta massima flessibilità.', area: 'Ritmo', doubt: 'Flessibile quanto? Sere, weekend, straordinari?' },
  { phrase: 'Ambiente giovane e stimolante.', area: 'Perché voi', doubt: 'Lo scrivono tutti. Perché dovrei scegliere voi?' },
] as const;

type Line = { bar: string } | { doubt: number };

const LINES: readonly Line[] = [
  { bar: '92%' },
  { doubt: 0 },
  { bar: '74%' },
  { bar: '86%' },
  { doubt: 1 },
  { doubt: 2 },
  { bar: '58%' },
  { doubt: 3 },
  { bar: '80%' },
  { doubt: 4 },
  { bar: '42%' },
];

export function AdSheet({ className = '', active = null, scan = false }: { className?: string; active?: number | null; scan?: boolean }) {
  const focused = active !== null;
  return <figure className={`ax-sheet${focused ? ' is-focused' : ''} ${className}`.trim()} aria-hidden="true">
    <figcaption className="ax-sheet-head"><span>Offerta di lavoro</span><b>Magazziniere carrellista</b></figcaption>
    <ul>
      {LINES.map((line, index) => 'bar' in line
        ? <li key={index}><span className="ax-bar" style={{ '--w': line.bar } as React.CSSProperties} /></li>
        : <li key={index}><span className={active === line.doubt ? 'ax-vague is-active' : 'ax-vague'}>{AD_DOUBTS[line.doubt]!.phrase}</span></li>)}
    </ul>
    {scan && <span className="ax-scan" />}
  </figure>;
}
