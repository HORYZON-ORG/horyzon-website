import {
  PATRIMONIAL_PILOT_MARKETING_VERSION, PATRIMONIAL_PILOT_PRIVACY_VERSION,
  patrimonialBrand, patrimonialEvent, pilotAvailability, pilotExperience, pilotForms, pilotGoals, pilotUtmKeys,
  type PilotMode, type PilotUtm,
} from '../../content/patrimonial-funnels.ts';
import { normalizePhone } from '../radar/highlevel.ts';

type CommonLead = {
  firstName: string; lastName: string; email: string; phone: string; province: string;
  profile: string; message: string; consent: true; marketingConsent: boolean; utm: PilotUtm;
};
export type PilotLead = CommonLead & (
  { mode: 'architect-path'; experience: string; goal: string; availability: string }
  | { mode: 'patrimonial-event' }
);
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max ? value.trim() : null;
const choice = (value: unknown, choices: readonly string[]) => value === undefined || value === '' ? '' : typeof value === 'string' && choices.includes(value) ? value : null;

export function validatePilotLead(input: Record<string, unknown>): PilotLead | null {
  if (input.mode !== 'architect-path' && input.mode !== 'patrimonial-event') return null;
  const mode = input.mode;
  const allowed = new Set(['mode', 'sourcePath', 'firstName', 'lastName', 'email', 'phone', 'province', 'profile', 'message', 'consent', 'marketingConsent', 'website', 'utm', ...(mode === 'architect-path' ? ['experience', 'goal', 'availability'] : [])]);
  if (Object.keys(input).some(key => !allowed.has(key)) || input.sourcePath !== pilotForms[mode].path || input.website || input.consent !== true || typeof input.marketingConsent !== 'boolean') return null;
  const firstName = text(input.firstName, 120), lastName = text(input.lastName, 120), email = text(input.email, 254), province = text(input.province, 80);
  const rawPhone = text(input.phone ?? '', 40), message = text(input.message ?? '', 1500);
  const profile = choice(input.profile, pilotForms[mode].profiles);
  if (!firstName || !lastName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !province || province.length < 2 || rawPhone === null || message === null || profile === null) return null;
  if ([firstName, lastName, province].some(value => /[\r\n]/.test(value))) return null;
  const phone = normalizePhone(rawPhone);
  if ((mode === 'architect-path' && !phone) || (phone && !/^\+[1-9]\d{7,14}$/.test(phone))) return null;
  const utm: PilotUtm = {};
  if (input.utm !== undefined) {
    if (!input.utm || typeof input.utm !== 'object' || Array.isArray(input.utm)) return null;
    for (const [key, value] of Object.entries(input.utm)) {
      if (!pilotUtmKeys.includes(key as typeof pilotUtmKeys[number])) return null;
      const clean = text(value, 100);
      if (clean === null || /[\r\n]/.test(clean)) return null;
      if (clean) utm[key as typeof pilotUtmKeys[number]] = clean;
    }
  }
  const common: CommonLead = { firstName, lastName, email: email.toLowerCase(), phone, province, profile, message, consent: true, marketingConsent: input.marketingConsent, utm };
  if (mode === 'patrimonial-event') return { ...common, mode };
  const experience = choice(input.experience, pilotExperience), goal = choice(input.goal, pilotGoals), availability = choice(input.availability, pilotAvailability);
  if (experience === null || goal === null || availability === null) return null;
  return { ...common, mode, experience, goal, availability };
}

// No automatic fallback from a malformed pilot request into the public contract.
export function isLegacyLeadPayload(input: Record<string, unknown>): boolean {
  return (input.mode === undefined || input.mode === 'legacy/public') &&
    !['sourcePath', 'firstName', 'lastName', 'province', 'profile', 'experience', 'goal', 'availability', 'marketingConsent', 'utm'].some(key => Object.hasOwn(input, key));
}

export function pilotCrmDetails(lead: PilotLead, now: Date) {
  const form = pilotForms[lead.mode];
  const label = lead.mode === 'architect-path' ? patrimonialBrand.path : patrimonialEvent.title;
  const fields = [
    `Funnel: ${lead.mode}`, `Percorso: ${label}`, `Source path: ${form.path}`, `Ricevuta: ${now.toISOString()}`,
    `Nome: ${lead.firstName}`, `Cognome: ${lead.lastName}`, `Provincia: ${lead.province}`, `Profilo: ${lead.profile || 'Non indicato'}`,
    ...(lead.mode === 'architect-path' ? [`Esperienza commerciale/relazionale: ${lead.experience || 'Non indicata'}`, `Cosa cerca: ${lead.goal || 'Non indicato'}`, `Disponibilità: ${lead.availability || 'Non indicata'}`] : []),
    `Consenso privacy / ricontatto: sì · ${PATRIMONIAL_PILOT_PRIVACY_VERSION} · /privacy-policy`,
    `Consenso marketing: ${lead.marketingConsent ? 'sì' : 'no'} · ${PATRIMONIAL_PILOT_MARKETING_VERSION}`,
    ...pilotUtmKeys.flatMap(key => lead.utm[key] ? [`${key}: ${lead.utm[key]}`] : []),
    ...(lead.message ? [`Domanda: ${lead.message}`] : []),
    lead.mode === 'architect-path' ? 'Richiesta ricevuta: nessuna accettazione o ingresso garantito.' : 'Richiesta di partecipazione: nessuna registrazione definitiva o prenotazione confermata.',
  ];
  return {
    source: `${patrimonialBrand.division} · ${lead.mode} (horyzon.it)`,
    tags: ['horyzon-patrimoniale', lead.mode === 'architect-path' ? 'percorso-architetto-patrimoniale' : 'evento-patrimoniale', 'pilot'],
    note: fields.join('\n'),
  };
}

export const pilotMode = (value: unknown): value is PilotMode => value === 'architect-path' || value === 'patrimonial-event';
