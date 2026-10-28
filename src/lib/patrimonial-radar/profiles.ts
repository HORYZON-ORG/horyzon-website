import { na, refs, value, type Answers } from "./answers.ts";
import { condition } from "./areas.ts";
import { declaredGoals } from "./goals.ts";
import { allGE, allGT, allLT, and, or, type Truth } from "./intervals.ts";
import type { Calculation } from "./indicators.ts";
import type { ProfileResult, QuestionId } from "./types.ts";
export function evaluateProfiles(a: Answers, calc: Calculation): ProfileResult {
  const v = <T,>(id: QuestionId) => value<T>(a, id), f = calc.facts;
  const c = (id: QuestionId, expected: string[]) => condition(v(id), expected);
  const costs = calc.issues.some(x => x.code === "COSTS_APPLICABILITY_CONTRADICTION") ? "INDETERMINATE" : na(a, "RP-F04") ? "TRUE" : c("RP-F04", ["EXPLAIN"]);
  const incomeCoherent = !calc.issues.some(x => x.code === "INCOME_CONTRADICTION");
  const margin = f.marginCoherent && incomeCoherent ? allLT(f.M, "0") : "INDETERMINATE";
  const mese = or(c("RP-A03", ["REPEATED_GAP"]), and(margin, c("RP-A03", ["COVERED", "OCCASIONAL_GAP", "REPEATED_GAP"])));
  const inventory = v<{ complete: boolean; categories: string[] }>("RP-E01"), e2 = v<{ band: string; type: string }>("RP-E02");
  const cashOnly: Truth = inventory?.complete ? inventory.categories.length === 1 && inventory.categories[0] === "CASH" ? allGT(f.L, "0") : "FALSE" : "INDETERMINATE";
  const perceivedCash: Truth = !e2 ? "INDETERMINATE" : e2.type === "UNKNOWN" && e2.band === "GE75" ? "INDETERMINATE" : e2.band === "GE75" && e2.type === "CASH" ? "TRUE" : "FALSE";
  const qualitative = and(inventory?.complete ? "TRUE" : "INDETERMINATE", or(cashOnly, perceivedCash));
  const quantitative = allGE(f.qL, "80");
  const reconcileGoals = declaredGoals(a).some(g => g.horizon.state === "VALUE") && ["NONE", "IDEA"].includes(String(v("RP-F01")));
  const common = and(allGE(f.a, "3"), c("RP-B04", ["OWN_AVAILABLE"]), c("RP-A03", ["COVERED"]), c("RP-F01", ["NONE", "IDEA"]), reconcileGoals ? "INDETERMINATE" : "TRUE", f.marginCoherent && incomeCoherent ? "TRUE" : "INDETERMINATE");
  const fermi = and(common, or(qualitative, quantitative));
  const affida = and(c("RP-F03", ["WITH_PROFESSIONAL", "DELEGATED_PROFESSIONAL"]), na(a, "RP-F04") ? "FALSE" : c("RP-F04", ["FOUND", "NOT_FOUND"]));
  const sourceOK: Truth = calc.issues.some(x => x.code === "LONGTERM_SOURCE") ? "INDETERMINATE" : "TRUE";
  const costruisce = and(c("RP-F01", ["HORIZON", "DEFINED"]), c("RP-F02", ["CHECKED"]), c("RP-F06", ["WITHIN3", "FOUR_TO12"]), c("RP-F05", ["EXPOSURE"]), costs, c("RP-A03", ["COVERED", "PLANNED_DRAW"]), allGE(f.a, "3"), c("RP-C03", ["NONE"]), sourceOK, f.marginCoherent ? "TRUE" : "INDETERMINATE");
  const profileIds: Record<keyof ProfileResult["traits"], QuestionId[]> = {
    MESE: ["RP-A01", "RP-A02", "RP-C01", "RP-C02", "RP-A03", "RP-S01", "RP-S02"],
    FERMI: ["RP-E01", "RP-E02", "RP-X04", "RP-B01", "RP-B02", "RP-B03", "RP-C01", "RP-C04", "RP-B04", "RP-A01", "RP-A02", "RP-C02", "RP-A03", "RP-F01", "RP-X06", "RP-S01", "RP-S02"],
    AFFIDA: ["RP-F03", "RP-F04", "RP-E01"],
    COSTRUISCE: ["RP-F01", "RP-F02", "RP-F06", "RP-F05", "RP-F04", "RP-E01", "RP-A03", "RP-B01", "RP-B02", "RP-B03", "RP-C01", "RP-C04", "RP-C03", "RP-X08", "RP-S01", "RP-S02"],
  };
  const truths = { MESE: mese, FERMI: fermi, AFFIDA: affida, COSTRUISCE: costruisce };
  const reasons = {
    MESE: v("RP-A03") === "REPEATED_GAP" ? "Ricorso non programmato a risparmi o credito dichiarato nella maggior parte dei mesi." : "Margine certamente negativo nel contesto dichiarato non programmato.",
    FERMI: "Riserva e contesto noti, obiettivi non ancora temporizzati, prevalenza della liquidità nel canale qualitativo e/o quantitativo indicato separatamente.",
    AFFIDA: "Modalità professionale attuale e difficoltà dichiarata nell'individuare o spiegare i costi delle posizioni applicabili.",
    COSTRUISCE: "Obiettivi temporizzati, verifica del lungo periodo, revisione recente, singolo quesito e comprensione dei costi/assenza verificata, con riserva e pagamenti secondo i criteri locali.",
  };
  const traits = Object.fromEntries(Object.entries(truths).map(([id, truth]) => [id, { truth, rule: `H-P-${id}`, reason: truth === "TRUE" ? reasons[id as keyof typeof reasons] : id === "FERMI" && reconcileGoals ? "Obiettivo temporizzato incompatibile con F01: candidato sospeso fino alla riconciliazione esplicita." : truth === "FALSE" ? "Almeno un requisito del candidato è certamente escluso dalle risposte utilizzabili." : "Dati mancanti, intervalli o coerenza non consentono di decidere tutti i requisiti del candidato.", refs: refs(a, profileIds[id as keyof typeof profileIds]), limitation: "Profilo educativo sperimentale; nessuna propensione al rischio, adeguatezza o priorità commerciale." }])) as ProfileResult["traits"];
  const matches = Object.keys(traits).filter(k => traits[k as keyof typeof traits].truth === "TRUE");
  const indeterminate = Object.values(traits).some(t => t.truth === "INDETERMINATE");
  const status = !f.completeScope ? "NOT_DETERMINABLE" : matches.length >= 2 ? "MIXED" : matches.length === 1 && !indeterminate ? "PREVALENT" : "NOT_DETERMINABLE";
  return { traits, status, profiles: f.completeScope ? matches : [], reason: !f.completeScope ? "PERIMETER_NOT_CONFIRMED" : status === "MIXED" ? "MULTIPLE_TRAITS_CONFIRMED" : status === "PREVALENT" ? "ONE_TRAIT_AND_OTHERS_EXCLUDED" : indeterminate ? "INSUFFICIENT_OR_UNRECONCILED_DATA" : "NO_PATTERN_FITS", fermi: { qualitative, quantitative, basis: qualitative === "TRUE" && quantitative === "TRUE" ? "BOTH" : qualitative === "TRUE" ? "QUALITATIVE" : quantitative === "TRUE" ? "QUANTITATIVE" : null, quantitativeStatus: !v("RP-X04") ? "NOT_DONE" : quantitative === "TRUE" ? "CONFIRMED" : quantitative === "FALSE" ? "EXCLUDED" : "INDETERMINATE", reconcileGoals } };
}
