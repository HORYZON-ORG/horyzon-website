import type { Interval, Truth } from "./intervals.ts";
import type { VERSIONS } from "./versions.ts";
export type QuestionId = `RP-${"S01" | "S02" | "S03" | "S04" | "A01" | "A02" | "A03" | "A04" | "A05" | "B01" | "B02" | "B03" | "B04" | "C01" | "C02" | "C03" | "C04" | "D01" | "D02" | "E01" | "E02" | "E03" | "E04" | "F01" | "F02" | "F03" | "F04" | "F05" | "F06" | "X01" | "X02" | "X03" | "X04" | "X05" | "X06" | "X07" | "X08" | "X09" | "X10" | "X11"}`;
export type Scope = "INDIVIDUAL" | "HOUSEHOLD";
export type Period = "T0" | "T12" | "Tnow";
export type Quality = "REPORTED" | "ESTIMATED" | "BAND";
export type Area = "A" | "B" | "C" | "D" | "E" | "F";
export type AnswerState = "VALUE" | "UNKNOWN" | "DECLINED" | "NOT_APPLICABLE" | "UNANSWERED";
export type Field<T> = { state: "VALUE"; value: T } | { state: Exclude<AnswerState, "VALUE"> };
export interface Money {
  currency: "EUR"; basis: "MONTHLY" | "ANNUAL" | "STOCK";
  period: Period; scope: Scope; asOf: string; quality: Quality;
  coverage?: "COMPLETE" | "PARTIAL";
  amount?: string; band?: number;
  range?: { lower: string; upper: string | null; lowerClosed: boolean; upperClosed: boolean };
}
export type AssetClass = "CASH" | "FINANCIAL" | "HOME" | "OTHER_PROPERTY" | "BUSINESS" | "VALUABLES" | "CRYPTO" | "OTHER" | "PENSION";
export type Exposure = "INCOME" | "SUPPORT" | "HOME" | "LIABILITY";
export type Protection = "CHECKED" | "UNREVIEWED" | "GAP";
export interface Goal {
  id: string; category: "RESERVE" | "PLANNED_EXPENSE" | "HOUSING" | "REDUCE_DEBT" | "SUPPORT" | "WORK_CHANGE" | "LONGTERM" | "FAMILY_PASSAGE" | "OTHER_CLARIFY";
  rank: Field<1 | 2 | 3>; horizon: Field<"WITHIN12" | "OVER12_TO36" | "OVER36" | { months: number }>;
  nature: Field<"ONCE" | "CONTINUING">; target: Field<Money>;
}
export interface GoalsV2 { goals: Goal[] }
export interface GoalV1 { category: Goal["category"]; horizon: Goal["horizon"]; target: Goal["target"] }
export interface Constraint {
  id: string; kind: "ACCESS" | "PRESERVE_RESERVE" | "NO_NEW_DEBT" | "NO_HOME_BUSINESS" | "OTHER_CLARIFY";
  scope: "GLOBAL" | string; rigidity: Field<"HARD" | "PREFERENCE">;
  access?: "NOW" | "DAYS7" | "DAYS30" | "BY_GOAL_HORIZON";
}
export interface Resources {
  minimum: Field<Money>; available: Field<Money>;
  collections: { allocations: Exclude<AnswerState, "NOT_APPLICABLE">; otherResources: Exclude<AnswerState, "NOT_APPLICABLE">; constraints: Exclude<AnswerState, "NOT_APPLICABLE"> };
  allocations: { goalId: string; amount: Field<Money> }[];
  otherResources: { goalId: string; asset: AssetClass }[];
  constraints: Constraint[];
}
export interface Experience {
  personalExperience: Field<{
    episodes: { category: "CASH" | "BONDS" | "EQUITY" | "FUNDS_ETF" | "INSURANCE" | "PENSION" | "CRYPTO" | "OTHER_CLARIFY"; behavior: Field<"HEARD" | "READ_COMPARED" | "HELD_DELEGATED" | "PARTICIPATED">; recency: Field<"WITHIN12" | "OVER12"> }[];
    none: boolean;
  }>;
  expectations: Field<("UNDERSTAND_COSTS_RISKS" | "AVAILABILITY" | "UNCERTAIN_RESULTS" | "GUARANTEED_NO_FLUCTUATION" | "HIGH_RETURN_NO_RISK_LIQUID" | "NONE_DEFINED")[]>;
  doubts: Field<("COST" | "ACCESS" | "LOSS" | "FUNCTION" | "CONTRACT" | "OTHER_CLARIFY")[]>;
}
/** Unknown transport payloads must pass validation before contributing to conclusions. */
export interface AnswerRevision {
  id: QuestionId; revision: number; questionVersion: number;
  asOf: string;
  state: AnswerState; value?: unknown;
  confirmedAgainst: Partial<Record<QuestionId, string>>;
}
export interface AssessmentInput { asOf: string; answers: readonly AnswerRevision[] }
export interface QuestionDefinition {
  id: QuestionId; version: number; text: string; help: string;
  variants?: readonly { when: string; text: string }[];
  area: Area | "CONTEXT" | "GOALS"; optional: boolean; type: string;
  options: readonly string[]; optionContract: string; applicability: string;
  dependencies: readonly QuestionId[]; reconfirmOn: readonly QuestionId[];
  validations: string; unit: "EUR" | "PERSONS" | null; period: Period | null;
  indicators: readonly string[]; privacy: string;
}
export interface AnswerRef { id: QuestionId; revision: number; questionVersion: number; asOf: string }
export interface ResolvedAnswer {
  id: QuestionId; state: AnswerState; lifecycle: "ACTIVE" | "INACTIVE" | "RECONFIRM";
  applicability: "APPLICABLE" | "NOT_APPLICABLE" | "INDETERMINATE";
  ref: AnswerRef | null; value?: unknown; issues: string[];
}
export interface Periods { T0: string; T12: { start: string; end: string }; Tnow: { start: string; end: string } }
export interface Issue { code: string; refs: AnswerRef[]; message: string; rule: string }
export interface Indicator {
  id: string; status: "POINT" | "INTERVAL" | "DESCRIBED" | "NOT_CALCULABLE" | "NOT_APPLICABLE";
  range: Interval | null; value: unknown; usable: boolean; reason: string;
  refs: AnswerRef[]; inputQuestions: QuestionId[]; formula: string; period: string; unit: string;
  quality: Quality[]; ruleVersion: string;
}
export type AreaState = "ATTENZIONE" | "DA_APPROFONDIRE" | "PRESIDI_DICHIARATI" | "STRUTTURA_DESCRITTA" | "NON_VALUTABILE";
export interface Evidence {
  id: string; rule: string; ruleVersion: string; area: Area;
  kind: "FAVORABLE" | "VULNERABILITY" | "NEUTRAL" | "MISSING";
  text: string; limitation: string; refs: AnswerRef[]; indicators: string[];
  priority: 1 | 2 | 3 | 4; dedupe: string;
}
export interface AreaResult { area: Area; state: AreaState; rule: string; evidenceIds: string[] }
export interface ProfileResult {
  traits: Record<"MESE" | "FERMI" | "AFFIDA" | "COSTRUISCE", { truth: Truth; rule: string; reason: string; refs: AnswerRef[]; limitation: string }>;
  status: "PREVALENT" | "MIXED" | "NOT_DETERMINABLE"; profiles: string[]; reason: string;
  fermi: { qualitative: Truth; quantitative: Truth; basis: "QUALITATIVE" | "QUANTITATIVE" | "BOTH" | null; quantitativeStatus: "NOT_DONE" | "CONFIRMED" | "EXCLUDED" | "INDETERMINATE"; reconcileGoals: boolean };
}
export interface GoalCheck { rule: string; status: "COHERENT" | "CLARIFY" | "INSUFFICIENT"; message: string; refs: AnswerRef[] }
export interface GoalResult {
  goals: Goal[]; prioritized: Goal[]; resources: Resources | null; experience: Experience | null;
  definitions: { goalId: string; status: "DEFINED_FOR_DISCUSSION" | "TO_CLARIFY"; missing: string[]; refs: AnswerRef[]; limitation: string }[];
  serviceUtility: { main: Field<string>; futureInvolvement: Field<string> } | null;
  checks: GoalCheck[]; missing: string[]; inactiveLinks: string[]; catalogMatching: "DEFERRED_OUT_OF_SCOPE";
}
export interface Completeness { applicable: number; resolved: number; visited: number; blocks: { id: string; resolved: boolean; excluded: boolean }[] }
export interface CanonicalResult {
  versions: typeof VERSIONS; periods: Periods; scope: Scope | null; scopeCoverage: string | null;
  answers: ResolvedAnswer[]; history: { ref: AnswerRef; state: AnswerState; disposition: "CURRENT" | "SUPERSEDED" }[];
  indicators: Record<string, Indicator>; areas: Record<Area, AreaResult>;
  evidence: Evidence[]; favorable: string[]; vulnerabilities: string[]; priorities: string[];
  incoherences: Issue[]; completeness: Record<Area, Completeness>;
  quality: { precision: Quality[]; scope: string; temporal: string[]; coherence: string; source: "SELF_REPORTED_NOT_EXTERNALLY_VERIFIED" };
  profiles: ProfileResult; goals: GoalResult; interviewQuestions: { rule: string; text: string; refs: AnswerRef[] }[];
  optionalAvailability: { id: QuestionId; state: AnswerState; lifecycle: ResolvedAnswer["lifecycle"] }[];
}
/** Contracts only; no projection builder or authorization is implemented in this phase. */
export interface ClientResultProjection {
  resultVersion: string; materialEvidenceIds: string[]; areas: CanonicalResult["areas"];
  vulnerabilities: string[]; incoherences: Issue[]; limitations: string[]; goals: GoalResult;
}
export interface AdvisorResultProjection extends ClientResultProjection {
  indicators: CanonicalResult["indicators"]; answerRefs: AnswerRef[];
  profiles: ProfileResult; interviewQuestions: CanonicalResult["interviewQuestions"];
}
