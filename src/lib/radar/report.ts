// The paid Radar report: scores, answers and advice composed into one document (page, PDF and email share it).
import { ADVICE_BAND_LABELS, adviceKey, answerBand, HOURLY_PROFIT_CRITICAL, HOURLY_PROFIT_TARGET, hourlyProfitBand, scoreBand, type AdviceBand, type RadarAdvice } from './advice.ts';
import { OWNER_SALARY_KEY, PARTNERS_KEY } from './owner-economics.ts';
import { RADAR_AREAS } from './domain.ts';
import type { RadarAnswers, RadarAreaId, RadarOwnerEconomics, RadarScores } from './types.ts';

export const LIKERT_LABELS = ['Per nulla', 'Poco', 'Abbastanza', 'Molto', 'Completamente'] as const;

export interface RadarReportContext {
  aziendaNome: string;
  referenteNome: string;
  settore: string;
  numeroDipendenti: string;
  volumeAffari: string;
  /** What the company actually does, in the owner's words (v3 qualification). */
  descrizioneAttivita?: string;
  completedAt: string | null;
}

export interface ReportAdvice { title: string; body: string; action: string }
export interface ReportQuestion { key: string; question: string; answer: number; answerLabel: string; band: AdviceBand; autonomy: boolean; advice: ReportAdvice }
export interface ReportArea { id: RadarAreaId; label: string; score: number; band: AdviceBand; bandLabel: string; reading: ReportAdvice; strengths: ReportQuestion[]; gaps: ReportQuestion[] }
export interface ReportPriority { area: string; question: string; answerLabel: string; advice: ReportAdvice }
export interface ReportIndex { score: number; band: AdviceBand; bandLabel: string; reading: ReportAdvice }

export interface RadarReport {
  company: RadarReportContext;
  generatedAt: string;
  global: ReportIndex;
  organizationalMaturity: number;
  autonomy: ReportIndex & { gap: number; gapReading: string };
  ai: ReportIndex & { uses: string[] };
  economics: (RadarOwnerEconomics & { band: AdviceBand; bandLabel: string; reading: ReportAdvice }) | null;
  areas: ReportArea[];
  strongest: { label: string; score: number };
  weakest: { label: string; score: number };
  priorities: ReportPriority[];
  seasonal: boolean;
  /** The data given at the start and in the economic questions, as label/value lines for page, PDF and CRM. */
  profile: { label: string; value: string }[];
  /** Reference values for the hourly figure, so every surface quotes the same thresholds. */
  hourlyBenchmark: { critical: number; target: number };
}

const AI_USES = ['Contenuti e marketing', 'Amministrazione e reportistica', 'Servizio clienti', 'Analisi dati e decisioni', 'Non la utilizziamo ancora', 'Altro'];

function pick(advice: Map<string, RadarAdvice>, kind: RadarAdvice['kind'], subject: string, band: AdviceBand): ReportAdvice {
  const found = advice.get(adviceKey(kind, subject, band));
  return found ? { title: found.title, body: found.body, action: found.action } : { title: '', body: '', action: '' };
}

function index(score: number, advice: Map<string, RadarAdvice>, kind: RadarAdvice['kind'], subject: string): ReportIndex {
  const band = scoreBand(score);
  return { score, band, bandLabel: ADVICE_BAND_LABELS[band], reading: pick(advice, kind, subject, band) };
}

function likert(answers: RadarAnswers, key: string): number {
  const value = answers[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(5, Math.max(1, Math.round(value))) : 3;
}

function gapReading(gap: number): string {
  if (gap >= 15) return 'I reparti sono più organizzati di quanto siano autonomi da te: i metodi ci sono, ma le decisioni passano ancora dalla tua scrivania. È il punto in cui la delega rende di più.';
  if (gap <= -15) return 'L’impresa va avanti anche senza di te più di quanto i reparti siano organizzati: le persone compensano con l’esperienza, ma senza metodi scritti questa autonomia è fragile.';
  return 'Organizzazione e autonomia dal titolare crescono di pari passo: lavorare sull’una rafforza anche l’altra.';
}

export function buildRadarReport(input: { scores: RadarScores; answers: RadarAnswers; advice: Map<string, RadarAdvice>; context: RadarReportContext; now?: Date }): RadarReport {
  const { scores, answers, advice, context } = input;
  const areas: ReportArea[] = RADAR_AREAS.map((area) => {
    const score = scores.areas.find((item) => item.id === area.id)?.score ?? 0;
    const questions: ReportQuestion[] = area.questions.map((question, i) => {
      const key = `${area.id}#${i}`;
      const answer = likert(answers, key);
      const band = answerBand(answer);
      return { key, question, answer, answerLabel: LIKERT_LABELS[answer - 1]!, band, autonomy: i === 4, advice: pick(advice, 'question', key, band) };
    });
    const band = scoreBand(score);
    return {
      id: area.id, label: area.label, score, band, bandLabel: ADVICE_BAND_LABELS[band], reading: pick(advice, 'area', area.id, band),
      strengths: questions.filter((item) => item.band === 'solido').sort((a, b) => b.answer - a.answer),
      gaps: questions.filter((item) => item.band !== 'solido').sort((a, b) => a.answer - b.answer),
    };
  });

  // Priorities: lowest answers first, weighted up when the question measures owner autonomy and when the
  // department is weak; at most one per department so the 90 days touch the whole company.
  const candidates = areas.flatMap((area) => area.gaps.map((gap) => ({ area, gap, weight: (6 - gap.answer) * (gap.autonomy ? 1.4 : 1) * (1 + (100 - area.score) / 100) })))
    .sort((a, b) => b.weight - a.weight);
  const chosen: typeof candidates = [];
  for (const candidate of candidates) if (chosen.length < 3 && !chosen.some((item) => item.area.id === candidate.area.id)) chosen.push(candidate);
  for (const candidate of candidates) if (chosen.length < 3 && !chosen.includes(candidate)) chosen.push(candidate);

  const economics = scores.ownerEconomics;
  const economicsBand = economics ? hourlyProfitBand(economics.hourlyProfit) : null;
  const uses = Array.isArray(answers['ai#casoUso']) ? (answers['ai#casoUso'] as number[]).map((i) => AI_USES[i]).filter((use): use is string => Boolean(use)) : [];

  return {
    company: context,
    generatedAt: (input.now ?? new Date()).toISOString(),
    global: index(scores.global, advice, 'global', 'indice'),
    organizationalMaturity: scores.organizationalMaturity,
    autonomy: { ...index(scores.ownerAutonomy, advice, 'autonomy', 'titolare'), gap: scores.autonomyGap, gapReading: gapReading(scores.autonomyGap) },
    ai: { ...index(scores.ai, advice, 'ai', 'ai'), uses },
    economics: economics && economicsBand ? { ...economics, band: economicsBand, bandLabel: ADVICE_BAND_LABELS[economicsBand], reading: pick(advice, 'economics', 'utile_ora', economicsBand) } : null,
    areas,
    strongest: { label: scores.strongestArea.label, score: scores.strongestArea.score },
    weakest: { label: scores.weakestArea.label, score: scores.weakestArea.score },
    priorities: chosen.map(({ area, gap }) => ({ area: area.label, question: gap.question, answerLabel: gap.answerLabel, advice: gap.advice })),
    seasonal: scores.seasonal,
    profile: companyProfile(context, answers, scores.seasonal),
    hourlyBenchmark: { critical: HOURLY_PROFIT_CRITICAL, target: HOURLY_PROFIT_TARGET },
  };
}

const euroWhole = (value: number) => `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(value)} €`;

function companyProfile(context: RadarReportContext, answers: RadarAnswers, seasonal: boolean): { label: string; value: string }[] {
  const salary = answers[OWNER_SALARY_KEY];
  const partners = answers[PARTNERS_KEY];
  const lines: [string, string | undefined][] = [
    ['Settore', context.settore],
    ['Cosa fa l’azienda', context.descrizioneAttivita],
    ['Fatturato annuo', context.volumeAffari],
    ['Dipendenti', context.numeroDipendenti],
    ['Attività stagionale', seasonal ? 'Sì' : 'No'],
    ['Soci', Array.isArray(partners) ? (partners[0] === 1 ? `Sì · la tua quota è il ${partners[1]}%` : 'No, unico titolare') : undefined],
    ['Stipendio del titolare', Array.isArray(salary) ? (salary[0] === 1 ? `${euroWhole(salary[2] ?? 0)} lordi ${salary[1] === 1 ? 'al mese' : 'l’anno'}` : 'Nessuno') : undefined],
  ];
  return lines.filter((line): line is [string, string] => Boolean(line[1]?.trim())).map(([label, value]) => ({ label, value }));
}
