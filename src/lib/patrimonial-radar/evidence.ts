import { refs, value, type Answers } from "./answers.ts";
import type { Evidence } from "./types.ts";
import { VERSIONS } from "./versions.ts";
import { allGT } from "./intervals.ts";
import type { Calculation } from "./indicators.ts";
export function localFactEvidence(a: Answers, c: Calculation): Evidence[] {
  const result: Evidence[] = [];
  if (c.indicators["I-A01"].usable && allGT(c.facts.M, "0") === "TRUE") result.push({ id: "H-MARGIN-POSITIVE:A", rule: "I-A01", ruleVersion: VERSIONS.rules, area: "A", kind: "FAVORABLE", text: "Il margine di cassa storico dichiarato è positivo.", limitation: "Fatto locale: non promuove lo stato A e non indica quanto investire o disponibilità futura.", refs: c.indicators["I-A01"].refs, indicators: ["I-A01"], priority: 4, dedupe: "MARGIN_POSITIVE" });
  if (c.indicators["I-E01"].usable && allGT(c.facts.N, "0") === "TRUE") result.push({ id: "H-NET-POSITIVE:E", rule: "I-E01", ruleVersion: VERSIONS.rules, area: "E", kind: "NEUTRAL", text: "Il netto delle attività considerate è positivo.", limitation: "Non compensa arretrati o carenza di liquidità e non certifica adeguatezza patrimoniale.", refs: refs(a, ["RP-E01", "RP-B02", "RP-X04", "RP-X05", "RP-C01", "RP-C03", "RP-S01", "RP-S02"]), indicators: ["I-E01"], priority: 4, dedupe: "NET_POSITIVE" });
  return result;
}
export function educationalEvidence(a: Answers): Evidence[] {
  const answer = value<string>(a, "RP-X07");
  if (!answer) return [];
  return [{ id: "H-COST-EXERCISE:F", rule: "H-COST-EXERCISE", ruleVersion: VERSIONS.rules, area: "F", kind: "NEUTRAL", text: answer === "20" ? "Risposta corretta al singolo esercizio: 2% di 1.000 euro per un anno è 20 euro." : "Spiegazione del singolo esercizio: 2% di 1.000 euro per un anno è 20 euro.", limitation: "Non misura conoscenza globale o costi reali e non modifica lo stato F.", refs: refs(a, ["RP-X07"]), indicators: ["I-F03"], priority: 4, dedupe: "H-COST-EXERCISE" }];
}
export function priorityIds(evidence: Evidence[]): string[] {
  const selected = new Map<string, Evidence>();
  for (const e of [...evidence].filter(e => e.kind === "VULNERABILITY").sort((x, y) => x.priority - y.priority || (x.rule < y.rule ? -1 : x.rule > y.rule ? 1 : 0))) if (!selected.has(e.dedupe)) selected.set(e.dedupe, e);
  return [...selected.values()].slice(0, 3).map(e => e.id);
}
