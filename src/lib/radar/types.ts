export const RADAR_QUESTIONNAIRE_VERSION = 'radar-v2' as const;

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
  hourlyProfit: number;
}

export interface RadarStep {
  id: string;
  kind: 'LIKERT' | 'SEASONAL' | 'AI_MULTI' | 'OWNER_HOURS' | 'COMPANY_PROFIT';
  title: string;
  areaId?: RadarAreaId;
  autonomy?: boolean;
  options?: readonly string[];
}
