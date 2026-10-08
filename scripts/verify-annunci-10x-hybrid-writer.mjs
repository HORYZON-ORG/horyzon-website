import assert from 'node:assert/strict';

import {
  DECISION_ENGINE_WRITER_PROMPT_VERSION,
  applyOptionalEditorialPolish,
  buildCandidateWriterView,
  buildDeterministicCandidateMaster,
  composeHybridWriterMaster,
  createAnnunci10xTruthLedger,
  masterText,
  projectAnnunci10xAiInput,
  runAnnunci10xHardFactsCheck,
  sanitizeAnnunci10xCandidateMaster,
} from '../src/lib/annunci-10x/index.ts';
import {
  ANNUNCI10X_CANONICAL_FIXTURES,
  CUSTOMER_CARE_CANONICAL_FIXTURE,
  MAGAZZINIERE_CANONICAL_FIXTURE,
  canonicalFixtureHash,
  stableHash,
} from './support/annunci-10x-canonical-fixtures.ts';

const PROMPT_VERSION = DECISION_ENGINE_WRITER_PROMPT_VERSION;

const diagnostics = [];
for (const fixture of ANNUNCI10X_CANONICAL_FIXTURES) {
  const provenance = buildProvenance(fixture);
  diagnostics.push(provenance.report);
  assertCanonicalWriterInput(fixture, provenance.candidateWriterView);
  assertProjectedInput(provenance.projectedInput);

  const master = sanitizeAnnunci10xCandidateMaster(composeHybridWriterMaster({
    editorialCore: fixture.safeEditorialCore,
    sessionId: `canonical-${fixture.key}`,
    roleCard: fixture.roleCard,
    truthLedger: provenance.truthLedger,
    promptVersion: PROMPT_VERSION,
  }), provenance.truthLedger);
  const text = masterText(master);
  assert.equal(runAnnunci10xHardFactsCheck(provenance.truthLedger, text).final, 'PASS', `${fixture.label}: canonical synthetic master must pass Hard Facts`);
  assertDeterministicShellMatchesFixture(fixture, text);
  assertDeterministicRequirements(fixture, master);
}

const customer = buildProvenance(CUSTOMER_CARE_CANONICAL_FIXTURE);
const customerBase = canonicalText(CUSTOMER_CARE_CANONICAL_FIXTURE, customer.truthLedger);
assert.deepEqual(
  customer.candidateWriterView.responsibilities.map((fact) => fact.value),
  [
    'rispondere alle richieste clienti',
    'comprendere il problema segnalato',
    'fornire informazioni sui servizi',
    'gestire richieste amministrative semplici',
    'registrare le richieste nel CRM',
    'verificare che la richiesta sia stata gestita',
    'collaborare con amministrazione e commerciale',
  ],
  'Customer Care CandidateWriterView responsibilities are grammatically homogeneous',
);
assertNegativeControl('A.customer-italiano-scritto-chiaro', customer.truthLedger, `${customerBase}\nServe italiano scritto chiaro.`);
assertNegativeControl('B.customer-aggiornare-informazioni-crm', customer.truthLedger, `${customerBase}\nAggiornerai le informazioni nel CRM.`);
assertNegativeControl('C.customer-riallineare-informazioni-amministrazione-commerciale', customer.truthLedger, `${customerBase}\nDovrai riallineare informazioni con amministrazione e commerciale.`);

const crmRequirementPromotionPositiveControls = [
  'È necessario conoscere il CRM.',
  'La conoscenza del CRM è obbligatoria.',
  "È richiesta esperienza nell'utilizzo del CRM.",
  'Per il ruolo è indispensabile avere familiarità con il CRM.',
  'Devi conoscere il CRM.',
  "Sono richieste competenze nell'uso del CRM.",
];
for (const [index, claim] of crmRequirementPromotionPositiveControls.entries()) {
  assertRequirementPromotion(`CRM-positive-${index + 1}`, customer.truthLedger, `${customerBase}\n${claim}`, true);
}

const crmRequirementPromotionNegativeControls = [
  'Fornirai informazioni sui servizi quando necessario e registrerai le richieste nel CRM.',
  'Quando necessario, collaborerai con amministrazione e commerciale; registrerai le richieste nel CRM.',
  'Gestirai le richieste amministrative semplici quando necessario. Registrerai le richieste nel CRM.',
  'Verificherai che la richiesta sia stata gestita e, quando necessario, collaborerai con amministrazione e commerciale. Il CRM viene utilizzato per registrare le richieste.',
];
for (const [index, claim] of crmRequirementPromotionNegativeControls.entries()) {
  assertRequirementPromotion(`CRM-negative-${index + 1}`, customer.truthLedger, `${customerBase}\n${claim}`, false);
}

const warehouse = buildProvenance(MAGAZZINIERE_CANONICAL_FIXTURE);
const warehouseBase = canonicalText(MAGAZZINIERE_CANONICAL_FIXTURE, warehouse.truthLedger);
const warehouseProvenance = assertWarehouseProvenance(warehouse);
assert.deepEqual(
  warehouse.candidateWriterView.responsibilities.map((fact) => fact.value),
  [
    'ricevere la merce',
    'controllare le quantita',
    'sistemare i prodotti',
    'preparare gli ordini',
    'collaborare con autisti e ufficio ordini',
  ],
  'Warehouse CandidateWriterView responsibilities are grammatically homogeneous',
);
assertNegativeControl('D.warehouse-ritiri', warehouse.truthLedger, `${warehouseBase}\nTi occuperai anche di ritiri.`);
assertNegativeControl('E.warehouse-quotidiano', warehouse.truthLedger, `${warehouseBase}\nIl lavoro prevede un controllo quotidiano delle quantita.`);
assertNegativeControl('F.warehouse-ridurre-errori-ritardi', warehouse.truthLedger, `${warehouseBase}\nIl tuo contributo servira a ridurre errori e ridurre ritardi.`);
assertNegativeControl('G.warehouse-segnalare-discrepanze', warehouse.truthLedger, `${warehouseBase}\nDovrai segnalare eventuali discrepanze rispetto all atteso.`);
assertNegativeControl('H.warehouse-buona-manualita', warehouse.truthLedger, `${warehouseBase}\nServe buona manualita.`);
assertNegativeControl('I.warehouse-documenti-magazzino', warehouse.truthLedger, `${warehouseBase}\nGestirai documenti di magazzino.`);
assertNegativeControl('J.warehouse-altri-reparti', warehouse.truthLedger, `${warehouseBase}\nCollaborerai con altri reparti.`);
assertWarehouseForbiddenUnexpectedEvent(
  'K.warehouse-unexpected-events-coordination-contamination',
  'differenze tra quantita attese e merce ricevuta, urgenze nella preparazione ordini, necessita di coordinarsi con autisti e ufficio ordini',
);

const customerDeterministic = deterministicMaster(CUSTOMER_CARE_CANONICAL_FIXTURE, customer.truthLedger);
const customerDeterministicText = masterText(customerDeterministic);
const customerDeterministicReport = runAnnunci10xHardFactsCheck(customer.truthLedger, customerDeterministicText);
assert.equal(customerDeterministicReport.final, 'PASS', 'Customer Care deterministic base must pass Hard Facts');
assert.equal(editorialValidator(customerDeterministic).status, 'PASS', 'Customer Care deterministic base must pass editorial validator');

const warehouseDeterministic = deterministicMaster(MAGAZZINIERE_CANONICAL_FIXTURE, warehouse.truthLedger);
const warehouseDeterministicText = masterText(warehouseDeterministic);
const warehouseDeterministicReport = runAnnunci10xHardFactsCheck(warehouse.truthLedger, warehouseDeterministicText);
assert.equal(warehouseDeterministicReport.final, 'PASS', 'Warehouse deterministic base must pass Hard Facts');
assert.equal(editorialValidator(warehouseDeterministic).status, 'PASS', 'Warehouse deterministic base must pass editorial validator');

const unsafeWarehousePolish = applyOptionalEditorialPolish({
  deterministicMaster: warehouseDeterministic,
  editorialCore: {
    opening: "PMI italiana che distribuisce prodotti alimentari a ristoranti e attività commerciali cerca un Magazziniere / Addetto logistica per garantire la correttezza delle quantità e l'affidabilità nella preparazione degli ordini. Il ruolo è focalizzato sul mantenimento dell'ordine e sull'efficace svolgimento delle operazioni di magazzino. Il risultato atteso è mantenere affidabili le quantità e la preparazione degli ordini, facilitando il lavoro quotidiano del team operativo.",
    responsibilities: "Ricevere la merce e controllare le quantita all'arrivo, segnalando eventuali differenze tra quantita attese e merce ricevuta.\n\nSistemare i prodotti nel magazzino e preparare gli ordini rispettando l'ordine dell area e la correttezza della preparazione.\n\nCollaborare con autisti e ufficio ordini per gestire le urgenze nella preparazione ordini e per coordinare le attività operative collegati alla spedizione.",
  },
  roleCard: MAGAZZINIERE_CANONICAL_FIXTURE.roleCard,
  truthLedger: warehouse.truthLedger,
});
assert.deepEqual(unsafeWarehousePolish.editorialPolish, { OPENING: 'DETERMINISTIC', RESPONSIBILITIES: 'DETERMINISTIC' }, 'unsafe warehouse canary sections must be rejected independently');
assert.equal(masterText(unsafeWarehousePolish.master), warehouseDeterministicText, 'unsafe warehouse polish must retain deterministic master');
assert.equal(runAnnunci10xHardFactsCheck(warehouse.truthLedger, masterText(unsafeWarehousePolish.master)).final, 'PASS', 'warehouse fallback master must pass Hard Facts');

const customerPolish = applyOptionalEditorialPolish({
  deterministicMaster: customerDeterministic,
  editorialCore: {
    opening: "Siamo una PMI italiana che offre servizi B2B in abbonamento e cerchiamo un/una Addetto/a Customer Care. Il ruolo prevede di rispondere alle richieste clienti, comprendere il problema segnalato e mantenere ordinata la gestione nel CRM. L’obiettivo concreto è verificare che la richiesta sia stata gestita nel perimetro standard.",
    responsibilities: "Ti occuperai di rispondere alle richieste clienti e di comprendere il problema segnalato; fornirai informazioni sui servizi quando necessario e registrerai le richieste nel CRM. Verificherai che la richiesta sia stata gestita nel perimetro standard e gestirai richieste amministrative semplici. Gestirai in autonomia le richieste standard e collaborerai con amministrazione e commerciale. Affronterai eventuali imprevisti gestendo più richieste clienti nello stesso periodo, mantenendo chiarezza nella comunicazione e ordine nella gestione.",
  },
  roleCard: CUSTOMER_CARE_CANONICAL_FIXTURE.roleCard,
  truthLedger: customer.truthLedger,
});
assert.equal(runAnnunci10xHardFactsCheck(customer.truthLedger, masterText(customerPolish.master)).final, 'PASS', 'Customer Care optional polish final master must pass Hard Facts');

const badStyleMaster = composeCustomerMaster(customer.truthLedger, {
  opening: CUSTOMER_CARE_CANONICAL_FIXTURE.safeEditorialCore.opening,
  responsibilities: [
    'Rispondere alle richieste clienti, comprendere il problema segnalato e fornire informazioni sui servizi.',
    'Gestire richieste amministrative semplici, registrare le richieste nel CRM e verificare che la richiesta sia stata gestita.',
    'Collaborazione con amministrazione e commerciale e gestire in autonomia richieste standard, inclusa la gestione di piu richieste clienti nello stesso periodo.',
  ].join('\n'),
});
assert.equal(runAnnunci10xHardFactsCheck(customer.truthLedger, masterText(badStyleMaster)).final, 'PASS', 'style regression fixture remains factually valid');
assert.equal(isEditorialResponsibilitiesStyleAcceptable(badStyleMaster), false, 'style regression catches nominal phrase + infinitive coordination');

const goodStyleMaster = composeCustomerMaster(customer.truthLedger, {
  opening: CUSTOMER_CARE_CANONICAL_FIXTURE.safeEditorialCore.opening,
  responsibilities: [
    'Risponderai alle richieste clienti, comprenderai il problema segnalato e fornirai informazioni sui servizi.',
    'Gestirai richieste amministrative semplici, registrerai le richieste nel CRM e verificherai che la richiesta sia stata gestita.',
    'Lavorerai in autonomia sulle richieste standard e collaborerai con amministrazione e commerciale. Quando arrivano piu richieste clienti nello stesso periodo, dovrai gestirle mantenendo chiarezza e ordine.',
  ].join('\n\n'),
});
assert.equal(runAnnunci10xHardFactsCheck(customer.truthLedger, masterText(goodStyleMaster)).final, 'PASS', 'good Customer Care fixture preserves facts');
assert.equal(isEditorialResponsibilitiesStyleAcceptable(goodStyleMaster), true, 'good Customer Care fixture passes editorial style regression');

const exactCustomerCareLiveMaster = `Posizione
Addetto/a Customer Care

Il ruolo
Siamo una PMI italiana che offre servizi B2B in abbonamento e cerchiamo un/una Addetto/a Customer Care. Il ruolo prevede di rispondere alle richieste clienti, comprendere il problema segnalato e mantenere ordinata la gestione nel CRM. L’obiettivo concreto è verificare che la richiesta sia stata gestita nel perimetro standard.

Cosa farai
Ti occuperai di rispondere alle richieste clienti e di comprendere il problema segnalato; fornirai informazioni sui servizi quando necessario e registrerai le richieste nel CRM. Verificherai che la richiesta sia stata gestita nel perimetro standard e gestirai richieste amministrative semplici. Gestirai in autonomia le richieste standard e collaborerai con amministrazione e commerciale. Affronterai eventuali imprevisti gestendo più richieste clienti nello stesso periodo, mantenendo chiarezza nella comunicazione e ordine nella gestione.

Cosa cerchiamo
Per questo ruolo servono ascolto, chiarezza nella comunicazione, pazienza, organizzazione, precisione e capacita di gestire piu richieste.
E gradita, ma non obbligatoria, un'esperienza di almeno 1 anno in assistenza clienti.

Condizioni di lavoro
Sede: Lecce.
Modalità: Ibrida, 3 giorni in ufficio e 2 da remoto.
Orario: Lunedi-venerdi 09:00-18:00.
Contratto: Tempo determinato 12 mesi con possibilita di trasformazione a tempo indeterminato.
Turni: Non previsti.
Reperibilità: Non prevista.
Compenso: RAL 23.000-26.000 EUR.

Candidatura
Se questa posizione ti interessa, inviaci la tua candidatura.`;
const exactCustomerCareLiveReport = runAnnunci10xHardFactsCheck(customer.truthLedger, exactCustomerCareLiveMaster);
assert.equal(exactCustomerCareLiveReport.violations.requirementPromotion, false, 'exact Customer Care live master must not trigger CRM requirementPromotion false positive');
assert.equal(exactCustomerCareLiveReport.final, 'PASS', 'exact Customer Care live master must pass after scope-aware requirementPromotion');

console.log(JSON.stringify({
  status: 'PASS',
  verifier: 'verify-annunci-10x-hybrid-writer',
  diagnostics,
  negativeControls: [
    'A.customer-italiano-scritto-chiaro',
    'B.customer-aggiornare-informazioni-crm',
    'C.customer-riallineare-informazioni-amministrazione-commerciale',
    'D.warehouse-ritiri',
    'E.warehouse-quotidiano',
    'F.warehouse-ridurre-errori-ritardi',
    'G.warehouse-segnalare-discrepanze',
    'H.warehouse-buona-manualita',
    'I.warehouse-documenti-magazzino',
    'J.warehouse-altri-reparti',
    'K.warehouse-unexpected-events-coordination-contamination',
  ],
  warehouseProvenance,
  deterministicBase: {
    customerCare: {
      hardFacts: customerDeterministicReport.final,
      editorialValidator: editorialValidator(customerDeterministic).status,
      publicationVerdict: 'SI',
    },
    magazziniere: {
      hardFacts: warehouseDeterministicReport.final,
      editorialValidator: editorialValidator(warehouseDeterministic).status,
      publicationVerdict: 'SI',
    },
  },
  optionalPolishReplay: {
    customerCare: customerPolish.editorialPolish,
    magazziniere: unsafeWarehousePolish.editorialPolish,
  },
  styleRegression: 'PASS',
  crmRequirementPromotion: {
    positiveControls: '6/6 PASS',
    negativeControls: '4/4 PASS',
    exactCustomerCareMaster: exactCustomerCareLiveReport.final,
  },
}, null, 2));

function buildProvenance(fixture) {
  const truthLedger = createAnnunci10xTruthLedger(fixture.roleCard);
  const candidateWriterView = buildCandidateWriterView(truthLedger);
  const projectedInput = projectAnnunci10xAiInput('GENERATE', {
    candidateWriterView,
    communicationStrategy: fixture.communicationStrategy,
  });
  return {
    truthLedger,
    candidateWriterView,
    projectedInput,
    report: {
      fixtureName: fixture.label,
      fixtureHash: canonicalFixtureHash(fixture),
      roleCardHash: stableHash(fixture.roleCard),
      truthLedgerHash: stableHash(truthLedger),
      candidateWriterView,
    },
  };
}

function canonicalText(fixture, truthLedger) {
  return masterText(sanitizeAnnunci10xCandidateMaster(composeHybridWriterMaster({
    editorialCore: fixture.safeEditorialCore,
    sessionId: `canonical-${fixture.key}`,
    roleCard: fixture.roleCard,
    truthLedger,
    promptVersion: PROMPT_VERSION,
  }), truthLedger));
}

function deterministicMaster(fixture, truthLedger) {
  return sanitizeAnnunci10xCandidateMaster(buildDeterministicCandidateMaster({
    sessionId: `deterministic-${fixture.key}`,
    roleCard: fixture.roleCard,
    truthLedger,
    promptVersion: PROMPT_VERSION,
  }), truthLedger);
}

function editorialValidator(master) {
  const text = masterText(master);
  const problems = [];
  if (/Elementi segnalati|Elementi concreti|Non dichiarato|Non specificato|RoleCard|database/i.test(text)) problems.push('internal wording');
  if (/Retribuzione:\s*Retribuzione/i.test(text)) problems.push('duplicated compensation label');
  for (const section of master.sections) {
    if (section.type !== 'TITLE' && !section.body.trim()) problems.push(`${section.type} empty`);
  }
  const responsibilities = master.sections.find((section) => section.type === 'RESPONSIBILITIES')?.body ?? '';
  if (hasNominalPhrasePlusInfinitiveCoordination(responsibilities)) problems.push('nominal phrase plus infinitive coordination');
  return { status: problems.length === 0 ? 'PASS' : 'FAIL', problems };
}

function assertWarehouseProvenance(provenance) {
  const fixtureUnexpectedEvents = MAGAZZINIERE_CANONICAL_FIXTURE.roleCard.attractionContext.unexpectedEvents.value;
  const roleCardUnexpectedEvents = provenance.truthLedger.roleCard.attractionContext.unexpectedEvents.value;
  const truthLedgerFact = provenance.truthLedger.facts.find((fact) => fact.key === 'unexpectedEvents');
  const candidateUnexpectedEvents = provenance.candidateWriterView.unexpectedEvents;
  const expectedUnexpectedEvents = 'differenze tra quantita attese e merce ricevuta, urgenze nella preparazione ordini';
  const expectedResponsibilities = [
    'ricevere la merce',
    'controllare le quantita',
    'sistemare i prodotti',
    'preparare gli ordini',
    'collaborare con autisti e ufficio ordini',
  ];
  assert.equal(fixtureUnexpectedEvents, expectedUnexpectedEvents, 'Warehouse fixture unexpectedEvents must be canonical');
  assert.equal(roleCardUnexpectedEvents, expectedUnexpectedEvents, 'Warehouse RoleCard unexpectedEvents must match fixture');
  assert.equal(truthLedgerFact?.id, 'F21', 'Warehouse unexpectedEvents fact id');
  assert.equal(truthLedgerFact?.value, expectedUnexpectedEvents, 'Warehouse Truth Ledger F21 must match fixture');
  assert.equal(candidateUnexpectedEvents?.value, expectedUnexpectedEvents, 'Warehouse CandidateWriterView unexpectedEvents must not be enriched');
  assert.deepEqual(
    provenance.candidateWriterView.responsibilities.map((fact) => fact.value),
    expectedResponsibilities,
    'Warehouse responsibilities must remain canonical',
  );
  assert.equal(
    provenance.candidateWriterView.autonomy?.value,
    'svolgere le attivita assegnate con attenzione a quantita, ordine dell area e correttezza della preparazione',
    'Warehouse autonomy must remain canonical',
  );
  const candidatePayload = JSON.stringify({
    autonomy: provenance.candidateWriterView.autonomy,
    unexpectedEvents: provenance.candidateWriterView.unexpectedEvents,
  });
  assert.doesNotMatch(candidatePayload, /supervisione|responsabilit[aà] complessiva|coordinamento|controllo del flusso/i, 'Warehouse autonomy must not be enriched');
  assert.doesNotMatch(candidatePayload, /necessita di coordinarsi|coordinarsi con autisti|coordinarsi con ufficio ordini|gestire con autisti|interfacciarsi con autisti/i, 'Warehouse unexpectedEvents must not include collaborator relationship enrichment');
  return {
    fixtureUnexpectedEvents,
    roleCardUnexpectedEvents,
    truthLedgerF21: truthLedgerFact,
    candidateWriterViewUnexpectedEvents: candidateUnexpectedEvents,
    responsibilities: provenance.candidateWriterView.responsibilities.map((fact) => fact.value),
    autonomy: provenance.candidateWriterView.autonomy?.value ?? null,
  };
}

function assertWarehouseForbiddenUnexpectedEvent(label, unexpectedEvents) {
  const contaminatedFixture = {
    ...MAGAZZINIERE_CANONICAL_FIXTURE,
    roleCard: {
      ...MAGAZZINIERE_CANONICAL_FIXTURE.roleCard,
      attractionContext: {
        ...MAGAZZINIERE_CANONICAL_FIXTURE.roleCard.attractionContext,
        unexpectedEvents: {
          ...MAGAZZINIERE_CANONICAL_FIXTURE.roleCard.attractionContext.unexpectedEvents,
          value: unexpectedEvents,
        },
      },
    },
  };
  const provenance = buildProvenance(contaminatedFixture);
  assert.throws(
    () => assertWarehouseProvenance(provenance),
    /unexpectedEvents must be canonical|RoleCard unexpectedEvents must match fixture|must not include collaborator relationship enrichment/,
    `${label}: contaminated unexpectedEvents must fail provenance`,
  );
}

function composeCustomerMaster(truthLedger, editorialCore) {
  return sanitizeAnnunci10xCandidateMaster(composeHybridWriterMaster({
    editorialCore,
    sessionId: 'customer-style-regression',
    roleCard: CUSTOMER_CARE_CANONICAL_FIXTURE.roleCard,
    truthLedger,
    promptVersion: PROMPT_VERSION,
  }), truthLedger);
}

function assertCanonicalWriterInput(fixture, candidateWriterView) {
  const writerInput = JSON.stringify(candidateWriterView);
  for (const pattern of fixture.expectedWriterInput) {
    assert.match(writerInput, pattern, `${fixture.label}: missing canonical input ${pattern}`);
  }
  for (const pattern of fixture.forbiddenWriterInput) {
    assert.doesNotMatch(writerInput, pattern, `${fixture.label}: contaminated writer input ${pattern}`);
  }
  assert.doesNotMatch(writerInput, /TRAINABLE|DISQUALIFYING/i, `${fixture.label}: non-public requirement category leaked`);
  assert.doesNotMatch(writerInput, /roleCard|premium|rubric|score|debug/i, `${fixture.label}: full/internal payload leaked`);
}

function assertProjectedInput(projectedInput) {
  assert.deepEqual(Object.keys(projectedInput).sort(), ['candidateWriterView', 'communicationStrategy']);
  assert.ok(projectedInput.candidateWriterView, 'projected writer input must include candidateWriterView');
  assert.equal(Object.hasOwn(projectedInput, 'roleCard'), false, 'projected writer input must not include roleCard');
}

function assertDeterministicShellMatchesFixture(fixture, text) {
  for (const pattern of fixture.expectedWriterInput) {
    if (fixture.key === 'customer-care' && /almeno 1 anno/.test(pattern.source)) continue;
    if (fixture.key === 'magazziniere' && /gradita ma non obbligatoria|gradito ma non obbligatorio/.test(pattern.source)) continue;
    assert.match(text, pattern, `${fixture.label}: deterministic master missing canonical fact ${pattern}`);
  }
  for (const pattern of fixture.forbiddenWriterInput) {
    assert.doesNotMatch(text, pattern, `${fixture.label}: deterministic master contains forbidden contamination ${pattern}`);
  }
}

function assertDeterministicRequirements(fixture, master) {
  const requirements = master.sections.find((section) => section.type === 'REQUIREMENTS');
  assert.ok(requirements, `${fixture.label}: deterministic requirements section exists`);
  if (fixture.key === 'customer-care') {
    assert.equal(
      requirements.body,
      [
        'Per questo ruolo servono ascolto, chiarezza nella comunicazione, pazienza, organizzazione, precisione e capacità di gestire più richieste.',
        "E gradita, ma non obbligatoria, un'esperienza di almeno 1 anno in assistenza clienti.",
      ].join('\n'),
      `${fixture.label}: deterministic requirements output`,
    );
  }
  if (fixture.key === 'magazziniere') {
    assert.equal(
      requirements.body,
      [
        'Per questo ruolo servono affidabilità, puntualità e attenzione agli errori.',
        'Sono gradite, ma non obbligatorie, esperienza precedente in magazzino e patentino muletto.',
      ].join('\n'),
      `${fixture.label}: deterministic requirements output`,
    );
  }
  assert.doesNotMatch(requirements.body, /TRAINABLE|DISQUALIFYING|procedure interne|organizzazione specifica/i, `${fixture.label}: deterministic requirements exclude internal categories`);
}

function assertNegativeControl(label, ledger, mutatedText) {
  const report = runAnnunci10xHardFactsCheck(ledger, mutatedText);
  assert.notEqual(report.final, 'PASS', `${label}: mutated master unexpectedly passed Hard Facts`);
}

function assertRequirementPromotion(label, ledger, text, expected) {
  const report = runAnnunci10xHardFactsCheck(ledger, text);
  assert.equal(report.violations.requirementPromotion, expected, `${label}: requirementPromotion expected ${expected}`);
  if (!expected) assert.equal(report.final, 'PASS', `${label}: negative control should remain Hard Facts PASS`);
}

function isEditorialResponsibilitiesStyleAcceptable(master) {
  const responsibilities = master.sections.find((section) => section.type === 'RESPONSIBILITIES')?.body ?? '';
  return !hasNominalPhrasePlusInfinitiveCoordination(responsibilities);
}

function hasNominalPhrasePlusInfinitiveCoordination(value) {
  return /\b(?:collaborazione|gestione|registrazione|verifica|preparazione|ricezione|controllo|sistemazione)\b[^.!?\n]{0,120}\s+e\s+(?:gestire|registrare|verificare|collaborare|rispondere|comprendere|fornire|preparare|controllare|sistemare|ricevere)\b/i.test(value);
}
