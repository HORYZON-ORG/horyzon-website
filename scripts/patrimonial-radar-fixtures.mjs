// Synthetic RP-CASES-1.2-draft inputs. Expectations are transcribed, not calculated by the engine.
import { recordAnswer, dependencyOrder } from "../src/lib/patrimonial-radar/index.ts";
export const T0 = "2026-10-18";
export const field = value => ({ state: "VALUE", value });
export const state = s => ({ state: s });
export const money = (amount, period = "T0", scope = "INDIVIDUAL", extra = {}) => ({ currency: "EUR", basis: period === "T0" ? "STOCK" : "MONTHLY", period, scope, asOf: T0, quality: "ESTIMATED", amount: String(amount), ...extra });
export const band = (lo, hi, period = "T0", scope = "INDIVIDUAL", lc = true, uc = false) => ({ currency: "EUR", basis: period === "T0" ? "STOCK" : "MONTHLY", period, scope, asOf: T0, quality: "BAND", range: { lower: String(lo), upper: hi === null ? null : String(hi), lowerClosed: lc, upperClosed: uc } });
export const set = (input, id, v, s = "VALUE", version) => recordAnswer(input, id.startsWith("RP-") ? id : `RP-${id}`, s, v, version);
export const omit = (input, ...ids) => ids.reduce((i, id) => set(i, id, undefined, "UNANSWERED"), input);
const complete = true;
export function assessment(d) {
  const scope = d.scope ?? "INDIVIDUAL", m = (v, p = "T0") => typeof v === "object" ? v : money(v, p, scope);
  const values = { S01: scope, S02: "COMPLETE", S03: ["EMPLOYEE"], S04: "0", A03: "COVERED", A04: "REGULAR", A05: "GT80", B04: "OWN_AVAILABLE", C03: "NONE", D01: ["HOME"], D02: { HOME: field("CHECKED") }, F01: "HORIZON", F02: "CHECKED", F03: "DIRECT", F05: "EXPOSURE", F06: "WITHIN3", E04: "NO", ...(d.values ?? {}) };
  for (const [id, key, p] of [["A01", "Y", "T12"], ["A02", "E", "T12"], ["B01", "K", "Tnow"], ["B02", "L", "T0"], ["B03", "P", "T0"], ["C02", "R", "T12"]]) if (d[key] !== undefined) values[id] = m(d[key], p);
  values.C01 ??= { kinds: d.R === 0 && d.D === 0 ? ["NONE"] : ["MORTGAGE"], ...(d.D > 0 ? { openNow: true } : {}) };
  if (d.R !== undefined) values.C04 = { payment: m(d.R, "Tnow"), knownChange: field("NO") };
  if (d.assets) {
    const categories = [...(d.L === 0 ? [] : ["CASH"]), ...Object.keys(d.assets)];
    values.E01 = { categories: categories.length ? categories : ["NONE"], complete };
    values.X04 = { complete, rows: Object.fromEntries(Object.entries(d.assets).map(([k, v]) => [k, typeof v === "object" && v.state ? v : field(m(v))])) };
    values.F04 = categories.some(c => ["FINANCIAL", "PENSION"].includes(c)) ? "EXPLAIN" : state("NOT_APPLICABLE");
  }
  if (d.D !== undefined && d.D !== 0) values.X05 = { complete, total: m(d.D) };
  if (d.e2) values.E02 = { band: d.e2[0], type: d.e2[1] };
  if (d.e3) values.E03 = d.e3;
  Object.assign(values, d.overrides ?? {});
  let result = { asOf: T0, answers: [] };
  for (const id of dependencyOrder()) {
    const v = values[id.slice(3)];
    if (v === undefined) continue;
    result = v?.state && v.state !== "VALUE" ? set(result, id, undefined, v.state) : set(result, id, v);
  }
  return result;
}
export const fixtures = [
  { id: "T01", Y: 1600, E: 1200, R: 0, K: 1100, L: 12000, P: 2000, assets: {}, D: 0, e2: ["GE75", "CASH"], e3: "ALL", expected: ["P/P/P/P/S/P", "COSTRUISCE", 400, 25, 9.09, 12000, 100, 0] },
  { id: "T02", scope: "HOUSEHOLD", Y: 4000, E: 2500, R: 800, K: 1800, L: 20000, P: 5000, assets: { HOME: 300000, FINANCIAL: 90000 }, D: 180000, e2: ["GE50_LT75", "PROPERTY"], e3: "GE25_LT50", values: { S04: "2", A05: "GT50_LE80", D01: ["HOME", "SUPPORT"], D02: { HOME: field("CHECKED"), SUPPORT: field("CHECKED") }, F01: "DEFINED" }, expected: ["P/P/P/P/S/P", "COSTRUISCE", 700, 17.5, 5.77, 230000, 4.88, 20] },
  { id: "T03", scope: "HOUSEHOLD", Y: 3000, E: 2000, R: 1600, K: 1500, L: 1000, P: 0, assets: { HOME: 140000 }, D: 95000, e2: ["GE75", "PROPERTY"], e3: "LT25", values: { S04: "2", A03: "REPEATED_GAP", B04: "CANNOT_PAY", C03: "CURRENT", C01: { kinds: ["MORTGAGE", "CONSUMER"], openNow: true }, D01: ["HOME", "SUPPORT"], D02: { HOME: field("CHECKED"), SUPPORT: field("GAP") }, F01: "IDEA", F02: "ROUGH" }, expected: ["A/A/A/D/D/D", "MESE", -600, -20, .32, 46000, .71, 53.33] },
  { id: "T04", Y: 4500, E: 2000, R: 0, K: 1500, L: 200000, P: 20000, assets: { FINANCIAL: 20000 }, D: 0, e2: ["GE75", "CASH"], e3: "ALL", values: { F01: "NONE", F02: "ROUGH" }, expected: ["P/P/P/P/S/D", "FERMI", 2500, 55.56, 120, 220000, 90.91, 0] },
  { id: "T05", Y: 3500, E: 2800, R: 500, K: 2000, L: 4000, P: 2000, assets: { OTHER_PROPERTY: 1200000 }, D: 100000, e2: ["GE75", "PROPERTY"], e3: "LT25", values: { S03: ["EMPLOYEE", "RENT"], A03: "OCCASIONAL_GAP", A04: "PREDICTABLE_VARIABLE", B04: "SELL_OR_BORROW", D02: { HOME: field("UNREVIEWED") }, F01: "IDEA", F02: "ROUGH" }, expected: ["D/A/P/D/D/D", null, 200, 5.71, .8, 1104000, .33, 14.29] },
  { id: "T06", Y: 5000, E: 2800, R: 200, K: 1800, L: 25000, P: 5000, assets: { FINANCIAL: 375000, OTHER_PROPERTY: 100000 }, D: 20000, e2: ["LT50", "FINANCIAL_ISSUER"], e3: "GE50_NOT_ALL", overrides: { F03: "WITH_PROFESSIONAL", F04: "NOT_FOUND" }, expected: ["P/P/P/P/S/D", "AFFIDA", 2000, 40, 10, 480000, 5, 4] },
  { id: "T07", Y: 6000, E: 3500, R: 500, K: 2500, L: 20000, P: 10000, assets: { BUSINESS: 800000, HOME: 300000 }, D: 200000, e2: ["GE50_LT75", "BUSINESS"], e3: "LT25", values: { S03: ["BUSINESS"], A04: "PREDICTABLE_VARIABLE", X02: ["GUARANTEE"], D02: { HOME: field("UNREVIEWED") }, E04: "YES" }, expected: ["P/P/D/D/D/P", "COSTRUISCE", 2000, 33.33, 3.33, 920000, 1.79, 8.33] },
  { id: "T08", Y: 2200, E: 1400, R: 0, K: 1300, L: 30000, P: 5000, assets: { HOME: 180000 }, D: 0, e2: ["GE75", "PROPERTY"], e3: "LT25", values: { S03: ["PENSION"] }, expected: ["P/P/P/P/D/P", "COSTRUISCE", 800, 36.36, 19.23, 210000, 14.29, 0] },
  { id: "T09", Y: 4000, E: 2500, R: 500, K: 1800, L: 15000, P: 3000, assets: { FINANCIAL: 15000 }, D: 20000, e2: ["GE50_LT75", "OTHER"], e3: "ALL", values: { S03: ["PROFESSIONAL"], A03: "OCCASIONAL_GAP", A04: "UNPREDICTABLE", X01: money(500, "T12"), D02: { HOME: field("UNREVIEWED") }, F01: "IDEA", F02: "ROUGH" }, expected: ["D/P/P/D/S/D", null, 1000, 25, 5.22, 10000, 50, 12.5] },
  { id: "T10", Y: 1800, E: 1400, R: 0, K: 1200, L: 6000, P: 0, assets: {}, D: 0, e2: ["GE75", "CASH"], e3: "ALL", values: { F02: "ROUGH" }, expected: ["P/P/P/P/S/D", null, 400, 22.22, 5, 6000, 100, 0] },
  { id: "T11", scope: "HOUSEHOLD", Y: band(2000, 3000, "T12", "INDIVIDUAL"), values: { S02: "PARTIAL", A02: state("UNKNOWN"), A03: state("UNKNOWN"), A04: state("UNKNOWN"), B01: state("UNKNOWN"), B02: state("DECLINED"), B04: state("UNKNOWN"), C01: state("UNKNOWN"), C03: state("UNKNOWN"), D01: state("UNKNOWN"), D02: state("UNANSWERED"), E01: state("UNKNOWN"), E04: state("UNKNOWN"), F01: "IDEA", F02: state("UNKNOWN"), F03: state("UNANSWERED"), F05: state("UNKNOWN"), F06: state("DECLINED") }, expected: ["NV/NV/NV/NV/NV/D", null] },
  { id: "T12", Y: 8000, E: 3000, R: 1000, K: 2500, L: 100000, P: 20000, assets: { FINANCIAL: 400000, HOME: 300000, OTHER_PROPERTY: 200000 }, D: 150000, e2: ["LT50", "FINANCIAL_ISSUER"], e3: "GE50_NOT_ALL", values: { F01: "NONE", F02: "NOT_REVIEWED", F06: "NEVER" }, expected: ["P/P/P/P/S/D", null, 4000, 50, 22.86, 850000, 10, 12.5] },
  { id: "T13", Y: 3000, E: 3200, R: 400, K: 2000, L: 5000, P: 1000, assets: { FINANCIAL: 15000 }, D: 30000, e2: ["GE75", "FINANCIAL_ISSUER"], e3: "GE50_NOT_ALL", values: { A03: "REPEATED_GAP", C03: "RESOLVED", D02: { HOME: field("GAP") }, F01: "IDEA", F02: "ROUGH", F03: "DELEGATED_PROFESSIONAL", F05: "COUNT", F06: "OVER12" }, overrides: { F04: "NOT_FOUND" }, expected: ["A/D/A/D/D/D", ["MESE", "AFFIDA"], -600, -20, 1.67, -10000, 25, 13.33] },
  { id: "T14", Y: band(2000, 3000, "T12"), E: band(1500, 2000, "T12"), R: band(500, 1000, "T12"), K: band(1000, 1500, "Tnow"), L: band(5000, 10000), P: 1000, values: { E01: { categories: ["CASH", "FINANCIAL"], complete }, E02: state("UNKNOWN"), E03: state("UNKNOWN"), F04: "EXPLAIN" }, expected: ["D/D/D/P/NV/P", null] },
];
// Rnow is distinct from R12 even when the numerical interval is identical.
export function buildFixture(id) {
  const d = fixtures.find(d => d.id === id); if (!d) throw new Error(id);
  let input = assessment(d);
  if (id === "T14") input = set(input, "C04", { payment: band(500, 1000, "Tnow"), knownChange: field("NO") });
  return input;
}
export const goal = (id = "goal-a", overrides = {}) => ({ id, category: "PLANNED_EXPENSE", rank: field(1), horizon: field("WITHIN12"), nature: field("ONCE"), target: field(money(8000)), ...overrides });
export const resources = (minimum, available, allocations = [], constraints = []) => ({ minimum: minimum?.state ? minimum : field(money(minimum)), available: available?.state ? available : field(money(available)), collections: { allocations: allocations.length ? "VALUE" : "UNANSWERED", otherResources: "UNANSWERED", constraints: constraints.length ? "VALUE" : "UNANSWERED" }, allocations, otherResources: [], constraints });
export const constraint = (id = "access", scope = "GLOBAL", access = "DAYS7") => ({ id, scope, kind: "ACCESS", rigidity: field("HARD"), access });
export const experience = (overrides = {}) => {
  const { none = true, episodes = [], ...parts } = overrides;
  return { personalExperience: field({ none, episodes }), expectations: state("UNANSWERED"), doubts: state("UNANSWERED"), ...parts };
};
