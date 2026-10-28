import { refs, value, type Answers } from "./answers.ts";
import { allGE, allGT, allLT, subtract, sum, point, type Interval } from "./intervals.ts";
import type { Calculation } from "./indicators.ts";
import { usableMoney } from "./money.ts";
import type { AssessmentInput, Experience, Field, Goal, GoalCheck, GoalResult, GoalsV2, GoalV1, Money, Resources, Scope } from "./types.ts";
const unknown = { state: "UNANSWERED" } as const;
export function declaredGoals(a: Answers): Goal[] {
  if (a["RP-X06"].ref?.questionVersion === 1) {
    const legacy = value<GoalV1>(a, "RP-X06");
    return legacy ? [{ id: "legacy-x06", category: legacy.category, rank: unknown, nature: unknown, horizon: legacy.horizon, target: legacy.target }] : [];
  }
  return value<GoalsV2>(a, "RP-X06")?.goals ?? [];
}
export function evaluateGoals(input: AssessmentInput, a: Answers, calc: Calculation): GoalResult {
  const goals = declaredGoals(a), ids = new Set(goals.map(g => g.id));
  const raw = value<Resources>(a, "RP-X09"), checks: GoalCheck[] = [], missing: string[] = [], inactiveLinks: string[] = [];
  const references = refs(a, ["RP-X06", "RP-X09", "RP-X10", "RP-X11", "RP-F01", "RP-B02", "RP-B03", "RP-S01", "RP-S02"]);
  const check = (rule: string, status: GoalCheck["status"], message: string) => checks.push({ rule, status, message, refs: references });
  const f1 = value(a, "RP-F01"), timed = goals.some(g => g.horizon.state === "VALUE");
  check("R-G01", timed && ["NONE", "IDEA"].includes(String(f1)) ? "CLARIFY" : goals.length ? "COHERENT" : "INSUFFICIENT", timed && ["NONE", "IDEA"].includes(String(f1)) ? "Obiettivo temporizzato presente: riconciliare esplicitamente F01 prima di letture incompatibili." : "Righe dichiarate conservate; nessun principale o lista esaustiva inventati.");
  for (const g of goals) {
    for (const key of ["rank", "horizon", "nature", "target"] as const) if (g[key].state !== "VALUE") missing.push(`${g.id}.${key}:${g[key].state}`);
  }
  const resources: Resources | null = raw ? {
    ...raw,
    allocations: raw.allocations.filter(x => { if (!ids.has(x.goalId)) { inactiveLinks.push(`allocation:${x.goalId}`); return false; } return true; }),
    otherResources: raw.otherResources.filter(x => { if (x.goalId !== "GLOBAL" && !ids.has(x.goalId)) { inactiveLinks.push(`resource:${x.goalId}`); return false; } return true; }),
    constraints: raw.constraints.filter(x => { if (x.scope !== "GLOBAL" && !ids.has(x.scope)) { inactiveLinks.push(`constraint:${x.id}`); return false; } return true; }),
  } : null;
  const context = { scope: value<Scope>(a, "RP-S01"), asOf: input.asOf };
  const amount = (x: Field<Money> | undefined): Interval | null => x?.state === "VALUE" && calc.facts.completeScope ? usableMoney(x.value, context, "T0") : null;
  const Cmin = amount(raw?.minimum), G0 = amount(raw?.available), L = calc.facts.L, P = calc.facts.P;
  if (Cmin && L && P && calc.facts.completeScope) {
    const aboveL = allGT(subtract(Cmin, L), "0"), belowP = allLT(subtract(Cmin, P), "0");
    const coherent = allGE(subtract(L, Cmin), "0") === "TRUE" && allGE(subtract(Cmin, P), "0") === "TRUE";
    check("R-G02", coherent ? "COHERENT" : "CLARIFY", aboveL === "TRUE" ? "Cmin supera L: chiarire se si tratta invece di una riserva futura desiderata; non è diagnosi di insolvenza." : belowP === "TRUE" ? "La quota attuale da mantenere non include tutti gli accantonamenti P." : coherent ? "P<=Cmin<=L verificato sulle fasce dichiarate." : "Fasce non sufficienti a confermare P<=Cmin<=L; nessun punto medio.");
  } else check("R-G02", "INSUFFICIENT", "Confronto P/Cmin/L non disponibile; i vincoli qualitativi restano utilizzabili.");
  if (G0 && Cmin && L && calc.facts.completeScope) {
    const residual = subtract(subtract(L, Cmin), G0);
    check("R-G03", allGE(residual, "0") === "TRUE" ? "COHERENT" : "CLARIFY", allLT(residual, "0") === "TRUE" ? "G0 eccede la parte attuale L-Cmin. Chiarire le dichiarazioni senza tagliare o aggiungere risorse." : allGE(residual, "0") === "TRUE" ? "G0 è compatibile con L-Cmin; non è capitale investibile verificato." : "Compatibilità G0<=L-Cmin indeterminata sulle fasce.");
  } else check("R-G03", "INSUFFICIENT", "G0, Cmin o disponibilità non noti nello stesso perimetro e data; nessuna imputazione.");
  const allocations = resources?.allocations ?? [], amounts = allocations.map(x => amount(x.amount));
  if (G0 && allocations.length && amounts.every(x => x)) {
    const total = amounts.reduce<Interval>((acc, x) => sum(acc, x!), point("0"));
    const remaining = subtract(G0, total);
    check("R-G04", allGE(remaining, "0") === "TRUE" ? "COHERENT" : "CLARIFY", allLT(remaining, "0") === "TRUE" ? "Le attribuzioni G_i superano il medesimo G0 attuale; nessuna redistribuzione o priorità automatica." : allGE(remaining, "0") === "TRUE" ? "Le attribuzioni esplicite rispettano l'unico bacino G0." : "Le fasce non decidono la compatibilità delle attribuzioni con G0.");
  } else check("R-G04", "INSUFFICIENT", "Attribuzioni non espresse o incomplete; non equivalgono a zero e non sono ripartite in parti uguali.");
  if (resources) {
    const inventory = value<{ complete: boolean; categories: string[] }>(a, "RP-E01");
    if (inventory?.complete && resources.otherResources.some(r => !inventory.categories.includes(r.asset))) check("R-G03-RESOURCE-REFERENCE", "CLARIFY", "Una categoria da riesaminare non compare nell'inventario completo: chiarire il riferimento, senza aggiungerne il valore a G0.");
    for (const key of ["allocations", "otherResources", "constraints"] as const) if (resources.collections[key] !== "VALUE") missing.push(`X09.${key}:${resources.collections[key]}`);
    for (const key of ["minimum", "available"] as const) if (resources[key].state !== "VALUE") missing.push(`X09.${key}:${resources[key].state}`);
    for (const x of resources.allocations) if (x.amount.state !== "VALUE") missing.push(`${x.goalId}.allocation:${x.amount.state}`);
  } else missing.push(`X09:${a["RP-X09"].state}`);
  const experience = value<Experience>(a, "RP-X10");
  if (experience) for (const key of ["personalExperience", "expectations", "doubts"] as const) if (experience[key].state !== "VALUE") missing.push(`X10.${key}:${experience[key].state}`);
  const serviceUtility = value<{ main: Field<string>; futureInvolvement: Field<string> }>(a, "RP-X11");
  if (serviceUtility) for (const key of ["main", "futureInvolvement"] as const) if (serviceUtility[key].state !== "VALUE") missing.push(`X11.${key}:${serviceUtility[key].state}`);
  const expectations = experience?.expectations;
  const unrealisticWish = expectations?.state === "VALUE" && expectations.value.some(x => ["GUARANTEED_NO_FLUCTUATION", "HIGH_RETURN_NO_RISK_LIQUID"].includes(x));
  check("R-G05", unrealisticWish ? "CLARIFY" : experience || serviceUtility ? "COHERENT" : "INSUFFICIENT", unrealisticWish ? "Chiarire le aspettative espresse su certezza, accesso e rischio; non sono capacità effettiva o esiti del quiz." : "Esperienza personale, aspettative e partecipazione futura restano distinte dalle modalità attuali e dai dati economici.");
  const definitions = goals.map(g => {
    const absent: string[] = (["rank", "horizon", "nature", "target"] as const).filter(key => g[key].state !== "VALUE");
    if (g.target.state === "VALUE" && !usableMoney(g.target.value, context, "T0")) absent.push("targetContext");
    if (g.category === "OTHER_CLARIFY") absent.push("categoryDetail");
    return { goalId: g.id, status: absent.length ? "TO_CLARIFY" as const : "DEFINED_FOR_DISCUSSION" as const, missing: absent, refs: refs(a, ["RP-X06"]), limitation: "Definizione per il colloquio; non finanziabilità o capitale equivalente di un'esigenza continuativa." };
  });
  return { goals, definitions, prioritized: goals.filter(g => g.rank.state === "VALUE").sort((x, y) => (x.rank as { state: "VALUE"; value: number }).value - (y.rank as { state: "VALUE"; value: number }).value), resources, experience, serviceUtility, checks, missing, inactiveLinks, catalogMatching: "DEFERRED_OUT_OF_SCOPE" };
}
