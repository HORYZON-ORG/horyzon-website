import { question } from "./catalog.ts";
import { moneyErrors } from "./money.ts";
import type { QuestionId, Period } from "./types.ts";
export const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const code = (x: unknown, codes: readonly string[]) => typeof x === "string" && codes.includes(x);
const list = (x: unknown, codes: readonly string[], max = codes.length) => Array.isArray(x) && x.length > 0 && x.length <= max && new Set(x).size === x.length && x.every(v => code(v, codes)) && !(x.includes("NONE") && x.length > 1);
const id = (x: unknown) => typeof x === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(x) && x !== "GLOBAL";
const shape = (x: unknown, keys: readonly string[]) => object(x) && Object.keys(x).every(k => keys.includes(k));
const states = ["UNKNOWN", "DECLINED", "UNANSWERED"];
const field = (x: unknown, valid: (v: unknown) => boolean): boolean => object(x) && shape(x, ["state", "value"]) && (x.state === "VALUE" ? valid(x.value) : code(x.state, states) && x.value === undefined);
const monetary = (x: unknown, period: Period) => moneyErrors(x, period).length === 0;
const assets = ["CASH", "FINANCIAL", "HOME", "OTHER_PROPERTY", "BUSINESS", "VALUABLES", "CRYPTO", "OTHER", "PENSION"];
const exposures = ["INCOME", "SUPPORT", "HOME", "LIABILITY"];
const goalCategories = question("RP-X06").options;
const horizon = (x: unknown) => code(x, ["WITHIN12", "OVER12_TO36", "OVER36"]) || object(x) && shape(x, ["months"]) && Number.isSafeInteger(x.months) && Number(x.months) >= 0;
const goal = (x: unknown) => object(x) && shape(x, ["id", "category", "rank", "horizon", "nature", "target"]) && id(x.id) && code(x.category, goalCategories) && field(x.rank, v => [1, 2, 3].includes(v as number)) && field(x.horizon, horizon) && field(x.nature, v => code(v, ["ONCE", "CONTINUING"])) && field(x.target, v => monetary(v, "T0"));
export function validateValue(qid: QuestionId, value: unknown, version = question(qid).version): string[] {
  const q = question(qid), k = qid.slice(3);
  const keys: Record<string, string[]> = { C01: ["kinds", "openNow"], C04: ["payment", "knownChange"], E01: ["categories", "complete"], E02: ["band", "type"], X04: ["complete", "rows"], X05: ["complete", "total"], X06: version === 1 ? ["category", "horizon", "target"] : ["goals"], X08: ["source", "recency"], X09: ["minimum", "available", "collections", "allocations", "otherResources", "constraints"], X10: ["personalExperience", "expectations", "doubts"], X11: ["main", "futureInvolvement"] };
  if (keys[k] && !shape(value, keys[k])) return ["UNKNOWN_OR_INVALID_FIELD"];
  if (version !== q.version && !(k === "X06" && version === 1)) return ["QUESTION_VERSION"];
  if (["A01", "A02", "B01", "B02", "B03", "C02", "X01"].includes(k)) return moneyErrors(value, q.period!);
  let valid = false;
  if (["S01", "S02", "S04", "A03", "A04", "A05", "B04", "C03", "E03", "E04", "F01", "F02", "F03", "F04", "F05", "F06", "X07"].includes(k)) valid = code(value, q.options);
  if (["S03", "D01", "X02"].includes(k)) valid = list(value, q.options);
  if (k === "C01") valid = object(value) && list(value.kinds, q.options) && (value.openNow === undefined || typeof value.openNow === "boolean") && !(Array.isArray(value.kinds) && value.kinds.includes("NONE") && value.openNow === true);
  if (k === "C04") valid = object(value) && monetary(value.payment, "Tnow") && field(value.knownChange, v => code(v, ["YES", "NO"]));
  if (k === "D02") valid = object(value) && Object.keys(value).length > 0 && Object.entries(value).every(([key, v]) => exposures.includes(key) && field(v, s => code(s, q.options)));
  if (k === "E01") valid = object(value) && list(value.categories, [...assets, "NONE"]) && typeof value.complete === "boolean";
  if (k === "E02") valid = object(value) && code(value.band, q.options) && code(value.type, ["CASH", "PROPERTY", "BUSINESS", "FINANCIAL_ISSUER", "OTHER", "UNKNOWN"]);
  if (k === "X03") valid = object(value) && Object.entries(value).length > 0 && Object.entries(value).every(([key, row]) => exposures.includes(key) && object(row) && shape(row, ["availability", "conditions", "duration", "need"]) && ["availability", "conditions", "duration", "need"].every(d => field(row[d], v => code(v, ["CHECKED", "UNREVIEWED"])) || object(row[d]) && shape(row[d], ["state", "confirmedIrrelevant"]) && row[d].state === "NOT_APPLICABLE" && row[d].confirmedIrrelevant === true));
  if (k === "X04") valid = object(value) && typeof value.complete === "boolean" && object(value.rows) && Object.entries(value.rows).every(([key, v]) => assets.includes(key) && (field(v, m => monetary(m, "T0")) || object(v) && shape(v, ["state"]) && v.state === "NOT_APPLICABLE"));
  if (k === "X05") valid = object(value) && typeof value.complete === "boolean" && monetary(value.total, "T0");
  if (k === "X06") {
    if (version === 1) valid = object(value) && code(value.category, goalCategories) && field(value.horizon, horizon) && field(value.target, v => monetary(v, "T0"));
    else if (object(value) && Array.isArray(value.goals)) {
      const gs = value.goals;
      const ranks = gs.filter(g => object(g) && object(g.rank) && g.rank.state === "VALUE").map(g => (g.rank as Record<string, unknown>).value);
      valid = gs.length > 0 && gs.length <= 3 && gs.every(goal) && new Set(gs.map(g => g.id)).size === gs.length && new Set(ranks).size === ranks.length;
    }
  }
  if (k === "X08") valid = object(value) && field(value.source, v => code(v, q.options)) && field(value.recency, v => code(v, ["WITHIN12", "OVER12"]));
  if (k === "X09") valid = object(value) && field(value.minimum, v => monetary(v, "T0")) && field(value.available, v => monetary(v, "T0")) && Array.isArray(value.allocations) && value.allocations.length <= 3 && new Set(value.allocations.map(a => object(a) ? a.goalId : null)).size === value.allocations.length && value.allocations.every(a => object(a) && shape(a, ["goalId", "amount"]) && id(a.goalId) && field(a.amount, v => monetary(v, "T0"))) && Array.isArray(value.otherResources) && value.otherResources.length <= 3 && value.otherResources.every(a => object(a) && shape(a, ["goalId", "asset"]) && (a.goalId === "GLOBAL" || id(a.goalId)) && code(a.asset, assets)) && Array.isArray(value.constraints) && value.constraints.length <= 3 && new Set(value.constraints.map(c => object(c) ? c.id : null)).size === value.constraints.length && value.constraints.every(c => object(c) && shape(c, ["id", "kind", "scope", "rigidity", "access"]) && id(c.id) && code(c.kind, ["ACCESS", "PRESERVE_RESERVE", "NO_NEW_DEBT", "NO_HOME_BUSINESS", "OTHER_CLARIFY"]) && (c.scope === "GLOBAL" || id(c.scope)) && field(c.rigidity, v => code(v, ["HARD", "PREFERENCE"])) && (c.kind === "ACCESS" ? code(c.access, ["NOW", "DAYS7", "DAYS30", "BY_GOAL_HORIZON"]) : c.access === undefined));
  if (k === "X10") valid = object(value) && field(value.personalExperience, x => object(x) && shape(x, ["none", "episodes"]) && typeof x.none === "boolean" && Array.isArray(x.episodes) && x.episodes.length <= 3 && (x.none ? x.episodes.length === 0 : x.episodes.length > 0) && new Set(x.episodes.map(e => object(e) ? e.category : null)).size === x.episodes.length && x.episodes.every(e => object(e) && shape(e, ["category", "behavior", "recency"]) && code(e.category, q.options.filter(x => x !== "NONE")) && field(e.behavior, v => code(v, ["HEARD", "READ_COMPARED", "HELD_DELEGATED", "PARTICIPATED"])) && field(e.recency, v => code(v, ["WITHIN12", "OVER12"])))) && field(value.expectations, v => list(v, ["UNDERSTAND_COSTS_RISKS", "AVAILABILITY", "UNCERTAIN_RESULTS", "GUARANTEED_NO_FLUCTUATION", "HIGH_RETURN_NO_RISK_LIQUID", "NONE_DEFINED"]) && !(Array.isArray(v) && v.includes("NONE_DEFINED") && v.length > 1)) && field(value.doubts, v => list(v, ["COST", "ACCESS", "LOSS", "FUNCTION", "CONTRACT", "OTHER_CLARIFY"]));
  if (k === "X11") valid = object(value) && field(value.main, v => code(v, q.options)) && field(value.futureInvolvement, v => code(v, ["DIRECT", "TOGETHER", "CONSIDER_DELEGATION", "UNDERSTAND_FIRST", "CLARIFY"]));
  if (k === "X09" && object(value)) {
    const cs = value.collections;
    valid = valid && object(cs) && shape(cs, ["allocations", "otherResources", "constraints"]) && ["allocations", "otherResources", "constraints"].every(key => code(cs[key], ["VALUE", ...states]) && (cs[key] === "VALUE" || Array.isArray(value[key]) && value[key].length === 0));
  }
  return valid ? [] : ["INVALID_VALUE"];
}
