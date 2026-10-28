import { known, na, refs, value, type Answers } from "./answers.ts";
import { allGE, allGT, allLT, and, or, type Truth } from "./intervals.ts";
import type { Calculation } from "./indicators.ts";
import { VERSIONS } from "./versions.ts";
import type { Area, AreaResult, AreaState, Evidence, Field, QuestionId } from "./types.ts";
export const AREA_IDS: Area[] = ["A", "B", "C", "D", "E", "F"];
export const condition = (x: unknown, allowed: readonly unknown[]): Truth => x === null || x === undefined ? "INDETERMINATE" : allowed.includes(x) ? "TRUE" : "FALSE";
export function evaluateAreas(a: Answers, calc: Calculation): { areas: Record<Area, AreaResult>; evidence: Evidence[] } {
  const { facts: f, indicators: i, issues } = calc, evidence: Evidence[] = [];
  const v = <T,>(id: QuestionId) => value<T>(a, id);
  const definitions: Record<Area, QuestionId[]> = {
    A: ["RP-A01", "RP-A02", "RP-A03", "RP-A04", "RP-A05", "RP-C01", "RP-C02", "RP-S01", "RP-S02"],
    B: ["RP-B01", "RP-B02", "RP-B03", "RP-B04", "RP-C01", "RP-C04", "RP-S01", "RP-S02"],
    C: ["RP-C01", "RP-C02", "RP-C03", "RP-C04", "RP-A01", "RP-A02", "RP-A03", "RP-X02", "RP-S01", "RP-S02"],
    D: ["RP-D01", "RP-D02", "RP-X03", "RP-S04"], E: ["RP-E01", "RP-E02", "RP-E03", "RP-E04", "RP-B01", "RP-B02", "RP-B03", "RP-C01", "RP-C03", "RP-C04", "RP-X04", "RP-X05", "RP-S01", "RP-S02"],
    F: ["RP-F01", "RP-F02", "RP-F03", "RP-F04", "RP-F05", "RP-F06", "RP-E01", "RP-X08"],
  };
  const matches: Record<Area, { state: AreaState; ev: Evidence }[]> = { A: [], B: [], C: [], D: [], E: [], F: [] };
  function add(area: Area, state: AreaState, rule: string, text: string, indicators: string[], priority: 1 | 2 | 3 | 4 = 4, dedupe = rule) {
    const kind = state === "PRESIDI_DICHIARATI" ? "FAVORABLE" : state === "STRUTTURA_DESCRITTA" ? "NEUTRAL" : state === "NON_VALUTABILE" ? "MISSING" : "VULNERABILITY";
    const ev: Evidence = { id: `${rule}:${area}`, rule, ruleVersion: VERSIONS.rules, area, kind, text, limitation: "Regola educativa Horyzon sperimentale; dichiarazioni non verificate, nessuna certificazione o proposta finanziaria.", refs: refs(a, definitions[area]), indicators, priority, dedupe };
    matches[area].push({ state, ev }); evidence.push(ev);
  }
  const a3 = v<string>("RP-A03"), a4 = v<string>("RP-A04"), b4 = v<string>("RP-B04"), c3 = v<string>("RP-C03");
  const marginOK = f.marginCoherent && !issues.some(x => x.code === "INCOME_CONTRADICTION");
  const neg = marginOK ? allLT(f.M, "0") : "INDETERMINATE";
  const pos = marginOK ? allGT(f.M, "0") : "INDETERMINATE";
  const crosses = !!f.M && neg !== "TRUE" && pos !== "TRUE" && marginOK;
  if (a3 === "REPEATED_GAP" || neg === "TRUE" && a3 && a3 !== "PLANNED_DRAW") add("A", "ATTENZIONE", "R-A-01", a3 === "REPEATED_GAP" ? "Ricorso non programmato a risparmi o credito nella maggior parte dei mesi." : "Uscite non coperte dalle entrate recenti.", ["I-A01"], 2, "CASH_DEFICIT");
  if (crosses || neg === "TRUE" && (!a3 || a3 === "PLANNED_DRAW") || a3 === "OCCASIONAL_GAP" || a4 === "UNPREDICTABLE") add("A", "DA_APPROFONDIRE", "R-A-02", "Chiarire margine, variabilità o uso del patrimonio; un prelievo programmato non prova una crisi.", ["I-A01", "I-A04"], 4);
  if (pos === "TRUE" && a3 === "COVERED" && ["REGULAR", "PREDICTABLE_VARIABLE"].includes(a4 ?? "") && known(a, "RP-A05") && f.completeScope) add("A", "PRESIDI_DICHIARATI", "R-A-03", "Avanzo recente e contesto delle entrate dichiarati.", ["I-A01", "I-A03"]);
  if (allLT(f.a, "1") === "TRUE" || b4 === "CANNOT_PAY") add("B", "ATTENZIONE", "R-B-01", b4 === "CANNOT_PAY" ? "Difficoltà dichiarata ad affrontare lo scenario imprevisto entro 30 giorni." : "Riserva libera inferiore a un mese del fabbisogno essenziale corrente.", ["I-B01", "I-B03"], b4 === "CANNOT_PAY" ? 1 : 2);
  if (f.a && allLT(f.a, "1") !== "TRUE" && allGE(f.a, "3") !== "TRUE" || ["EARMARKED", "SELL_OR_BORROW"].includes(b4 ?? "")) add("B", "DA_APPROFONDIRE", "R-B-02", "Autonomia intermedia o incerta sulle soglie, oppure risorse da reperire nello scenario.", ["I-B01", "I-B03"], 2);
  if (allGE(f.a, "3") === "TRUE" && b4 === "OWN_AVAILABLE" && i["I-B03"].usable) add("B", "PRESIDI_DICHIARATI", "R-B-03", "Riserva dichiarata di almeno tre mesi ai costi essenziali attuali e disponibilità nello scenario.", ["I-B01", "I-B03"]);
  const debt = v<{ kinds: string[] }>("RP-C01"), noDebt = debt?.kinds.includes("NONE");
  const c4 = v<{ knownChange: Field<string> }>("RP-C04");
  const changed = c4?.knownChange.state === "VALUE" ? c4.knownChange.value : null;
  const extra = v<string[]>("RP-X02"), hasExtra = !!extra?.some(x => x !== "NONE");
  if (c3 === "CURRENT" || allGT(f.R12, "0") === "TRUE" && neg === "TRUE" && a3 && a3 !== "PLANNED_DRAW") add("C", "ATTENZIONE", "R-C-01", c3 === "CURRENT" ? "Ritardi di pagamento attualmente dichiarati, anche senza prestiti." : "Rate pagate in un contesto di disavanzo non programmato.", ["I-C03", "I-A01", "I-C01"], c3 === "CURRENT" ? 1 : 2, c3 === "CURRENT" ? "CURRENT_ARREARS" : "CASH_DEFICIT");
  const currentUninterpretable = !!debt && !noDebt && !!c4 && f.completeScope && !i["I-C02"].usable;
  if (c3 === "RESOLVED" || changed === "YES" || hasExtra || !noDebt && !!debt && crosses || currentUninterpretable) add("C", "DA_APPROFONDIRE", "R-C-02", "Verificare ritardi risolti, impegni attuali, variazioni note o condizioni ulteriori; nessuna soglia automatica sul rapporto rate/reddito.", ["I-C01", "I-C02", "I-C03", "I-A01"], 3);
  if (noDebt && c3 === "NONE" || debt && !noDebt && f.completeScope && f.R12 && f.Rnow && f.Y && i["I-C01"].usable && i["I-C02"].usable && c3 === "NONE" && marginOK && allGE(f.M, "0") === "TRUE" && changed === "NO" && !hasExtra) add("C", "PRESIDI_DICHIARATI", "R-C-03", noDebt ? "Assenza esplicita di prestiti e ritardi dichiarati; conclusione limitata a C." : "Rate e contesto recente descritti, senza ritardi o cambiamenti dichiarati.", ["I-C01", "I-C02", "I-C03", "I-A01"]);
  const exposure = v<string[]>("RP-D01"), protections = v<Record<string, Field<string>>>("RP-D02");
  const activeProtections = exposure?.filter(e => e !== "NONE").map(e => protections?.[e]);
  const limits = v<Record<string, Record<string, Field<string>>>>("RP-X03");
  const limitGap = exposure?.some(e => Object.values(limits?.[e] ?? {}).some(c => c.state === "VALUE" && c.value === "UNREVIEWED"));
  if (activeProtections?.some(p => p?.state === "VALUE" && ["GAP", "UNREVIEWED"].includes(p.value)) || limitGap) add("D", "DA_APPROFONDIRE", "R-D-01", "Una strategia o un limite pertinente è dichiarato da verificare.", ["I-D01", "I-D02"], 3);
  if (activeProtections?.length && activeProtections.every(p => p?.state === "VALUE" && p.value === "CHECKED") && !limitGap && !issues.some(x => x.code === "DEPENDENTS_EXPOSURE")) add("D", "PRESIDI_DICHIARATI", "R-D-02", "Strategie per le esposizioni individuate dichiarate controllate; adeguatezza non verificata.", ["I-D01", "I-D02"]);
  const e2 = v<{ band: string; type: string }>("RP-E02"), e3 = v<string>("RP-E03"), e4 = v<string>("RP-E04");
  const concentration: Truth = na(a, "RP-E02") ? "FALSE" : !e2 ? "INDETERMINATE" : e2.band !== "GE75" || e2.type === "CASH" ? "FALSE" : e2.type === "UNKNOWN" ? "INDETERMINATE" : "TRUE";
  const common: Truth = na(a, "RP-E04") ? "FALSE" : e4 === "YES" ? "TRUE" : e4 === "NO" ? "FALSE" : "INDETERMINATE";
  const illiquid = na(a, "RP-E03") ? "FALSE" : and(condition(e3, ["LT25"]), allLT(f.a, "1"));
  const exposureSignal = or(concentration, common, illiquid);
  if (exposureSignal === "TRUE") add("E", "DA_APPROFONDIRE", "R-E-01", "Esposizione singola marcata, legame reddito/patrimonio o bassa liquidabilità insieme a riserva breve.", ["I-E03.perceived", "I-E04", "I-B01"], 3);
  const negativeNet = allLT(f.N, "0") === "TRUE", zeroWithDebt = f.zeroAssets && f.openDebt;
  if (zeroWithDebt || negativeNet) add("E", "DA_APPROFONDIRE", "R-E-02", "Attività nulle con debito aperto, oppure netto considerato negativo; non è diagnosi di insolvenza.", ["I-E01", "I-E01.A", "I-E01.D"], 3);
  const eKnown = v<{ complete: boolean }>("RP-E01")?.complete && ["RP-E01", "RP-E02", "RP-E03", "RP-E04"].every(id => known(a, id as QuestionId));
  if (!negativeNet && !zeroWithDebt && (f.zeroAssets ? !!f.D && isZeroRange(f.D) : eKnown && exposureSignal === "FALSE") && !issues.some(x => ["CASH_INVENTORY", "DUPLICATE_L", "EXCLUDED_ASSET_POSITIVE"].includes(x.code))) add("E", "STRUTTURA_DESCRITTA", "R-E-02-STRUCTURE", "Struttura dichiarata descritta; nessuna conclusione di adeguatezza, diversificazione o salute patrimoniale.", ["I-E01", "I-E03.perceived", "I-E04"]);
  const f1 = v<string>("RP-F01"), f2 = v<string>("RP-F02"), f4 = v<string>("RP-F04"), f5 = v<string>("RP-F05"), f6 = v<string>("RP-F06");
  if (["NONE", "IDEA"].includes(f1 ?? "") || ["ROUGH", "NOT_REVIEWED"].includes(f2 ?? "") || ["FOUND", "NOT_FOUND"].includes(f4 ?? "") || f5 === "COUNT" || ["OVER12", "NEVER"].includes(f6 ?? "")) add("F", "DA_APPROFONDIRE", "R-F-01", "Approfondire gli specifici obiettivi, pratiche o quesiti non ancora chiariti; nessun voto globale di conoscenza.", ["I-F01", "I-F02", "I-F03", "I-F04"]);
  if (["HORIZON", "DEFINED"].includes(f1 ?? "") && f2 === "CHECKED" && v("RP-F03") && (f4 === "EXPLAIN" || na(a, "RP-F04")) && f5 === "EXPOSURE" && ["WITHIN3", "FOUR_TO12"].includes(f6 ?? "") && i["I-F04"].usable && !issues.some(x => x.code === "COSTS_APPLICABILITY_CONTRADICTION")) add("F", "PRESIDI_DICHIARATI", "R-F-02", "Pratiche e singola risposta educativa dichiarate secondo i criteri locali.", ["I-F01", "I-F02", "I-F03", "I-F04"]);
  const areas = {} as Record<Area, AreaResult>;
  const order: AreaState[] = ["ATTENZIONE", "DA_APPROFONDIRE", "PRESIDI_DICHIARATI", "STRUTTURA_DESCRITTA", "NON_VALUTABILE"];
  for (const area of AREA_IDS) {
    if (!matches[area].length) add(area, "NON_VALUTABILE", `R-${area}-MISSING`, "Basi insufficienti o incoerenti per una valutazione locale; i singoli fatti restano disponibili.", []);
    const selected = [...matches[area]].sort((x, y) => order.indexOf(x.state) - order.indexOf(y.state))[0];
    areas[area] = { area, state: selected.state, rule: selected.ev.rule, evidenceIds: matches[area].map(m => m.ev.id) };
  }
  return { areas, evidence };
}
function isZeroRange(r: import("./intervals.ts").Interval) { return allGE(r, "0") === "TRUE" && allGT(r, "0") === "FALSE"; }
