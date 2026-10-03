import type { Annunci10xDecision, Annunci10xDecisionReport, Annunci10xTruthLedger } from './types.ts';
import { compensationText, factValue, factsByCategory, publishableRequirementItems } from './ledger.ts';
import { includesEquivalent, meaningfulTokens, normalizeForDecision, normalizeNumberText, sentences } from './text.ts';
import { runAnnunci10xPreflight } from './preflight.ts';

export function runAnnunci10xHardFactsCheck(ledger: Annunci10xTruthLedger, masterText: string): Annunci10xDecisionReport {
  const preflight = runAnnunci10xPreflight(ledger);
  const preservation = {
    role: preserveField(masterText, factValue(ledger.roleCard.title)),
    companyContext: preserveField(masterText, factValue(ledger.roleCard.attractionContext.companyDescription)),
    location: preserveField(masterText, factValue(ledger.roleCard.attractionContext.location)),
    workMode: preserveField(masterText, factValue(ledger.roleCard.attractionContext.workModeDetail) || factValue(ledger.roleCard.attractionContext.workMode)),
    schedule: preserveField(masterText, factValue(ledger.roleCard.attractionContext.schedule)),
    contract: preserveField(masterText, factValue(ledger.roleCard.attractionContext.contractType)),
    compensation: preserveCompensation(ledger, masterText),
    experience: preserveExperience(ledger, masterText),
    technologies: preserveTechnologies(ledger, masterText),
    requiredRequirements: preserveRequirements(ledger, masterText, 'REQUIREMENT_REQUIRED'),
    preferredRequirements: preserveRequirements(ledger, masterText, 'REQUIREMENT_PREFERRED'),
    benefits: preserveBenefits(ledger, masterText),
    application: preserveApplication(ledger, masterText),
  };

  const violations = {
    inventedBenefit: hasInventedBenefit(ledger, masterText),
    inventedTechnology: hasInventedTechnology(ledger, masterText),
    inventedApplicationProcess: hasInventedApplicationProcess(ledger, masterText),
    requirementPromotion: hasRequirementPromotion(ledger, masterText),
    preferredConsequence: hasPreferredConsequence(ledger, masterText),
    trainablePromise: hasTrainablePromise(ledger, masterText),
    missingDataDisclosure: hasMissingDataDisclosure(masterText),
    internalStructureLeak: hasInternalStructureLeak(masterText),
    mechanicalApplicationPlaceholder: hasMechanicalApplicationPlaceholder(masterText),
    conditionNegotiability: hasConditionNegotiability(ledger, masterText),
    schedulePreferenceInference: hasSchedulePreferenceInference(ledger, masterText),
    employerBrandExpansion: hasEmployerBrandExpansion(ledger, masterText),
    entityExpansion: hasEntityExpansion(ledger, masterText),
    numericDrift: hasNumericDrift(ledger, masterText),
    relationPurposeExpansion: hasRelationPurposeExpansion(ledger, masterText),
    responsibilityExpansion: hasResponsibilityExpansion(ledger, masterText),
  };

  const hardFailures = collectHardFailures(preservation, violations);
  const unknowns = Object.entries(preservation)
    .filter(([, decision]) => decision === 'UNKNOWN')
    .map(([key]) => key);
  const warnings = [
    ...unknowns.map((key) => `UNKNOWN: ${key}`),
    ...(preflight.canGenerate ? [] : preflight.reasons),
  ];
  const final = !preflight.canGenerate
    ? 'BLOCK'
    : hardFailures.length > 0
      ? 'FIX_REQUIRED'
      : 'PASS';

  return { preflight, preservation, violations, hardFailures, unknowns, warnings, final };
}

function preserveField(masterText: string, expected: string): Annunci10xDecision {
  if (!expected) return 'UNKNOWN';
  if (/non dichiarat|non specificat|non indicat/i.test(expected)) return 'PASS';
  return includesEquivalent(masterText, expected) ? 'PASS' : 'FAIL';
}

function preserveCompensation(ledger: Annunci10xTruthLedger, masterText: string): Annunci10xDecision {
  const expected = compensationText(ledger.roleCard);
  if (!expected) return 'UNKNOWN';
  const normalizedMaster = normalizeNumberText(masterText);
  const normalizedExpected = normalizeNumberText(expected);
  if (/ccnl/i.test(expected) && !/ccnl/i.test(masterText)) return 'FAIL';
  const numbers = normalizedExpected.match(/\d[\d.]*/g) ?? [];
  if (numbers.length > 0 && !numbers.every((number) => normalizedMaster.includes(number.replace(/\D/g, '') || number))) return 'FAIL';
  return includesEquivalent(normalizedMaster, normalizedExpected) ? 'PASS' : 'FAIL';
}

function preserveExperience(ledger: Annunci10xTruthLedger, masterText: string): Annunci10xDecision {
  const experienceFacts = ledger.facts.filter((fact) => /(?:anni|esperienza)/i.test(fact.value) && fact.category.startsWith('REQUIREMENT'));
  if (experienceFacts.length === 0) return 'UNKNOWN';
  return experienceFacts.every((fact) => includesEquivalent(masterText, fact.value)) ? 'PASS' : 'FAIL';
}

function preserveTechnologies(ledger: Annunci10xTruthLedger, masterText: string): Annunci10xDecision {
  const technologies = factsByCategory(ledger, 'TECHNOLOGY');
  if (technologies.length === 0) return 'UNKNOWN';
  return technologies.every((fact) => includesEquivalent(masterText, fact.value)) ? 'PASS' : 'FAIL';
}

function preserveRequirements(ledger: Annunci10xTruthLedger, masterText: string, category: 'REQUIREMENT_REQUIRED' | 'REQUIREMENT_PREFERRED'): Annunci10xDecision {
  const facts = factsByCategory(ledger, category);
  if (facts.length === 0) return 'UNKNOWN';
  const items = facts.flatMap((fact) => publishableRequirementItems(fact.value));
  if (items.length === 0) return 'UNKNOWN';
  return items.every((item) => includesEquivalent(masterText, item)) ? 'PASS' : 'FAIL';
}

function preserveBenefits(ledger: Annunci10xTruthLedger, masterText: string): Annunci10xDecision {
  const benefits = factsByCategory(ledger, 'BENEFIT');
  if (benefits.length === 0) return hasInventedBenefit(ledger, masterText) ? 'FAIL' : 'PASS';
  return benefits.every((fact) => includesEquivalent(masterText, fact.value)) ? 'PASS' : 'FAIL';
}

function preserveApplication(ledger: Annunci10xTruthLedger, masterText: string): Annunci10xDecision {
  const application = factValue(ledger.roleCard.applicationInstructions);
  if (!application || !hasSpecificApplicationInstruction(application)) return hasInventedApplicationProcess(ledger, masterText) ? 'FAIL' : 'PASS';
  return includesEquivalent(masterText, application) ? 'PASS' : 'FAIL';
}

function hasInventedBenefit(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  const authorized = authorizedFactText(ledger);
  const mentioned = benefitConcepts().filter((benefit) => benefit.pattern.test(masterText));
  return mentioned.some((benefit) => !benefit.evidencePatterns.some((pattern) => pattern.test(authorized)));
}

function hasInventedTechnology(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  const authorized = authorizedFactText(ledger);
  const mentioned = technologyConcepts()
    .filter((technology) => technology.pattern.test(masterText));
  return mentioned.some((technology) => !technology.evidencePatterns.some((pattern) => pattern.test(authorized)));
}

function hasInventedApplicationProcess(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  const application = normalizeForDecision(factValue(ledger.roleCard.applicationInstructions));
  const explicitlyDeclared = hasSpecificApplicationInstruction(application);
  const applicationSentences = sentences(masterText).map(normalizeForDecision);
  if (applicationSentences.some((sentence) => /\b(?:ti ricontatteremo|sarai ricontattat|colloquio|step successiv|processo di selezione)\b/.test(sentence))) return true;
  if (applicationSentences.some((sentence) => /\b(?:invia|manda|allega|carica|candidati|candidatura)\b/.test(sentence)
    && /\b(?:cv|curriculum|lettera di presentazione|breve presentazione|presentazione)\b/.test(sentence)
    && !(explicitlyDeclared && /\b(?:cv|curriculum|lettera di presentazione|breve presentazione|presentazione)\b/.test(application)))) return true;
  if (!explicitlyDeclared && applicationSentences.some((sentence) => /\b(?:invia|manda|candidati|candidatura)\b/.test(sentence)
    && /\b(?:indicando|specificando|segnalando)\b/.test(sentence)
    && /\b(?:esperienza|disponibilita)\b/.test(sentence))) return true;
  if (!explicitlyDeclared && applicationSentences.some((sentence) => /\blinkedin\b/.test(sentence))) return true;
  return false;
}

function hasSpecificApplicationInstruction(application: string): boolean {
  const normalized = normalizeForDecision(application);
  if (!normalized) return false;
  if (/candidatura tramite il canale(?: dell'? annuncio)?/.test(normalized)) return false;
  return /@|https?:\/\/|www\.|\blinkedin\b|\bform\b|\bcv\b|\bcurriculum\b|\boggetto\b|\bemail\b|\bmail\b|\blettera\b|\bdocument[oi]\b/.test(normalized);
}

function authorizedFactText(ledger: Annunci10xTruthLedger): string {
  return normalizeForDecision(ledger.facts.filter((fact) => fact.category !== 'BOUNDARY').map((fact) => fact.value).join(' '));
}

function technologyConcepts(): Array<{ label: string; pattern: RegExp; evidencePatterns: RegExp[] }> {
  return [
    { label: 'TypeScript', pattern: /\btypescript\b/i, evidencePatterns: [/\btypescript\b/] },
    { label: 'React', pattern: /\breact\b/i, evidencePatterns: [/\breact\b/] },
    { label: 'Node.js', pattern: /\bnode(?:\.js)?\b/i, evidencePatterns: [/\bnode(?:\.js)?\b/] },
    { label: 'SQL', pattern: /\bsql\b/i, evidencePatterns: [/\bsql\b/] },
    { label: 'REST API', pattern: /\brest\s+api\b/i, evidencePatterns: [/\brest\s+api\b/] },
    { label: 'Git', pattern: /\bgit\b/i, evidencePatterns: [/\bgit\b/] },
    { label: 'CRM', pattern: /\bcrm\b/i, evidencePatterns: [/\bcrm\b/] },
    { label: 'WMS', pattern: /\bwms\b/i, evidencePatterns: [/\bwms\b/] },
    { label: 'PLC', pattern: /\bplc\b/i, evidencePatterns: [/\bplc\b/] },
    { label: 'Kubernetes', pattern: /\bkubernetes\b/i, evidencePatterns: [/\bkubernetes\b/] },
    { label: 'Docker', pattern: /\bdocker\b/i, evidencePatterns: [/\bdocker\b/] },
    { label: 'AWS', pattern: /\baws\b/i, evidencePatterns: [/\baws\b/] },
    { label: 'Azure', pattern: /\bazure\b/i, evidencePatterns: [/\bazure\b/] },
    { label: 'microservizi', pattern: /\bmicroservizi\b/i, evidencePatterns: [/\bmicroservizi\b/] },
    { label: 'CI/CD', pattern: /\bci\/cd\b/i, evidencePatterns: [/\bci\/cd\b/] },
    { label: 'Salesforce', pattern: /\bsalesforce\b/i, evidencePatterns: [/\bsalesforce\b/] },
    { label: 'Postman', pattern: /\bpostman\b/i, evidencePatterns: [/\bpostman\b/] },
    { label: 'GitHub Actions', pattern: /\bgithub\s+actions\b/i, evidencePatterns: [/\bgithub\s+actions\b/] },
  ];
}

function benefitConcepts(): Array<{ label: string; pattern: RegExp; evidencePatterns: RegExp[] }> {
  return [
    { label: 'buoni pasto', pattern: /\b(?:buoni\s+pasto|ticket(?:\s+restaurant)?)\b/i, evidencePatterns: [/\b(?:buoni\s+pasto|ticket(?:\s+restaurant)?)\b/] },
    { label: 'welfare', pattern: /\bwelfare\b/i, evidencePatterns: [/\bwelfare\b/] },
    { label: 'assicurazione sanitaria', pattern: /\bassicurazione(?:\s+sanitaria)?\b/i, evidencePatterns: [/\bassicurazione(?:\s+sanitaria)?\b/] },
    { label: 'bonus', pattern: /\b(?:bonus|premi)\b/i, evidencePatterns: [/\b(?:bonus|premi)\b/] },
    { label: 'auto aziendale', pattern: /\bauto\s+aziendale\b/i, evidencePatterns: [/\bauto\s+aziendale\b/] },
    { label: 'telefono aziendale', pattern: /\btelefono\s+aziendale\b/i, evidencePatterns: [/\btelefono\s+aziendale\b/] },
    { label: 'laptop', pattern: /\blaptop\b/i, evidencePatterns: [/\blaptop\b/] },
    { label: 'MacBook', pattern: /\bmacbook\b/i, evidencePatterns: [/\bmacbook\b/] },
    { label: 'stock option', pattern: /\bstock\s+option\b/i, evidencePatterns: [/\bstock\s+option\b/] },
    { label: 'budget formazione', pattern: /\bbudget\s+formazione\b/i, evidencePatterns: [/\bbudget\s+formazione\b/] },
    { label: 'formazione continua', pattern: /\bformazione\s+continua\b/i, evidencePatterns: [/\bformazione\s+continua\b/] },
    { label: 'percorso di crescita strutturato', pattern: /\bpercorso\s+di\s+crescita\s+strutturat[oa]\b/i, evidencePatterns: [/\bpercorso\s+di\s+crescita\s+strutturat[oa]\b/] },
  ];
}

function hasRequirementPromotion(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  if (/\brequisiti\s+selettivi\b/i.test(masterText)) return true;
  const preferred = factsByCategory(ledger, 'REQUIREMENT_PREFERRED').flatMap((fact) => publishableRequirementItems(fact.value));
  const textSentences = sentences(masterText);
  return preferred.some((item) => {
    const tokens = meaningfulTokens(item);
    return textSentences.some((sentence) => {
      const normalizedSentence = normalizeForDecision(sentence);
      return tokens.some((token) => normalizedSentence.includes(token))
        && /\b(?:richiediamo|e\s+richiest[oaie]|sono\s+richiest[oaie]|viene\s+richiest[oaie]|indispensabile|necessari[oaie]|obbligatori[oaie]|devi avere|serve avere|requisito\s+obbligatorio)\b/.test(normalizedSentence)
        && !/\b(?:preferenzial|preferibil|gradit|apprezzat|plus)\b/.test(normalizedSentence)
        && !/\bnon\b.{0,24}\b(?:obbligator|necessari)/.test(normalizedSentence);
    });
  });
}

function hasPreferredConsequence(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  const preferred = factsByCategory(ledger, 'REQUIREMENT_PREFERRED').flatMap((fact) => publishableRequirementItems(fact.value));
  const textSentences = sentences(masterText);
  return preferred.some((item) => {
    const tokens = preferredConsequenceAnchors(ledger, item);
    return textSentences.some((sentence) => tokens.some((token) => normalizeForDecision(sentence).includes(token))
      && /\b(?:facilita|facilitano|aiuta|aiutano|permette|permettono|riduce|riducono|operativ[oaie] prima|autonomia maggiore|vantaggio)\b/i.test(sentence));
  });
}

function preferredConsequenceAnchors(ledger: Annunci10xTruthLedger, item: string): string[] {
  const generic = new Set(['precedente', 'precedenti', 'gradito', 'gradita', 'graditi', 'gradite', 'obbligatorio', 'obbligatoria', 'obbligatori', 'obbligatorie', 'preferibile', 'preferenziale', 'entrambi', 'entrambe']);
  const tokens = meaningfulTokens(item).filter((token) => !generic.has(token));
  const nonPreferredText = normalizeForDecision(ledger.facts
    .filter((fact) => fact.category !== 'REQUIREMENT_PREFERRED')
    .map((fact) => fact.value)
    .join(' '));
  const distinctive = tokens.filter((token) => !nonPreferredText.includes(token));
  return distinctive.length > 0 ? distinctive : tokens;
}

function hasTrainablePromise(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  if (factsByCategory(ledger, 'REQUIREMENT_TRAINABLE').length === 0) return false;
  if (/\b(?:ti formeremo|sarai format[oa]|formazione prevista|percorso formativo|imparerai sul posto|si apprendono sul posto|verrai affiancat[oa])\b/i.test(masterText)) return true;
  const trainable = factsByCategory(ledger, 'REQUIREMENT_TRAINABLE').flatMap((fact) => publishableRequirementItems(fact.value));
  return trainable.some((item) => {
    const tokens = trainableRequirementAnchors(ledger, item);
    if (tokens.length === 0) return false;
    return sentences(masterText).some((sentence) => {
      const normalizedSentence = normalizeForDecision(sentence);
      const matches = tokens.filter((token) => normalizedSentence.includes(token)).length;
      return matches >= Math.min(2, tokens.length)
        && /\b(?:utile|familiarita|familiarit[aà]|serve|richiest[oaie]|necessari[oaie])\b/.test(normalizedSentence);
    });
  });
}

function trainableRequirementAnchors(ledger: Annunci10xTruthLedger, item: string): string[] {
  const generic = new Set(['specifica', 'specifico', 'specifiche', 'interno', 'interna', 'interni', 'interne', 'azienda', 'aziendale', 'aziendali']);
  const tokens = meaningfulTokens(item).filter((token) => !generic.has(token));
  const nonTrainableText = normalizeForDecision(ledger.facts
    .filter((fact) => fact.category !== 'REQUIREMENT_TRAINABLE')
    .map((fact) => fact.value)
    .join(' '));
  const distinctive = tokens.filter((token) => !nonTrainableText.includes(token));
  return distinctive.length > 0 ? distinctive : tokens;
}

function hasMissingDataDisclosure(masterText: string): boolean {
  return /\b(?:non sono stat[ei] dichiarat[ie]|non vengono indicat[ie]|non abbiamo informazioni|non [eè] specificat[oaie]|non sono disponibili dettagli|non dichiarat[oaie]|non disponibile)\b/i.test(masterText);
}

function hasInternalStructureLeak(masterText: string): boolean {
  if (/\bAttivita tipiche incluse nel ruolo\s*:/i.test(masterText)) return true;
  if (masterText.split(/\n/).filter((line) => /^\s*-\s+\S/.test(line)).length >= 8) return true;
  return /^(?:Indispensabili|Preferenziali|Apprendibili|Vincoli|Autonomia|Imprevisti e variabilit[aà]|Benefit|Obiettivo del ruolo|Elementi apprendibili in sede|Trainabile|Formabili in sede|Requisiti principali(?:\s+\(obbligatori\))?|Requisiti preferiti|Attivita tipiche incluse nel ruolo)\s*:/im.test(masterText);
}

function hasMechanicalApplicationPlaceholder(masterText: string): boolean {
  return /\b(?:canale dell['’]?\s*annuncio|canale indicato nell['’]?\s*annuncio|tramite il canale(?: indicato)?)\b/i.test(masterText);
}

function hasConditionNegotiability(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  const hasDeclaredContract = Boolean(factValue(ledger.roleCard.attractionContext.contractType));
  const hasDeclaredSchedule = Boolean(factValue(ledger.roleCard.attractionContext.schedule));
  if (!hasDeclaredContract && !hasDeclaredSchedule) return false;
  return /\b(?:contratto|orario)\b.{0,80}\b(?:concordat[ioa] con l['’]?azienda|da concordare|da negoziare|negoziat[ioa])\b/i.test(masterText);
}

function hasSchedulePreferenceInference(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  if (!factValue(ledger.roleCard.attractionContext.schedule)) return false;
  return /\b(?:orario|turni|routine)\b.{0,100}\b(?:pensat[oaie]\s+per|ideale\s+per|adatt[oaie]\s+a|perfett[oaie]\s+per|per chi preferisce|compatibil[ei]\s+con)\b/i.test(masterText);
}

function hasEmployerBrandExpansion(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  const knownText = normalizeForDecision(ledger.facts.map((fact) => fact.value).join(' '));
  const brandClaims: Array<[RegExp, RegExp]> = [
    [/\bambiente\s+dinamic[oa]\b/i, /\bambiente\s+dinamic[oa]\b/],
    [/\btalento\s+(?:verra\s+)?valorizzat[oa]\b/i, /\btalento\s+(?:verra\s+)?valorizzat[oa]\b/],
    [/\bazienda\s+in\s+crescita\b/i, /\bazienda\s+in\s+crescita\b/],
    [/\bcontesto\s+stimolante\b/i, /\bcontesto\s+stimolante\b/],
  ];
  return brandClaims.some(([pattern, evidence]) => pattern.test(masterText) && !evidence.test(knownText));
}

function hasEntityExpansion(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  const knownText = normalizeForDecision(ledger.facts.map((fact) => fact.value).join(' '));
  if (/\baltri reparti\b/i.test(masterText) && !/altri reparti/.test(knownText)) return true;
  if (/\bdiversi team aziendali\b/i.test(masterText) && !/diversi team aziendali/.test(knownText)) return true;
  if (/\b(?:team|reparti|uffici|stakeholder|management)\b/i.test(masterText) && !/\b(?:team|reparti|uffici|stakeholder|management)\b/i.test(knownText)) return true;
  return false;
}

function hasNumericDrift(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  const text = normalizeForDecision(masterText);
  return exactCountEntities(ledger).some(({ count, noun }) => {
    const approximateSameNumber = new RegExp(`\\b(?:circa|piu o meno|all'?incirca)\\s+${count}\\s+${escapeRegExp(noun)}\\b`, 'i');
    const approximateWordNumber = count === '12'
      ? new RegExp(`\\b(?:una\\s+)?(?:decina|dozzina)\\s+di\\s+${escapeRegExp(noun)}\\b`, 'i')
      : null;
    return approximateSameNumber.test(text) || Boolean(approximateWordNumber?.test(text));
  });
}

function exactCountEntities(ledger: Annunci10xTruthLedger): Array<{ count: string; noun: string; canonical: string }> {
  const entities: Array<{ count: string; noun: string; canonical: string }> = [];
  const pattern = /\b(\d{1,3})\s+(operatori|operatrici|addetti|addette|sviluppatori|sviluppatrici|tecnici|tecniche|persone|risorse)\b/gi;
  for (const fact of ledger.facts.filter((item) => item.publishable && item.category !== 'COMPENSATION' && item.category !== 'BOUNDARY')) {
    const value = normalizeForDecision(fact.value);
    for (const match of value.matchAll(pattern)) {
      const count = match[1] ?? '';
      const noun = match[2] ?? '';
      if (isApproximateCount(value, match.index ?? 0)) continue;
      if (count && noun) entities.push({ count, noun, canonical: `${count} ${noun}` });
    }
  }
  return entities;
}

function isApproximateCount(value: string, matchIndex: number): boolean {
  const prefix = value.slice(Math.max(0, matchIndex - 32), matchIndex);
  return /\b(?:circa|piu o meno|all'?incirca|approssimativamente)\s*$/.test(prefix);
}

function hasRelationPurposeExpansion(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  const knownText = normalizeForDecision(ledger.facts.map((fact) => fact.value).join(' '));
  const relationSentences = sentences(masterText).filter((sentence) => /\b(?:collabor\w*|coordina\w*|confront\w*|interag\w*|lavora con)\b/i.test(sentence));
  const unsupportedObjects: Array<{ pattern: RegExp; evidence: RegExp[] }> = [
    { pattern: /\broadmap\b/, evidence: [/\broadmap\b/] },
    { pattern: /\bstrategie\b/, evidence: [/\bstrategie\b/] },
    { pattern: /\bobiettivi commerciali\b/, evidence: [/\bobiettivi commerciali\b/] },
    { pattern: /\bpriorita dei clienti\b/, evidence: [/\bpriorita dei clienti\b/] },
    { pattern: /\bconsegne?\b/, evidence: [/\bconsegne?\b/] },
    { pattern: /\bspedizioni?\b/, evidence: [/\bspedizioni?\b/] },
    { pattern: /\bgestire\s+(?:le\s+)?priorita\b/, evidence: [/\bgestire\s+(?:le\s+)?priorita\b/, /\bpriorita operative\b/] },
    { pattern: /\bdubbi\s+operativi\b/, evidence: [/\bdubbi\s+operativi\b/] },
    { pattern: /\bprocesso\s+\w*\s*strutturat[oaie]\b/, evidence: [/\bprocesso\s+\w*\s*strutturat[oaie]\b/] },
    { pattern: /\bpassaggi\s+codificat[ioa]\b/, evidence: [/\bpassaggi\s+codificat[ioa]\b/] },
    { pattern: /\bsla\b/, evidence: [/\bsla\b/] },
    { pattern: /\bqualita\b/, evidence: [/\bqualita\b/] },
    { pattern: /\bsicurezza\b/, evidence: [/\bsicurezza\b/] },
  ];
  return relationSentences.some((sentence) => unsupportedObjects.some((object) => object.pattern.test(sentence)
    && !object.evidence.some((evidence) => evidence.test(knownText))));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasResponsibilityExpansion(ledger: Annunci10xTruthLedger, masterText: string): boolean {
  const knownText = normalizeForDecision(ledger.facts.map((fact) => fact.value).join(' '));
  const expansions: Array<[RegExp, RegExp]> = [
    [/\bprogettazione\s+(?:di\s+)?(?:rest\s+)?api\b/i, /\bprogettazion/],
    [/\bservizi esterni\b/i, /\bservizi esterni/],
    [/\bmicroservizi\b/i, /\bmicroservizi/],
    [/\bprocedure di qualita\b/i, /\bqualit/],
    [/\bdocumenti di trasporto|ddt\b/i, /\bddt|documenti di trasporto/],
    [/\bimballaggio\b/i, /\bimballaggio/],
  ];
  return expansions.some(([pattern, evidence]) => pattern.test(masterText) && !evidence.test(knownText));
}

function collectHardFailures(
  preservation: Annunci10xDecisionReport['preservation'],
  violations: Annunci10xDecisionReport['violations'],
): string[] {
  const failures = Object.entries(preservation)
    .filter(([, decision]) => decision === 'FAIL')
    .map(([key]) => `Preservation failed: ${key}`);
  for (const [key, value] of Object.entries(violations)) {
    if (value) failures.push(`Violation: ${key}`);
  }
  return failures;
}
