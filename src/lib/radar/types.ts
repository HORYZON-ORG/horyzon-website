export const RADAR_QUESTIONNAIRE_VERSION = 'radar-v1' as const;

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

export interface RadarStep {
  id: string;
  kind: 'LIKERT' | 'SEASONAL' | 'AI_MULTI';
  title: string;
  areaId?: RadarAreaId;
  autonomy?: boolean;
  options?: readonly string[];
}
