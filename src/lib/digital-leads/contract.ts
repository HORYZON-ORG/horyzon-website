import { createHash } from 'node:crypto';

export const DIGITAL_PRIVACY_VERSION = 'digital-intake-v1';
export type DigitalTerritory = 'salento' | 'barese' | 'nazionale';
export type DigitalFrequency = 'daily' | 'weekly' | 'monthly' | 'other';
export type DigitalPayload = {
  first_name: string; last_name: string; company_name: string;
  email: string; phone: string | null; province: string;
  activity: string; frequency: DigitalFrequency; tools: string;
  territory: DigitalTerritory; privacy_version: string;
};
export type DigitalSubmission = { requestId: string; payload: DigitalPayload; hash: string };
const requestIdRe = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.length <= max ? v.trim().replace(/\s+/g, ' ') : null;
const inRange = (value: string | null, min: number, max: number): value is string =>
  value !== null && value.length >= min && value.length <= max;

export function digitalTerritory(province: string): DigitalTerritory {
  const p = province.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (['lecce', 'brindisi', 'taranto', 'salento', 'le', 'br', 'ta'].includes(p)) return 'salento';
  if (['bari', 'barletta', 'andria', 'trani', 'barletta-andria-trani', 'bat', 'ba', 'bt'].includes(p)) return 'barese';
  return 'nazionale'; // Routing suggestion only, not an automatic personal assignment.
}

function normalizePhone(raw: string): string | null {
  if (!raw) return '';
  const value = raw.replace(/[\s.()/\-]/g, '');
  const international = value.startsWith('00') ? '+' + value.slice(2) : value.startsWith('+') ? value : '+39' + value;
  return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
}

export function parseDigitalSubmission(input: unknown, headerId: string | null): DigitalSubmission | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const v = input as Record<string, unknown>;
  if (v.website || v.consent !== true || typeof v.requestId !== 'string' ||
    !requestIdRe.test(v.requestId) || v.requestId.toLowerCase() !== headerId?.toLowerCase()) return null;

  const first = clean(v.firstName, 80), last = clean(v.lastName, 80);
  const company = clean(v.company, 150), email = clean(v.email, 254);
  const province = clean(v.province, 80), activity = clean(v.activity, 1200);
  const tools = clean(v.tools ?? '', 200), rawPhone = clean(v.phone ?? '', 35);
  const frequency = v.frequency;
  if (!inRange(first, 2, 80) || !inRange(last, 2, 80) ||
    !inRange(company, 2, 150) || !inRange(email, 5, 254) || !emailRe.test(email) ||
    !inRange(province, 2, 80) || !inRange(activity, 20, 1200) ||
    tools === null || rawPhone === null ||
    !['daily','weekly','monthly','other'].includes(String(frequency))) return null;
  const phone = normalizePhone(rawPhone);
  if (phone === null) return null;

  const payload: DigitalPayload = {
    first_name: first, last_name: last, company_name: company,
    email: email.toLowerCase(), phone: phone || null, province, activity,
    frequency: frequency as DigitalFrequency, tools, territory: digitalTerritory(province),
    privacy_version: DIGITAL_PRIVACY_VERSION,
  };
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return { requestId: v.requestId.toLowerCase(), payload, hash };
}
