import type { RadarAnswer, RadarAnswers, RadarOwnerEconomics } from './types.ts';

export const OWNER_HOURS_KEY = 'economia#ore';
export const COMPANY_PROFIT_KEY = 'economia#utile';
export const OWNER_SALARY_KEY = 'economia#stipendio';
export const PARTNERS_KEY = 'economia#soci';
export const WEEKS_PER_MONTH = 52 / 12;

const numbers = (value: unknown): value is number[] => Array.isArray(value) && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));

// Hours: [0 = weekly / 1 = daily, hours, days per week (0 for weekly)].
// Profit: [0 = annual / 1 = monthly, profit before income taxes in euros].
// Salary: [0] none, or [1, 0 = annual / 1 = monthly, gross amount in euros].
// Partners: [0] sole owner, or [1, the owner's share in percent, 1-99].
export function validOwnerEconomicsAnswer(key: string, value: unknown): value is RadarAnswer {
  if (!numbers(value)) return false;
  if (key === COMPANY_PROFIT_KEY) return value.length === 2 && (value[0] === 0 || value[0] === 1);
  if (key === OWNER_SALARY_KEY) return (value[0] === 0 && value.length === 1) || (value[0] === 1 && value.length === 3 && (value[1] === 0 || value[1] === 1) && value[2]! >= 0);
  if (key === PARTNERS_KEY) return (value[0] === 0 && value.length === 1) || (value[0] === 1 && value.length === 2 && value[1]! > 0 && value[1]! < 100);
  if (key !== OWNER_HOURS_KEY || value.length !== 3 || (value[0] !== 0 && value[0] !== 1)) return false;
  const [, hours, days] = value;
  return value[0] === 0
    ? hours! > 0 && hours! <= 168 && days === 0
    : hours! > 0 && hours! <= 24 && Number.isInteger(days) && days! >= 1 && days! <= 7;
}

export function calculateOwnerEconomics(answers: RadarAnswers): RadarOwnerEconomics | null {
  const hours = answers[OWNER_HOURS_KEY];
  const profit = answers[COMPANY_PROFIT_KEY];
  if (!validOwnerEconomicsAnswer(OWNER_HOURS_KEY, hours) || !validOwnerEconomicsAnswer(COMPANY_PROFIT_KEY, profit)) return null;
  const [hoursPeriod, hoursAmount, days] = hours as number[];
  const [profitPeriod, profitAmount] = profit as number[];
  const monthlyHours = hoursAmount! * (hoursPeriod === 1 ? days! : 1) * WEEKS_PER_MONTH;
  const monthlyProfit = profitAmount! / (profitPeriod === 0 ? 12 : 1);
  // Partners split the profit: the owner's hour is worth their share, not the whole company's profit.
  const partners = answers[PARTNERS_KEY];
  const ownerShare = validOwnerEconomicsAnswer(PARTNERS_KEY, partners) && (partners as number[])[0] === 1 ? (partners as number[])[1]! / 100 : 1;
  const ownerMonthlyProfit = monthlyProfit * ownerShare;
  const hourlyProfit = ownerMonthlyProfit / monthlyHours;
  // The salary is a cost the profit already paid: adding it back shows what the owner really earns per hour.
  const salary = answers[OWNER_SALARY_KEY];
  const monthlySalary = validOwnerEconomicsAnswer(OWNER_SALARY_KEY, salary) ? ((salary as number[])[0] === 1 ? (salary as number[])[2]! / ((salary as number[])[1] === 0 ? 12 : 1) : 0) : null;
  const hourlyEarnings = monthlySalary === null ? null : (ownerMonthlyProfit + monthlySalary) / monthlyHours;
  return Number.isFinite(hourlyProfit) ? { monthlyHours, monthlyProfit, ownerShare, ownerMonthlyProfit, hourlyProfit, monthlySalary, hourlyEarnings } : null;
}
