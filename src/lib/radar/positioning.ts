import type { RadarPositioningAnswer } from './types.ts';

export const POSITIONING_KEY = 'marketing#posizionamento';
export const POSITIONING_TITLE = 'Quanto è posizionata la tua azienda nella testa del tuo cliente?';
export const POSITIONING_DESCRIPTION_TITLE = 'Per che cosa è posizionata l’azienda?';
export const POSITIONING_HINT = 'Descrivi con parole tue per quale motivo la tua azienda viene considerata e riconosciuta dal mercato. Se non lo sai, puoi indicarlo.';
export const POSITIONING_LABELS = ['Poco posizionata', '2', '3', '4', 'Molto posizionata'] as const;
export const POSITIONING_MAX_LENGTH = 2000;

export function isPositioningAnswer(value: unknown): value is RadarPositioningAnswer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { rating, description } = value as Partial<RadarPositioningAnswer>;
  return typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5 && typeof description === 'string' && description.trim().length > 0 && description.length <= POSITIONING_MAX_LENGTH;
}
