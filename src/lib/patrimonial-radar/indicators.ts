import { value, refs, na, type Answers } from "./answers.ts";
import { allGT, allLT, compare, decimal, freeLiquidity, isPoint, isZero, point, ratio, scale, share, subtract, sum, type Interval } from "./intervals.ts";
import { usableMoney } from "./money.ts";
import { VERSIONS } from "./versions.ts";
import type { AssessmentInput, AssetClass, Field, Indicator, Issue, Money, Period, Quality, QuestionId, Scope } from "./types.ts";
export const NON_PENSION: AssetClass[] = ["CASH", "FINANCIAL", "HOME", "OTHER_PROPERTY", "BUSINESS", "VALUABLES", "CRYPTO", "OTHER"];
export interface Facts {
  Y: Interval | null; E: Interval | null; R12: Interval | null; Rnow: Interval | null;
  K: Interval | null; L: Interval | null; P: Interval | null; Lf: Interval | null; T: Interval | null;
  M: Interval | null; a: Interval | null; A: Interval | null; D: Interval | null; N: Interval | null; qL: Interval | null;
  marginCoherent: boolean; completeScope: boolean; zeroAssets: boolean; openDebt: boolean;
}
export interface Calculation { indicators: Record<string, Indicator>; facts: Facts; issues: Issue[] }
export function calculateIndicators(input: AssessmentInput, a: Answers): Calculation {
  const scope = value<Scope>(a, "RP-S01"), completeScope = !!scope && value(a, "RP-S02") === "COMPLETE";
  const context = { scope, asOf: input.asOf }, issues: Issue[] = [], indicators: Record<string, Indicator> = {};
  const v = <T,>(id: QuestionId) => value<T>(a, id);
  const issue = (code: string, ids: QuestionId[], message: string, rule = "INPUT-COHERENCE") => issues.push({ code, refs: refs(a, ids), message, rule });
  function money(m: Money | null | undefined, p: Period): Interval | null {
    return m ? usableMoney(m, context, p) : null;
  }
  const get = (id: QuestionId, p: Period) => money(v<Money>(id), p);
  const noDebt = v<{ kinds: string[] }>("RP-C01")?.kinds.includes("NONE") === true;
  const Y = get("RP-A01", "T12"), E = get("RP-A02", "T12"), K = get("RP-B01", "Tnow"), L = get("RP-B02", "T0");
  const R12 = noDebt ? point("0") : get("RP-C02", "T12");
  const current = v<{ payment: Money; knownChange: Field<string> }>("RP-C04");
  const Rnow = noDebt ? point("0") : money(current?.payment, "Tnow");
  const P = L && isZero(L) ? point("0") : get("RP-B03", "T0");
  const Lf = L && P ? freeLiquidity(L, P) : null;
  if (L && P && !Lf) issue("P_EXCEEDS_L", ["RP-B02", "RP-B03"], "Gli accantonamenti superano le disponibilità in ogni combinazione ammissibile.", "I-B01");
  if (L && isZero(L) && v("RP-B04") === "OWN_AVAILABLE") issue("SHOCK_RESOURCES", ["RP-B02", "RP-B04"], "Chiarire la disponibilità a 7 giorni rispetto allo scenario a 30 giorni.", "I-B03");
  const T = completeScope && K && Rnow ? sum(K, Rnow) : null;
  const expenses = completeScope && E && R12 ? sum(E, R12) : null;
  const M = completeScope && Y && expenses ? subtract(Y, expenses) : null;
  const coveredConflict = allLT(M, "0") === "TRUE" && v("RP-A03") === "COVERED";
  const incomeConflict = !!Y && allGT(Y, "0") === "TRUE" && (v<string[]>("RP-S03")?.includes("NONE") === true || v("RP-A04") === "NO_INCOME");
  const marginCoherent = !coveredConflict && !incomeConflict;
  if (coveredConflict) issue("MARGIN_COVERED_CONTRADICTION", ["RP-A01", "RP-A02", "RP-C01", "RP-C02", "RP-A03"], "Il margine negativo e le uscite dichiarate coperte richiedono chiarimento; le conclusioni dipendenti sono sospese.", "I-A01");
  if (incomeConflict) issue("INCOME_CONTRADICTION", ["RP-A01", "RP-S03", "RP-A04"], "Entrate positive e assenza di entrate dichiarata non coincidono.");
  const inv = v<{ categories: AssetClass[]; complete: boolean }>("RP-E01");
  if (inv?.complete && !inv.categories.includes("CASH") && L && allGT(L, "0") === "TRUE") issue("CASH_INVENTORY", ["RP-E01", "RP-B02"], "Liquidità positiva esclusa dall'inventario dichiarato completo.", "I-E01");
  const rows = v<{ complete: boolean; rows: Partial<Record<AssetClass, Field<Money>>> }>("RP-X04");
  const components: Partial<Record<AssetClass, Interval>> = {};
  for (const category of NON_PENSION) {
    const row = rows?.rows[category], amount = row?.state === "VALUE" ? money(row.value, "T0") : null;
    if (category === "CASH") { if (L) components.CASH = L; }
    else if (inv?.complete && !inv.categories.includes(category)) components[category] = point("0");
    else if (amount) components[category] = amount;
    if (category === "CASH" && amount && L && JSON.stringify(amount) !== JSON.stringify(L)) issue("DUPLICATE_L", ["RP-X04", "RP-B02"], "La riga liquidità deve riferirsi alla stessa risposta B02, non a un secondo saldo.", "I-E01");
    if (category !== "CASH" && inv?.complete && !inv.categories.includes(category) && amount && allGT(amount, "0") === "TRUE") issue("EXCLUDED_ASSET_POSITIVE", ["RP-X04", "RP-E01"], "Valore positivo per una categoria esclusa dall'inventario completo.", "I-E01");
  }
  for (const category of ["FINANCIAL", "PENSION"] as const) {
    const row = rows?.rows[category];
    const amount = row?.state === "VALUE" ? money(row.value, "T0") : null;
    if (inv?.complete && !inv.categories.includes(category) && allGT(amount, "0") === "TRUE") issue("COSTS_APPLICABILITY_CONTRADICTION", ["RP-E01", "RP-X04", "RP-F04"], "Una posizione finanziaria/previdenziale positiva contraddice l'esclusione dall'inventario; riconciliare l'applicabilità dei costi.", "I-F02");
  }
  const structuralZeroAssets = completeScope && !!inv?.complete && inv.categories.every(c => !NON_PENSION.includes(c)) && !!L && isZero(L);
  const assetCoherent = !issues.some(i => ["CASH_INVENTORY", "DUPLICATE_L", "EXCLUDED_ASSET_POSITIVE"].includes(i.code));
  const subtotal = Object.values(components).reduce((acc, r) => sum(acc, r), point("0"));
  const A = completeScope && assetCoherent && (structuralZeroAssets || rows?.complete && inv?.complete && NON_PENSION.every(c => components[c])) ? subtotal : null;
  const zeroAssets = structuralZeroAssets || !!A && isZero(A);
  const residual = v<{ total: Money; complete: boolean }>("RP-X05");
  const knownResidual = residual ? money(residual.total, "T0") : null;
  let D = completeScope && residual?.complete ? knownResidual : null;
  const c3 = v<string>("RP-C03"), openNow = v<{ openNow?: boolean }>("RP-C01")?.openNow;
  if (noDebt && (c3 === "NONE" || c3 === "RESOLVED") && completeScope) D = point("0");
  const openDebt = c3 === "CURRENT" || openNow === true || allGT(Rnow, "0") === "TRUE" || allGT(knownResidual, "0") === "TRUE";
  if (D && isZero(D) && openDebt) {
    issue("ZERO_OPEN_DEBT", ["RP-X05", "RP-C01", "RP-C03"], "Debito residuo nullo incompatibile con obblighi ancora aperti dichiarati.", "I-E01"); D = null;
  }
  const N = A && D ? subtract(A, D) : null;
  const aRange = completeScope && Lf && T ? ratio(Lf, T) : null;
  const q = (part: AssetClass[]): Interval | null => {
    if (!A || !NON_PENSION.every(c => components[c])) return null;
    const own = part.reduce((r, c) => sum(r, components[c]!), point("0"));
    const other = NON_PENSION.filter(c => !part.includes(c)).reduce((r, c) => sum(r, components[c]!), point("0"));
    const result = share(own, other); return result ? scale(result, decimal("100")) : null;
  };
  const qL = q(["CASH"]);
  const baseReason = completeScope ? "MISSING_INCOMPATIBLE_OR_UNDEFINED_DENOMINATOR" : "INCOMPLETE_OR_UNKNOWN_SCOPE";
  function missingReason(id: string): string {
    if (!completeScope) return "INCOMPLETE_OR_UNKNOWN_SCOPE";
    if (id.startsWith("I-B") && L && P && !Lf) return "INCOMPATIBLE_P_EXCEEDS_L";
    if (["I-A01.m", "I-C01", "I-C02"].includes(id) && Y && allGT(Y, "0") !== "TRUE") return "INCOME_ZERO_OR_CAN_BE_ZERO";
    if (["I-B01", "I-A04.ratio"].includes(id) && T && allGT(T, "0") !== "TRUE") return "ESSENTIAL_BUDGET_ZERO_OR_CAN_BE_ZERO";
    if (["I-A02", "I-B02"].includes(id) && expenses && allGT(expenses, "0") !== "TRUE") return "HISTORIC_EXPENSES_ZERO_OR_CAN_BE_ZERO";
    if (id === "I-E01.A" || id.startsWith("I-E02") || id.startsWith("I-E03")) return A ? "TOTAL_ASSETS_CAN_BE_ZERO" : "NON_PENSION_INVENTORY_NOT_COMPLETE_OR_COHERENT";
    if (id === "I-E01.D") return "RESIDUAL_DEBT_NOT_COMPLETE_OR_COHERENT";
    if (id === "I-E01") return !A ? "ASSETS_NOT_COMPLETE_OR_COHERENT" : "RESIDUAL_DEBT_NOT_COMPLETE_OR_COHERENT";
    return "REQUIRED_INPUT_MISSING_STALE_PARTIAL_OR_INCOMPATIBLE";
  }
  function numeric(id: string, range: Interval | null, ids: QuestionId[], formula: string, period: string, unit: string, applicable = true, usable = true, reason = baseReason) {
    const inputQuestions = [...new Set<QuestionId>(["RP-S01", "RP-S02", ...ids])];
    indicators[id] = { id, status: !applicable ? "NOT_APPLICABLE" : range ? isPoint(range) ? "POINT" : "INTERVAL" : "NOT_CALCULABLE", range: applicable ? range : null, value: null, usable: applicable && !!range && usable, reason: !applicable ? "VERIFIED_STRUCTURAL_ABSENCE" : !usable ? "UNRESOLVED_CONTRADICTION" : range ? "SELF_REPORTED_CONSERVATIVE_RANGE" : reason === baseReason ? missingReason(id) : reason, refs: refs(a, inputQuestions), inputQuestions, formula, period, unit, quality: collectQuality(ids.map(id => v(id))), ruleVersion: VERSIONS.rules };
  }
  function described(id: string, ids: QuestionId[], data: unknown, applicable = true, usable = true) {
    const hasData = data !== null && data !== undefined;
    indicators[id] = { id, status: !applicable ? "NOT_APPLICABLE" : hasData ? "DESCRIBED" : "NOT_CALCULABLE", range: null, value: hasData && applicable ? data : null, usable: applicable && hasData && usable, reason: !applicable ? "VERIFIED_STRUCTURAL_ABSENCE" : hasData ? usable ? "DECLARATION_NOT_OBJECTIVE_VERIFICATION" : "UNRESOLVED_CONTRADICTION" : "MISSING_DECLARATION", refs: refs(a, ids), inputQuestions: ids, formula: "QUALITATIVE_NO_SCORE", period: "T0 / declared reference period", unit: "DECLARATION", quality: [], ruleVersion: VERSIONS.rules };
  }
  const mInputs: QuestionId[] = ["RP-A01", "RP-A02", "RP-C01", "RP-C02", "RP-A03", "RP-S03", "RP-A04"];
  numeric("I-A01", M, mInputs, "M=Y-E-R12", "T12", "EUR/MONTH", true, marginCoherent);
  numeric("I-A01.annual", M ? scale(M, decimal("12")) : null, mInputs, "12*M", "T12", "EUR/YEAR", true, marginCoherent);
  const outToIncome = expenses && Y ? ratio(expenses, Y) : null;
  numeric("I-A01.m", outToIncome ? scale(subtract(point("1"), outToIncome), decimal("100")) : null, mInputs, "(1-(E+R12)/Y)*100", "T12", "PERCENT", true, marginCoherent);
  numeric("I-A02", Y && expenses ? ratio(Y, expenses) : null, mInputs, "Y/(E+R12)", "T12", "TIMES", true, marginCoherent);
  described("I-A03", ["RP-A05", "RP-A01", "RP-A04", "RP-S03"], v("RP-A05"), !na(a, "RP-A05"));
  const ymin = get("RP-X01", "T12");
  const minimumCoherent = !(ymin && Y && allGT(subtract(ymin, Y), "0") === "TRUE");
  if (!minimumCoherent) issue("MINIMUM_EXCEEDS_MEAN", ["RP-X01", "RP-A01"], "Minimo osservato superiore alla media dello stesso periodo.", "I-A04");
  numeric("I-A04", ymin && T ? subtract(ymin, T) : null, ["RP-X01", "RP-B01", "RP-C01", "RP-C04", "RP-A01"], "Ymin-(K+Rnow)", "T12 versus Tnow; not a forecast", "EUR/MONTH", true, minimumCoherent);
  const bInputs: QuestionId[] = ["RP-B01", "RP-B02", "RP-B03", "RP-C01", "RP-C04"];
  numeric("I-B01.Lf", completeScope ? Lf : null, bInputs, "L-P; 0<=P<=L", "T0", "EUR");
  numeric("I-B01.T", T, bInputs, "K+Rnow", "Tnow", "EUR/MONTH");
  numeric("I-B01", aRange, bInputs, "(L-P)/(K+Rnow)", "T0 / Tnow", "MONTHS");
  numeric("I-B02", Lf && expenses ? ratio(Lf, expenses) : null, [...bInputs, "RP-A02", "RP-C02"], "Lf/(E+R12)", "T0 / T12", "MONTHS", true, marginCoherent);
  described("I-B03", ["RP-B04"], v("RP-B04"), true, !issues.some(i => i.code === "SHOCK_RESOURCES"));
  for (const [id, payment, ids, period] of [["I-C01", R12, ["RP-A01", "RP-C01", "RP-C02"], "T12"], ["I-C02", Rnow, ["RP-A01", "RP-C01", "RP-C04", "RP-X02"], "Tnow / T12 proxy; not a forecast"]] as const) {
    const r = completeScope && payment && Y ? ratio(payment, Y) : null;
    numeric(id, r ? scale(r, decimal("100")) : null, [...ids, "RP-S03", "RP-A04"], "R/Y*100", period, "PERCENT", true, !incomeConflict);
  }
  described("I-C03", ["RP-C03"], c3);
  const ds = v<string[]>("RP-D01"), d2 = v<Record<string, Field<string>>>("RP-D02");
  const dMap = ds && !ds.includes("NONE") ? Object.fromEntries(ds.map(e => [e, d2?.[e] ?? { state: "UNANSWERED" }])) : ds ? { exposures: "NONE_PERCEIVED" } : null;
  described("I-D01", ["RP-D01", "RP-D02"], dMap);
  const x3 = v<Record<string, unknown>>("RP-X03");
  described("I-D02", ["RP-D01", "RP-D02", "RP-X03"], x3 && ds ? Object.fromEntries(Object.entries(x3).filter(([e]) => ds.includes(e))) : null, !na(a, "RP-X03"));
  const ei: QuestionId[] = ["RP-E01", "RP-B02", "RP-X04", "RP-X05", "RP-C01", "RP-C03"];
  numeric("I-E01.A", A, ei, "sum(non-pension classes); L counted once", "T0", "EUR");
  numeric("I-E01.D", D, ei, "current residual plus overdue, no duplication", "T0", "EUR");
  numeric("I-E01", N, ei, "N=A-D", "T0", "EUR");
  numeric("I-E01.subtotal", inv && Object.keys(components).length ? subtotal : null, ei, "known subtotal; NOT total assets", "T0", "EUR", true, assetCoherent, "NO_KNOWN_COMPONENT");
  const pension = rows?.rows.PENSION;
  numeric("I-E01.pension", pension?.state === "VALUE" ? money(pension.value, "T0") : null, ["RP-X04"], "separate restricted pension capital, excluded from A", "T0", "EUR");
  const compositionApplicable = !(A && isZero(A));
  numeric("I-E02", qL, ei, "L/(L+other assets)*100", "T0", "PERCENT", compositionApplicable);
  const shares = NON_PENSION.map(c => { const range = q([c]); numeric(`I-E03.${c}`, range, ei, `${c}/(own+other classes)*100`, "T0", "PERCENT", compositionApplicable); return range; });
  // Envelope of max shares: conservative lower bound, never an inferred issuer exposure.
  const cmax = shares.every(r => r) ? (shares as Interval[]).reduce<Interval>((acc, r) => {
    const lc = compare(acc.lower!, r.lower!), uc = compare(acc.upper!, r.upper!);
    return { lower: lc >= 0 ? acc.lower : r.lower, upper: uc >= 0 ? acc.upper : r.upper,
      lowerClosed: lc === 0 ? acc.lowerClosed && r.lowerClosed : lc > 0 ? acc.lowerClosed : r.lowerClosed,
      upperClosed: uc === 0 ? acc.upperClosed || r.upperClosed : uc > 0 ? acc.upperClosed : r.upperClosed };
  }, shares[0]!) : null;
  numeric("I-E03", cmax, ei, "max(class shares), conservative envelope; NOT issuer concentration", "T0", "PERCENT", compositionApplicable);
  numeric("I-E03.property", q(["HOME", "OTHER_PROPERTY"]), ei, "(home+other property)/(own+other classes)*100", "T0", "PERCENT", compositionApplicable);
  described("I-E03.perceived", ["RP-E02", "RP-E03"], v("RP-E02") || v("RP-E03") ? { largestExposure: v("RP-E02"), liquidity30Days: v("RP-E03") } : null, !na(a, "RP-E02"));
  described("I-E04", ["RP-E04", "RP-A05", "RP-E01"], v("RP-E04"), !na(a, "RP-E04"));
  described("I-F01", ["RP-F01", "RP-F06", "RP-X06"], v("RP-F01") || v("RP-F06") || v("RP-X06") ? { goalsLevel: v("RP-F01"), review: v("RP-F06"), goals: v("RP-X06"), goalsVersion: a["RP-X06"].ref?.questionVersion ?? null } : null);
  described("I-F02", ["RP-F03", "RP-F04"], v("RP-F03") || v("RP-F04") || na(a, "RP-F04") ? { decisionMode: v("RP-F03"), costs: v("RP-F04"), costsApplicability: a["RP-F04"].applicability } : null);
  described("I-F03", ["RP-F05", "RP-X07"], { concentration: { state: a["RP-F05"].state, answer: v("RP-F05"), outcome: v("RP-F05") ? v("RP-F05") === "EXPOSURE" ? "CORRECT" : "INCORRECT" : "UNAVAILABLE" }, arithmetic: { state: a["RP-X07"].state, answer: v("RP-X07"), outcome: v("RP-X07") ? v("RP-X07") === "20" ? "CORRECT" : "INCORRECT" : "UNAVAILABLE" } });
  if (!v("RP-F05") && !v("RP-X07")) Object.assign(indicators["I-F03"], { status: "NOT_CALCULABLE", usable: false, reason: "NO_KNOWN_QUIZ_ANSWER" });
  const x8 = v<{ source: Field<string> }>("RP-X08");
  const sourceConflict = v("RP-F02") === "CHECKED" && x8?.source.state === "VALUE" && ["UNVERIFIED", "NONE"].includes(x8.source.value);
  if (sourceConflict) issue("LONGTERM_SOURCE", ["RP-F02", "RP-X08"], "Fonte non verificata: chiedere revisione esplicita della verifica dichiarata.", "I-F04");
  described("I-F04", ["RP-F02", "RP-X08"], v("RP-F02") || v("RP-X08") ? { process: v("RP-F02"), sourceAndDate: v("RP-X08") } : null, true, !sourceConflict);
  const dependentCount = v<string>("RP-S04");
  if (dependentCount && dependentCount !== "0" && ds && !ds.includes("SUPPORT")) issue("DEPENDENTS_EXPOSURE", ["RP-S04", "RP-D01"], "Confermare l'esposizione al sostentamento delle persone economicamente dipendenti.", "I-D01");
  return { indicators, issues, facts: { Y, E, R12, Rnow, K, L, P, Lf, T, M, a: aRange, A, D, N, qL, marginCoherent, completeScope, zeroAssets, openDebt } };
}
export function collectQuality(items: unknown[]): Quality[] {
  const result = new Set<Quality>();
  function visit(item: unknown) {
    if (!item || typeof item !== "object") return;
    if ("quality" in item && ["REPORTED", "ESTIMATED", "BAND"].includes(String(item.quality))) result.add(item.quality as Quality);
    for (const child of Object.values(item)) visit(child);
  }
  items.forEach(visit); return [...result].sort();
}
