// Radar leads into HighLevel (LeadConnector API v2): the free Radar is the lead magnet, the CRM follows it up.
// Starting the Radar upserts the contact and tags it; completing it adds the outcome tags and a note with the scores.
// Off until HIGHLEVEL_PRIVATE_TOKEN and HIGHLEVEL_LOCATION_ID are set; a CRM failure never blocks the Radar.
import type { RadarReport } from './report.ts';

const API_BASE = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';
const HUB_RADAR_URL = 'https://hub.horyzon.it/finance';

export const RADAR_TAG = 'radar-impresa';
export const RADAR_STARTED_TAG = 'radar-avviato';
export const RADAR_COMPLETED_TAG = 'radar-completato';

export interface RadarLead {
  aziendaNome: string;
  referenteNome: string;
  referenteEmail: string;
  referenteTelefono: string;
  settore: string;
  volumeAffari: string;
  numeroDipendenti: string;
}

export interface HighLevelConfig { token: string; locationId: string; fetchImpl?: typeof fetch }

export function highLevelConfig(env: Record<string, string | undefined> = process.env): HighLevelConfig | null {
  const token = env.HIGHLEVEL_PRIVATE_TOKEN?.trim();
  const locationId = env.HIGHLEVEL_LOCATION_ID?.trim();
  return token && locationId ? { token, locationId } : null;
}

/** HighLevel wants E.164: Italian numbers typed without a prefix get +39. */
export function normalizePhone(raw: string): string {
  const compact = raw.replace(/[\s().\-/]/g, '');
  if (!compact) return '';
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  return `+39${compact}`;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

const euro = (value: number, digits = 0) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

export function radarOutcomeTags(report: RadarReport): string[] {
  const tags = [RADAR_TAG, RADAR_COMPLETED_TAG, `radar-indice-${report.global.band.replace(/_/g, '-')}`];
  if (report.economics) tags.push(`radar-utile-ora-${report.economics.band.replace(/_/g, '-')}`);
  return tags;
}

export function radarLeadNote(lead: RadarLead, report: RadarReport): string {
  const lines = [
    `Radar d’Impresa completato — ${lead.aziendaNome}`,
    '',
    `Indice globale: ${report.global.score}/100 (${report.global.bandLabel})`,
    `Maturità organizzativa: ${report.organizationalMaturity}/100 · Autonomia dal titolare: ${report.autonomy.score}/100 · AI: ${report.ai.score}/100`,
    `Reparti: ${report.areas.map((area) => `${area.label} ${area.score}`).join(' · ')}`,
    `Più solido: ${report.strongest.label} · Prioritario: ${report.weakest.label}`,
  ];
  if (report.economics) {
    lines.push(`Utile per ora lavorata: ${euro(report.economics.hourlyProfit, 2)} (${report.economics.bandLabel}) — utile ${euro(report.economics.monthlyProfit)}/mese, ${Math.round(report.economics.monthlyHours)} ore/mese`);
  }
  if (report.priorities.length) {
    lines.push('', 'Priorità dei prossimi 90 giorni:');
    report.priorities.forEach((priority, index) => lines.push(`${index + 1}. ${priority.advice.title || priority.question} (${priority.area})`));
  }
  lines.push('', `Settore: ${lead.settore} · Dipendenti: ${lead.numeroDipendenti} · Volume d’affari: ${lead.volumeAffari}${report.seasonal ? ' · Attività stagionale' : ''}`);
  lines.push(`Scheda completa e PDF nell’Hub: ${HUB_RADAR_URL}`);
  return lines.join('\n');
}

async function call<T>(config: HighLevelConfig, path: string, body: unknown): Promise<T> {
  const response = await (config.fetchImpl ?? fetch)(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, Version: API_VERSION, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HighLevel ${path.split('/')[1] ?? ''} ${response.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

// Upsert never sends tags: in HighLevel they would replace the contact's existing ones. Tags go through the add-tags call.
async function upsertContact(config: HighLevelConfig, lead: RadarLead): Promise<string> {
  const payload = await call<{ contact?: { id?: string } }>(config, '/contacts/upsert', {
    locationId: config.locationId,
    ...splitName(lead.referenteNome),
    email: lead.referenteEmail,
    phone: normalizePhone(lead.referenteTelefono) || undefined,
    companyName: lead.aziendaNome,
    source: 'Radar d’Impresa (horyzon.it)',
  });
  const id = payload.contact?.id;
  if (!id) throw new Error('HighLevel upsert returned no contact id');
  return id;
}

export async function syncRadarLeadStarted(config: HighLevelConfig, lead: RadarLead): Promise<string> {
  const contactId = await upsertContact(config, lead);
  await call(config, `/contacts/${encodeURIComponent(contactId)}/tags`, { tags: [RADAR_TAG, RADAR_STARTED_TAG] });
  return contactId;
}

export async function syncRadarLeadCompleted(config: HighLevelConfig, lead: RadarLead, report: RadarReport): Promise<string> {
  const contactId = await upsertContact(config, lead);
  await call(config, `/contacts/${encodeURIComponent(contactId)}/tags`, { tags: radarOutcomeTags(report) });
  await call(config, `/contacts/${encodeURIComponent(contactId)}/notes`, { body: radarLeadNote(lead, report) });
  return contactId;
}

/** Fire-and-forget wrapper for route handlers: logs, never throws. */
export async function runHighLevelSync(label: string, task: (config: HighLevelConfig) => Promise<unknown>): Promise<void> {
  const config = highLevelConfig();
  if (!config) return;
  try { await task(config); }
  catch (error) { console.error('HighLevel sync failed', { step: label, message: error instanceof Error ? error.message : 'unknown' }); }
}
