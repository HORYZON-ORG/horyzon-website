import { ANNUNCI10X_RUBRIC_VERSION, CHECK_STATUSES } from './constants.ts';
import type { CheckStatus } from './types.ts';

export type RubricDimensionId =
  | 'ROLE_IDENTITY'
  | 'WORK_AND_RESULTS'
  | 'ROLE_ALIGNMENT'
  | 'REQUIREMENTS'
  | 'OFFER_AND_CONDITIONS'
  | 'CHANNEL_AND_FORMAT'
  | 'READABILITY'
  | 'APPLICATION';

export interface RubricDimension {
  id: RubricDimensionId;
  label: string;
  maxPoints: number;
}

export interface RubricAnchors {
  PASS: string;
  PARTIAL: string;
  MISSING: string;
  NOT_EVALUABLE: string;
}

export interface RubricCheckDefinition {
  id: string;
  dimensionId: RubricDimensionId;
  label: string;
  description: string;
  maxPoints: 5;
  allowedStatuses: readonly CheckStatus[];
  anchors: RubricAnchors;
  conflictNote: string;
  methodNotes: string[];
}

export interface RubricValidationResult {
  ok: boolean;
  errors: string[];
  totalMaxPoints: number;
}

export const ANNUNCI10X_RUBRIC_DIMENSIONS: readonly RubricDimension[] = [
  { id: 'ROLE_IDENTITY', label: 'Identita del ruolo', maxPoints: 10 },
  { id: 'WORK_AND_RESULTS', label: 'Lavoro e risultati', maxPoints: 15 },
  { id: 'ROLE_ALIGNMENT', label: 'Allineamento al ruolo', maxPoints: 20 },
  { id: 'REQUIREMENTS', label: 'Requisiti', maxPoints: 10 },
  { id: 'OFFER_AND_CONDITIONS', label: 'Offerta e condizioni', maxPoints: 20 },
  { id: 'CHANNEL_AND_FORMAT', label: 'Canale e formato', maxPoints: 10 },
  { id: 'READABILITY', label: 'Leggibilita', maxPoints: 10 },
  { id: 'APPLICATION', label: 'Candidatura', maxPoints: 5 },
] as const;

export const ANNUNCI10X_RUBRIC_CHECKS: readonly RubricCheckDefinition[] = [
  check('01', 'ROLE_IDENTITY', 'Titolo chiaro, specifico e riconoscibile', 'Il titolo permette di capire subito ruolo e famiglia professionale.', 'Il titolo e specifico e riconoscibile.', 'Il titolo e comprensibile ma generico o incompleto.', 'Il titolo manca o non identifica il ruolo.', 'Non valutabile senza titolo o contesto minimo.', ['Non usare sinonimi creativi se riducono riconoscibilita.']),
  check('02', 'ROLE_IDENTITY', 'Livello/perimetro del ruolo comprensibili', 'Il testo chiarisce seniority, perimetro o responsabilita attesa.', 'Livello e perimetro sono espliciti.', 'Livello o perimetro sono parzialmente deducibili.', 'Livello e perimetro mancano.', 'Non valutabile se il ruolo non ha livello/perimetro applicabile.', ['Perimetro e piu importante di una seniority formale quando la seniority non e nota.']),
  check('03', 'WORK_AND_RESULTS', 'Attivita quotidiane concrete', 'Le attivita ordinarie sono concrete, osservabili e non solo slogan.', 'Attivita quotidiane chiare e concrete.', 'Attivita presenti ma vaghe o incomplete.', 'Attivita quotidiane assenti.', 'Non valutabile quando il ruolo non prevede routine descrivibile.', ['La routine non va nascosta dietro promesse aspirazionali.']),
  check('04', 'WORK_AND_RESULTS', 'Contributo/risultato atteso osservabile', 'Il contributo atteso e tradotto in risultati o effetti verificabili.', 'Risultato atteso osservabile.', 'Risultato presente ma poco misurabile.', 'Contributo atteso mancante.', 'Non valutabile se l input non consente di distinguere il contributo.', ['Il risultato puo essere qualitativo, ma deve essere osservabile.']),
  check('05', 'WORK_AND_RESULTS', 'Contesto operativo, collaborazione e interlocutori', 'Il testo chiarisce con chi si lavora, contesto e principali interazioni.', 'Contesto e interlocutori chiari.', 'Contesto parziale o solo implicito.', 'Contesto operativo assente.', 'Non valutabile se il canale non consente contesto esteso.', ['Il contesto riduce ambiguita e false aspettative.']),
  check('06', 'ROLE_ALIGNMENT', 'Enfasi coerente con popolarita ruolo/azienda', 'La strategia non confonde popolarita del ruolo e attrattivita aziendale.', 'Enfasi coerente con domanda e attrattivita.', 'Enfasi utile ma poco differenziata.', 'Enfasi generica o non motivata.', 'Non valutabile se popolarita e attrattivita sono entrambe sconosciute.', ['UNKNOWN resta UNKNOWN e non diventa automaticamente LOW o HIGH.']),
  check('07', 'ROLE_ALIGNMENT', 'Rappresentazione fedele challenge/routine', 'Challenge e routine sono bilanciate senza creare sfide artificiali.', 'Challenge/routine fedeli al lavoro reale.', 'Bilanciamento presente ma incompleto.', 'Routine o challenge travisate o assenti.', 'Non valutabile senza segnali sul modo di lavorare.', ['Un lavoro routinario puo essere forte se precisione e continuita sono visibili.']),
  check('08', 'ROLE_ALIGNMENT', 'Qualificazione e impegno rappresentati correttamente', 'Il livello di selettivita e impegno richiesto e proporzionato.', 'Qualificazione e impegno coerenti.', 'Coerenza parziale o non esplicita.', 'Selettivita o impegno fuorvianti.', 'Non valutabile senza requisiti o condizioni minime.', ['La difficolta va resa visibile, non addolcita.']),
  check('09', 'ROLE_ALIGNMENT', 'Linguaggio, competenze e strumenti coerenti con tecnicita', 'Il lessico e il dettaglio tecnico sono adeguati al ruolo.', 'Tecnicalita rappresentata con precisione.', 'Dettaglio tecnico utile ma incompleto.', 'Gergo ornamentale o tecnicalita assente quando necessaria.', 'Non valutabile quando la tecnicalita non e determinabile.', ['Tecnico non significa piu parole difficili: significa piu precisione.']),
  check('10', 'REQUIREMENTS', 'Indispensabili distinti da preferenziali/apprendibili', 'I requisiti distinguono vincoli, preferenze e aspetti formabili.', 'Requisiti ben separati.', 'Separazione parziale.', 'Requisiti mescolati o non distinti.', 'Non valutabile se non sono presenti requisiti.', ['Ridurre inflated requirements quando non legati al lavoro reale.']),
  check('11', 'REQUIREMENTS', 'Requisiti pertinenti al lavoro reale', 'I requisiti sono giustificati dalle attivita e dai risultati attesi.', 'Requisiti pertinenti e motivati.', 'Pertinenza parziale.', 'Requisiti arbitrari o scollegati.', 'Non valutabile senza requisiti o lavoro descritto.', ['La pertinenza protegge da selezione inutilmente stretta.']),
  check('12', 'OFFER_AND_CONDITIONS', 'Sede/modalita di lavoro chiare', 'Sede, remoto/presenza o mobilita sono espliciti dove rilevanti.', 'Sede e modalita chiare.', 'Informazioni parziali.', 'Sede/modalita mancanti.', 'Non valutabile se non applicabile al formato o ruolo.', ['Contraddizioni su remoto/presenza sono materia da gate.']),
  check('13', 'OFFER_AND_CONDITIONS', 'Rapporto, orari, turni/tempi pertinenti', 'Contratto, orari, turni o tempi sono spiegati quando rilevanti.', 'Condizioni temporali chiare.', 'Condizioni parziali.', 'Condizioni mancanti.', 'Non valutabile se non applicabile o non disponibile.', ['Le condizioni materiali non vanno compensate con tono promozionale.']),
  check('14', 'OFFER_AND_CONDITIONS', 'Compenso/fascia chiari quando disponibili/applicabili', 'Il compenso e chiaro quando disponibile o gestito con trasparenza quando non divulgabile.', 'Compenso o politica di disclosure chiari.', 'Compenso parziale o non ben contestualizzato.', 'Compenso mancante quando necessario.', 'Non valutabile se non disponibile e non obbligatorio nel contesto.', ['N/D non penalizza automaticamente, ma abbassa coverage.']),
  check('15', 'OFFER_AND_CONDITIONS', "Ragioni concrete e verificate per scegliere l'offerta", 'Le ragioni di attrazione sono specifiche, supportate e non promozionali.', 'Ragioni concrete e verificate.', 'Ragioni presenti ma generiche.', 'Ragioni assenti o solo slogan.', 'Non valutabile senza contesto aziendale utilizzabile.', ['Company credibility deve poggiare su fatti, non claim.']),
  check('16', 'CHANNEL_AND_FORMAT', 'Struttura appropriata al canale/formato', 'La struttura rispetta vincoli e aspettative del canale.', 'Struttura adatta al canale.', 'Struttura usabile ma non ottimale.', 'Struttura inadatta.', 'Non valutabile senza canale/formato target.', ['Il Master resta fonte di verita delle varianti.']),
  check('17', 'CHANNEL_AND_FORMAT', 'Coerenza tra testo, campi e destinazione', 'Testo, campi strutturati e destinazione non divergono sui fatti.', 'Testo e campi coerenti.', 'Coerenza parziale con rischi minori.', 'Divergenze o campi mancanti rilevanti.', 'Non valutabile senza campi o destinazione.', ['Divergenze materiali possono bloccare la pubblicazione.']),
  check('18', 'READABILITY', 'Gerarchia e scansione leggibili', 'Titoli, sezioni e ordine aiutano lettura e scansione.', 'Gerarchia chiara e scansionabile.', 'Gerarchia presente ma migliorabile.', 'Testo denso o disordinato.', 'Non valutabile senza testo sufficiente.', ['La leggibilita sostiene chiarezza, non decoro.']),
  check('19', 'READABILITY', 'Linguaggio concreto, preciso, senza ripetizioni inutili', 'Il linguaggio evita vaghezze, cliché e ripetizioni non informative.', 'Linguaggio concreto e preciso.', 'Qualche genericita o ripetizione.', 'Linguaggio vago, gonfio o ripetitivo.', 'Non valutabile senza testo sufficiente.', ['Precisione batte enfasi.']),
  check('20', 'APPLICATION', 'CTA e destinazione candidatura chiare', 'Il candidato capisce come candidarsi e cosa succede dopo.', 'CTA e destinazione chiare.', 'CTA presente ma incompleta.', 'CTA mancante o inutilizzabile.', 'Non valutabile se il formato non richiede CTA.', ['CTA invalida puo bloccare il gate anche con score alto.']),
] as const;

export const ANNUNCI10X_RUBRIC = {
  version: ANNUNCI10X_RUBRIC_VERSION,
  dimensions: ANNUNCI10X_RUBRIC_DIMENSIONS,
  checks: ANNUNCI10X_RUBRIC_CHECKS,
  totalMaxPoints: 100,
} as const;

export function getRubricCheckDefinition(id: string): RubricCheckDefinition {
  const definition = ANNUNCI10X_RUBRIC_CHECKS.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown Annunci 10x rubric check: ${id}`);
  return definition;
}

export function validateAnnunci10xRubric(): RubricValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  let totalMaxPoints = 0;

  for (const definition of ANNUNCI10X_RUBRIC_CHECKS) {
    if (ids.has(definition.id)) errors.push(`Duplicate check id ${definition.id}`);
    ids.add(definition.id);
    totalMaxPoints += definition.maxPoints;
    if (definition.maxPoints !== 5) errors.push(`Check ${definition.id} must be worth 5 points`);
    if (!ANNUNCI10X_RUBRIC_DIMENSIONS.some((dimension) => dimension.id === definition.dimensionId)) errors.push(`Check ${definition.id} has unknown dimension`);
    for (const status of CHECK_STATUSES) {
      if (!definition.allowedStatuses.includes(status)) errors.push(`Check ${definition.id} does not allow ${status}`);
    }
  }

  if (ANNUNCI10X_RUBRIC_CHECKS.length !== 20) errors.push(`Rubric must contain 20 checks, found ${ANNUNCI10X_RUBRIC_CHECKS.length}`);
  if (totalMaxPoints !== 100) errors.push(`Rubric total must be 100, found ${totalMaxPoints}`);

  for (const dimension of ANNUNCI10X_RUBRIC_DIMENSIONS) {
    const dimensionTotal = ANNUNCI10X_RUBRIC_CHECKS
      .filter((definition) => definition.dimensionId === dimension.id)
      .reduce((sum, definition) => sum + definition.maxPoints, 0);
    if (dimensionTotal !== dimension.maxPoints) errors.push(`Dimension ${dimension.id} must total ${dimension.maxPoints}, found ${dimensionTotal}`);
  }

  return { ok: errors.length === 0, errors, totalMaxPoints };
}

function check(
  id: string,
  dimensionId: RubricDimensionId,
  label: string,
  description: string,
  pass: string,
  partial: string,
  missing: string,
  notEvaluable: string,
  methodNotes: string[],
): RubricCheckDefinition {
  return {
    id,
    dimensionId,
    label,
    description,
    maxPoints: 5,
    allowedStatuses: CHECK_STATUSES,
    anchors: {
      PASS: pass,
      PARTIAL: partial,
      MISSING: missing,
      NOT_EVALUABLE: notEvaluable,
    },
    conflictNote: 'CONFLICT vale 0 punti e puo generare issue o publication gate quando la contraddizione e materiale.',
    methodNotes,
  };
}
