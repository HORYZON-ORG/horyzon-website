import { decimal, div, interval, point, scale, type Interval } from "./intervals.ts";
import type { Money, Period, Periods, Scope } from "./types.ts";
export const FLOW_BOUNDS = ["0", "500", "1000", "1500", "2000", "3000", "5000", "10000"] as const;
export const STOCK_BOUNDS = ["0", "1000", "5000", "10000", "25000", "50000", "100000", "250000", "500000"] as const;
export const validDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
export function periods(asOf: string): Periods {
  if (!validDate(asOf)) throw new Error("Invalid assessment date");
  const d = new Date(asOf), y = d.getUTCFullYear(), m = d.getUTCMonth();
  const date = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  return { T0: asOf, T12: { start: date(y - 1, m, 1), end: date(y, m, 0) }, Tnow: { start: date(y, m, 1), end: date(y, m + 1, 0) } };
}
/** UI adapters may use this explicit locale conversion; ambiguous commas are rejected. */
export function italianAmount(input: string): string {
  if (!/^(?:\d+|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(input)) throw new Error("Ambiguous Italian amount");
  return input.replaceAll(".", "").replace(",", ".");
}
export function moneyErrors(input: unknown, expected?: Period): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return ["MONEY_SHAPE"];
  const v = input as Money;
  const errors: string[] = [];
  if (Object.keys(v).some(k => !["currency", "basis", "period", "scope", "asOf", "quality", "coverage", "amount", "band", "range"].includes(k))) errors.push("UNKNOWN_MONEY_FIELD");
  if (v.currency !== "EUR") errors.push("CURRENCY");
  if (!["INDIVIDUAL", "HOUSEHOLD"].includes(v.scope)) errors.push("MONEY_SCOPE");
  if (!["T0", "T12", "Tnow"].includes(v.period) || expected && v.period !== expected) errors.push("PERIOD");
  if (!validDate(v.asOf)) errors.push("AS_OF");
  if (!["REPORTED", "ESTIMATED", "BAND"].includes(v.quality)) errors.push("QUALITY");
  if (v.coverage !== undefined && !["COMPLETE", "PARTIAL"].includes(v.coverage)) errors.push("COVERAGE");
  if (v.period === "T0" ? v.basis !== "STOCK" : !["MONTHLY", ...(v.period === "T12" ? ["ANNUAL"] : [])].includes(v.basis)) errors.push("BASIS");
  if ([v.amount, v.band, v.range].filter(x => x !== undefined).length !== 1) errors.push("ONE_AMOUNT_REPRESENTATION");
  const amount = (x: unknown) => typeof x === "string" && /^\d+(?:\.\d{1,2})?$/.test(x);
  if (v.amount !== undefined && !amount(v.amount)) errors.push("DECIMAL_CENTS");
  const bounds = v.basis === "STOCK" ? STOCK_BOUNDS : FLOW_BOUNDS;
  if (v.band !== undefined && (!Number.isInteger(v.band) || v.band < 0 || v.band > bounds.length)) errors.push("BAND");
  if ((v.band !== undefined || v.range !== undefined) && v.quality !== "BAND") errors.push("BAND_QUALITY");
  if (v.range !== undefined) {
    if (!v.range || Object.keys(v.range).some(k => !["lower", "upper", "lowerClosed", "upperClosed"].includes(k)) || !amount(v.range.lower) || v.range.upper !== null && !amount(v.range.upper) || typeof v.range.lowerClosed !== "boolean" || typeof v.range.upperClosed !== "boolean" || v.range.upper === null && v.range.upperClosed) errors.push("RANGE");
    else { try { interval(v.range.lower, v.range.upper, v.range.lowerClosed, v.range.upperClosed); } catch { errors.push("EMPTY_RANGE"); } }
  }
  return errors;
}
export function normalizeMoney(v: Money): Interval {
  const errors = moneyErrors(v);
  if (errors.length) throw new Error(errors.join(","));
  let r: Interval;
  if (v.amount !== undefined) r = point(v.amount);
  else if (v.range) r = interval(v.range.lower, v.range.upper, v.range.lowerClosed, v.range.upperClosed);
  else {
    const bounds = v.basis === "STOCK" ? STOCK_BOUNDS : FLOW_BOUNDS, b = v.band!;
    r = b === 0 ? point("0") : interval(bounds[b - 1], bounds[b] ?? null, b !== 1, false);
    // Annual bands are the monthly FM bounds multiplied by 12, then normalized.
    if (v.basis === "ANNUAL") r = scale(r, decimal("12"));
  }
  return v.basis === "ANNUAL" ? scale(r, div(decimal("1"), decimal("12"))) : r;
}
export function usableMoney(v: Money, context: { asOf: string; scope: Scope | null }, expected: Period): Interval | null {
  if (moneyErrors(v, expected).length || context.scope === null || v.scope !== context.scope || v.asOf !== context.asOf || v.coverage === "PARTIAL") return null;
  return normalizeMoney(v);
}
