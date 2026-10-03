export function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeForDecision(value: string): string {
  return compactText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/\b(euro|eur)\b/gi, '€')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeNumberText(value: string): string {
  return normalizeForDecision(value)
    .replace(/(\d)\.(?=\d{3}\b)/g, '$1')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/(\d)\s+(?=\d{3}\b)/g, '$1')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*€\s*/g, '€');
}

export function includesEquivalent(haystack: string, needle: string): boolean {
  const normalizedHaystack = normalizeNumberText(haystack);
  const normalizedNeedle = normalizeNumberText(needle);
  if (!normalizedNeedle) return true;
  if (normalizedHaystack.includes(normalizedNeedle)) return true;
  const tokens = meaningfulTokens(normalizedNeedle);
  if (tokens.length === 0) return true;
  const required = tokens.length <= 4 ? tokens.length : Math.ceil(tokens.length * 0.72);
  return tokens.filter((token) => normalizedHaystack.includes(token)).length >= required;
}

export function meaningfulTokens(value: string): string[] {
  const stop = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'a', 'da', 'in', 'con', 'per', 'e', 'o', 'un', 'una', 'uno', 'del', 'della', 'delle', 'dei', 'degli', 'al', 'alla', 'alle', 'ai', 'agli', 'che', 'non', 'sono', 'essere', 'nel', 'nella']);
  return normalizeNumberText(value)
    .split(/[^a-z0-9€]+/i)
    .filter((token) => token.length >= 3 || /\d/.test(token) || token === '€')
    .filter((token) => !stop.has(token));
}

export function splitListLike(value: string): string[] {
  return compactText(value)
    .split(/[;\n]|(?:\s+-\s+)/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function sentences(value: string): string[] {
  return compactText(value)
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function hasUnknownText(value: string): boolean {
  return /\b(?:non\s+(?:sono\s+stat[ei]\s+)?dichiarat[aoie]?|non\s+(?:sono\s+stat[ei]\s+)?specificat[aoie]?|non\s+(?:sono\s+stat[ei]\s+)?indicat[aoie]?|non disponibil[ei]|non\s+sono\s+disponibili|nessun[ao]?|da definire)\b/i.test(value);
}

export function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
