// v4 adds the owner's positioning assessment and description in Marketing.
export const RADAR_QUESTIONNAIRE_VERSION = 'radar-v4' as const;

export type RadarAreaId = 'amministrazione' | 'produzione' | 'commerciale' | 'marketing' | 'risorse-umane';
export type RadarJourneyStatus = 'STARTED' | 'IN_PROGRESS' | 'PAYMENT_REQUIRED' | 'PAID' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED';
export interface RadarPositioningAnswer { rating: number; description: string }
export type RadarAnswer = number | number[] | RadarPositioningAnswer;
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
  kind: 'LIKERT' | 'SEASONAL' | 'AI_MULTI' | 'OWNER_HOURS' | 'COMPANY_PROFIT' | 'OWNER_SALARY' | 'PARTNERS' | 'POSITIONING';
  title: string;
  areaId?: RadarAreaId;
  autonomy?: boolean;
  options?: readonly string[];
}
