// The job ad at the centre of /annunci-10x, drawn like a listing on a job board: company, title, a grid of
// key facts and the apply button. `step` drives the rewrite: 0 is the vague ad (the free Score finds the
// rust squiggles), 1–5 rewrite one sentence at a time (strike, then the clear version), 6 is the clear ad
// (what Annuncio 10x writes). The clear version is an illustrative example: the page says so next to it.
// Server-safe, so the hero and the static story render without JavaScript.

type Rewrite = {
  area: string;
  before: string;
  after: readonly [string, string, string];
  error: readonly [string, string];
  note: string;
};

export const AD_REWRITES: readonly Rewrite[] = [
  {
    area: 'Attività',
    before: 'Cerchiamo ragazzo/a dinamico/a e motivato/a.',
    after: ['Servizio ai tavoli, pranzo e cena, ', '60 coperti', '.'],
    error: ['“Dinamico e motivato” ', 'non è un lavoro.'],
    note: 'Chi legge deve capire che cosa farà. E chi non lo vuole fare si ferma qui.',
  },
  {
    area: 'Orari',
    before: 'Disponibilità anche nei weekend.',
    after: ['Turni mar–sab 18–24, ', 'domenica e lunedì liberi', '.'],
    error: ['“Disponibilità nei weekend” ', 'non è un orario.'],
    note: 'I turni scritti selezionano prima del colloquio.',
  },
  {
    area: 'Stipendio',
    before: 'Retribuzione commisurata all’esperienza.',
    after: ['', '1.450 € netti al mese', ', mance divise.'],
    error: ['“Commisurata all’esperienza” ', 'non è una cifra.'],
    note: 'Senza un numero, chi è bravo passa oltre. Chi si candida a tutto no.',
  },
  {
    area: 'Contratto',
    before: 'Possibilità di crescita.',
    after: ['Dopo 3 mesi, ', 'contratto a tempo indeterminato', '.'],
    error: ['“Possibilità di crescita” ', 'non è un contratto.'],
    note: 'Una promessa vaga attira chi cerca un ripiego.',
  },
  {
    area: 'Perché voi',
    before: 'Ambiente giovane e dinamico.',
    after: ['', 'Due settimane di affiancamento', ' con il capo sala.'],
    error: ['“Giovane e dinamico” ', 'lo scrivono tutti.'],
    note: 'Un fatto vero su come si lavora da voi vale più di un aggettivo.',
  },
];

// Each key fact fills in when the sentence that answers it is rewritten (step = rewrite number).
const FACTS = [
  { label: 'Orari', before: 'da definire', after: 'Mar–sab, sera', step: 2 },
  { label: 'Stipendio', before: 'commisurato', after: '1.450 € netti', step: 3 },
  { label: 'Contratto', before: '—', after: 'Indeterminato', step: 4 },
] as const;

export const AD_FINAL_STEP = AD_REWRITES.length + 1;

function lineState(index: number, step: number) {
  const n = index + 1;
  if (step >= AD_FINAL_STEP || n < step) return 'ax-line is-done';
  if (n === step) return 'ax-line is-current';
  return 'ax-line';
}

export function AdSheet({ className = '', step = 0, scan = false }: { className?: string; step?: number; scan?: boolean }) {
  const status = step === 0 ? 'Prima' : step >= AD_FINAL_STEP ? 'Dopo' : 'In revisione';
  return <figure className={`ax-ad ${className}`.trim()} data-step={step} aria-hidden="true">
    <div className="ax-ad-head">
      <span className="ax-ad-logo">TA</span>
      <span className="ax-ad-company"><b>La tua azienda</b>Bari · ristorazione</span>
    </div>
    <p className="ax-ad-title">Cameriere/a di sala</p>
    <dl className="ax-facts">
      {FACTS.map((fact) => <div key={fact.label} className={step >= fact.step ? 'ax-fact is-done' : 'ax-fact'}>
        <dt>{fact.label}</dt>
        <dd><span className="ax-fact-before">{fact.before}</span><span className="ax-fact-after">{fact.after}</span></dd>
      </div>)}
    </dl>
    <ul className="ax-lines">
      {AD_REWRITES.map((line, index) => <li key={line.area} className={lineState(index, step)}>
        <span className="ax-before">{line.before}</span>
        <span className="ax-after">{line.after[0]}<em>{line.after[1]}</em>{line.after[2]}</span>
      </li>)}
    </ul>
    <div className="ax-ad-foot"><span className="ax-ad-status">{status}</span><span className="ax-ad-apply">Candidati</span></div>
    {scan && <span className="ax-scan" />}
  </figure>;
}
