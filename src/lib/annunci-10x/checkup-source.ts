export type CheckupSourceArea = 'CONTEXT' | 'ACTIVITIES' | 'REQUIRED' | 'PREFERRED' | 'OFFER' | 'CONDITIONS' | 'APPLICATION';
export interface CheckupSourceUnit { id: string; text: string; area: CheckupSourceArea }

/** The original is immutable. Section labels carry factual meaning. */
export function checkupSourceUnits(text: string): CheckupSourceUnit[] {
  let area: CheckupSourceArea = 'CONTEXT';
  const units: CheckupSourceUnit[] = [];
  const lines = text.split(/\r?\n|;\s*|(?<=[.!?])\s+(?=(?:Requisiti|Contratto|Candidatur[ae]|Sede|Retribuzione|Orario|Benefit)\b)/);
  for (const raw of lines) {
    const line = raw.trim().replace(/^[•·*]\s+|^-\s+/, '').trim();
    if (!line) continue;
    const heading = sourceHeading(line);
    if (heading) { area = heading; continue; }
    const inlineHeading = line.includes(':') ? sourceHeading(line.slice(0, line.indexOf(':'))) : null;
    if (inlineHeading) area = inlineHeading;
    // A preference about years or a narrower location does not make the main prerequisite optional.
    const partialPreference = /\([^)]*(?:preferibilmente|preferenza|preferenziale\s+(?:la|il|l[’']))/i.test(line);
    const preferredItem = !partialPreference && /^(?:preferibil\w*|preferenzial\w*|gradit\w*|facoltativ\w*|costituisc\w*|[eè] particolarmente apprezzat\w*)\b|costituir[aà]\s+(?:un\s+)?titolo preferenziale/i.test(line);
    const actualArea = preferredItem
      && (area === 'REQUIRED' || area === 'PREFERRED' || /diploma|esperienza|titolo|provenienza|conoscenza|residenza/i.test(line)) ? 'PREFERRED'
      : /si occuper[aà]|gestir[aà]/i.test(line) && (area === 'REQUIRED' || area === 'PREFERRED') ? 'ACTIVITIES'
      : /^(?:tipo di contratto|contratto(?: di lavoro)?|sede(?: di lavoro| di riferimento)?|orario|retribuzione|ral|range retributivo)\s*:/i.test(line) ? 'CONDITIONS'
        : /^(?:invia(?:re|ci|te)?|per candidar|candidati\b)/i.test(line) ? 'APPLICATION' : area;
    units.push({ id: 'S' + String(units.length + 1).padStart(3, '0'), text: line, area: actualArea });
  }
  return units;
}
function sourceHeading(line: string): CheckupSourceArea | null {
  const s = line.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[:.]+$/, '').trim();
  if (/^(?:costituiscono? (?:un |titolo )?plus|qualita preferenziali|requisiti preferenziali|titoli preferenziali)$/.test(s)) return 'PREFERRED';
  if (/^(?:requisiti(?: richiesti| indispensabili| e competenze tecniche)?|chi (?:stiamo cercando|cerchiamo)|attitudini e competenze comportamentali|cosa cerchiamo)$/.test(s)) return 'REQUIRED';
  if (/^(?:(?:principali )?responsabilita|attivita(?: principali)?|cosa farai|(?:il )?ruolo|descrizione della posizione|mansioni|mansione)$/.test(s)) return 'ACTIVITIES';
  if (/^(?:cosa offriamo|condizioni offerte|offriamo|benefit|strumenti di lavoro|formazione continua)$/.test(s)) return 'OFFER';
  if (/^(?:candidatur[ae]|come candidarsi|application)$/.test(s)) return 'APPLICATION';
  if (/^(?:sede di lavoro|orario di lavoro|condizioni di lavoro)$/.test(s)) return 'CONDITIONS';
  if (/^(?:chi siamo|perche .+|il contesto)$/.test(s)) return 'CONTEXT';
  return null;
}
export function checkupNumericFacts(text: string): string[] {
  return [...new Set((text.match(/\d+(?:[.,]\d+)*/g) ?? []).map(n => n.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.').replace(/\.0+$/, '')))];
}
export function checkupLiteralIssues(original: string, candidate: string): string[] {
  const before = new Set(checkupNumericFacts(original)), after = new Set(checkupNumericFacts(candidate));
  const issues = [...before].filter(n => !after.has(n)).map(n => 'Numero originale perso: ' + n);
  const modeDeclared = /\b(?:in presenza|da remoto|smart working|lavoro ibrido|modalit[aà] ibrida|lavoro in sede)\b/i.test(original);
  const modeAdded = /\b(?:in presenza|da remoto|smart working|lavoro ibrido|modalit[aà] ibrida)\b|\b(?:full[ -]?time|tempo pieno)\s+in\s+sede\b/i.test(candidate);
  if (!modeDeclared && modeAdded) issues.push('Modalità di lavoro non dichiarata nella fonte: una sede o il tempo pieno non autorizzano ad aggiungere presenza, remoto o lavoro ibrido.');
  issues.push(...[...after].filter(n => !before.has(n)).map(n => 'Numero non presente nell’originale: ' + n));
  for (const s of original.match(/https?:\/\/[^\s<>]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? []) {
    if (!candidate.includes(s)) issues.push('Destinazione originale persa: ' + s);
  }
  for (const s of candidate.match(/https?:\/\/[^\s<>]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? []) {
    if (!original.includes(s)) issues.push('Destinazione non autorizzata: ' + s);
  }
  return issues;
}
export function hasCheckupPlaceholderDestination(text: string): boolean {
  return /\[(?:indirizzo\s*)?(?:e-?mail|email|link|url|contatto)[^\]]*\]|\b(?:email@esempio|nome@azienda|example\.com)\b/i.test(text);
}
