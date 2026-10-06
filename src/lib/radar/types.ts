// v3 (call 5 Oct 2026): no seasonal step (the qualification form asks it), owner salary and partners added.
export const RADAR_QUESTIONNAIRE_VERSION = 'radar-v3' as const;

export type RadarAreaId = 'amministrazione' | 'produzione' | 'commerciale' | 'marketing' | 'risorse-umane';
export type RadarJourneyStatus = 'STARTED' | 'IN_PROGRESS' | 'PAYMENT_REQUIRED' | 'PAID' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED';
export type RadarAnswer = number | number[];
export type RadarAnswers = Record<string, RadarAnswer>;

export interface RadarAreaScore {
  id: RadarAreaId;
  label: string;
  score: number;
}
export interface RadarScores {
  ownerEconomics: RadarOwnerEconomics | null;
  areas: RadarAreaScore[];
  ownerAutonomy: number;
  organizationalMaturity: number;
  global: number;
  autonomyGap: number;
  ai: number;
  seasonal: boolean;
  strongestArea: RadarAreaScore;
  weakestArea: RadarAreaScore;
}

export interface RadarOwnerEconomics {
  monthlyProfit: number;
  monthlyHours: number;
  /** The owner's share of the profit, 0-1 (1 without partners or when not asked). */
  ownerShare: number;
  /** monthlyProfit × ownerShare. */
  ownerMonthlyProfit: number;
  /** Owner's share of the profit per hour worked: the Radar's headline figure. */
  hourlyProfit: number;
  /** Gross salary the owner takes, per month; null when the Radar did not ask it (v1/v2). */
  monthlySalary: number | null;
  /** (salary + share of profit) per hour worked; null when the salary was not asked. */
  hourlyEarnings: number | null;
}

export interface RadarStep {
  id: string;
  kind: 'LIKERT' | 'SEASONAL' | 'AI_MULTI' | 'OWNER_HOURS' | 'COMPANY_PROFIT' | 'OWNER_SALARY' | 'PARTNERS';
  title: string;
  areaId?: RadarAreaId;
  autonomy?: boolean;
  options?: readonly string[];
}
