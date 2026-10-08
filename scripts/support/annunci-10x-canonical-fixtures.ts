import { createHash } from 'node:crypto';

import type {
  Annunci10xEditorialCoreOutput,
  CommunicationStrategy,
  RoleCard,
} from '../../src/lib/annunci-10x/index.ts';
import { createFact } from '../../src/lib/annunci-10x/index.ts';

export interface Annunci10xCanonicalFixture {
  readonly key: 'customer-care' | 'magazziniere';
  readonly label: string;
  readonly roleCard: RoleCard;
  readonly communicationStrategy: Pick<CommunicationStrategy, 'summary' | 'candidateAngle' | 'reasons' | 'proofPoints' | 'riskNotes'>;
  readonly safeEditorialCore: Annunci10xEditorialCoreOutput;
  readonly expectedWriterInput: readonly RegExp[];
  readonly forbiddenWriterInput: readonly RegExp[];
}

export const CUSTOMER_CARE_CANONICAL_FIXTURE: Annunci10xCanonicalFixture = {
  key: 'customer-care',
  label: 'Customer Care',
  roleCard: {
    title: confirmed('Addetto/a Customer Care', 'canonical-customer-title'),
    mission: confirmed('rispondere alle richieste clienti, comprendere il problema segnalato e mantenere ordinata la gestione nel CRM', 'canonical-customer-mission'),
    outcomes: [
      confirmed('verificare che la richiesta sia stata gestita nel perimetro standard', 'canonical-customer-outcome'),
    ],
    responsibilities: [
      confirmed('rispondere alle richieste clienti', 'canonical-customer-responsibility-1'),
      confirmed('comprendere il problema segnalato', 'canonical-customer-responsibility-2'),
      confirmed('fornire informazioni sui servizi', 'canonical-customer-responsibility-3'),
      confirmed('gestire richieste amministrative semplici', 'canonical-customer-responsibility-4'),
      confirmed('registrare le richieste nel CRM', 'canonical-customer-responsibility-5'),
      confirmed('verificare che la richiesta sia stata gestita', 'canonical-customer-responsibility-6'),
      confirmed('collaborazione con amministrazione e commerciale', 'canonical-customer-responsibility-7'),
    ],
    requirements: [
      { id: 'canonical-customer-req-1', label: confirmed('ascolto', 'canonical-customer-req-1'), classification: 'REQUIRED' },
      { id: 'canonical-customer-req-2', label: confirmed('chiarezza nella comunicazione', 'canonical-customer-req-2'), classification: 'REQUIRED' },
      { id: 'canonical-customer-req-3', label: confirmed('pazienza', 'canonical-customer-req-3'), classification: 'REQUIRED' },
      { id: 'canonical-customer-req-4', label: confirmed('organizzazione', 'canonical-customer-req-4'), classification: 'REQUIRED' },
      { id: 'canonical-customer-req-5', label: confirmed('precisione', 'canonical-customer-req-5'), classification: 'REQUIRED' },
      { id: 'canonical-customer-req-6', label: confirmed('capacita di gestire piu richieste', 'canonical-customer-req-6'), classification: 'REQUIRED' },
      { id: 'canonical-customer-pref-1', label: confirmed("un'esperienza di almeno 1 anno in assistenza clienti", 'canonical-customer-pref-1'), classification: 'PREFERRED' },
    ],
    compensation: {
      visibility: confirmed('PUBLIC', 'canonical-customer-compensation-visibility'),
      amountText: confirmed('RAL 23.000-26.000 EUR', 'canonical-customer-compensation'),
    },
    attractionContext: {
      companyDescription: confirmed('PMI italiana servizi B2B in abbonamento', 'canonical-customer-company'),
      workMode: confirmed('Ibrida, 3 giorni in ufficio e 2 da remoto', 'canonical-customer-work-mode'),
      location: confirmed('Lecce', 'canonical-customer-location'),
      contractType: confirmed('Tempo determinato 12 mesi con possibilita di trasformazione a tempo indeterminato', 'canonical-customer-contract'),
      schedule: confirmed('Lunedi-venerdi 09:00-18:00', 'canonical-customer-schedule'),
      shifts: confirmed('Non previsti', 'canonical-customer-shifts'),
      onCall: confirmed('Non prevista', 'canonical-customer-on-call'),
      operatingContext: confirmed('servizi B2B in abbonamento, CRM, amministrazione e commerciale', 'canonical-customer-operating-context'),
      autonomy: confirmed('gestire in autonomia richieste standard', 'canonical-customer-autonomy'),
      unexpectedEvents: confirmed('piu richieste clienti nello stesso periodo', 'canonical-customer-unexpected'),
      attractivenessEvidence: [],
    },
    applicationInstructions: confirmed('tramite il canale dell annuncio', 'canonical-customer-application'),
  },
  communicationStrategy: {
    summary: 'Rendere il ruolo chiaro, concreto e aderente ai facts canonici.',
    candidateAngle: 'Persona ordinata e paziente che cerca un ruolo customer care con condizioni definite.',
    reasons: [],
    proofPoints: [],
    riskNotes: [],
  },
  safeEditorialCore: {
    opening: 'Una PMI italiana servizi B2B in abbonamento cerca un Addetto/a Customer Care a Lecce. La posizione richiede ordine nel rispondere alle richieste clienti e nel registrare le richieste nel CRM.',
    responsibilities: 'Ti occuperai di rispondere alle richieste clienti, comprendere il problema segnalato, fornire informazioni sui servizi, gestire richieste amministrative semplici, registrare le richieste nel CRM, verificare che la richiesta sia stata gestita, gestire in autonomia le richieste standard e collaborare con amministrazione e commerciale.',
  },
  expectedWriterInput: [
    /Addetto\/a Customer Care/i,
    /\bLecce\b/i,
    /Ibrida,\s*3 giorni in ufficio e 2 da remoto/i,
    /Luned[iì]-venerd[iì] 09:00-18:00/i,
    /Tempo determinato 12 mesi con possibilit[aà] di trasformazione a tempo indeterminato/i,
    /RAL 23\.000-26\.000 EUR/i,
    /Non previsti/i,
    /Non prevista/i,
    /un'esperienza di almeno 1 anno in assistenza clienti/i,
    /PMI italiana\b(?=[\s\S]*servizi B2B in abbonamento)/i,
    /rispondere alle richieste clienti/i,
    /comprendere il problema segnalato/i,
    /fornire informazioni sui servizi/i,
    /richieste amministrative semplici/i,
    /verificare che la richiesta sia stata gestita/i,
    /gestire in autonomia le richieste standard/i,
    /collaborare con amministrazione e commerciale/i,
    /registrare le richieste nel CRM/i,
  ],
  forbiddenWriterInput: [
    /italiano scritto chiaro/i,
    /\bemail\b/i,
    /\btelefono\b/i,
    /\bticket\b/i,
    /\bresponsabile\b/i,
    /familiarit[aà]\s+(?:con\s+)?CRM/i,
    /aggiornare le informazioni/i,
    /riallineare informazioni/i,
    /24\.000-28\.000/i,
    /affiancamento iniziale/i,
  ],
};

export const MAGAZZINIERE_CANONICAL_FIXTURE: Annunci10xCanonicalFixture = {
  key: 'magazziniere',
  label: 'Magazziniere',
  roleCard: {
    title: confirmed('Magazziniere / Addetto logistica', 'canonical-warehouse-title'),
    mission: confirmed('mantenere affidabili quantita, preparazione ordini e collaborazione operativa nel magazzino', 'canonical-warehouse-mission'),
    outcomes: [
      confirmed('mantenere affidabili quantita e preparazione ordini', 'canonical-warehouse-outcome'),
    ],
    responsibilities: [
      confirmed('ricezione merce', 'canonical-warehouse-responsibility-1'),
      confirmed('controllo quantita', 'canonical-warehouse-responsibility-2'),
      confirmed('sistemazione prodotti', 'canonical-warehouse-responsibility-3'),
      confirmed('preparazione ordini', 'canonical-warehouse-responsibility-4'),
      confirmed('collaborazione con autisti e ufficio ordini', 'canonical-warehouse-responsibility-5'),
    ],
    requirements: [
      { id: 'canonical-warehouse-req-1', label: confirmed('affidabilita', 'canonical-warehouse-req-1'), classification: 'REQUIRED' },
      { id: 'canonical-warehouse-req-2', label: confirmed('puntualita', 'canonical-warehouse-req-2'), classification: 'REQUIRED' },
      { id: 'canonical-warehouse-req-3', label: confirmed('attenzione agli errori', 'canonical-warehouse-req-3'), classification: 'REQUIRED' },
      { id: 'canonical-warehouse-pref-1', label: confirmed('esperienza precedente in magazzino', 'canonical-warehouse-pref-1'), classification: 'PREFERRED' },
      { id: 'canonical-warehouse-pref-2', label: confirmed('patentino muletto', 'canonical-warehouse-pref-2'), classification: 'PREFERRED' },
    ],
    compensation: {
      visibility: confirmed('PUBLIC', 'canonical-warehouse-compensation-visibility'),
      amountText: confirmed('Retribuzione da definire in base all esperienza e nel rispetto del CCNL applicato', 'canonical-warehouse-compensation'),
    },
    attractionContext: {
      companyDescription: confirmed('PMI italiana che distribuisce prodotti alimentari a ristoranti e attivita commerciali', 'canonical-warehouse-company'),
      workMode: confirmed('In sede', 'canonical-warehouse-work-mode'),
      location: confirmed('Bari', 'canonical-warehouse-location'),
      contractType: confirmed('Tempo determinato iniziale con possibilita di trasformazione a tempo indeterminato', 'canonical-warehouse-contract'),
      schedule: confirmed('Lunedi-venerdi 08:00-17:00 con pausa pranzo', 'canonical-warehouse-schedule'),
      shifts: confirmed('Non dichiarati', 'canonical-warehouse-shifts'),
      onCall: confirmed('Non dichiarata', 'canonical-warehouse-on-call'),
      operatingContext: confirmed('autisti e ufficio ordini', 'canonical-warehouse-operating-context'),
      autonomy: confirmed('svolge attivita operative assegnate con attenzione a quantita, ordine dell area e correttezza della preparazione', 'canonical-warehouse-autonomy'),
      unexpectedEvents: confirmed('differenze tra quantita attese e merce ricevuta, urgenze nella preparazione ordini', 'canonical-warehouse-unexpected'),
      attractivenessEvidence: [],
    },
    applicationInstructions: confirmed('tramite il canale dell annuncio', 'canonical-warehouse-application'),
  },
  communicationStrategy: {
    summary: 'Descrivere un lavoro operativo in magazzino alimentare senza inventare benefit o contesti.',
    candidateAngle: 'Persona affidabile e puntuale che cerca un lavoro logistico concreto.',
    reasons: [],
    proofPoints: [],
    riskNotes: [],
  },
  safeEditorialCore: {
    opening: 'Una PMI italiana che distribuisce prodotti alimentari a ristoranti e attivita commerciali cerca un Magazziniere / Addetto logistica a Bari per mantenere affidabili quantita, preparazione ordini e collaborazione operativa nel magazzino.',
    responsibilities: 'Ti occuperai di ricevere la merce, controllare le quantita, sistemare i prodotti, preparare gli ordini e collaborare con autisti e ufficio ordini.',
  },
  expectedWriterInput: [
    /Magazziniere \/ Addetto logistica/i,
    /\bBari\b/i,
    /PMI italiana che distribuisce prodotti alimentari a ristoranti e attivit[aà] commerciali/i,
    /ricevere la merce/i,
    /controllare le quantit[aà]/i,
    /sistemare i prodotti/i,
    /preparare gli ordini/i,
    /collaborare con autisti e ufficio ordini/i,
    /affidabilit[aà]/i,
    /puntualit[aà]/i,
    /attenzione agli errori/i,
    /esperienza precedente in magazzino/i,
    /patentino muletto/i,
    /Retribuzione da definire in base all esperienza e nel rispetto del CCNL applicato/i,
  ],
  forbiddenWriterInput: [
    /quotidian/i,
    /ridurre errori/i,
    /ridurre ritardi/i,
    /segnalare eventuali discrepanze/i,
    /\britiri\b/i,
    /\bBrescia\b/i,
    /manifatturier/i,
    /materiali per (?:consegne o )?produzione/i,
    /documenti di magazzino/i,
    /buona manualit/i,
    /\bresponsabile\b/i,
    /altri reparti/i,
    /necessita di coordinarsi/i,
    /coordinarsi con autisti/i,
    /coordinarsi con ufficio ordini/i,
    /gestire con autisti/i,
    /interfacciarsi con autisti/i,
  ],
};

export const ANNUNCI10X_CANONICAL_FIXTURES = [
  CUSTOMER_CARE_CANONICAL_FIXTURE,
  MAGAZZINIERE_CANONICAL_FIXTURE,
] as const;

export function canonicalFixtureHash(fixture: Annunci10xCanonicalFixture): string {
  return stableHash({
    key: fixture.key,
    roleCard: fixture.roleCard,
    communicationStrategy: fixture.communicationStrategy,
  });
}

export function stableHash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex').slice(0, 16);
}

function confirmed<T>(value: T, sourceId: string) {
  return createFact(value, 'USER_CONFIRMED', { sourceId, publishable: true, confidence: 95 });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
