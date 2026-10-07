import assert from 'node:assert/strict';
import {
  applyAnnunci10xClientRevision,
  buildAnnunci10xBaseAd,
  createAnnunci10xTruthLedger,
  factsByCategory,
  masterText,
  runAnnunci10xHardFactsCheck,
  runAnnunci10xDecisionEngineCreateRuntime,
  runAnnunci10xPreflight,
  sanitizeAnnunci10xCandidateMaster,
  validateGenerateOutput,
} from '../src/lib/annunci-10x/index.ts';
import { includesEquivalent } from '../src/lib/annunci-10x/decision-engine/text.ts';

const fact = (value, publishable = true) => ({
  value,
  source: 'USER_DECLARED',
  status: 'NORMALIZED',
  confidence: 90,
  publishable,
});

function roleCard(overrides = {}) {
  return {
    title: fact(overrides.title ?? 'Magazziniere / Addetto logistica'),
    mission: fact(overrides.mission ?? 'Gestire merce in entrata, controllo quantità, sistemazione prodotti e preparazione ordini.'),
    outcomes: [fact(overrides.outcome ?? 'Mantenere affidabili quantità, preparazione ordini e collaborazione operativa.')],
    responsibilities: [fact(overrides.responsibilities ?? 'Ricezione merce; controllo quantità; sistemazione prodotti; preparazione ordini; collaborazione con autisti e ufficio ordini.')],
    requirements: [
      { id: 'req-required', classification: 'REQUIRED', label: fact(overrides.required ?? 'Affidabilità; puntualità; attenzione agli errori') },
      { id: 'req-preferred', classification: 'PREFERRED', label: fact(overrides.preferred ?? 'Esperienza precedente in magazzino e patentino muletto, graditi ma non obbligatori') },
      { id: 'req-trainable', classification: 'TRAINABLE', label: fact(overrides.trainable ?? 'Organizzazione specifica del magazzino e procedure interne') },
      { id: 'req-boundary', classification: 'DISQUALIFYING', label: fact(overrides.boundary ?? 'Non inventare benefit, welfare, formazione certificata o processi di candidatura') },
    ],
    compensation: {
      visibility: fact('PUBLIC'),
      amountText: fact(overrides.compensation ?? 'Retribuzione da definire in base all esperienza e nel rispetto del CCNL applicato.'),
    },
    attractionContext: {
      companyDescription: fact(overrides.companyDescription ?? 'PMI italiana che distribuisce prodotti alimentari a ristoranti e attività commerciali.'),
      workMode: fact(overrides.workMode ?? 'In sede'),
      workModeDetail: fact(overrides.workModeDetail ?? 'In sede'),
      location: fact(overrides.location ?? 'Bari'),
      contractType: fact(overrides.contract ?? 'Tempo determinato iniziale con possibilità di trasformazione a tempo indeterminato'),
      schedule: fact(overrides.schedule ?? 'Lunedì-venerdì, 08:00-17:00 con pausa pranzo'),
      shifts: fact(overrides.shifts ?? 'Non dichiarati'),
      onCall: fact(overrides.onCall ?? 'Non dichiarata'),
      operatingContext: fact(overrides.operatingContext ?? 'Collaborazione con autisti e ufficio ordini.'),
      autonomy: fact(overrides.autonomy ?? 'Svolge attività operative assegnate con attenzione a quantità, ordine e correttezza della preparazione.'),
      unexpectedEvents: fact(overrides.unexpectedEvents ?? 'Differenze tra quantità attese e merce ricevuta, urgenze nella preparazione ordini.'),
      attractivenessEvidence: overrides.benefit ? [fact(overrides.benefit)] : [],
    },
    applicationInstructions: fact(overrides.application ?? 'Candidatura tramite il canale dell annuncio.'),
  };
}

function check(master, overrides = {}) {
  const ledger = createAnnunci10xTruthLedger(roleCard(overrides));
  return runAnnunci10xHardFactsCheck(ledger, master);
}

function makeMaster(body, overrides = {}) {
  return {
    id: overrides.id ?? 'master-test',
    sessionId: 'session-test',
    kind: 'MASTER',
    sections: [
      {
        id: 's-title',
        type: 'TITLE',
        key: 'title',
        title: '',
        body: overrides.title ?? 'Magazziniere / Addetto logistica',
        sourceFactIds: ['F01'],
      },
      {
        id: 's-body',
        type: 'RESPONSIBILITIES',
        key: 'body',
        title: 'Il lavoro',
        body,
        sourceFactIds: ['F02', 'F03', 'F04'],
      },
    ],
    sourceOfTruth: true,
    generatedAt: '2026-10-03T00:00:00.000Z',
    promptVersion: 'annunci10x-decision-engine-test',
  };
}

function generateOutputWithSections(sections) {
  return {
    generatedAd: {
      id: 'generated-test',
      sessionId: 'session-test',
      kind: 'MASTER',
      sections,
      sourceOfTruth: true,
      generatedAt: '2026-10-03T00:00:00.000Z',
      promptVersion: 'annunci10x-decision-engine-test',
    },
    title: 'Full Stack Developer',
    metadata: {},
    sections,
    fullText: 'stale provider full text',
    sourcePaths: ['test'],
  };
}

async function runtimeWithMasters(masters) {
  let generateCalls = 0;
  let repairCalls = 0;
  const runtime = await runAnnunci10xDecisionEngineCreateRuntime({
    roleCard: roleCard(),
    writer: {
      async generate() {
        generateCalls += 1;
        return { master: masters[0] };
      },
      async repair() {
        repairCalls += 1;
        return { master: masters[1] ?? masters[0] };
      },
    },
  });
  return { runtime, generateCalls, repairCalls };
}

const completeGoodBody = [
  'PMI italiana che distribuisce prodotti alimentari a ristoranti e attività commerciali, con sede a Bari.',
  'Il lavoro si svolge in sede con tempo determinato iniziale e possibilità di trasformazione a tempo indeterminato.',
  'L orario e lunedì-venerdì, 08:00-17:00 con pausa pranzo.',
  'Ti occuperai di ricezione merce, controllo quantità, sistemazione prodotti e preparazione ordini.',
  'Collaborerai con autisti e ufficio ordini quando emergono discrepanze nelle quantità o urgenze nella preparazione ordini.',
  'La retribuzione e da definire in base all esperienza e nel rispetto del CCNL applicato.',
  'Sono richieste affidabilità, puntualità e attenzione agli errori.',
  'Sono graditi, ma non obbligatori, esperienza precedente in magazzino e patentino muletto.',
  'Se ti riconosci in questo profilo, inviaci la tua candidatura.',
].join(' ');

{
  const ledger = createAnnunci10xTruthLedger(roleCard());
  const preflight = runAnnunci10xPreflight(ledger);
  assert.equal(preflight.canGenerate, true, 'complete role facts should pass boolean preflight');
  const baseAd = buildAnnunci10xBaseAd(ledger);
  assert.match(baseAd.text, /ATTIVITA CONFERMATE/);
  assert.doesNotMatch(baseAd.text, /NON INVENTARE/);
  assert.ok(baseAd.internalBoundaries.some((fact) => /Non inventare/.test(fact.value)), 'negative constraints must remain internal metadata');
}

{
  const valid = {
    id: 'section-valid',
    type: 'CONDITIONS',
    key: 'conditions',
    title: 'Condizioni',
    body: 'Sede: Milano, modalità ibrida.',
    sourceFactIds: ['F01'],
  };
  const output = validateGenerateOutput(generateOutputWithSections([
    valid,
    { id: 'section-empty', type: 'CONDITIONS', key: 'schedule', title: 'Orario', body: '', sourceFactIds: [] },
  ]));
  assert.deepEqual(output.generatedAd.sections.map((section) => section.id), ['section-valid'], 'provider sections with empty body must be omitted before domain validation');
  assert.doesNotMatch(output.fullText, /Orario|Non dichiarato|N\/A/i, 'omitted sections must not inject placeholders into fullText');
}

{
  const valid = {
    id: 'section-valid',
    type: 'CONDITIONS',
    key: 'conditions',
    title: 'Condizioni',
    body: 'Sede: Milano, modalità ibrida.',
    sourceFactIds: ['F01'],
  };
  const output = validateGenerateOutput(generateOutputWithSections([
    valid,
    { id: 'section-whitespace', type: 'CONDITIONS', key: 'schedule', title: 'Orario', body: '   \n  ', sourceFactIds: [] },
  ]));
  assert.deepEqual(output.generatedAd.sections.map((section) => section.id), ['section-valid'], 'provider sections with whitespace body must be omitted before domain validation');
}

{
  const valid = {
    id: 'section-valid',
    type: 'CONDITIONS',
    key: 'conditions',
    title: 'Condizioni',
    body: 'Sede: Milano...',
    sourceFactIds: ['F01'],
  };
  const output = validateGenerateOutput(generateOutputWithSections([valid]));
  assert.equal(output.generatedAd.sections[0]?.body, 'Sede: Milano...', 'valid provider section body must be preserved exactly after trim-normalization');
}

{
  const sections = [
    { id: 's1', type: 'OPENING', key: 'opening', title: 'Apertura', body: 'Full Stack Developer per software gestionali B2B.', sourceFactIds: ['F01'] },
    { id: 's2', type: 'RESPONSIBILITIES', key: 'work', title: 'Cosa farai', body: 'Sviluppo frontend e backend, REST API, debugging e code review.', sourceFactIds: ['F02'] },
    { id: 's3', type: 'CONTEXT', key: 'context', title: 'Contesto', body: 'Collaborazione con altri sviluppatori e responsabile prodotto.', sourceFactIds: ['F03'] },
    { id: 's4', type: 'REQUIREMENTS', key: 'requirements', title: 'Cosa serve', body: 'TypeScript, React, Node.js, database SQL, REST API e Git.', sourceFactIds: ['F04'] },
    { id: 's5', type: 'CONDITIONS', key: 'conditions', title: 'Condizioni', body: 'Sede: Milano. Modalità: ibrida, 3 giorni in ufficio e 2 da remoto. Contratto: tempo indeterminato.', sourceFactIds: ['F05'] },
    { id: 's6', type: 'GROWTH', key: 'benefits', title: 'Cosa trovi', body: '', sourceFactIds: [] },
    { id: 's7', type: 'CONDITIONS', key: 'compensation', title: 'Compenso', body: 'RAL 32.000-40.000 EUR in funzione dell esperienza.', sourceFactIds: ['F06'] },
    { id: 's8', type: 'APPLICATION', key: 'application', title: 'Candidatura', body: 'Se questa posizione ti interessa, inviaci la tua candidatura.', sourceFactIds: ['F07'] },
  ];
  const output = validateGenerateOutput(generateOutputWithSections(sections));
  assert.equal(output.generatedAd.sections.length, 7, 'mixed provider output with one empty section must produce only valid domain sections');
  assert.deepEqual(output.generatedAd.sections.map((section) => section.id), ['s1', 's2', 's3', 's4', 's5', 's7', 's8'], 'normalization must preserve order of valid sections');
  assert.doesNotMatch(output.fullText, /Non dichiarato|N\/A|Informazione non disponibile/i, 'normalization must omit empty sections without placeholder injection');
  assert.match(output.fullText, /RAL 32\.000-40\.000 EUR/i, 'normalization must preserve RAL');
  assert.match(output.fullText, /tempo indeterminato/i, 'normalization must preserve contract');
  assert.match(output.fullText, /Milano/i, 'normalization must preserve location');
  assert.match(output.fullText, /ibrida, 3 giorni in ufficio e 2 da remoto/i, 'normalization must preserve work mode');
  assert.match(output.fullText, /TypeScript, React, Node\.js, database SQL, REST API e Git/i, 'normalization must preserve technologies and requirements');
}

{
  const text = 'Interventi su componenti elettrici e meccanici.';
  assert.equal(includesEquivalent(text, 'componenti meccanici'), true, 'coordinated noun phrase must preserve mechanical components');
  assert.equal(includesEquivalent(text, 'componenti elettrici'), true, 'coordinated noun phrase must preserve electrical components');
  assert.equal(includesEquivalent('Interventi su componenti meccanici.', 'componenti meccanici'), true, 'exact noun phrase must pass');
  assert.equal(includesEquivalent('Interventi sugli impianti.', 'componenti meccanici'), false, 'broad plant wording must not preserve mechanical components');
  assert.equal(includesEquivalent('Buone competenze elettriche.', 'lettura schemi elettrici'), false, 'broad electrical skills must not preserve electrical diagram reading');
  assert.equal(includesEquivalent('Frontend e backend.', 'frontend'), true, 'simple coordinated technical item must preserve frontend');
  assert.equal(includesEquivalent('Database SQL e REST API.', 'database SQL'), true, 'simple coordinated technical phrase must preserve database SQL');
  assert.equal(includesEquivalent('Frontend moderno.', 'React'), false, 'broad frontend wording must not preserve React');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({ schedule: 'Non dichiarato' }));
  const baseAd = buildAnnunci10xBaseAd(ledger);
  assert.doesNotMatch(baseAd.text, /Orario\s*:/i, 'unknown schedule must be omitted from Base Ad');
  assert.doesNotMatch(baseAd.text, /non dichiarat/i, 'unknown placeholders must not be serialized in Base Ad');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({ schedule: '08:00-17:00' }));
  const baseAd = buildAnnunci10xBaseAd(ledger);
  assert.match(baseAd.text, /Orario:\s*08:00-17:00/i, 'declared schedule must be preserved in Base Ad');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({ benefit: 'Benefit: non dichiarati' }));
  const baseAd = buildAnnunci10xBaseAd(ledger);
  assert.deepEqual(factsByCategory(ledger, 'BENEFIT'), [], 'unknown benefits must not become publishable benefit facts');
  assert.doesNotMatch(baseAd.text, /BENEFIT|benefit|non dichiarat/i, 'unknown benefits must be omitted from Base Ad');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({ benefit: 'Benefit: nessun benefit previsto' }));
  const baseAd = buildAnnunci10xBaseAd(ledger);
  assert.deepEqual(factsByCategory(ledger, 'BENEFIT').map((fact) => fact.value), ['nessun benefit previsto'], 'explicit no-benefit facts must not be treated as UNKNOWN');
  assert.match(baseAd.text, /nessun benefit previsto/i, 'explicit no-benefit facts must remain publishable');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({
    benefit: 'Benefit: Non sono stati dichiarati benefit. Formazione e crescita concreta: Non sono stati dichiarati percorsi di carriera garantiti o formazione certificata.',
  }));
  assert.deepEqual(factsByCategory(ledger, 'BENEFIT'), [], 'missing-data disclosures must not become publishable benefit facts');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({
    preferred: 'Non sono state dichiarate tecnologie preferenziali ulteriori.',
  }));
  assert.deepEqual(factsByCategory(ledger, 'REQUIREMENT_PREFERRED'), [], 'missing preferred requirements must not become publishable requirement facts');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({
    benefit: 'Benefit: buoni pasto 8 EUR. Formazione e crescita concreta: Non sono stati dichiarati percorsi certificati.',
  }));
  assert.deepEqual(factsByCategory(ledger, 'BENEFIT').map((fact) => fact.value), ['buoni pasto 8 EUR'], 'real attractiveness facts must survive when mixed with missing-data disclosures');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({
    benefit: 'Elementi concreti da valorizzare: In sede; esperienza precedente in magazzino e patentino muletto, graditi ma non obbligatori; orario lunedì-venerdì, 08:00-17:00 con pausa pranzo.',
  }));
  assert.deepEqual(factsByCategory(ledger, 'BENEFIT'), [], 'attractiveness evidence that only repeats work mode, preferred requirements and schedule must not become duplicate benefit facts');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({
    benefit: 'Elementi concreti da valorizzare: In sede; buoni pasto 8 EUR; orario lunedì-venerdì, 08:00-17:00 con pausa pranzo.',
  }));
  assert.deepEqual(
    factsByCategory(ledger, 'BENEFIT').map((fact) => fact.value),
    ['buoni pasto 8 EUR'],
    'mixed attractiveness evidence must preserve only the distinct grounded benefit',
  );
}

{
  const report = check('Il ruolo prevede laptop e telefono aziendale. Sono previsti anche buoni pasto.', {
    benefit: 'Laptop e telefono aziendale.',
  });
  assert.equal(report.violations.inventedBenefit, true, 'undeclared benefit additions must fail even when other benefits are declared');
}

{
  const report = check('Avrai formazione continua e un percorso di crescita strutturato.', {
    benefit: '',
  });
  assert.equal(report.violations.inventedBenefit, true, 'undeclared training or growth benefits must fail');
}

{
  const report = check('Entrerai in un ambiente dinamico dove il tuo talento verra valorizzato.');
  assert.equal(report.violations.employerBrandExpansion, true, 'unsupported employer branding must require repair');
}

{
  const report = check('Obiettivo del ruolo: sviluppare opportunita qualificate.\nElementi apprendibili in sede: procedure interne.');
  assert.equal(report.violations.internalStructureLeak, true, 'internal RoleCard-style headings must require repair');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard());
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster('REQUISITI PREFERENZIALI\nEsperienza precedente in magazzino e patentino muletto, graditi ma non obbligatori.'), ledger);
  const text = masterText(sanitized);
  assert.doesNotMatch(text, /REQUISITI PREFERENZIALI/i, 'candidate sanitizer must remove known internal marker headings');
  assert.match(text, /Esperienza precedente in magazzino/i, 'candidate sanitizer must preserve useful candidate-facing content');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard());
  const master = makeMaster('Gestisce attivita standard in autonomia.');
  master.sections[1].title = 'Autonomia';
  const sanitized = sanitizeAnnunci10xCandidateMaster(master, ledger);
  assert.equal(sanitized.sections[1]?.title, 'Cosa farai', 'candidate sanitizer must derive the public heading from the section type');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard());
  const master = {
    ...makeMaster('PMI italiana che distribuisce prodotti alimentari.'),
    sections: [
      { id: 's-opening', type: 'OPENING', key: 'opening', title: 'CONTESTO', body: 'PMI italiana che distribuisce prodotti alimentari.', sourceFactIds: ['F09'] },
      { id: 's-mission', type: 'MISSION', key: 'mission', title: 'MISSIONE', body: 'Gestire merce in entrata e preparazione ordini.', sourceFactIds: ['F02'] },
      { id: 's-work', type: 'RESPONSIBILITIES', key: 'work', title: 'ATTIVITÀ PRINCIPALI', body: 'Ricezione merce e controllo quantità.', sourceFactIds: ['F04'] },
      { id: 's-context', type: 'CONTEXT', key: 'context', title: 'CONTESTO OPERATIVO', body: 'Collaborazione con autisti e ufficio ordini.', sourceFactIds: ['F16'] },
      { id: 's-req', type: 'REQUIREMENTS', key: 'requirements', title: 'REQUISITI', body: 'Affidabilità, puntualità e attenzione agli errori.', sourceFactIds: ['F05'] },
      { id: 's-cond', type: 'CONDITIONS', key: 'conditions', title: 'CONDIZIONI', body: 'Sede: Bari.', sourceFactIds: ['F10'] },
      { id: 's-growth', type: 'GROWTH', key: 'growth', title: 'BENEFIT / ATTRATTIVITÀ DICHIARATI', body: 'Orari definiti.', sourceFactIds: ['F19'] },
    ],
  };
  const sanitized = sanitizeAnnunci10xCandidateMaster(master, ledger);
  assert.deepEqual(
    sanitized.sections.map((section) => section.title),
    ['Il ruolo', 'Il tuo obiettivo', 'Cosa farai', 'Con chi lavorerai', 'Cosa cerchiamo', 'Condizioni di lavoro', 'Cosa trovi'],
    'candidate sanitizer must normalize system-like section titles into publication-ready language',
  );
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard());
  const master = {
    ...makeMaster('PMI alimentare a Bari.'),
    sections: [
      { id: 's-title-wrong', type: 'TITLE', key: 'role', title: 'Chi siamo', body: 'PMI alimentare a Bari.', sourceFactIds: ['F09'] },
      { id: 's-opening', type: 'OPENING', key: 'opening', title: 'Apertura', body: 'PMI alimentare a Bari.', sourceFactIds: ['F09'] },
    ],
  };
  const sanitized = sanitizeAnnunci10xCandidateMaster(master, ledger);
  const title = sanitized.sections.find((section) => section.type === 'TITLE');
  assert.equal(title?.title, 'Posizione', 'TITLE section must use a publication-ready label');
  assert.equal(title?.body, 'Magazziniere / Addetto logistica', 'TITLE body must always preserve the exact confirmed role');
  assert.deepEqual(title?.sourceFactIds, ['F01'], 'TITLE section must point back to the canonical role fact');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard());
  const company = 'PMI italiana che distribuisce prodotti alimentari a ristoranti e attività commerciali.';
  const master = {
    ...makeMaster(completeGoodBody),
    sections: [
      { id: 's-title', type: 'TITLE', key: 'role', title: 'RUOLO', body: 'Magazziniere / Addetto logistica', sourceFactIds: ['F01'] },
      { id: 's-opening', type: 'OPENING', key: 'opening', title: 'Apertura', body: `Cerchiamo un Magazziniere / Addetto logistica. ${company}`, sourceFactIds: ['F01', 'F09'] },
      { id: 's-company-context', type: 'CONTEXT', key: 'context', title: 'CONTESTO', body: company, sourceFactIds: ['F09'] },
      { id: 's-work', type: 'RESPONSIBILITIES', key: 'work', title: 'ATTIVITÀ PRINCIPALI', body: completeGoodBody, sourceFactIds: ['F04'] },
    ],
  };
  const sanitized = sanitizeAnnunci10xCandidateMaster(master, ledger);
  assert.equal(
    sanitized.sections.some((section) => section.id === 's-company-context'),
    false,
    'company-only context section must be removed when the opening already contains the same company context',
  );
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({
    benefit: 'Elementi concreti da valorizzare: In sede; esperienza precedente in magazzino e patentino muletto, graditi ma non obbligatori; orario lunedì-venerdì, 08:00-17:00 con pausa pranzo.',
  }));
  const master = {
    ...makeMaster(completeGoodBody),
    sections: [
      ...makeMaster(completeGoodBody).sections,
      {
        id: 's-growth-redundant',
        type: 'GROWTH',
        key: 'growth',
        title: 'BENEFIT / ATTRATTIVITÀ DICHIARATI',
        body: 'Elementi concreti da valorizzare: In sede; esperienza precedente in magazzino e patentino muletto, graditi ma non obbligatori; orario lunedì-venerdì, 08:00-17:00 con pausa pranzo.',
        sourceFactIds: ['F19'],
      },
    ],
  };
  const sanitized = sanitizeAnnunci10xCandidateMaster(master, ledger);
  assert.equal(sanitized.sections.some((section) => section.type === 'GROWTH'), false, 'growth section must be omitted when it only repeats work mode, preferred experience and schedule');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({ benefit: 'Buoni pasto 8 EUR.' }));
  const master = {
    ...makeMaster(completeGoodBody),
    sections: [
      ...makeMaster(completeGoodBody).sections,
      { id: 's-growth-real', type: 'GROWTH', key: 'growth', title: 'BENEFIT / ATTRATTIVITÀ DICHIARATI', body: 'Buoni pasto 8 EUR.', sourceFactIds: ['F19'] },
    ],
  };
  const sanitized = sanitizeAnnunci10xCandidateMaster(master, ledger);
  const growth = sanitized.sections.find((section) => section.type === 'GROWTH');
  assert.ok(growth, 'distinct grounded benefits must remain candidate-facing');
  assert.equal(growth?.title, 'Cosa trovi');
  assert.match(growth?.body ?? '', /Buoni pasto 8 EUR/i);
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({ required: 'Autonomia; orientamento agli obiettivi' }));
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster('- Autonomia\n- Orientamento agli obiettivi'), ledger);
  const text = masterText(sanitized);
  const report = runAnnunci10xHardFactsCheck(ledger, text);
  assert.match(text, /Autonomia/i, 'candidate sanitizer must preserve Autonomia when it is a REQUIRED list item');
  assert.doesNotMatch(text, /Come lavorerai/i, 'candidate sanitizer must not turn REQUIRED content into a heading');
  assert.equal(report.preservation.requiredRequirements, 'PASS', 'sanitized REQUIRED Autonomia must pass preservation');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({ preferred: 'Autonomia' }));
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster('- Autonomia'), ledger);
  const text = masterText(sanitized);
  assert.match(text, /Autonomia/i, 'candidate sanitizer must preserve Autonomia when it is a PREFERRED list item');
  assert.doesNotMatch(text, /Come lavorerai/i, 'candidate sanitizer must not turn PREFERRED content into a heading');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard());
  const sentence = 'Cerchiamo autonomia nella gestione delle attivita.';
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster(sentence), ledger);
  assert.match(masterText(sanitized), new RegExp(sentence.replace('.', '\\.')), 'candidate sanitizer must preserve normal body prose containing autonomia');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({ required: 'Autonomia; orientamento agli obiettivi' }));
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster('- Autonomia\n- Orientamento agli obiettivi'), ledger);
  const text = masterText(sanitized);
  assert.match(text, /Autonomia/i, 'candidate sanitizer must preserve Autonomia in raw repair output');
  assert.equal(runAnnunci10xHardFactsCheck(ledger, text).preservation.requiredRequirements, 'PASS', 'raw repair output with Autonomia must remain valid after sanitize');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard());
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster('- Imprevisti e variabilita'), ledger);
  const text = masterText(sanitized);
  assert.match(text, /Imprevisti e variabilita/i, 'candidate sanitizer must preserve facts that collide with internal heading labels when they are list content');
  assert.doesNotMatch(text, /Nel lavoro quotidiano/i, 'candidate sanitizer must not rewrite fact content as a heading');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard());
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster('Ti occuperai di controllo quantità e preparazione ordini.\nDO_NOT_INVENT: Non inventare benefit, welfare o processi di candidatura.'), ledger);
  const text = masterText(sanitized);
  assert.match(text, /controllo quantità/i, 'candidate sanitizer must keep real content');
  assert.doesNotMatch(text, /DO_NOT_INVENT|Non inventare|benefit|welfare/i, 'candidate sanitizer must remove internal anti-hallucination instructions');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard());
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster('Ti occuperai di controllo quantità.\nNon sono stati dichiarati benefit o dettagli ulteriori sulla formazione.'), ledger);
  const text = masterText(sanitized);
  assert.match(text, /controllo quantità/i, 'candidate sanitizer must keep useful prose when removing missing-data disclosures');
  assert.doesNotMatch(text, /non sono stati dichiarati|benefit|formazione/i, 'candidate sanitizer must remove missing-data disclosures candidate-facing');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({ schedule: 'Non dichiarato' }));
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster('Ti occuperai di controllo quantità.\nOrario: non dichiarato.'), ledger);
  const text = masterText(sanitized);
  assert.match(text, /controllo quantità/i, 'candidate sanitizer must keep useful prose when removing unknown schedule disclosures');
  assert.doesNotMatch(text, /Orario|non dichiarato/i, 'candidate sanitizer must remove unknown schedule placeholders candidate-facing');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard());
  const body = [
    'Cerchiamo una persona operativa e affidabile per un magazzino alimentare, dove ordine e precisione contano in ogni passaggio della giornata.',
    '- Ricezione merce',
    '- controllo quantità',
    '- preparazione ordini',
    '- utilizzo transpallet',
  ].join('\n');
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster(body), ledger);
  const text = masterText(sanitized);
  assert.doesNotMatch(text, /^\s*-\s+/m, 'candidate sanitizer may remove bullet markers when the master already contains narrative prose');
  assert.match(text, /utilizzo transpallet/i, 'candidate sanitizer must preserve hard facts when removing bullet markers');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({ application: 'Candidatura tramite il canale dell annuncio.' }));
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster("Candidatura tramite il canale dell'annuncio."), ledger);
  const text = masterText(sanitized);
  assert.doesNotMatch(text, /canale dell['’]?\s*annuncio/i, 'generic mechanical CTA must be removed');
  assert.match(text, /Se questa posizione ti interessa, inviaci la tua candidatura\./, 'generic mechanical CTA must become canonical neutral CTA');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({
    application: 'tramite il canale dell annuncio, senza documenti o passaggi aggiuntivi non dichiarati',
  }));
  const master = makeMaster('Inviare la candidatura tramite il canale dell annuncio, senza documenti o passaggi aggiuntivi non dichiarati.');
  master.sections[1] = {
    ...master.sections[1],
    id: 's-application',
    type: 'APPLICATION',
    key: 'application',
    title: 'CANDIDATURA',
    sourceFactIds: ['F21'],
  };
  const sanitized = sanitizeAnnunci10xCandidateMaster(master, ledger);
  const application = sanitized.sections.find((section) => section.type === 'APPLICATION');
  assert.ok(application, 'generic application section must remain present after sanitization');
  assert.equal(application.body, 'Se questa posizione ti interessa, inviaci la tua candidatura.', 'generic application with missing-data wording must become the neutral CTA');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({ application: 'Invia CV a recruiting@azienda-test.it con oggetto Magazziniere.' }));
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster('Per candidarti, invia CV a recruiting@azienda-test.it con oggetto Magazziniere.'), ledger);
  const text = masterText(sanitized);
  assert.match(text, /recruiting@azienda-test\.it/i, 'candidate sanitizer must preserve explicit application channel facts');
  assert.doesNotMatch(text, /Se questa posizione ti interessa/i, 'candidate sanitizer must not replace explicit application facts with a generic CTA');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({
    title: 'Full Stack Developer',
    companyDescription: 'PMI italiana che sviluppa software gestionali e applicazioni web B2B.',
    location: 'Milano',
    workMode: 'Ibrida',
    workModeDetail: 'Ibrida: 3 giorni in ufficio e 2 giorni da remoto',
    contract: 'Tempo indeterminato',
    schedule: 'Lunedì-venerdì, 09:00-18:00',
    compensation: 'RAL 32.000-40.000 EUR in funzione dell esperienza.',
    responsibilities: 'Sviluppo frontend e backend; integrazione REST API; debugging; code review; utilizzo Git.',
    required: 'TypeScript; React; Node.js; database SQL; REST API; Git',
    preferred: 'Non dichiarati',
  }));
  const body = [
    'PMI italiana che sviluppa software gestionali e applicazioni web B2B a Milano.',
    'Modalità ibrida: 3 giorni in ufficio e 2 giorni da remoto.',
    'Contratto a tempo indeterminato, lunedì-venerdì 09:00-18:00.',
    'RAL 32.000-40.000 EUR in funzione dell esperienza.',
    'Lavorerai su frontend e backend con TypeScript, React, Node.js, database SQL, REST API e Git.',
  ].join(' ');
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster(body, { title: 'Full Stack Developer' }), ledger);
  const text = masterText(sanitized);
  assert.match(text, /32\.000-40\.000/i, 'candidate sanitizer must not alter RAL');
  assert.match(text, /tempo indeterminato/i, 'candidate sanitizer must not alter contract');
  assert.match(text, /09:00-18:00/i, 'candidate sanitizer must not alter schedule');
  assert.match(text, /Milano/i, 'candidate sanitizer must not alter location');
  assert.match(text, /TypeScript/i, 'candidate sanitizer must not alter technologies');
  assert.match(text, /REST API/i, 'candidate sanitizer must not alter requirements');
}

{
  const ledger = createAnnunci10xTruthLedger(roleCard({
    title: 'Full Stack Developer',
    companyDescription: 'PMI italiana che sviluppa software gestionali e applicazioni web B2B.',
    location: 'Milano',
    workMode: 'Ibrida',
    workModeDetail: 'Ibrida: 3 giorni in ufficio e 2 giorni da remoto',
    contract: 'Tempo indeterminato',
    schedule: 'Non dichiarato',
    compensation: 'RAL 32.000-40.000 EUR in funzione dell esperienza.',
    responsibilities: 'Sviluppo frontend e backend; integrazione REST API; debugging; code review; utilizzo Git.',
    required: 'TypeScript; React; Node.js; database SQL; REST API; Git',
    preferred: 'Non dichiarati',
  }));
  const body = [
    'PMI italiana che sviluppa software gestionali e applicazioni web B2B a Milano.',
    'Modalità ibrida: 3 giorni in ufficio e 2 giorni da remoto.',
    'Contratto a tempo indeterminato.',
    'Orario: non dichiarato.',
    'RAL 32.000-40.000 EUR in funzione dell esperienza.',
    'Lavorerai su frontend e backend con TypeScript, React, Node.js, database SQL, REST API e Git.',
  ].join('\n');
  const sanitized = sanitizeAnnunci10xCandidateMaster(makeMaster(body, { title: 'Full Stack Developer' }), ledger);
  const text = masterText(sanitized);
  assert.doesNotMatch(text, /Orario|non dichiarato/i, 'candidate sanitizer must remove unknown placeholders only');
  assert.match(text, /32\.000-40\.000/i, 'candidate sanitizer must preserve RAL when removing unknown placeholders');
  assert.match(text, /Milano/i, 'candidate sanitizer must preserve location when removing unknown placeholders');
  assert.match(text, /ibrida/i, 'candidate sanitizer must preserve work mode when removing unknown placeholders');
  assert.match(text, /tempo indeterminato/i, 'candidate sanitizer must preserve contract when removing unknown placeholders');
  assert.match(text, /TypeScript/i, 'candidate sanitizer must preserve requirements when removing unknown placeholders');
  assert.match(text, /REST API/i, 'candidate sanitizer must preserve technologies when removing unknown placeholders');
}

{
  const report = check('Magazziniere / Addetto logistica per PMI alimentare a Bari. Retribuzione da definire in base all esperienza e nel rispetto del CCNL applicato. Richieste affidabilità, puntualità e attenzione agli errori. Graditi ma non obbligatori esperienza in magazzino e patentino muletto. Candidati tramite il canale dell annuncio.');
  assert.equal(report.preservation.compensation, 'PASS', 'CCNL preserved should pass');
}

{
  const report = check('Magazziniere / Addetto logistica per PMI alimentare a Bari. Retribuzione da definire in base all esperienza. Richieste affidabilità, puntualità e attenzione agli errori.');
  assert.equal(report.preservation.compensation, 'FAIL', 'CCNL lost should fail');
}

{
  const master = 'Full Stack Developer a Milano. RAL 32.000-40.000 EUR in funzione dell esperienza. Requisiti: TypeScript, React, Node.js, database SQL, REST API e Git.';
  const report = check(master, {
    title: 'Full Stack Developer',
    responsibilities: 'Sviluppo frontend e backend; integrazione REST API; debugging; code review; utilizzo Git.',
    required: 'TypeScript; React; Node.js; database SQL; REST API; Git',
    preferred: 'Non dichiarati',
    trainable: 'Dominio dei prodotti aziendali',
    compensation: 'RAL 32.000-40.000 EUR in funzione dell esperienza.',
    location: 'Milano',
    companyDescription: 'PMI italiana che sviluppa software gestionali e applicazioni web B2B.',
  });
  assert.equal(report.preservation.compensation, 'PASS', 'RAL range preserved should pass');
}

{
  const report = check('Full Stack Developer a Milano. RAL 32 EUR in funzione dell esperienza.', {
    title: 'Full Stack Developer',
    required: 'TypeScript; React; Node.js',
    preferred: 'Non dichiarati',
    compensation: 'RAL 32.000-40.000 EUR in funzione dell esperienza.',
    location: 'Milano',
  });
  assert.equal(report.preservation.compensation, 'FAIL', 'truncated RAL range should fail');
}

{
  const report = check('Sono graditi, ma non obbligatori, esperienza precedente in magazzino e patentino muletto. Sono richieste affidabilità, puntualità e attenzione agli errori.');
  assert.equal(report.violations.requirementPromotion, false, 'preferred preserved as preferred should pass');
}

{
  const report = check(
    'Obbligatori: ascolto, chiarezza nella comunicazione, pazienza, organizzazione, precisione e capacità di gestire più richieste contemporaneamente. Preferenziali: almeno 1 anno di esperienza in assistenza clienti (non obbligatorio).',
    {
      required: 'ascolto, chiarezza nella comunicazione, pazienza, organizzazione, precisione e capacita di gestire piu richieste',
      preferred: 'almeno 1 anno di esperienza in assistenza clienti, ma non obbligatorio',
    },
  );
  assert.equal(report.violations.requirementPromotion, false, 'required and preferred lines in the same section must not cross-match through generic mandatory wording');
}

{
  const report = check('Sono richiesti esperienza precedente in magazzino e patentino muletto. Sono richieste affidabilità, puntualità e attenzione agli errori.');
  assert.equal(report.violations.requirementPromotion, true, 'preferred promoted to required should fail');
}

{
  const report = check('Requisiti selettivi: esperienza precedente in magazzino e patentino muletto.');
  assert.equal(report.violations.requirementPromotion, true, 'misleading selective requirement labels should trigger repair');
}

{
  const report = check('È preferibile almeno un anno di esperienza, ma non è obbligatorio.', {
    preferred: 'Almeno 1 anno di esperienza in assistenza clienti',
  });
  assert.equal(report.violations.requirementPromotion, false, 'preferred experience with explicit non mandatory wording should pass');
}

{
  const report = check('Esperienza precedente in assistenza clienti costituisce un plus.', {
    preferred: 'Esperienza precedente in assistenza clienti',
  });
  assert.equal(report.violations.requirementPromotion, false, 'preferred experience as plus should pass');
}

{
  const report = check('Nel magazzino, ordine e collaborazione aiutano a evitare errori su quantità e articoli.');
  assert.equal(report.violations.preferredConsequence, false, 'general role context must not be mistaken for an effect of preferred requirements');
}

{
  const report = check(
    completeGoodBody + '\nNella giornata tipo gestirai le richieste dei clienti.',
    { responsibilities: 'Gestire le richieste dei clienti.' },
  );
  assert.equal(report.violations.responsibilityExpansion, true, 'undeclared daily cadence must require repair');
  assert.equal(report.final, 'FIX_REQUIRED');
}

{
  const report = check('Il patentino muletto e gradito ma non obbligatorio: facilita l inserimento operativo.');
  assert.equal(report.violations.preferredConsequence, true, 'preferred requirements must not invent candidate-facing consequences');
}

{
  const report = check('È richiesto almeno un anno di esperienza.', {
    preferred: 'Almeno 1 anno di esperienza in assistenza clienti',
  });
  assert.equal(report.violations.requirementPromotion, true, 'preferred experience promoted to required should fail');
}

{
  const report = check('È necessario avere almeno un anno di esperienza.', {
    preferred: 'Almeno 1 anno di esperienza in assistenza clienti',
  });
  assert.equal(report.violations.requirementPromotion, true, 'preferred experience promoted to necessary should fail');
}

{
  const report = check('Risponderai alle richieste dei clienti. Requisito preferenziale: preferibile almeno 1 anno in assistenza clienti, ma non obbligatorio.', {
    preferred: 'Almeno 1 anno in assistenza clienti',
  });
  assert.equal(report.violations.requirementPromotion, false, 'customer requests must not be confused with required requirements');
}

{
  const report = check('L organizzazione specifica del magazzino e le procedure interne sono elementi interni al lavoro.', {});
  assert.equal(report.violations.trainablePromise, false, 'trainable internal mention without promise should pass');
}

{
  const report = check('Ti formeremo sulle procedure interne e verrai affiancato per imparare l organizzazione specifica del magazzino.');
  assert.equal(report.violations.trainablePromise, true, 'trainable promise should fail');
}

{
  const report = check('Le procedure interne si apprendono sul posto.');
  assert.equal(report.violations.trainablePromise, true, 'passive trainable-as-training promise should fail');
}

{
  const report = check('È utile la familiarità con organizzazione specifica del magazzino e procedure interne.');
  assert.equal(report.violations.trainablePromise, true, 'trainable facts must not become implicit useful familiarity requirements');
}

{
  const report = check('Se ti riconosci in questo profilo, inviaci la tua candidatura.');
  assert.equal(report.violations.inventedApplicationProcess, false, 'generic CTA should pass');
  assert.equal(report.violations.mechanicalApplicationPlaceholder, false, 'human neutral CTA should pass');
}

{
  const report = check('Se questa posizione ti interessa, inviaci la tua candidatura.', {
    application: 'tramite il canale dell annuncio, senza documenti o passaggi aggiuntivi non dichiarati',
  });
  assert.equal(report.preservation.application, 'PASS', 'generic channel application with negative document wording must remain generic');
  assert.equal(report.violations.inventedApplicationProcess, false, 'neutral CTA must not invent an application process when generic channel wording is declared');
}

{
  const report = check("Candidatura tramite il canale dell'annuncio.");
  assert.equal(report.violations.mechanicalApplicationPlaceholder, true, 'mechanical channel CTA placeholder should require repair');
}

{
  const report = check("Il contratto e l'orario sono concordati con l'azienda.");
  assert.equal(report.violations.conditionNegotiability, true, 'declared contract and schedule must not become negotiable');
}

{
  const report = check("L'orario e pensato per chi preferisce una routine lavorativa prevedibile.");
  assert.equal(report.violations.schedulePreferenceInference, true, 'declared schedule must not imply unsupported candidate preferences');
}

{
  const report = check('Invia CV e presentazione: ti ricontatteremo per i prossimi step di selezione su LinkedIn.');
  assert.equal(report.violations.inventedApplicationProcess, true, 'invented recruitment process should fail');
}

{
  const report = check('Presenterai i servizi ai potenziali clienti e aggiornerai il CRM con le informazioni sui prospect.', {
    responsibilities: 'Presentare i servizi dell azienda ai potenziali clienti; aggiornare il CRM.',
    application: '',
  });
  assert.equal(report.violations.inventedApplicationProcess, false, 'commercial presentare must not be treated as application process');
  assert.notEqual(report.preservation.application, 'FAIL', 'absent generic application must not fail preservation');
}

{
  const report = check('Invia il CV e una breve presentazione.', { application: '' });
  assert.equal(report.violations.inventedApplicationProcess, true, 'real application presentation should fail');
}

{
  const report = check('Inviaci la tua candidatura indicando brevemente la tua esperienza e disponibilita.', { application: 'Candidatura tramite il canale dell annuncio.' });
  assert.equal(report.violations.inventedApplicationProcess, true, 'generic application path must not invent requested candidate details');
}

{
  const report = check('Per candidarti, invia CV a recruiting@azienda-test.it.', { application: 'Invia CV a recruiting@azienda-test.it.' });
  assert.equal(report.violations.inventedApplicationProcess, false, 'declared CV application path should pass');
}

{
  const report = check('Aggiornerai il CRM.', {
    responsibilities: 'Aggiornare il CRM.',
    required: 'Precisione',
    preferred: 'Non dichiarati',
  });
  assert.equal(report.violations.inventedTechnology, false, 'CRM declared in activity facts should be authorized');
}

{
  const report = check('Aggiornerai Salesforce.', {
    responsibilities: 'Aggiornare il CRM.',
    required: 'Precisione',
    preferred: 'Non dichiarati',
  });
  assert.equal(report.violations.inventedTechnology, true, 'specific undeclared technology should fail even when a related generic tool exists');
}

{
  const report = check('Sono richiesti lettura schemi elettrici, conoscenze meccaniche e capacità di diagnosi. Interverrai su componenti elettrici e meccanici.', {
    title: 'Tecnico manutentore elettromeccanico',
    responsibilities: 'Interventi su componenti elettrici e meccanici; ricerca e individuazione guasti.',
    required: 'Lettura schemi elettrici; conoscenze meccaniche; capacità di diagnosi',
    preferred: 'Non dichiarati',
    boundary: 'Non inventare PLC, macchinari specifici o certificazioni.',
  });
  assert.notEqual(report.preservation.technologies, 'FAIL', 'technical skills are preserved semantically without storage-category failure');
  assert.equal(report.violations.inventedTechnology, false, 'negative technology boundary must not create a false invented technology issue');
}

{
  const report = check('È richiesta esperienza PLC Siemens.', {
    title: 'Tecnico manutentore elettromeccanico',
    responsibilities: 'Interventi su componenti elettrici e meccanici; ricerca e individuazione guasti.',
    required: 'Lettura schemi elettrici; conoscenze meccaniche; capacità di diagnosi',
    preferred: 'Non dichiarati',
    boundary: 'Non inventare PLC, macchinari specifici o certificazioni.',
  });
  assert.equal(report.violations.inventedTechnology, true, 'PLC from negative boundary must not be authorized');
}

{
  const report = check('Se ti interessa, inviaci la tua candidatura.', { application: '' });
  assert.notEqual(report.preservation.application, 'FAIL', 'application absent should not fail preservation');
  assert.equal(report.violations.inventedApplicationProcess, false, 'neutral CTA should pass when no specific application fact exists');
}

{
  const report = check('Collaborerai con autisti e ufficio ordini quando emergono discrepanze nelle quantità.');
  assert.equal(report.violations.entityExpansion, false, 'exact entity set should pass');
}

{
  const report = check('Collaborerai con gli operatori di produzione.', {
    operatingContext: 'Collaborazione con operatori di produzione e responsabile manutenzione',
  });
  assert.equal(report.violations.entityExpansion, false, 'canonical production operators must pass');
}

{
  const report = check('Collaborerai con autisti, ufficio ordini e altri reparti quando emergono discrepanze.');
  assert.equal(report.violations.entityExpansion, true, 'entity expansion should fail');
}

{
  const report = check('Collaborerai con il team di produzione.', {
    operatingContext: 'Collaborazione con operatori di produzione e responsabile manutenzione',
  });
  assert.equal(report.violations.entityExpansion, true, 'unsupported team abstraction must fail when only production operators are declared');
}

{
  const report = check('Coordinerai 12 operatori.', {
    title: 'Responsabile di produzione',
    operatingContext: '12 operatori coordinati, direzione e magazzino',
  });
  assert.equal(report.violations.entityExpansion, false, 'exact declared operator count must not be an entity expansion');
  assert.equal(report.violations.numericDrift, false, 'exact declared operator count must pass numeric preservation');
}

{
  const report = check('Coordinerai circa 12 operatori.', {
    title: 'Responsabile di produzione',
    operatingContext: '12 operatori coordinati, direzione e magazzino',
  });
  assert.equal(report.violations.numericDrift, true, 'exact operator count must not become approximate');
}

{
  const report = check('Coordinerai una decina di operatori.', {
    title: 'Responsabile di produzione',
    operatingContext: '12 operatori coordinati, direzione e magazzino',
  });
  assert.equal(report.violations.numericDrift, true, 'exact operator count must not become a vague word count');
}

{
  const report = check('Gestirai un team di circa 12 operatori.', {
    title: 'Responsabile di produzione',
    operatingContext: '12 operatori coordinati, direzione e magazzino',
  });
  assert.equal(report.final, 'FIX_REQUIRED', 'team plus approximate exact count must require repair');
  assert.equal(report.violations.entityExpansion, true, 'unsupported team abstraction must still fail');
  assert.equal(report.violations.numericDrift, true, 'approximate exact operator count must still fail');
}

{
  let repairInput = null;
  const bad = makeMaster(`${completeGoodBody} Gestirai un team di circa 12 operatori.`, { title: 'Responsabile di produzione' });
  const runtime = await runAnnunci10xDecisionEngineCreateRuntime({
    roleCard: roleCard({
      title: 'Responsabile di produzione',
      operatingContext: '12 operatori coordinati, direzione e magazzino',
    }),
    writer: {
      async generate() {
        return { master: bad };
      },
      async repair(input) {
        repairInput = input;
        return { master: makeMaster(`${completeGoodBody} Coordina 12 operatori.`, { title: 'Responsabile di produzione' }) };
      },
    },
  });
  assert.ok(repairInput?.repairRequest.repairInstructions.some((instruction) => instruction.kind === 'EXACT_NUMBER_CANONICALIZATION' && instruction.canonicalText === '12 operatori'), 'repair request must include exact number canonicalization for 12 operators');
  assert.equal(runtime.status, 'READY_FOR_CLIENT', 'repair with exact canonical operator count must pass');
  assert.match(masterText(runtime.finalMaster), /Coordina 12 operatori/i, 'repair must restore exact canonical operator count');
}

{
  let repairInput = null;
  const bad = makeMaster(`${completeGoodBody} Collaborerai con il team di produzione e il responsabile manutenzione.`);
  const runtime = await runAnnunci10xDecisionEngineCreateRuntime({
    roleCard: roleCard({
      operatingContext: 'Collaborazione con operatori di produzione e responsabile manutenzione',
    }),
    writer: {
      async generate() {
        return { master: bad };
      },
      async repair(input) {
        repairInput = input;
        const instruction = input.repairRequest.repairInstructions[0];
        const body = instruction
          ? input.repairRequest.currentMaster.replace(instruction.unsupportedText, instruction.canonicalText)
          : input.repairRequest.currentMaster;
        return { master: makeMaster(body) };
      },
    },
  });
  assert.equal(repairInput?.repairRequest.repairInstructions[0]?.unsupportedText, 'il team di produzione', 'repair request must identify the unsupported team abstraction');
  assert.equal(repairInput?.repairRequest.repairInstructions[0]?.canonicalText, 'gli operatori di produzione', 'repair request must provide the canonical entity replacement');
  assert.match(masterText(runtime.finalMaster), /operatori di produzione/i, 'repair must produce the canonical production operators entity');
  assert.doesNotMatch(masterText(runtime.finalMaster), /team di produzione/i, 'repair must remove unsupported team abstraction');
}

{
  const report = check('Lavorerai con il team IT.', {
    title: 'Full Stack Developer',
    operatingContext: 'Collaborazione con altri sviluppatori e responsabile prodotto',
    responsibilities: 'Sviluppo frontend e backend; debugging.',
    required: 'TypeScript; React',
  });
  assert.equal(report.violations.entityExpansion, true, 'team IT must not be authorized by declared other developers');
}

{
  const report = check('Ti confronterai con il management.', {
    title: 'Full Stack Developer',
    operatingContext: 'Collaborazione con responsabile prodotto',
    responsibilities: 'Sviluppo frontend e backend; debugging.',
    required: 'TypeScript; React',
  });
  assert.equal(report.violations.entityExpansion, true, 'management must not be authorized by declared product manager');
}

{
  const report = check('Parlerai con stakeholder business.', {
    title: 'Commerciale B2B',
    operatingContext: 'Confronto con clienti',
    responsibilities: 'Comprendere esigenze dei clienti.',
    required: 'Comunicazione',
  });
  assert.equal(report.violations.entityExpansion, true, 'declared clienti must not authorize generic stakeholder expansion');
}

{
  const report = check('RAL indicativa €40.000-€48.000 in funzione dell esperienza.', {
    compensation: 'RAL €40.000-€48.000 in funzione dell esperienza.',
  });
  assert.equal(report.preservation.compensation, 'PASS', 'declared compensation range must remain valid with indicativa wording');
  assert.equal(report.violations.numericDrift, false, 'numeric drift checker must not treat compensation ranges as exact entity counts');
}

{
  const report = check('Collaborerai con autisti e ufficio ordini.');
  assert.equal(report.violations.relationPurposeExpansion, false, 'relation only should pass');
}

{
  const report = check('Collaborerai con autisti e ufficio ordini per gestire consegne e spedizioni.');
  assert.equal(report.violations.relationPurposeExpansion, true, 'invented relation purpose should fail');
}

{
  const report = check('Collaborerai con autisti e ufficio ordini attraverso un processo strutturato con passaggi codificati.');
  assert.equal(report.violations.relationPurposeExpansion, true, 'invented structured process around collaboration should fail');
}

{
  const report = check('Il ruolo comprende ricezione merce, controllo quantità e preparazione ordini.', {});
  assert.equal(report.violations.missingDataDisclosure, false, 'missing data omitted should pass');
}

{
  const report = check('Non sono stati dichiarati benefit o dettagli ulteriori sul welfare.');
  assert.equal(report.violations.missingDataDisclosure, true, 'missing data disclosure should be flagged');
}

{
  const report = check('RAL 32 000 - 40 000 EUR in funzione dell esperienza.', { compensation: 'RAL 32.000–40.000 EUR in funzione dell esperienza.' });
  assert.equal(report.preservation.compensation, 'PASS', 'Unicode range equivalent should pass');
}

{
  const good = makeMaster(completeGoodBody);
  const { runtime, generateCalls, repairCalls } = await runtimeWithMasters([good]);
  assert.equal(runtime.status, 'READY_FOR_CLIENT', 'CREATE pass should become READY_FOR_CLIENT');
  assert.equal(runtime.finalDecisionReport.final, 'PASS');
  assert.equal(generateCalls, 1);
  assert.equal(repairCalls, 0);
  assert.equal(runtime.providerCallCount, 1);
}

{
  const structurallyLeaky = makeMaster(`${completeGoodBody}\n\nDO_NOT_INVENT: Non inventare benefit o processi di candidatura.\nCandidatura tramite il canale dell'annuncio.`);
  const { runtime, generateCalls, repairCalls } = await runtimeWithMasters([structurallyLeaky]);
  assert.equal(runtime.status, 'READY_FOR_CLIENT', 'deterministic candidate-facing sanitizer should clear internal markers without AI repair');
  assert.equal(runtime.finalDecisionReport.final, 'PASS');
  assert.equal(generateCalls, 1);
  assert.equal(repairCalls, 0);
  assert.equal(runtime.providerCallCount, 1);
  assert.doesNotMatch(masterText(runtime.finalMaster), /DO_NOT_INVENT|canale dell['’]?\s*annuncio/i);
}

{
  const bad = makeMaster('PMI alimentare a Bari. Retribuzione da definire in base all esperienza. Sono richieste affidabilità, puntualità e attenzione agli errori.');
  const repaired = makeMaster(completeGoodBody);
  const { runtime, generateCalls, repairCalls } = await runtimeWithMasters([bad, repaired]);
  assert.equal(runtime.status, 'READY_FOR_CLIENT', 'CREATE fix via one surgical repair should become READY_FOR_CLIENT');
  assert.equal(runtime.automaticRevisionCount, 1);
  assert.equal(runtime.finalDecisionReport.final, 'PASS');
  assert.equal(generateCalls, 1);
  assert.equal(repairCalls, 1);
  assert.equal(runtime.providerCallCount, 2);
}

{
  const bad = makeMaster('PMI alimentare a Bari. Retribuzione da definire in base all esperienza. Sono richieste affidabilità, puntualità e attenzione agli errori.');
  const stillBad = makeMaster('PMI alimentare a Bari. Retribuzione da definire in base all esperienza. Sono richieste affidabilità, puntualità e attenzione agli errori.');
  const { runtime, generateCalls, repairCalls } = await runtimeWithMasters([bad, stillBad]);
  assert.equal(runtime.status, 'BLOCK', 'CREATE must block if the single repair does not clear hard failures');
  assert.equal(runtime.finalMaster, null, 'blocked CREATE must not expose a final paid master');
  assert.equal(runtime.automaticRevisionCount, 1);
  assert.equal(generateCalls, 1);
  assert.equal(repairCalls, 1);
}

{
  const good = makeMaster(completeGoodBody);
  const runtime = await runAnnunci10xDecisionEngineCreateRuntime({
    roleCard: roleCard({ preferred: 'Non dichiarati', trainable: 'Non dichiarati', shifts: 'Non dichiarati', onCall: 'Non dichiarata' }),
    writer: { async generate() { return { master: good }; } },
  });
  assert.equal(runtime.status, 'READY_FOR_CLIENT', 'UNKNOWN non-critical facts must not block CREATE');
  assert.ok(runtime.unknowns.length > 0, 'non-critical UNKNOWN decisions should remain visible as warnings');
  assert.equal(runtime.providerCallCount, 1);
}

{
  const report = check(
    completeGoodBody + '\nLa richiesta viene portata fino a una risoluzione.',
    { responsibilities: 'Ricezione richieste; registrazione nel CRM; verifica che la richiesta sia stata gestita.' },
  );
  assert.equal(report.violations.responsibilityExpansion, true, 'gestita must not be strengthened into risoluzione without explicit evidence');
  assert.equal(report.final, 'FIX_REQUIRED');
}

{
  const master = makeMaster(completeGoodBody);
  const revision = await applyAnnunci10xClientRevision({
    master,
    roleCard: roleCard(),
    revisionCount: 0,
    targetSectionId: 's-body',
    userInstruction: 'Rendi piu diretto il paragrafo.',
    async reviseSection({ previousSection, revisionNumber }) {
      return { ...previousSection, body: `${previousSection.body} Revision ${revisionNumber}.` };
    },
  });
  assert.equal(revision.status, 'REVISION_APPLIED', 'client revision count 0 should become 1');
  assert.equal(revision.revisionCount, 1);
  assert.match(masterText(revision.master), /Revision 1/);
}

{
  const master = makeMaster(completeGoodBody);
  const revision = await applyAnnunci10xClientRevision({
    master,
    roleCard: roleCard(),
    revisionCount: 1,
    targetSectionId: 's-body',
    userInstruction: 'Rendi piu coinvolgente.',
    async reviseSection({ previousSection }) {
      return { ...previousSection, body: previousSection.body };
    },
  });
  assert.equal(revision.status, 'REVISION_BLOCKED', 'no-op revision must not consume a client revision');
  assert.equal(revision.revisionCount, 1, 'no-op revision must preserve the current revision count');
  assert.equal(revision.master, master, 'no-op revision must preserve the current master');
}

{
  const master = makeMaster(completeGoodBody);
  const revision = await applyAnnunci10xClientRevision({
    master,
    roleCard: roleCard(),
    revisionCount: 3,
    targetSectionId: 's-body',
    userInstruction: 'Ancora una modifica.',
    async reviseSection({ previousSection }) {
      return previousSection;
    },
  });
  assert.equal(revision.status, 'REVISION_LIMIT_REACHED', 'client revision count 3 should hit limit');
  assert.equal(revision.master, master);
}

{
  const master = makeMaster(completeGoodBody);
  const revision = await applyAnnunci10xClientRevision({
    master,
    roleCard: roleCard(),
    revisionCount: 1,
    targetSectionId: 's-body',
    userInstruction: 'Rimuovi dettagli.',
    async reviseSection({ previousSection }) {
      return { ...previousSection, body: 'Testo corto senza CCNL.' };
    },
  });
  assert.equal(revision.status, 'REVISION_BLOCKED', 'failed revision must keep previous master');
  assert.equal(revision.revisionCount, 1);
  assert.equal(revision.master, master);
}

console.log('Annunci 10x decision engine verifier passed');
