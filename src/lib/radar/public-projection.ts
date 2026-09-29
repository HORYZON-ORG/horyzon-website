import type { RadarJourneyStatus, RadarScores } from './types.ts';

export interface LockedRadarProjection {
  status: RadarJourneyStatus;
  answeredCount: number;
  resultLocked: true;
}
export interface UnlockedRadarProjection {
  status: RadarJourneyStatus;
  answeredCount: number;
  resultLocked: false;
  scores: RadarScores;
}

export function lockedRadarProjection(input: Omit<LockedRadarProjection, 'resultLocked'>): LockedRadarProjection {
  return { ...input, resultLocked: true };
}

export function unlockedRadarProjection(input: Omit<UnlockedRadarProjection, 'resultLocked'>): UnlockedRadarProjection {
  return { ...input, resultLocked: false };
}
