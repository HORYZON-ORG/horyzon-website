import { QUESTION_CATALOG, QUESTION_IDS, question } from "./catalog.ts";
import { isZero, allGT } from "./intervals.ts";
import { usableMoney, periods, validDate } from "./money.ts";
import { validateValue } from "./validation.ts";
import type { AnswerRevision, AnswerState, AssessmentInput, Money, QuestionId, ResolvedAnswer, AnswerRef, Scope } from "./types.ts";
export type Answers = Record<QuestionId, ResolvedAnswer>;
export function dependencyOrder(): QuestionId[] {
  const result: QuestionId[] = [], visiting = new Set<QuestionId>();
  function visit(id: QuestionId) {
    if (visiting.has(id)) throw new Error(`Cyclic question dependency: ${id}`);
    if (result.includes(id)) return;
    visiting.add(id);
    for (const dep of question(id).dependencies) { if (!QUESTION_IDS.includes(dep)) throw new Error(`Unknown dependency ${dep}`); visit(dep); }
    visiting.delete(id); result.push(id);
  }
  QUESTION_IDS.forEach(visit); return result;
}
function latest(input: AssessmentInput): Map<QuestionId, AnswerRevision> {
  periods(input.asOf);
  const map = new Map<QuestionId, AnswerRevision>();
  for (const a of input.answers) {
    if (!QUESTION_IDS.includes(a.id) || !validDate(a.asOf) || !Number.isSafeInteger(a.revision) || a.revision <= 0 || a.revision <= (map.get(a.id)?.revision ?? 0)) throw new Error("Invalid answer identity/date/revision order");
    if (!["VALUE", "UNKNOWN", "DECLINED", "NOT_APPLICABLE", "UNANSWERED"].includes(a.state) || !a.confirmedAgainst || typeof a.confirmedAgainst !== "object") throw new Error("Invalid answer envelope");
    if (a.state !== "VALUE" && a.value !== undefined) throw new Error("Non-VALUE answer cannot carry a value");
    map.set(a.id, a);
  }
  return map;
}
const token = (a: AnswerRevision | undefined) => a ? `${a.revision}:${a.questionVersion}:${a.state}:${a.asOf}` : "ABSENT";
/** Append only: past answers and their dependency confirmations remain available to storage adapters. */
export function recordAnswer(input: AssessmentInput, id: QuestionId, state: AnswerState, value?: unknown, questionVersion = question(id).version): AssessmentInput {
  const map = latest(input);
  const confirmedAgainst = Object.fromEntries(question(id).reconfirmOn.map(dep => [dep, token(map.get(dep))]));
  const revision: AnswerRevision = { id, revision: (map.get(id)?.revision ?? 0) + 1, asOf: input.asOf, questionVersion, state, confirmedAgainst, ...(state === "VALUE" ? { value: structuredClone(value) } : {}) };
  return { asOf: input.asOf, answers: [...input.answers, revision] };
}
export function value<T = unknown>(a: Answers, id: QuestionId): T | null {
  const r = a[id];
  return r?.lifecycle === "ACTIVE" && r.state === "VALUE" && r.issues.length === 0 ? r.value as T : null;
}
export function refs(a: Answers, ids: readonly QuestionId[]): AnswerRef[] {
  return [...new Map(ids.flatMap(id => a[id]?.ref ? [[id, a[id].ref] as const] : [])).values()];
}
export const na = (a: Answers, id: QuestionId) => a[id]?.applicability === "NOT_APPLICABLE";
export const known = (a: Answers, id: QuestionId) => value(a, id) !== null || na(a, id);
function applicability(id: QuestionId, a: Answers, asOf: string): ResolvedAnswer["applicability"] {
  const v = <T,>(key: QuestionId) => value<T>(a, key);
  const noDebt = v<{ kinds: string[] }>("RP-C01")?.kinds.includes("NONE");
  const context = { scope: v<Scope>("RP-S01"), asOf };
  const lm = v<Money>("RP-B02"), ym = v<Money>("RP-A01");
  const l = lm ? usableMoney(lm, context, "T0") : null;
  const y = ym && v("RP-S02") === "COMPLETE" ? usableMoney(ym, context, "T12") : null;
  const inventory = v<{ categories: string[]; complete: boolean }>("RP-E01");
  const exposures = v<string[]>("RP-D01");
  if (["RP-C02", "RP-C04"].includes(id)) return noDebt ? "NOT_APPLICABLE" : v("RP-C01") ? "APPLICABLE" : "INDETERMINATE";
  if (id === "RP-X05") return noDebt && ["NONE", "RESOLVED"].includes(v<string>("RP-C03") ?? "") ? "NOT_APPLICABLE" : "APPLICABLE";
  if (id === "RP-B03") return l && isZero(l) ? "NOT_APPLICABLE" : "APPLICABLE";
  if (["RP-D02", "RP-X03"].includes(id)) return exposures?.includes("NONE") ? "NOT_APPLICABLE" : exposures ? "APPLICABLE" : "INDETERMINATE";
  if (id === "RP-F04") return inventory ? inventory.categories.some(x => ["FINANCIAL", "PENSION"].includes(x)) ? "APPLICABLE" : inventory.complete ? "NOT_APPLICABLE" : "INDETERMINATE" : "INDETERMINATE";
  if (["RP-A05", "RP-E04"].includes(id)) {
    if (id === "RP-E04" && inventory?.complete && inventory.categories.every(x => ["NONE", "PENSION"].includes(x)) && l && isZero(l)) return "NOT_APPLICABLE";
    if (y && isZero(y)) return "NOT_APPLICABLE";
    if (y && allGT(y, "0") === "TRUE") return "APPLICABLE";
    if (v<string[]>("RP-S03")?.includes("NONE") || v("RP-A04") === "NO_INCOME") return "NOT_APPLICABLE";
    return v("RP-S03") || v("RP-A04") ? "APPLICABLE" : "INDETERMINATE";
  }
  if (["RP-E02", "RP-E03"].includes(id)) return inventory?.complete && inventory.categories.every(x => ["NONE", "PENSION"].includes(x)) && l && isZero(l) ? "NOT_APPLICABLE" : inventory ? "APPLICABLE" : "INDETERMINATE";
  return "APPLICABLE";
}
export function resolveAnswers(input: AssessmentInput): Answers {
  const map = latest(input), out = {} as Answers;
  for (const id of dependencyOrder()) {
    const raw = map.get(id), app = applicability(id, out, input.asOf), q = question(id);
    const errors = raw?.state === "VALUE" ? validateValue(id, raw.value, raw.questionVersion) : [];
    if (id === "RP-X04" && raw?.state === "VALUE" && !errors.length) {
      const inventory = value<{ categories: string[]; complete: boolean }>(out, "RP-E01");
      const rows = (raw.value as { rows: Record<string, { state: string }> }).rows;
      for (const [category, row] of Object.entries(rows)) if (row.state === "NOT_APPLICABLE" && !(inventory?.complete && !inventory.categories.includes(category))) errors.push(`UNCONFIRMED_ROW_NOT_APPLICABLE:${category}`);
    }
    if (raw && raw.state !== "VALUE" && raw.questionVersion !== q.version && !(id === "RP-X06" && raw.questionVersion === 1)) errors.push("QUESTION_VERSION");
    const changed = !!raw && (raw.asOf !== input.asOf || q.reconfirmOn.some(dep => raw.confirmedAgainst[dep] !== token(map.get(dep)) || out[dep]?.lifecycle === "RECONFIRM"));
    if (raw?.state === "NOT_APPLICABLE" && app !== "NOT_APPLICABLE") errors.push("UNCONFIRMED_NOT_APPLICABLE");
    out[id] = { id, state: raw?.state ?? "UNANSWERED", lifecycle: app === "NOT_APPLICABLE" ? "INACTIVE" : changed ? "RECONFIRM" : "ACTIVE", applicability: app, ref: raw ? { id, revision: raw.revision, questionVersion: raw.questionVersion, asOf: raw.asOf } : null, ...(raw?.state === "VALUE" && !errors.length && !changed && app !== "NOT_APPLICABLE" ? { value: structuredClone(raw.value) } : {}), issues: errors };
  }
  return out;
}
export const ordinaryRoute = (a: Answers) => QUESTION_CATALOG.filter(q => !q.optional && a[q.id].applicability !== "NOT_APPLICABLE").map(q => q.id);
export function answerHistory(input: AssessmentInput) {
  const map = latest(input);
  return input.answers.map(a => ({ ref: { id: a.id, revision: a.revision, questionVersion: a.questionVersion, asOf: a.asOf }, state: a.state, disposition: map.get(a.id) === a ? "CURRENT" as const : "SUPERSEDED" as const }));
}
