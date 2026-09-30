import type { RadarAnswer, RadarAnswers, RadarOwnerEconomics } from './types.ts';

export const OWNER_HOURS_KEY = 'economia#ore';
export const COMPANY_PROFIT_KEY = 'economia#utile';
export const WEEKS_PER_MONTH = 52 / 12;

// Hours: [0 = weekly / 1 = daily, hours, days per week (0 for weekly)].
// Profit: [0 = annual / 1 = monthly, profit before income taxes in euros].
export function validOwnerEconomicsAnswer(key: string, value: unknown): value is RadarAnswer {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return false;
  if (key === COMPANY_PROFIT_KEY) return value.length === 2 && (value[0] === 0 || value[0] === 1);
  if (key !== OWNER_HOURS_KEY || value.length !== 3 || (value[0] !== 0 && value[0] !== 1)) return false;
  const [, hours, days] = value;
  return value[0] === 0
    ? hours > 0 && hours <= 168 && days === 0
    : hours > 0 && hours <= 24 && Number.isInteger(days) && days >= 1 && days <= 7;
}

export function calculateOwnerEconomics(answers: RadarAnswers): RadarOwnerEconomics | null {
  const hours = answers[OWNER_HOURS_KEY];
  const profit = answers[COMPANY_PROFIT_KEY];
  if (!validOwnerEconomicsAnswer(OWNER_HOURS_KEY, hours) || !validOwnerEconomicsAnswer(COMPANY_PROFIT_KEY, profit)) return null;
  const [hoursPeriod, hoursAmount, days] = hours as number[];
  const [profitPeriod, profitAmount] = profit as number[];
  const monthlyHours = hoursAmount * (hoursPeriod === 1 ? days : 1) * WEEKS_PER_MONTH;
  const monthlyProfit = profitAmount / (profitPeriod === 0 ? 12 : 1);
  const hourlyProfit = monthlyProfit / monthlyHours;
  return Number.isFinite(hourlyProfit) ? { monthlyHours, monthlyProfit, hourlyProfit } : null;
}
