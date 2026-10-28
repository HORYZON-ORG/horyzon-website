/** Exact rational arithmetic. Monetary inputs never pass through a JS float. */
export interface Fraction { numerator: string; denominator: string }
export interface Interval { lower: Fraction | null; upper: Fraction | null; lowerClosed: boolean; upperClosed: boolean }
const ZERO = BigInt(0), ONE = BigInt(1);
function gcd(a: bigint, b: bigint): bigint {
  a = a < ZERO ? -a : a; b = b < ZERO ? -b : b;
  while (b !== ZERO) { const r = a % b; a = b; b = r; }
  return a || ONE;
}
export function fraction(n: bigint | string, d: bigint | string = ONE): Fraction {
  let a = BigInt(n), b = BigInt(d);
  if (b === ZERO) throw new Error("Zero denominator");
  if (b < ZERO) { a = -a; b = -b; }
  const g = gcd(a, b);
  return { numerator: String(a / g), denominator: String(b / g) };
}
export function decimal(value: string): Fraction {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw new Error("Invalid decimal");
  const negative = value.startsWith("-"), raw = negative ? value.slice(1) : value;
  const [whole, part = ""] = raw.split(".");
  return fraction(BigInt((negative ? "-" : "") + whole + part), BigInt(10) ** BigInt(part.length));
}
export const add = (a: Fraction, b: Fraction) => fraction(BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator), BigInt(a.denominator) * BigInt(b.denominator));
export const neg = (a: Fraction) => fraction(-BigInt(a.numerator), a.denominator);
export const sub = (a: Fraction, b: Fraction) => add(a, neg(b));
export const mul = (a: Fraction, b: Fraction) => fraction(BigInt(a.numerator) * BigInt(b.numerator), BigInt(a.denominator) * BigInt(b.denominator));
export const div = (a: Fraction, b: Fraction) => fraction(BigInt(a.numerator) * BigInt(b.denominator), BigInt(a.denominator) * BigInt(b.numerator));
export function compare(a: Fraction, b: Fraction): -1 | 0 | 1 {
  const d = BigInt(a.numerator) * BigInt(b.denominator) - BigInt(b.numerator) * BigInt(a.denominator);
  return d < ZERO ? -1 : d > ZERO ? 1 : 0;
}
export const Z = decimal("0");
export function point(value: string | Fraction): Interval {
  const f = typeof value === "string" ? decimal(value) : value;
  return { lower: f, upper: f, lowerClosed: true, upperClosed: true };
}
export function interval(lower: string | null, upper: string | null, lowerClosed = true, upperClosed = false): Interval {
  const result = { lower: lower === null ? null : decimal(lower), upper: upper === null ? null : decimal(upper), lowerClosed: lower !== null && lowerClosed, upperClosed: upper !== null && upperClosed };
  if (result.lower && result.upper) {
    const c = compare(result.lower, result.upper);
    if (c > 0 || (c === 0 && !(lowerClosed && upperClosed))) throw new Error("Empty interval");
  }
  return result;
}
export const isPoint = (a: Interval) => !!a.lower && !!a.upper && compare(a.lower, a.upper) === 0;
export const isZero = (a: Interval) => isPoint(a) && compare(a.lower!, Z) === 0;
export function sum(a: Interval, b: Interval): Interval {
  return { lower: a.lower && b.lower ? add(a.lower, b.lower) : null, upper: a.upper && b.upper ? add(a.upper, b.upper) : null, lowerClosed: a.lowerClosed && b.lowerClosed, upperClosed: a.upperClosed && b.upperClosed };
}
export function subtract(a: Interval, b: Interval): Interval {
  return { lower: a.lower && b.upper ? sub(a.lower, b.upper) : null, upper: a.upper && b.lower ? sub(a.upper, b.lower) : null, lowerClosed: a.lowerClosed && b.upperClosed, upperClosed: a.upperClosed && b.lowerClosed };
}
export function scale(a: Interval, by: Fraction): Interval {
  if (compare(by, Z) < 0) throw new Error("Use subtraction for signed ranges");
  if (compare(by, Z) === 0) return point("0");
  return { ...a, lower: a.lower ? mul(a.lower, by) : null, upper: a.upper ? mul(a.upper, by) : null };
}
/** Denominators are strictly positive over the whole range; (0,b] is admissible. */
export function ratio(a: Interval, b: Interval): Interval | null {
  if (!a.lower || compare(a.lower, Z) < 0 || !b.lower || compare(b.lower, Z) < 0 || (compare(b.lower, Z) === 0 && b.lowerClosed)) return null;
  const lower = b.upper ? div(a.lower, b.upper) : Z;
  const upper = a.upper && compare(b.lower, Z) > 0 ? div(a.upper, b.lower) : isZero(a) ? Z : null;
  return { lower, upper, lowerClosed: compare(a.lower, Z) === 0 && a.lowerClosed || !!b.upper && a.lowerClosed && b.upperClosed, upperClosed: upper !== null && (isZero(a) || a.upperClosed && b.lowerClosed) };
}
/** Constrain P<=L on feasible combinations instead of silently clipping invalid input. */
export function freeLiquidity(l: Interval, p: Interval): Interval | null {
  if (p.lower && l.upper) {
    const c = compare(p.lower, l.upper);
    if (c > 0 || (c === 0 && !(p.lowerClosed && l.upperClosed))) return null;
  }
  const raw = subtract(l, p);
  if (!raw.lower || compare(raw.lower, Z) < 0) return { ...raw, lower: Z, lowerClosed: true };
  return raw;
}
/** Correlated component/(component+others), not component/independent total. */
export function share(component: Interval, others: Interval): Interval | null {
  const total = sum(component, others);
  if (!total.lower || compare(total.lower, Z) < 0 || (compare(total.lower, Z) === 0 && total.lowerClosed)) return null;
  if (isZero(component)) return point("0");
  if (isZero(others)) return point("1");
  const lo = component.lower && others.upper ? div(component.lower, add(component.lower, others.upper)) : Z;
  const hi = component.upper && others.lower ? div(component.upper, add(component.upper, others.lower)) : decimal("1");
  return { lower: lo, upper: hi, lowerClosed: component.lowerClosed && (compare(component.lower!, Z) === 0 || !!others.upper && others.upperClosed), upperClosed: others.lowerClosed && (compare(others.lower!, Z) === 0 || !!component.upper && component.upperClosed) };
}
export type Truth = "TRUE" | "FALSE" | "INDETERMINATE";
export function allLT(a: Interval | null, threshold: string): Truth {
  if (!a) return "INDETERMINATE";
  const t = decimal(threshold);
  if (a.upper && (compare(a.upper, t) < 0 || (compare(a.upper, t) === 0 && !a.upperClosed))) return "TRUE";
  if (a.lower && compare(a.lower, t) >= 0) return "FALSE";
  return "INDETERMINATE";
}
export function allGE(a: Interval | null, threshold: string): Truth {
  if (!a) return "INDETERMINATE";
  const t = decimal(threshold);
  if (a.lower && compare(a.lower, t) >= 0) return "TRUE";
  if (a.upper && (compare(a.upper, t) < 0 || (compare(a.upper, t) === 0 && !a.upperClosed))) return "FALSE";
  return "INDETERMINATE";
}
export function allGT(a: Interval | null, threshold: string): Truth {
  if (!a) return "INDETERMINATE";
  const t = decimal(threshold);
  if (a.lower && (compare(a.lower, t) > 0 || (compare(a.lower, t) === 0 && !a.lowerClosed))) return "TRUE";
  if (a.upper && compare(a.upper, t) <= 0) return "FALSE";
  return "INDETERMINATE";
}
export const and = (...xs: Truth[]): Truth => xs.includes("FALSE") ? "FALSE" : xs.every(x => x === "TRUE") ? "TRUE" : "INDETERMINATE";
export const or = (...xs: Truth[]): Truth => xs.includes("TRUE") ? "TRUE" : xs.every(x => x === "FALSE") ? "FALSE" : "INDETERMINATE";
