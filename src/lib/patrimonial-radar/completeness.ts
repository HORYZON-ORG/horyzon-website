import { known, na, value, type Answers } from "./answers.ts";
import { AREA_IDS } from "./areas.ts";
import type { Calculation } from "./indicators.ts";
import type { Area, Completeness, Field, QuestionId } from "./types.ts";
export function completeness(a: Answers, c: Calculation): Record<Area, Completeness> {
  const all = (...ids: QuestionId[]) => ids.every(id => known(a, id));
  const usable = (id: string) => c.indicators[id].usable;
  const noDebt = value<{ kinds: string[] }>(a, "RP-C01")?.kinds.includes("NONE");
  const exposure = value<string[]>(a, "RP-D01"), protections = value<Record<string, Field<string>>>(a, "RP-D02");
  const dResolved = !!exposure && !exposure.includes("NONE") && exposure.every(e => protections?.[e]?.state === "VALUE");
  const exposureCoherent = !c.issues.some(i => i.code === "DEPENDENTS_EXPOSURE");
  const inventoryCoherent = !c.issues.some(i => ["CASH_INVENTORY", "EXCLUDED_ASSET_POSITIVE", "COSTS_APPLICABILITY_CONTRADICTION"].includes(i.code));
  const costsCoherent = !c.issues.some(i => i.code === "COSTS_APPLICABILITY_CONTRADICTION");
  const blocks: Record<Area, [string, boolean, boolean][]> = {
    A: [["margin", usable("I-A01"), false], ["financing", all("RP-A03") && c.facts.marginCoherent, false], ["variability", all("RP-A04") && !c.issues.some(x => x.code === "INCOME_CONTRADICTION"), false], ["mainSource", all("RP-A05"), na(a, "RP-A05")]],
    B: [["essentialBudget", usable("I-B01.T"), false], ["freeReserve", usable("I-B01.Lf"), false], ["shock", usable("I-B03"), false]],
    C: [["presence", all("RP-C01"), false], ["historicPayments", !!noDebt || usable("I-C01"), false], ["arrears", all("RP-C03"), false], ["currentCommitments", !!noDebt || usable("I-C02"), false]],
    D: [["exposures", all("RP-D01") && exposureCoherent, false], ["protections", dResolved && exposureCoherent, na(a, "RP-D02") && exposureCoherent]],
    E: [["inventory", all("RP-E01") && inventoryCoherent, false], ["perceivedConcentration", all("RP-E02") && inventoryCoherent, na(a, "RP-E02") && inventoryCoherent], ["liquidability", all("RP-E03") && inventoryCoherent, na(a, "RP-E03") && inventoryCoherent], ["commonExposure", all("RP-E04") && inventoryCoherent, na(a, "RP-E04") && inventoryCoherent]],
    F: [["goals", all("RP-F01"), false], ["longTerm", all("RP-F02") && usable("I-F04"), false], ["decisionMode", all("RP-F03"), false], ["costs", all("RP-F04") && costsCoherent, na(a, "RP-F04") && costsCoherent], ["quiz", all("RP-F05"), false], ["review", all("RP-F06"), false]],
  };
  return Object.fromEntries(AREA_IDS.map(area => {
    const bs = blocks[area].map(([id, resolved, excluded]) => ({ id, resolved: resolved && !excluded, excluded }));
    const active = Object.values(a).filter(x => x.id.startsWith(`RP-${area}`) && x.applicability !== "NOT_APPLICABLE");
    return [area, { applicable: bs.filter(b => !b.excluded).length, resolved: bs.filter(b => b.resolved).length, visited: active.filter(x => x.state !== "UNANSWERED" && x.lifecycle === "ACTIVE").length, blocks: bs }];
  })) as Record<Area, Completeness>;
}
