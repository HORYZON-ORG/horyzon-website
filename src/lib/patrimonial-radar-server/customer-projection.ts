import type { Area } from '../patrimonial-radar/types.ts';
import type { CustomerResult } from '../patrimonial-radar-ui/customer-result.ts';
import type { Snapshot } from './contracts.ts';

/** Read only the stored canonical snapshot; never re-run or reinterpret diagnostic rules. */
export function customerProjection(snapshot: Pick<Snapshot, 'result'>): CustomerResult {
  const r = snapshot.result;
  const texts = (ids: string[]) => ids.flatMap(id => { const e = r.evidence.find(e => e.id === id); return e ? [e.text] : []; });
  const material = [...new Set([...r.priorities, ...r.vulnerabilities])];
  const missing = r.evidence.filter(e => e.kind === 'MISSING').map(e => e.text);
  const titles: Record<string, string> = { 'R-G01': 'Definizione degli obiettivi', 'R-G02': 'Liquidità da mantenere e impegni', 'R-G03': 'Quota attuale destinabile', 'R-G04': 'Attribuzioni agli obiettivi', 'R-G03-RESOURCE-REFERENCE': 'Risorse da verificare' };
  return {
    projectionVersion: 'RP-CLIENT-4C2-1', asOf: r.periods.T0, scope: r.scope,
    partial: r.scopeCoverage !== 'COMPLETE' || Object.values(r.completeness).some(c => c.resolved < c.applicable) || r.incoherences.length > 0,
    areas: Object.fromEntries((['A','B','C','D','E','F'] as Area[]).map(a => [a, {
      state: r.areas[a].state,
      evidence: r.evidence.filter(e => r.areas[a].evidenceIds.includes(e.id)).map(e => ({ text: e.text, limitation: e.limitation })),
      resolved: r.completeness[a].resolved, applicable: r.completeness[a].applicable,
    }])) as CustomerResult['areas'],
    strengths: texts(r.favorable).slice(0, 2), priorities: texts(material.slice(0, 3)), further: texts(material.slice(3)),
    limitations: [...new Set([...missing, ...r.incoherences.map(i => i.message), ...(r.quality.scope === 'PARTIAL_OR_UNKNOWN' ? ['Il perimetro è parziale o non conosciuto: i confronti che richiedono un bilancio completo restano sospesi.'] : []), ...r.quality.temporal.map(t => t === 'PARTIAL_T12_NO_EXTRAPOLATION' ? 'Alcuni flussi coprono solo parte del periodo: non sono stati estesi a un anno.' : 'Alcuni dati si riferiscono a una fotografia diversa e non sono usati nei confronti.')])],
    incoherent: r.incoherences.length > 0,
    reconfirmCount: r.answers.filter(a => a.lifecycle === 'RECONFIRM').length,
    inactiveCount: r.answers.filter(a => a.applicability === 'NOT_APPLICABLE').length,
    goals: r.goals.goals.map(g => ({ category: g.category, rank: g.rank.state === 'VALUE' ? { state: 'VALUE', value: g.rank.value } : { state: g.rank.state }, horizon: g.horizon.state === 'VALUE' ? { state: 'VALUE', value: typeof g.horizon.value === 'string' ? g.horizon.value : { months: g.horizon.value.months } } : { state: g.horizon.state }, clarify: r.goals.definitions.some(d => d.goalId === g.id && d.status === 'TO_CLARIFY') })),
    goalChecks: r.goals.resources || r.profiles.fermi.reconcileGoals ? r.goals.checks.filter(c => titles[c.rule]).map(c => ({ title: titles[c.rule], status: c.status })) : [],
  };
}
