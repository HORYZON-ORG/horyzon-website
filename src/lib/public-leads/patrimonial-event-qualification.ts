// Event-only structured qualification for the PREVIEW pilot event form (2A).
// Durable v2 and the architect candidate funnel deliberately remain unchanged;
// Hub writes remain OFF until the private database migration is verified.
import { eventInstruments, eventKnowledgeLevels, eventProfiles, eventScenes } from '../../content/patrimonial-event-content.ts';

export const PATRIMONIAL_EVENT_QUALIFICATION_SCHEMA = 1 as const;
export type EventAudienceProfile = typeof eventProfiles[number]['label'];
export type EventSceneId = typeof eventScenes[number]['id'];
export type EventInstrumentId = typeof eventInstruments[number]['id'];
export type EventKnowledgeLevel = typeof eventKnowledgeLevels[number];

export type EventQualification = {
  schemaVersion: typeof PATRIMONIAL_EVENT_QUALIFICATION_SCHEMA;
  audienceProfile: EventAudienceProfile | null;
  sceneId: EventSceneId | null;
  consultationRequested: boolean | null;
  instruments: { instrumentId: EventInstrumentId; knowledgeLevel: EventKnowledgeLevel }[];
};

const own = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const exactly = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const ids = new Set<string>(eventInstruments.map(instrument => instrument.id));
const levels = new Set<string>(eventKnowledgeLevels);
const profiles = new Set<string>(eventProfiles.map(profile => profile.label));
const scenes = new Set<string>(eventScenes.map(scene => scene.id));

/** Reject unknown fields, implicit false, duplicate instruments and presentation labels outside the versioned catalogue. */
export function validateEventQualification(raw: unknown): EventQualification | null {
  if (!own(raw) || !exactly(raw, ['schemaVersion', 'audienceProfile', 'sceneId', 'consultationRequested', 'instruments'])) return null;
  if (raw.schemaVersion !== 1) return null;
  if (raw.audienceProfile !== null && (typeof raw.audienceProfile !== 'string' || !profiles.has(raw.audienceProfile))) return null;
  if (raw.sceneId !== null && (typeof raw.sceneId !== 'string' || !scenes.has(raw.sceneId))) return null;
  if (raw.consultationRequested !== null && typeof raw.consultationRequested !== 'boolean') return null;
  if (!Array.isArray(raw.instruments) || raw.instruments.length > eventInstruments.length) return null;
  const seen = new Set<string>();
  const instruments: EventQualification['instruments'] = [];
  for (const value of raw.instruments) {
    if (!own(value) || !exactly(value, ['instrumentId', 'knowledgeLevel']) ||
      typeof value.instrumentId !== 'string' || !ids.has(value.instrumentId) ||
      typeof value.knowledgeLevel !== 'string' || !levels.has(value.knowledgeLevel) ||
      seen.has(value.instrumentId)) return null;
    seen.add(value.instrumentId);
    instruments.push({ instrumentId: value.instrumentId as EventInstrumentId, knowledgeLevel: value.knowledgeLevel as EventKnowledgeLevel });
  }
  instruments.sort((a, b) => a.instrumentId.localeCompare(b.instrumentId, 'en'));
  return {
    schemaVersion: 1,
    audienceProfile: raw.audienceProfile as EventAudienceProfile | null,
    sceneId: raw.sceneId as EventSceneId | null,
    consultationRequested: raw.consultationRequested as boolean | null,
    instruments,
  };
}

/** Stable, PII-free representation for hashing and immutable snapshots. Never use free-form CRM notes for decisions. */
export function canonicalEventQualification(raw: unknown): string | null {
  const qualified = validateEventQualification(raw);
  return qualified ? JSON.stringify(qualified) : null;
}

/** Null signals are unknown, not false or 'low knowledge'. */
export function eventQualificationSnapshot(raw: unknown): {
  schemaVersion: 1;
  audienceProfile: EventAudienceProfile | null;
  sceneId: EventSceneId | null;
  awarenessLevel: number | null;
  consultationRequested: boolean | null;
  instruments: EventQualification['instruments'];
} | null {
  const value = validateEventQualification(raw);
  if (!value) return null;
  const scene = eventScenes.find(item => item.id === value.sceneId);
  return { ...value, awarenessLevel: scene?.level ?? null };
}
