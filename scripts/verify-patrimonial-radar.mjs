import assert from "node:assert/strict";
import fs from "node:fs";
import { QUESTION_CATALOG, VERSIONS, diagnose, dependencyOrder, questionText, normalizeMoney, italianAmount, moneyErrors, periods, ordinaryRoute, resolveAnswers, validateValue, compare, decimal, point, interval, ratio, share, freeLiquidity, allGE, allLT, allGT, and, or } from "../src/lib/patrimonial-radar/index.ts";
import { fixtures, buildFixture, assessment, set, omit, field, state, money, band, goal, resources, constraint, experience, T0 } from "./patrimonial-radar-fixtures.mjs";
const tests = [], coverage = [];
const test = (id, fn, scope = "FULL") => tests.push({ id, fn, scope });
const run = input => diagnose(input);
const t = id => buildFixture(id);
const number = f => Number(f.numerator) / Number(f.denominator); // Assertions only; never engine arithmetic.
const range = (r, id) => r.indicators[id].range;
function exact(r, id, n) {
  const v = r.indicators[id]; assert.equal(v.status, "POINT", id); assert.equal(compare(v.range.lower, decimal(String(n))), 0, id); assert.equal(compare(v.range.upper, decimal(String(n))), 0, id);
}
function near(r, id, n) { assert.ok(range(r, id), id); assert.ok(Math.abs(number(range(r, id).lower) - n) < .00501, `${id}: ${number(range(r, id).lower)} != ${n}`); }
const nc = (r, ...ids) => ids.forEach(id => { assert.equal(r.indicators[id].status, "NOT_CALCULABLE", id); assert.equal(r.indicators[id].usable, false); });
const economic = r => ({ indicators: Object.fromEntries(Object.entries(r.indicators).filter(([id]) => !id.startsWith("I-F")).map(([id, i]) => [id, { range: i.range, status: i.status, usable: i.usable, value: i.value }])), areas: r.areas, profiles: r.profiles.profiles });
const check = (r, rule) => r.goals.checks.find(c => c.rule === rule);
const area = (r, k, state) => assert.equal(r.areas[k].state, state);
const answer = (r, id) => r.answers.find(a => a.id === `RP-${id}`);
const tr = (r, name, truth) => assert.equal(r.profiles.traits[name].truth, truth, name);
const attachGoals = (input, gs) => set(input, "X06", { goals: gs });
const assetRows = (input, rows) => set(input, "X04", { complete: true, rows: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v?.state ? v : field(typeof v === "object" ? v : money(v))])) });
const baseZero = () => assessment({ Y: 1500, E: 1000, R: 0, K: 900, L: 0, P: 0, assets: {}, D: 5000, values: { C01: { kinds: ["OTHER"], openNow: true } } });

test("catalogue/version/metadata", () => {
  assert.equal(QUESTION_CATALOG.length, 40); assert.equal(QUESTION_CATALOG.filter(q => !q.optional).length, 29);
  assert.equal(new Set(QUESTION_CATALOG.map(q => q.id)).size, 40); assert.equal(dependencyOrder().length, 40);
  assert.equal(QUESTION_CATALOG.find(q => q.id === "RP-X06").version, 2);
  assert.equal(VERSIONS.questionnaire, "RP-Q-1.2-draft"); assert.equal(VERSIONS.rules, "RP-RULES-1.2-draft");
  const doc = fs.readFileSync(new URL("../docs/patrimonial/radar-patrimoniale-v1-questionario.md", import.meta.url), "utf8");
  for (const q of QUESTION_CATALOG) { assert.ok(q.text && q.help && q.type && q.applicability && q.validations && q.privacy, q.id); assert.ok(doc.includes(q.text), q.id); assert.ok(doc.includes(q.help), q.id); }
});
const labels = { P: "PRESIDI_DICHIARATI", A: "ATTENZIONE", D: "DA_APPROFONDIRE", S: "STRUTTURA_DESCRITTA", NV: "NON_VALUTABILE" };
for (const f of fixtures) test(f.id, () => {
  const input = t(f.id), before = JSON.stringify(input), r = run(input);
  assert.deepEqual(Object.values(r.areas).map(a => a.state), f.expected[0].split("/").map(s => labels[s]));
  const profiles = f.expected[1] === null ? [] : Array.isArray(f.expected[1]) ? f.expected[1] : [f.expected[1]];
  assert.deepEqual(r.profiles.profiles, profiles);
  assert.equal(r.profiles.status, profiles.length > 1 ? "MIXED" : profiles.length ? "PREVALENT" : "NOT_DETERMINABLE");
  if (f.expected.length > 2) {
    const [, , M, m, autonomy, N, qL, dsr] = f.expected;
    exact(r, "I-A01", M); near(r, "I-A01.m", m); near(r, "I-B01", autonomy); exact(r, "I-E01", N); near(r, "I-E02", qL); near(r, "I-C01", dsr);
    exact(r, "I-E01.A", f.D + N); exact(r, "I-B01.Lf", f.L - f.P);
  }
  if (f.id === "T09") exact(r, "I-A04", -1800);
  if (f.id === "T11") { nc(r, "I-A01", "I-A01.m", "I-B01", "I-E01", "I-E02", "I-C01"); area(run(set(input, "F01", undefined, "DECLINED")), "F", "NON_VALUTABILE"); }
  if (f.id === "T14") {
    for (const [id, lo, hi, lc, uc] of [["I-A01", -1000, 1000, false, false], ["I-B01.Lf", 4000, 9000, true, false], ["I-B01.T", 1500, 2500, true, false], ["I-B01", 1.6, 6, false, false]]) {
      const v = range(r, id); assert.equal(compare(v.lower, decimal(String(lo))), 0); assert.equal(compare(v.upper, decimal(String(hi))), 0); assert.equal(v.lowerClosed, lc, id); assert.equal(v.upperClosed, uc, id);
    }
    near(r, "I-A01.m", -50); near(r, "I-C01", 16.6666667); nc(r, "I-E01", "I-E02");
  }
  assert.deepEqual(run(input), r); assert.equal(JSON.stringify(input), before);
  assert.doesNotThrow(() => JSON.stringify(r)); assert.ok(!JSON.stringify(r).includes("Infinity"));
  for (const i of Object.values(r.indicators)) for (const ref of i.refs) assert.ok(input.answers.some(a => a.id === ref.id && a.revision === ref.revision && a.questionVersion === ref.questionVersion));
});

test("G01", () => {
  const base = set(t("T04"), "F01", "HORIZON");
  const a = set(attachGoals(base, [goal("near", { horizon: field("WITHIN12") })]), "X09", resources(50000, 20000, [], [constraint("access", "near")]));
  const b = set(attachGoals(base, [goal("long", { horizon: field("OVER36") })]), "X09", resources(50000, 20000));
  const ra = run(set(a, "X11", { main: field("RESOURCES_CONSTRAINTS"), futureInvolvement: field("DIRECT") }));
  const rb = run(set(b, "X11", { main: field("CLARIFY_GOALS"), futureInvolvement: field("UNDERSTAND_FIRST") }));
  for (const r of [ra, rb]) { exact(r, "I-A01", 2500); exact(r, "I-B01", 120); exact(r, "I-E01", 220000); tr(r, "FERMI", "FALSE"); }
  assert.deepEqual(economic(ra), economic(rb)); assert.equal(ra.goals.resources.constraints[0].access, "DAYS7");
});
test("G02", () => {
  const g = goal("housing", { category: "HOUSING", horizon: field("OVER12_TO36"), target: field(money(30000, "T0", "HOUSEHOLD")) });
  let a = attachGoals(t("T02"), [g]); a = set(a, "X09", { ...resources(10000, 8000), minimum: field(money(10000, "T0", "HOUSEHOLD")), available: field(money(8000, "T0", "HOUSEHOLD")) });
  let b = set(a, "B02", money(10000, "T0", "HOUSEHOLD")); b = set(b, "B03", money(5000, "T0", "HOUSEHOLD")); b = set(b, "X09", { ...resources(8000, 1000), minimum: field(money(8000, "T0", "HOUSEHOLD")), available: field(money(1000, "T0", "HOUSEHOLD")) });
  const ra = run(a), rb = run(b); for (const r of [ra, rb]) { exact(r, "I-A01", 700); exact(r, "I-C01", 20); assert.equal(check(r, "R-G03").status, "COHERENT"); }
  exact(ra, "I-E01.A", 410000); exact(rb, "I-E01.A", 400000); exact(rb, "I-E01", 220000); near(rb, "I-B01", 1.92); area(ra, "B", "PRESIDI_DICHIARATI"); area(rb, "B", "DA_APPROFONDIRE"); tr(rb, "COSTRUISCE", "FALSE");
});
function moduleOnly(L, P, gs, rs) {
  let a = { asOf: T0, answers: [] };
  for (const [id, v] of [["S01", "INDIVIDUAL"], ["S02", "COMPLETE"], ["B02", money(L)], ["B03", money(P)], ["F01", "HORIZON"]]) a = set(a, id, v);
  if (gs) a = attachGoals(a, gs); if (rs) a = set(a, "X09", rs); return a;
}
test("G03", () => {
  let a = moduleOnly(30000, 5000, [goal()], resources(15000, 10000, [{ goalId: "goal-a", amount: field(money(8000)) }], [constraint()]));
  a = set(a, "X10", experience({ doubts: field(["ACCESS"]) })); a = set(a, "X11", { main: field("RESOURCES_CONSTRAINTS"), futureInvolvement: field("DIRECT") });
  const r = run(a); assert.equal(check(r, "R-G04").status, "COHERENT"); assert.equal(r.goals.prioritized[0].id, "goal-a"); nc(r, "I-A01", "I-B01", "I-E01");
});
test("G04", () => {
  let a = moduleOnly(40000, 5000, [goal("long", { category: "LONGTERM", horizon: field("OVER36"), nature: field("CONTINUING"), target: state("UNKNOWN") })], resources(25000, 10000, [{ goalId: "long", amount: state("UNANSWERED") }]));
  a = set(a, "X10", experience({ expectations: field(["HIGH_RETURN_NO_RISK_LIQUID"]) })); a = set(a, "X11", { main: field("INFORMATION_PROFESSIONALS"), futureInvolvement: field("UNDERSTAND_FIRST") });
  const r = run(a); assert.equal(check(r, "R-G03").status, "COHERENT"); assert.equal(check(r, "R-G04").status, "INSUFFICIENT"); assert.equal(check(r, "R-G05").status, "CLARIFY"); assert.equal(r.goals.goals[0].target.state, "UNKNOWN");
});
test("G05", () => {
  const a = moduleOnly(30000, 5000, [goal("housing", { category: "HOUSING", target: field(money(10000)) }), goal("support", { category: "SUPPORT", rank: field(2) })], resources(15000, 15000, [{ goalId: "housing", amount: field(money(10000)) }, { goalId: "support", amount: field(money(8000)) }]));
  const r = run(a); assert.equal(check(r, "R-G04").status, "CLARIFY"); assert.equal(r.goals.resources.allocations.length, 2); assert.equal(r.goals.prioritized[0].id, "housing");
});
test("G06", () => {
  let a = { asOf: T0, answers: [] }; a = set(a, "F01", undefined, "UNKNOWN"); a = set(a, "X06", undefined, "UNKNOWN"); a = set(a, "X09", undefined, "DECLINED"); a = set(a, "X11", { main: field("CLARIFY_GOALS"), futureInvolvement: field("UNDERSTAND_FIRST") });
  const r = run(a); assert.equal(r.goals.goals.length, 0); assert.equal(r.goals.resources, null); assert.equal(r.goals.experience, null); nc(r, "I-A01", "I-B01", "I-E01");
  const b = run(set(a, "F01", "NONE")); assert.equal(answer(b, "F01").state, "VALUE"); assert.equal(answer(b, "X06").state, "UNKNOWN"); assert.equal(b.goals.catalogMatching, "DEFERRED_OUT_OF_SCOPE");
});
test("G07", () => {
  let a = attachGoals(set(t("T12"), "F01", "HORIZON"), [goal("long", { horizon: field("OVER36") })]);
  a = set(a, "X09", { ...resources(100000, 0, [], [{ id: "reserve", kind: "PRESERVE_RESERVE", scope: "GLOBAL", rigidity: field("HARD") }, { id: "home", kind: "NO_HOME_BUSINESS", scope: "GLOBAL", rigidity: field("HARD") }, { id: "debt", kind: "NO_NEW_DEBT", scope: "GLOBAL", rigidity: field("HARD") }]), collections: { allocations: "UNANSWERED", otherResources: "VALUE", constraints: "VALUE" }, otherResources: [{ goalId: "long", asset: "FINANCIAL" }] });
  const r = run(a); exact(r, "I-E01", 850000); assert.equal(r.goals.resources.available.value.amount, "0"); assert.equal(check(r, "R-G03").status, "COHERENT");
});
test("G08", () => {
  let a = attachGoals(t("T01"), [goal("reserve", { category: "RESERVE" })]); a = set(a, "X09", resources(8000, 1000, [{ goalId: "reserve", amount: field(money(1000)) }])); a = set(a, "X10", experience()); a = set(a, "X11", { main: field("RESOURCES_CONSTRAINTS"), futureInvolvement: field("DIRECT") });
  const r = run(a); assert.deepEqual(economic(r), economic(run(t("T01")))); assert.equal(answer(r, "F04").applicability, "NOT_APPLICABLE"); tr(r, "COSTRUISCE", "TRUE");
});

test("CT-01", () => {
  const base = assessment({ Y: 1600, E: 1000, R: 0, K: 1000, L: 0, P: 0, D: 0, assets: {} });
  const r = run(base); exact(r, "I-B01", 0); area(r, "B", "ATTENZIONE");
  for (const s of ["UNKNOWN", "DECLINED", "UNANSWERED"]) { const x = run(set(base, "B02", undefined, s)); nc(x, "I-B01"); assert.equal(answer(x, "B02").state, s); }
});
test("CT-02", () => { const r = run(set(t("T01"), "B01", money(0, "Tnow"))); nc(r, "I-B01"); assert.notEqual(r.areas.B.state, "PRESIDI_DICHIARATI"); });
test("CT-03", () => { const r = run(set(t("T13"), "B03", money(6000))); nc(r, "I-B01.Lf", "I-B01"); assert.ok(r.incoherences.some(x => x.code === "P_EXCEEDS_L")); });
test("CT-04", () => {
  for (const [L, expected] of [[999, "ATTENZIONE"], [1000, "DA_APPROFONDIRE"], [2999, "DA_APPROFONDIRE"], [3000, "PRESIDI_DICHIARATI"]]) { const r = run(assessment({ Y: 1600, E: 1000, R: 0, K: 1000, L, P: 0, D: 0 })); exact(r, "I-B01", String(L / 1000)); area(r, "B", expected); }
});
test("CT-05", () => { const r = run(assessment({ Y: 0, E: 500, R: 100, K: 500, L: 1000, P: 0, D: 1000, values: { A03: "REPEATED_GAP", A04: "NO_INCOME", S03: ["NONE"] } })); exact(r, "I-A01", -600); nc(r, "I-A01.m", "I-C01", "I-C02"); });
test("CT-06", () => {
  let a = assessment({ Y: 0, E: 500, R: 0, K: 500, L: 0, P: 0, assets: {}, D: 0, values: { A03: "REPEATED_GAP", A04: "NO_INCOME", S03: ["NONE"] } });
  const before = run(a); area(before, "C", "PRESIDI_DICHIARATI"); nc(before, "I-C01"); exact(before, "I-E01.D", 0);
  a = set(a, "C03", "CURRENT"); const after = run(a); area(after, "C", "ATTENZIONE"); nc(after, "I-E01.D", "I-E01"); area(after, "A", "ATTENZIONE"); area(after, "B", "ATTENZIONE");
});
test("CT-07", () => {
  let a = t("T06"); const length = a.answers.length; a = set(a, "C01", { kinds: ["NONE"] }); const middle = run(a); assert.equal(answer(middle, "C02").lifecycle, "INACTIVE"); exact(middle, "I-C01", 0);
  a = set(a, "C01", { kinds: ["MORTGAGE"], openNow: true }); const after = run(a); for (const id of ["C02", "C04", "X05"]) assert.equal(answer(after, id).lifecycle, "RECONFIRM"); nc(after, "I-A01", "I-C01", "I-E01"); assert.equal(a.answers.length, length + 2); assert.ok(after.history.some(h => h.disposition === "SUPERSEDED"));
});
test("CT-08", () => { const r = run(attachGoals(set(t("T04"), "F01", "HORIZON"), [goal()])); tr(r, "FERMI", "FALSE"); exact(r, "I-B01", 120); });
test("CT-09", () => { const r = run(set(t("T06"), "F03", "DIRECT")); tr(r, "AFFIDA", "FALSE"); area(r, "F", "DA_APPROFONDIRE"); });
test("CT-10", () => { const before = run(t("T07")), after = run(assetRows(t("T07"), { BUSINESS: 1000000, HOME: 300000 })); exact(after, "I-E01.A", 1320000); exact(after, "I-E01", 1120000); assert.deepEqual(range(after, "I-B01"), range(before, "I-B01")); area(after, "E", "DA_APPROFONDIRE"); });
test("CT-11", () => { const r = run(assessment({ Y: 2000, E: 2500, R: 0, K: 1300, L: 30000, P: 5000, D: 0, assets: { HOME: 180000 }, values: { S03: ["PENSION"], A03: "PLANNED_DRAW" } })); exact(r, "I-A01", -500); tr(r, "MESE", "FALSE"); area(r, "A", "DA_APPROFONDIRE"); });
test("CT-12", () => { const r = run(assessment({ Y: 2000, E: 1500, R: 0, K: 1000, L: 10000, P: 0, D: 0, assets: { FINANCIAL: state("UNKNOWN"), HOME: 200000 } })); exact(r, "I-E01.subtotal", 210000); nc(r, "I-E01.A", "I-E01", "I-E02", "I-E03"); });
test("CT-13", () => {
  const a = baseZero(), r = run(a); exact(r, "I-E01", -5000); assert.equal(r.indicators["I-E02"].status, "NOT_APPLICABLE"); area(r, "E", "DA_APPROFONDIRE");
  const unknownDebt = omit(a, "X05"); const rd = run(unknownDebt); nc(rd, "I-E01"); area(rd, "E", "DA_APPROFONDIRE");
  const unresolved = run(set(unknownDebt, "C01", undefined, "UNKNOWN")); area(unresolved, "E", "NON_VALUTABILE");
  const zero = run(set(set(unknownDebt, "C01", { kinds: ["NONE"] }), "C03", "NONE")); exact(zero, "I-E01", 0); area(zero, "E", "STRUTTURA_DESCRITTA"); assert.equal(zero.completeness.E.applicable, 1); assert.equal(zero.completeness.E.resolved, 1);
});
test("CT-14", () => { const r = run(set(t("T13"), "A03", "COVERED")); assert.ok(r.incoherences.some(i => i.code === "MARGIN_COVERED_CONTRADICTION")); assert.equal(r.indicators["I-A01"].usable, false); tr(r, "MESE", "INDETERMINATE"); assert.notEqual(r.areas.A.state, "PRESIDI_DICHIARATI"); assert.equal(r.indicators["I-C01"].usable, true); exact(r, "I-E01", -10000); });
test("CT-15", () => { const a = run(set(t("T01"), "F05", undefined, "UNKNOWN")), b = run(set(t("T01"), "F05", "COUNT")); assert.equal(a.indicators["I-F03"].value.concentration.outcome, "UNAVAILABLE"); assert.equal(b.indicators["I-F03"].value.concentration.outcome, "INCORRECT"); area(a, "F", "NON_VALUTABILE"); area(b, "F", "DA_APPROFONDIRE"); assert.equal("score" in b, false); });
test("CT-16", () => { const a = t("T02"), b = set(a, "E02", { band: "GE75", type: "PROPERTY" }); area(run(a), "E", "STRUTTURA_DESCRITTA"); area(run(b), "E", "DA_APPROFONDIRE"); assert.deepEqual(range(run(a), "I-E01"), range(run(b), "I-E01")); });
test("CT-17", () => {
  let a = assetRows(t("T04"), { FINANCIAL: band(40000, 60000) }); let r = run(a); assert.equal(r.profiles.fermi.quantitative, "INDETERMINATE"); tr(r, "FERMI", "TRUE"); assert.equal(r.profiles.fermi.basis, "QUALITATIVE");
  r = run(set(a, "E02", undefined, "UNKNOWN")); tr(r, "FERMI", "INDETERMINATE");
  a = set(t("T04"), "B01", band(50000, 100000, "Tnow")); r = run(a); tr(r, "FERMI", "INDETERMINATE");
  r = run(set(a, "F01", "HORIZON")); tr(r, "FERMI", "FALSE");
});
test("CT-18", () => { const a = t("T13"); assert.deepEqual(run({ ...a, attendance: true, eventProfile: "COSTRUISCE" }), run({ ...a, attendance: false, eventProfile: "FERMI" })); });
test("CT-19", () => { const a = t("T02"); const r = run({ ...a, asOf: "2026-11-18" }); nc(r, "I-A01", "I-B01", "I-E01"); assert.ok(r.incoherences.some(i => i.code === "DIFFERENT_AS_OF")); const p = run(set(a, "S01", "INDIVIDUAL")); nc(p, "I-A01", "I-E01"); assert.equal(answer(p, "A01").lifecycle, "RECONFIRM"); });
test("CT-20", () => { const a = run(set(t("T01"), "X07", "20")), b = run(set(t("T01"), "X07", "200")); assert.deepEqual(economic(a), economic(b)); assert.deepEqual(a.areas, b.areas); assert.equal(b.indicators["I-F03"].value.arithmetic.outcome, "INCORRECT"); assert.ok(b.evidence.some(e => e.rule === "H-COST-EXERCISE")); });
test("CT-21", () => { const r = run(omit(t("T04"), "X04")); tr(r, "FERMI", "TRUE"); assert.equal(r.profiles.fermi.basis, "QUALITATIVE"); assert.equal(r.profiles.fermi.quantitativeStatus, "NOT_DONE"); area(r, "E", "STRUTTURA_DESCRITTA"); nc(r, "I-E01.A", "I-E01", "I-E02"); exact(r, "I-A01", 2500); exact(r, "I-B01", 120); });
test("CT-22", () => {
  let a = set(omit(t("T04"), "X04"), "E02", undefined, "UNKNOWN"); tr(run(a), "FERMI", "INDETERMINATE"); a = assetRows(a, { FINANCIAL: 20000 }); const r = run(a); tr(r, "FERMI", "TRUE"); assert.equal(r.profiles.fermi.basis, "QUANTITATIVE"); area(r, "E", "NON_VALUTABILE");
  const b = assessment({ Y: 4500, E: 2000, R: 0, K: 1500, L: 79000, P: 0, assets: { FINANCIAL: 21000 }, D: 0, e2: ["GE75", "CASH"], e3: "ALL", values: { F01: "NONE", F02: "ROUGH" } }); const rb = run(b); exact(rb, "I-E02", 79); assert.equal(rb.profiles.fermi.quantitativeStatus, "EXCLUDED"); tr(rb, "FERMI", "TRUE");
});
test("CT-23", () => { const a = baseZero(), b = set(a, "X05", { complete: true, total: money(6000) }); const r = run(a), rb = run(b); exact(r, "I-A01", 500); exact(r, "I-B01", 0); exact(rb, "I-E01", -6000); assert.deepEqual(range(r, "I-A01"), range(rb, "I-A01")); area(r, "E", "DA_APPROFONDIRE"); area(r, "B", "ATTENZIONE"); });
test("CT-24", () => { const a = t("T02"), b = set(a, "E02", undefined, "DECLINED"); area(run(a), "E", "STRUTTURA_DESCRITTA"); area(run(b), "E", "NON_VALUTABILE"); assert.deepEqual(range(run(a), "I-E01"), range(run(b), "I-E01")); });
test("CT-25", () => { let a = omit(t("T04"), "X04"); a = set(set(a, "F03", "WITH_PROFESSIONAL"), "F04", "NOT_FOUND"); const r = run(a); assert.equal(r.profiles.status, "MIXED"); assert.deepEqual(r.profiles.profiles, ["FERMI", "AFFIDA"]); a = attachGoals(set(a, "F01", "HORIZON"), [goal()]); assert.deepEqual(run(a).profiles.profiles, ["AFFIDA"]); });
test("CT-26", () => { const r = run(baseZero()); assert.ok(r.vulnerabilities.some(id => r.evidence.find(e => e.id === id)?.area === "E")); exact(r, "I-E01", -5000); assert.ok(r.evidence.some(e => e.rule === "R-E-02" && e.refs.some(ref => ref.id === "RP-X05"))); }, "PARTIAL: canonical material facts; projections deferred");
coverage.push({ id: "CT-27", status: "NOT_RUN", reason: "Authorization/assignment/revocation require future server identity and access contracts; no auth implementation in 4A." });
test("CT-28", () => { const a = t("T12"); assert.deepEqual(run({ ...a, commission: 10000, productCatalog: [{ enabled: true, sell: true }] }), run({ ...a, commission: 0, productCatalog: [] })); }, "PARTIAL: domain invariance; catalog/CRM enforcement deferred");
test("CT-29", () => {
  const g1 = goal("a"), g2 = goal("b", { rank: field(2), category: "SUPPORT" });
  let a = attachGoals(t("T01"), [g1, g2]); a = set(a, "X09", resources(8000, 2000, [{ goalId: "a", amount: field(money(1000)) }, { goalId: "b", amount: field(money(500)) }], [constraint("access", "a")]));
  const before = run(a), after = run(attachGoals(a, [{ ...g2, rank: field(1) }, { ...g1, rank: field(2) }]));
  assert.deepEqual(after.goals.resources, before.goals.resources); assert.equal(after.goals.prioritized[0].id, "b"); assert.deepEqual(economic(after), economic(before)); assert.equal(answer(after, "X09").lifecycle, "ACTIVE");
});
test("CT-30", () => { for (const s of ["VALUE", "UNKNOWN", "DECLINED", "UNANSWERED"]) { const x = s === "VALUE" ? field(money(0)) : state(s); const r = run(set(moduleOnly(30000, 5000, [goal()]), "X09", resources(15000, x))); assert.equal(r.goals.resources.available.state, s); if (s === "VALUE") assert.equal(check(r, "R-G03").status, "COHERENT"); else assert.equal(check(r, "R-G03").status, "INSUFFICIENT"); } });
test("CT-31", () => {
  const gs = [goal("a"), goal("b", { rank: field(2) })]; let a = moduleOnly(40000, 5000, gs, resources(10000, 15000, [{ goalId: "a", amount: field(money(10000)) }, { goalId: "b", amount: field(money(8000)) }])); assert.equal(check(run(a), "R-G04").status, "CLARIFY");
  a = set(a, "X09", { ...resources(10000, 15000), available: field(band(10000, 25000)), collections: { allocations: "VALUE", otherResources: "UNANSWERED", constraints: "UNANSWERED" }, allocations: [{ goalId: "a", amount: field(money(10000)) }, { goalId: "b", amount: field(money(8000)) }] }); const uncertain = check(run(a), "R-G04"); assert.equal(uncertain.status, "CLARIFY"); assert.match(uncertain.message, /fasce/);
  a = set(a, "X09", resources(10000, 15000, [{ goalId: "a", amount: field(money(10000)) }, { goalId: "b", amount: state("UNKNOWN") }])); assert.equal(check(run(a), "R-G04").status, "INSUFFICIENT");
});
test("CT-32", () => { const a = moduleOnly(40000, 5000, [goal("near"), goal("future", { rank: field(2), horizon: field("OVER36"), nature: field("CONTINUING"), target: state("UNKNOWN") })], resources(10000, 15000)); const r = run(a); assert.equal(check(r, "R-G04").status, "INSUFFICIENT"); assert.equal(r.goals.goals[1].target.state, "UNKNOWN"); assert.equal(r.goals.resources.available.value.amount, "15000"); assert.ok(!("futureCapital" in r.goals)); });
test("CT-33", () => { const a = t("T02"), before = run(a); assert.equal(before.goals.experience, null); const exp = experience({ none: false, episodes: [{ category: "FUNDS_ETF", behavior: field("HELD_DELEGATED"), recency: state("UNKNOWN") }] }); const after = run(set(a, "X10", exp)); assert.deepEqual(economic(after), economic(before)); assert.deepEqual(after.indicators["I-F03"], before.indicators["I-F03"]); assert.equal(after.goals.experience.personalExperience.value.episodes[0].behavior.value, "HELD_DELEGATED"); });
test("CT-34", () => { const a = t("T13"), r = run(set(a, "X11", { main: field("COST_FUNCTION"), futureInvolvement: field("DIRECT") })); assert.deepEqual(economic(r), economic(run(a))); assert.equal(answer(r, "F03").value, "DELEGATED_PROFESSIONAL"); assert.equal(r.goals.serviceUtility.futureInvolvement.value, "DIRECT"); });
test("CT-35", () => {
  let a = attachGoals(t("T04"), [goal("unplaced", { horizon: state("UNKNOWN") }), goal("secondary", { rank: field(2) })]); let r = run(a); assert.equal(r.profiles.fermi.reconcileGoals, true); tr(r, "FERMI", "INDETERMINATE"); assert.equal(check(r, "R-G01").status, "CLARIFY"); exact(r, "I-A01", 2500);
  a = set(a, "F01", "HORIZON"); r = run(a); tr(r, "FERMI", "FALSE"); assert.equal(r.goals.goals.length, 2); assert.equal(answer(r, "X06").lifecycle, "ACTIVE");
});
test("CT-36", () => { const a = t("T04"), before = run(a), r = run(set(a, "X11", { main: field("CLARIFY_GOALS"), futureInvolvement: field("UNDERSTAND_FIRST") })); assert.deepEqual(economic(r), economic(before)); assert.equal(answer(r, "F01").value, "NONE"); assert.equal(answer(r, "X06").state, "UNANSWERED"); assert.equal(r.goals.goals.length, 0); assert.equal(r.goals.checks[0].status, "INSUFFICIENT"); });
test("CT-37", () => { const r = run(moduleOnly(30000, 5000, [goal()], resources(15000, 10000, [], [constraint("access", "goal-a")]))); assert.equal(r.goals.resources.constraints[0].access, "DAYS7"); assert.equal(r.goals.goals[0].horizon.value, "WITHIN12"); assert.equal(r.goals.catalogMatching, "DEFERRED_OUT_OF_SCOPE"); }, "PARTIAL: declared time/access; future product matching not implemented");
test("CT-38", () => { let a = attachGoals(t("T07"), [goal()]); a = set(a, "X09", resources(15000, 1000)); const before = run(a), after = run(assetRows(a, { BUSINESS: 1800000, HOME: 300000 })); exact(after, "I-E01", 1920000); assert.deepEqual(after.goals.resources, before.goals.resources); assert.deepEqual(after.priorities, before.priorities); });
test("CT-39", () => {
  let a = attachGoals(t("T01"), [goal("a"), goal("b", { rank: field(2) })]); a = set(a, "X09", resources(8000, 2000, [{ goalId: "a", amount: field(money(1000)) }, { goalId: "b", amount: field(money(500)) }], [constraint("access", "a")])); const n = a.answers.length;
  const r = run(attachGoals(a, [goal("b", { rank: state("UNANSWERED") })])); assert.deepEqual(r.goals.resources.allocations.map(x => x.goalId), ["b"]); assert.equal(r.goals.resources.constraints.length, 0); assert.ok(r.goals.inactiveLinks.includes("allocation:a")); assert.equal(r.goals.prioritized.length, 0); assert.equal(a.answers.length, n);
  let legacy = set(t("T01"), "X06", { category: "RESERVE", horizon: field("WITHIN12"), target: field(money(8000)) }, "VALUE", 1); const rl = run(legacy); assert.equal(rl.goals.goals[0].rank.state, "UNANSWERED"); assert.equal(rl.goals.goals[0].nature.state, "UNANSWERED");
  legacy = attachGoals(legacy, [goal("legacy-x06", { category: "RESERVE", rank: state("UNANSWERED"), nature: state("UNANSWERED") })]); const rr = run(legacy); assert.equal(rr.goals.prioritized.length, 0); assert.ok(rr.history.some(h => h.ref.id === "RP-X06" && h.ref.questionVersion === 1 && h.disposition === "SUPERSEDED"));
});
test("CT-40", () => { let a = set(t("T01"), "X09", undefined, "DECLINED"); a = set(a, "X10", undefined, "UNKNOWN"); const r = run(set(a, "X11", { main: field("CLARIFY_GOALS"), futureInvolvement: state("UNANSWERED") })); assert.equal(answer(r, "X09").state, "DECLINED"); assert.equal(answer(r, "X10").state, "UNKNOWN"); assert.equal(answer(r, "X06").state, "UNANSWERED"); assert.equal(r.goals.serviceUtility.futureInvolvement.state, "UNANSWERED"); }, "PARTIAL: domain reuse and states; privacy/views/CRM deferred");

test("decimal/annual/locale/date", () => {
  assert.equal(italianAmount("1.234,56"), "1234.56"); assert.throws(() => italianAmount("1.23")); assert.throws(() => italianAmount("1,234"));
  const annual = money("12000.01", "T12", "INDIVIDUAL", { basis: "ANNUAL" }); assert.deepEqual(normalizeMoney(annual).lower, { numerator: "1200001", denominator: "1200" });
  const a = set(t("T01"), "A01", money(19200, "T12", "INDIVIDUAL", { basis: "ANNUAL" })); exact(run(a), "I-A01", 400);
  assert.deepEqual(periods(T0), { T0, T12: { start: "2025-10-01", end: "2026-09-30" }, Tnow: { start: "2026-10-01", end: "2026-10-31" } }); assert.throws(() => periods("2026-02-30"));
  for (const n of [-1, NaN, Infinity, "-1", "NaN", "Infinity", ".10", "1.001", "1e10"]) assert.ok(moneyErrors(money(n)).length, String(n));
  const huge = "999999999999999999999999999999999999.99"; assert.equal(compare(normalizeMoney(money(huge)).lower, decimal(huge)), 0);
});
test("bands/open/unbounded/exact predicates", () => {
  const flow = normalizeMoney({ ...money(0, "T12"), amount: undefined, band: 8, quality: "BAND" }); assert.equal(flow.upper, null); assert.equal(number(flow.lower), 10000); assert.equal(flow.lowerClosed, true);
  const openZero = normalizeMoney({ ...money(0), amount: undefined, band: 1, quality: "BAND" }); assert.equal(openZero.lowerClosed, false); assert.equal(openZero.upperClosed, false);
  assert.equal(ratio(point("1"), point("0")), null); assert.equal(ratio(point("1"), interval("0", "1", true, true)), null);
  const unbounded = ratio(point("1"), interval("0", "1", false, true)); assert.equal(unbounded.upper, null); assert.equal(unbounded.upperClosed, false);
  const zero = ratio(interval("0", "1", true, true), interval("1", null)); assert.equal(zero.lowerClosed, true);
  assert.equal(freeLiquidity(point("5000"), point("6000")), null); assert.equal(number(freeLiquidity(interval("0", "10"), interval("5", "20")).lower), 0);
  const q = share(interval("100", "200", true, true), interval("100", "200", true, true)); assert.equal(compare(q.lower, decimal("0.333333333333333333333")), 1); assert.equal(compare(q.upper, { numerator: "2", denominator: "3" }), 0);
  assert.equal(allGE(interval("3", null), "3"), "TRUE"); assert.equal(allLT(interval("0", "1", false, false), "1"), "TRUE"); assert.equal(allGT(interval("0", "1", true, false), "0"), "INDETERMINATE"); assert.equal(and("FALSE", "INDETERMINATE"), "FALSE"); assert.equal(or("TRUE", "INDETERMINATE"), "TRUE");
});
test("validation/catalogue/payloads", () => {
  const badGoals = { goals: [goal(), goal("b"), goal("c"), goal("d")] }; assert.ok(validateValue("RP-X06", badGoals).length);
  assert.ok(validateValue("RP-X06", { goals: [goal(), goal("b")] }).length); assert.ok(validateValue("RP-X06", { goals: [goal(), goal()] }).length);
  assert.ok(validateValue("RP-X10", experience({ episodes: [{ category: "CASH", behavior: field("HEARD"), recency: state("UNKNOWN") }] })).length);
  assert.ok(validateValue("RP-X10", experience({ expectations: field(["NONE_DEFINED", "AVAILABILITY"]) })).length);
  assert.ok(validateValue("RP-X11", { main: "CLARIFY_GOALS", futureInvolvement: "DIRECT" }).length);
  const r = run(set(t("T01"), "A01", undefined, "NOT_APPLICABLE")); nc(r, "I-A01"); assert.ok(answer(r, "A01").issues.includes("UNCONFIRMED_NOT_APPLICABLE"));
  const inactive = run(t("T01")); assert.equal(ordinaryRoute(resolveAnswers(t("T01"))).includes("RP-F04"), false); assert.equal(answer(inactive, "F04").applicability, "NOT_APPLICABLE");
});
test("revisions/perimeter/temporal/protection", () => {
  let a = set(t("T06"), "S01", "HOUSEHOLD"); a = set(a, "S01", "INDIVIDUAL"); assert.equal(answer(run(a), "A01").lifecycle, "RECONFIRM");
  const badTime = run(set(t("T01"), "A01", money(1600, "T12", "INDIVIDUAL", { coverage: "PARTIAL" }))); nc(badTime, "I-A01"); assert.ok(badTime.quality.temporal.includes("PARTIAL_T12_NO_EXTRAPOLATION"));
  const wrongScope = run(set(t("T01"), "A01", money(1600, "T12", "HOUSEHOLD"))); nc(wrongScope, "I-A01"); assert.ok(wrongScope.incoherences.some(x => x.code === "DIFFERENT_SCOPE"));
  a = set(t("T02"), "D01", ["HOME"]); assert.equal(answer(run(a), "D02").lifecycle, "RECONFIRM"); assert.notEqual(run(a).areas.D.state, "PRESIDI_DICHIARATI");
  const unknown = run(omit(t("T01"), "D01", "D02")); area(unknown, "D", "NON_VALUTABILE");
  const noExposure = run(set(t("T01"), "D01", ["NONE"])); area(noExposure, "D", "NON_VALUTABILE");
});
test("shared evidence / purity / boundaries", () => {
  const r = run(t("T13")); assert.ok(r.evidence.filter(e => e.dedupe === "CASH_DEFICIT").length >= 2); assert.equal(r.priorities.filter(id => r.evidence.find(e => e.id === id)?.dedupe === "CASH_DEFICIT").length, 1);
  const allUnknown = { asOf: T0, answers: [] }; const empty = run(allUnknown); assert.ok(Object.values(empty.areas).every(a => a.state === "NON_VALUTABILE")); assert.equal(empty.favorable.length, 0); assert.equal(empty.profiles.status, "NOT_DETERMINABLE");
  const frozen = t("T01"); Object.freeze(frozen.answers); Object.freeze(frozen); assert.deepEqual(run(frozen), run(t("T01")));
  assert.throws(() => run({ asOf: T0, answers: [...t("T01").answers, t("T01").answers[0]] }));
  const source = fs.readdirSync(new URL("../src/lib/patrimonial-radar", import.meta.url)).map(f => fs.readFileSync(new URL(`../src/lib/patrimonial-radar/${f}`, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(source, /(?:fetch\(|process\.env|Date\.now\(|Math\.random\(|from ["'](?:next|react|stripe|@supabase|node:fs))/);
});

test("independent optional states and global references", () => {
  for (const s of ["UNKNOWN", "DECLINED", "UNANSWERED"]) {
    let a = set(t("T01"), "X10", experience({ personalExperience: state(s), expectations: field(["AVAILABILITY"]) }));
    a = set(a, "X09", { ...resources(state(s), state(s)), collections: { allocations: s, otherResources: s, constraints: s } });
    a = set(a, "X11", { main: field("CLARIFY_GOALS"), futureInvolvement: state(s) });
    const r = run(a); assert.equal(r.goals.experience.personalExperience.state, s); assert.equal(r.goals.resources.collections.constraints, s); assert.equal(r.goals.serviceUtility.futureInvolvement.state, s); assert.deepEqual(economic(r), economic(run(t("T01"))));
  }
  const r = run(set(t("T01"), "X09", { ...resources(state("UNKNOWN"), state("UNKNOWN")), collections: { allocations: "UNANSWERED", otherResources: "VALUE", constraints: "UNANSWERED" }, otherResources: [{ goalId: "GLOBAL", asset: "CASH" }] })); assert.equal(r.goals.resources.otherResources.length, 1); assert.equal(r.goals.resources.available.state, "UNKNOWN");
});
test("quantitative partial inventory and residual presence", () => {
  let a = set(baseZero(), "X05", { complete: false, total: money(1000) }); a = set(a, "C01", { kinds: ["OTHER"] });
  a = set(a, "X05", { complete: false, total: money(1000) }); const r = run(a); nc(r, "I-E01.D", "I-E01"); area(r, "E", "DA_APPROFONDIRE");
  a = set(a, "C01", { kinds: ["OTHER"] }); a = omit(a, "X05"); a = set(a, "C04", { payment: money(0, "Tnow"), knownChange: field("NO") }); area(run(a), "E", "NON_VALUTABILE");
  a = set(a, "C04", { payment: money(100, "Tnow"), knownChange: field("NO") }); area(run(a), "E", "DA_APPROFONDIRE");
  const incoherent = run(set(baseZero(), "X05", { complete: true, total: money(0) })); assert.ok(incoherent.incoherences.some(i => i.code === "ZERO_OPEN_DEBT")); nc(incoherent, "I-E01.D");
  const partial = run(set(t("T02"), "E01", { complete: false, categories: ["CASH", "HOME", "FINANCIAL"] })); area(partial, "E", "NON_VALUTABILE"); nc(partial, "I-E01.A");
});
test("validated cell NA / protection limits / long term source", () => {
  const valid = run(assetRows(t("T01"), { FINANCIAL: state("NOT_APPLICABLE") })); exact(valid, "I-E01.A", 12000);
  const invalid = run(assetRows(t("T04"), { FINANCIAL: state("NOT_APPLICABLE") })); assert.ok(answer(invalid, "X04").issues.some(i => i.startsWith("UNCONFIRMED_ROW_NOT_APPLICABLE"))); nc(invalid, "I-E01.A");
  const cells = { availability: field("CHECKED"), conditions: field("CHECKED"), duration: field("UNREVIEWED"), need: state("UNKNOWN") };
  area(run(set(t("T01"), "X03", { HOME: cells })), "D", "DA_APPROFONDIRE");
  const old = run(set(t("T01"), "X08", { source: field("UNVERIFIED"), recency: field("WITHIN12") })); assert.equal(answer(old, "F02").value, "CHECKED"); assert.ok(old.incoherences.some(i => i.code === "LONGTERM_SOURCE")); assert.notEqual(old.areas.F.state, "PRESIDI_DICHIARATI");
  const noInvestments = run(set(t("T01"), "F03", "WITH_PROFESSIONAL")); tr(noInvestments, "AFFIDA", "FALSE"); tr(noInvestments, "COSTRUISCE", "TRUE"); assert.equal(noInvestments.profiles.status, "PREVALENT");
  assert.match(questionText("RP-F02", ["PENSION"]), /già disponibili in pensione/); assert.equal(questionText("RP-F02", ["PENSION", "EMPLOYEE"]), questionText("RP-F02", null));
});
test("declared income contradiction / exact cents / malformed fields", () => {
  const r = run(set(t("T02"), "A04", "NO_INCOME")); assert.ok(r.incoherences.some(i => i.code === "INCOME_CONTRADICTION")); assert.equal(r.indicators["I-A01"].usable, false); assert.equal(r.indicators["I-C01"].usable, false); exact(r, "I-E01", 230000);
  const cents = run(assessment({ Y: "1000.01", E: "999.99", R: 0, K: 500, L: 1000, P: 0, D: 0 })); exact(cents, "I-A01", ".02".replace(/^\./, "0."));
  const monthly = normalizeMoney({ ...money(0, "T12"), amount: undefined, band: 5, quality: "BAND" }); const annual = normalizeMoney({ ...money(0, "T12"), basis: "ANNUAL", amount: undefined, band: 5, quality: "BAND" }); assert.deepEqual(monthly, annual);
  assert.ok(validateValue("RP-X06", { goals: [goal("a", { secret: "not accepted" })] }).length); assert.ok(moneyErrors({ ...money(10), customerName: "not accepted" }).length);
  assert.equal(run(set(t("T01"), "A01", money(1600, "T12"), "VALUE", 999)).indicators["I-A01"].usable, false);
});
test("restricted pension is separate and contradictory cost applicability is suspended", () => {
  let a = set(t("T01"), "E01", { categories: ["CASH", "PENSION"], complete: true }); a = assetRows(a, { PENSION: 50000 }); a = set(a, "F04", "EXPLAIN");
  const r = run(a); exact(r, "I-E01.A", 12000); exact(r, "I-E01", 12000); exact(r, "I-E01.pension", 50000); exact(r, "I-E02", 100);
  const inconsistent = run(assetRows(t("T01"), { PENSION: 50000 })); assert.ok(inconsistent.incoherences.some(x => x.code === "COSTS_APPLICABILITY_CONTRADICTION")); assert.notEqual(inconsistent.areas.F.state, "PRESIDI_DICHIARATI"); tr(inconsistent, "COSTRUISCE", "INDETERMINATE");
  const wrongZero = run(set(t("T01"), "A01", money(0, "T12", "HOUSEHOLD"))); assert.notEqual(answer(wrongZero, "A05").applicability, "NOT_APPLICABLE");
});

let failures = 0;
for (const { id, fn, scope } of tests) {
  try { fn(); console.log(`${scope === "FULL" ? "PASS" : "PARTIAL PASS"} ${id}${scope === "FULL" ? "" : ` — ${scope}`}`); coverage.push({ id, status: scope === "FULL" ? "PASS" : "PARTIAL", scope }); }
  catch (error) { failures++; console.error(`FAIL ${id}: ${error.stack}`); coverage.push({ id, status: "FAIL" }); }
}
for (const c of coverage.filter(c => c.status === "NOT_RUN")) console.log(`NOT RUN ${c.id} — ${c.reason}`);
console.log(JSON.stringify({ executed: tests.length, passed: tests.length - failures, failed: failures, methodologyScenarios: coverage.filter(c => /^(?:T\d|G\d|CT-)/.test(c.id)).reduce((acc, c) => { acc[c.status] = (acc[c.status] ?? 0) + 1; return acc; }, {}) }));
if (failures) process.exitCode = 1;
