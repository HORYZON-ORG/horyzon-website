import { answerHistory, resolveAnswers, value } from "./answers.ts";
import { evaluateAreas } from "./areas.ts";
import { QUESTION_CATALOG } from "./catalog.ts";
import { completeness } from "./completeness.ts";
import { educationalEvidence, localFactEvidence, priorityIds } from "./evidence.ts";
import { evaluateGoals } from "./goals.ts";
import { calculateIndicators, collectQuality } from "./indicators.ts";
import { periods } from "./money.ts";
import { evaluateProfiles } from "./profiles.ts";
import { VERSIONS } from "./versions.ts";
import type { AssessmentInput, CanonicalResult, Issue, Money, Scope } from "./types.ts";
/** Pure, deterministic, JSON-safe composition. No external state or operational metadata. */
export function diagnose(input: AssessmentInput): CanonicalResult {
  const answers = resolveAnswers(input), calc = calculateIndicators(input, answers);
  const scope = value<Scope>(answers, "RP-S01"), temporal = new Set<string>();
  const inputIssues: Issue[] = [];
  for (const a of Object.values(answers)) {
    if (a.ref && a.ref.asOf !== input.asOf) {
      temporal.add("DIFFERENT_AS_OF");
      inputIssues.push({ code: "DIFFERENT_AS_OF", rule: "INPUT-TIME", refs: [a.ref], message: `${a.id}: risposta di una fotografia precedente, da riconfermare.` });
    }
    if (a.issues.length) inputIssues.push({ code: "INVALID_ANSWER", rule: "INPUT-VALIDATION", refs: a.ref ? [a.ref] : [], message: `${a.id}: ${a.issues.join(", ")}` });
    function inspect(item: unknown) {
      if (!item || typeof item !== "object") return;
      if ("currency" in item && item.currency === "EUR") {
        const m = item as Money;
        if (m.asOf !== input.asOf) { temporal.add("DIFFERENT_AS_OF"); inputIssues.push({ code: "DIFFERENT_AS_OF", rule: "INPUT-TIME", refs: a.ref ? [a.ref] : [], message: `${a.id}: dato riferito a una fotografia diversa; non riutilizzato nei confronti.` }); }
        if (scope && m.scope !== scope) inputIssues.push({ code: "DIFFERENT_SCOPE", rule: "INPUT-SCOPE", refs: a.ref ? [a.ref] : [], message: `${a.id}: perimetro monetario diverso da S01.` });
        if (m.coverage === "PARTIAL") temporal.add("PARTIAL_T12_NO_EXTRAPOLATION");
      }
      for (const child of Object.values(item)) inspect(child);
    }
    inspect(a.value);
  }
  const incoherences = [...inputIssues, ...calc.issues];
  const local = evaluateAreas(answers, calc), evidence = [...local.evidence, ...localFactEvidence(answers, calc), ...educationalEvidence(answers)];
  const goals = evaluateGoals(input, answers, calc);
  const interviewQuestions = [
    ...incoherences.map(x => ({ rule: x.rule, text: x.message, refs: x.refs })),
    ...evidence.filter(e => e.kind === "MISSING" || e.kind === "VULNERABILITY").map(e => ({ rule: e.rule, text: e.text, refs: e.refs })),
    ...goals.checks.filter(g => g.status !== "COHERENT").map(g => ({ rule: g.rule, text: g.message, refs: g.refs })),
  ];
  return {
    versions: VERSIONS, periods: periods(input.asOf), scope, scopeCoverage: value<string>(answers, "RP-S02"),
    answers: QUESTION_CATALOG.map(q => answers[q.id]), history: answerHistory(input),
    indicators: calc.indicators, areas: local.areas, evidence,
    favorable: evidence.filter(e => e.kind === "FAVORABLE").map(e => e.id), vulnerabilities: evidence.filter(e => e.kind === "VULNERABILITY").map(e => e.id), priorities: priorityIds(evidence),
    incoherences, completeness: completeness(answers, calc), quality: { precision: collectQuality(Object.values(answers).map(a => a.value)), scope: calc.facts.completeScope ? "COMPLETE_DECLARED" : "PARTIAL_OR_UNKNOWN", temporal: [...temporal].sort(), coherence: incoherences.length ? "CLARIFICATION_REQUIRED" : "NO_DETECTED_CONTRADICTION_NOT_VERIFICATION", source: "SELF_REPORTED_NOT_EXTERNALLY_VERIFIED" },
    profiles: evaluateProfiles(answers, calc), goals, interviewQuestions,
    optionalAvailability: QUESTION_CATALOG.filter(q => q.optional).map(q => ({ id: q.id, state: answers[q.id].state, lifecycle: answers[q.id].lifecycle })),
  };
}
