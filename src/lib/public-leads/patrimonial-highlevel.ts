import { normalizePhone } from '../radar/highlevel.ts';
import type { PatrimonialV2Lead } from './patrimonial-contract.ts';
import { patrimonialFlags, type PatrimonialOperationError } from './patrimonial-store.ts';
import { createPatrimonialRemotePipelineMapping, getPatrimonialRemoteMapping, patrimonialContactCustomFieldIds, validatePatrimonialRemoteMapping, type PatrimonialRemoteMapping } from './patrimonial-highlevel-config.ts';

const BASE_URL = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';
export type PatrimonialCapability = boolean | 'UNKNOWN';
export type PatrimonialCrmCapabilities = Record<'contactsRead' | 'contactsWrite' | 'tagsWrite' | 'notesWrite' | 'notesRead' | 'opportunitiesRead' | 'opportunitiesWrite' | 'calendarsRead' | 'workflowsRead' | 'usersRead' | 'bookingWrite' | 'webhookRead' | 'lostReasonsRead' | 'messagingWrite', PatrimonialCapability>;
export const unverifiedPatrimonialCapabilities: PatrimonialCrmCapabilities = {
  contactsRead: 'UNKNOWN', contactsWrite: 'UNKNOWN', tagsWrite: 'UNKNOWN', notesWrite: 'UNKNOWN', notesRead: 'UNKNOWN',
  opportunitiesRead: 'UNKNOWN', opportunitiesWrite: 'UNKNOWN', calendarsRead: 'UNKNOWN', workflowsRead: 'UNKNOWN',
  usersRead: 'UNKNOWN', bookingWrite: 'UNKNOWN', webhookRead: 'UNKNOWN', lostReasonsRead: 'UNKNOWN', messagingWrite: 'UNKNOWN',
};
export type PatrimonialCrmContact = { id: string; locationId: string; email: string | null; phone: string | null; source?: string; assignedTo?: string; tags?: string[] };
export type PatrimonialCrmNote = { id: string; locationId: string; contactId: string; marker: string };
export type NewPatrimonialContact = { firstName: string; lastName: string; email: string; phone?: string };
export interface PatrimonialCrmProvider {
  readonly locationId: string;
  readonly capabilities: PatrimonialCrmCapabilities;
  readonly verifiedTags: ReadonlySet<string>;
  assertReady(write: boolean): void;
  findContactsByEmail(email: string): Promise<PatrimonialCrmContact[]>;
  findContactsByPhone(phone: string): Promise<PatrimonialCrmContact[]>;
  getContact(id: string): Promise<PatrimonialCrmContact>;
  // NEW identities only. Implementations must create-only, never overwrite a match
  // through an anonymous upsert. The name preserves the conceptual provider interface.
  upsertContact(input: NewPatrimonialContact): Promise<PatrimonialCrmContact>;
  addTags(contactId: string, tags: string[]): Promise<void>;
  addNote(contactId: string, body: string): Promise<{ id: string }>;
  findNoteByRequestMarker?(contactId: string, marker: string): Promise<PatrimonialCrmNote | null>;
  searchOpportunities?(query: PatrimonialOpportunityQuery): Promise<PatrimonialRemoteOpportunity[]>;
  createOpportunity?(input: PatrimonialOpportunityWrite): Promise<PatrimonialRemoteOpportunity>;
  updateOpportunity?(id: string, input: PatrimonialOpportunityWrite & { expectedProviderVersion: string }): Promise<PatrimonialRemoteOpportunity>;
}

export class PatrimonialCrmError extends Error {
  readonly code: PatrimonialOperationError;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  readonly outcomeUncertain: boolean;
  constructor(code: PatrimonialOperationError, options: { status?: number; retryAfterSeconds?: number; outcomeUncertain?: boolean } = {}) {
    // Deliberately no provider body, URL/query, contact, credentials or original cause.
    super(`Patrimonial CRM ${code}`); this.name = 'PatrimonialCrmError';
    this.code = code; this.status = options.status; this.retryAfterSeconds = options.retryAfterSeconds;
    this.outcomeUncertain = options.outcomeUncertain === true;
  }
}
type HttpSpec = { method: 'GET' | 'POST' | 'PUT' | 'PATCH'; path: string; body?: unknown };
type ContactsPage = { contacts: PatrimonialCrmContact[]; complete: boolean; nextCursor?: string };
type VerifiedLookup = {
  verified: true; request: (value: string, locationId: string, cursor?: string) => HttpSpec;
  decode: (body: unknown) => ContactsPage;
};
export type PatrimonialHighLevelBindings = {
  // Exact search endpoints, pagination and decoders were not supplied by the remote
  // inventory. They must be verified server-side; no guessed defaults are installed.
  email?: VerifiedLookup; phone?: VerifiedLookup;
  contact?: { verified: true; request: (id: string) => HttpSpec; decode: (body: unknown) => PatrimonialCrmContact };
  create?: { verified: true; createOnly: true; request: (input: NewPatrimonialContact, locationId: string) => HttpSpec; decode: (body: unknown) => PatrimonialCrmContact };
  noteLookup?: { verified: true; request: (contactId: string, marker: string) => HttpSpec; decode: (body: unknown) => { complete: boolean; notes: PatrimonialCrmNote[] } };
};
export type PatrimonialHighLevelOptions = {
  env?: () => Record<string, string | undefined>; verifiedLocationId: string;
  capabilities?: Partial<PatrimonialCrmCapabilities>; verifiedTags?: readonly string[];
  bindings?: PatrimonialHighLevelBindings; baseUrl?: string; fetchImpl?: typeof fetch;
  now?: () => Date;
};

export function checkedPatrimonialContact(contact: PatrimonialCrmContact, locationId: string): PatrimonialCrmContact {
  if (!contact || typeof contact.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(contact.id) || contact.locationId !== locationId) throw new PatrimonialCrmError('CONFIG');
  if ((contact.email !== null && typeof contact.email !== 'string') || (contact.phone !== null && typeof contact.phone !== 'string')) throw new PatrimonialCrmError('SCHEMA');
  if (contact.tags !== undefined && (!Array.isArray(contact.tags) || contact.tags.some(x => typeof x !== 'string'))) throw new PatrimonialCrmError('SCHEMA');
  return { ...contact, email: contact.email?.trim().toLowerCase() ?? null, phone: contact.phone ? normalizePhone(contact.phone) : null };
}

export class PatrimonialHighLevelProvider implements PatrimonialCrmProvider {
  readonly capabilities: PatrimonialCrmCapabilities;
  readonly verifiedTags: ReadonlySet<string>;
  private options: PatrimonialHighLevelOptions;
  constructor(options: PatrimonialHighLevelOptions) {
    this.options = options;
    this.capabilities = { ...unverifiedPatrimonialCapabilities, ...options.capabilities };
    this.verifiedTags = new Set(options.verifiedTags ?? []);
  }
  private config(write: boolean) {
    const env = (this.options.env ?? (() => process.env))();
    const token = env.HIGHLEVEL_PRIVATE_TOKEN?.trim();
    const locationId = env.HIGHLEVEL_LOCATION_ID?.trim();
    const flags = patrimonialFlags(env);
    if (!flags.v2 || (write && !flags.crmWrite) || !token || /[\r\n]/.test(token) || !locationId || !/^[a-zA-Z0-9_-]{1,128}$/.test(locationId)
      || locationId !== this.options.verifiedLocationId || (this.options.baseUrl ?? BASE_URL) !== BASE_URL) throw new PatrimonialCrmError('CONFIG');
    return { token, locationId };
  }
  get locationId() { return this.config(false).locationId; }
  assertReady(write: boolean) {
    this.config(write);
    const bindings = this.options.bindings;
    if (this.capabilities.contactsRead !== true || !bindings?.email?.verified || !bindings.phone?.verified || !bindings.contact?.verified) throw new PatrimonialCrmError('CONFIG');
    if (write && (this.capabilities.contactsWrite !== true || this.capabilities.tagsWrite !== true || this.capabilities.notesWrite !== true || !bindings.create?.verified || !bindings.create.createOnly)) throw new PatrimonialCrmError('CONFIG');
  }
  private async request(spec: HttpSpec, effect: 'READ' | 'CREATE' | 'TAGS' | 'NOTE'): Promise<unknown> {
    const write = effect !== 'READ';
    const { token } = this.config(write); // recheck flags and location for every fetch
    let url: URL;
    try { url = new URL(spec.path, BASE_URL); } catch { throw new PatrimonialCrmError('CONFIG'); }
    if (!spec.path.startsWith('/contacts/') || url.origin !== BASE_URL || !url.pathname.startsWith('/contacts/') || url.username || url.password || url.hash || /\r|\n/.test(spec.path)) throw new PatrimonialCrmError('CONFIG');
    // Only a verified create-only binding may create. Anonymous /upsert can overwrite
    // a contact that appeared between lookup and create, so it is not used by v2.
    if (effect === 'CREATE' && (spec.method !== 'POST' || url.pathname.includes('upsert'))) throw new PatrimonialCrmError('CONFIG');
    if (effect === 'READ' && !['GET', 'POST'].includes(spec.method)) throw new PatrimonialCrmError('CONFIG');
    if (spec.method === 'GET' && spec.body !== undefined) throw new PatrimonialCrmError('CONFIG');
    const uncertain = effect === 'CREATE' || effect === 'NOTE';
    let response: Response;
    try {
      response = await (this.options.fetchImpl ?? fetch)(url.toString(), {
        method: spec.method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${token}`, Version: API_VERSION, Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }),
      });
    } catch { throw new PatrimonialCrmError('NETWORK', { outcomeUncertain: uncertain }); }
    if (!response.ok) {
      const status = response.status;
      const code = status === 429 ? 'RATE_LIMIT' : status === 400 ? 'SCHEMA' : status === 401 || status === 403 ? 'AUTH' : status === 404 ? 'CONFIG' : status === 409 ? 'IDENTITY' : status >= 500 ? 'PROVIDER' : 'SCHEMA';
      const rawRetry = response.headers.get('retry-after');
      const seconds = rawRetry === null ? undefined : /^\d+$/.test(rawRetry.trim()) ? Number(rawRetry) : Math.max(0, Math.ceil((Date.parse(rawRetry) - (this.options.now ?? (() => new Date()))().getTime()) / 1000));
      void response.body?.cancel().catch(() => undefined);
      throw new PatrimonialCrmError(code, { status, retryAfterSeconds: Number.isFinite(seconds) ? seconds : undefined, outcomeUncertain: uncertain && status >= 500 });
    }
    if (effect === 'TAGS') { void response.body?.cancel().catch(() => undefined); return {}; }
    try { return await response.json(); } catch { throw new PatrimonialCrmError('SCHEMA', { outcomeUncertain: uncertain }); }
  }
  private async lookup(binding: VerifiedLookup | undefined, value: string, field: 'email' | 'phone') {
    if (this.capabilities.contactsRead !== true || !binding?.verified) throw new PatrimonialCrmError('CONFIG');
    const matches = new Map<string, PatrimonialCrmContact>();
    let cursor: string | undefined;
    const cursors = new Set<string>();
    for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
      const body = await this.request(binding.request(value, this.locationId, cursor), 'READ');
      let page: ContactsPage;
      try { page = binding.decode(body); } catch { throw new PatrimonialCrmError('SCHEMA'); }
      if (!page || !Array.isArray(page.contacts) || typeof page.complete !== 'boolean' || (page.complete && page.nextCursor)) throw new PatrimonialCrmError('SCHEMA');
      for (const row of page.contacts) {
        const contact = checkedPatrimonialContact(row, this.locationId);
        if (contact[field] === value) matches.set(contact.id, contact);
      }
      if (matches.size > 1 || page.complete) return [...matches.values()];
      if (!page.nextCursor || cursors.has(page.nextCursor)) throw new PatrimonialCrmError('CONFIG');
      cursor = page.nextCursor; cursors.add(cursor);
    }
    throw new PatrimonialCrmError('CONFIG'); // incomplete search is never "no match"
  }
  findContactsByEmail(email: string) { return this.lookup(this.options.bindings?.email, email.trim().toLowerCase(), 'email'); }
  findContactsByPhone(phone: string) { return this.lookup(this.options.bindings?.phone, normalizePhone(phone), 'phone'); }
  async getContact(id: string) {
    const binding = this.options.bindings?.contact;
    if (this.capabilities.contactsRead !== true || !binding?.verified) throw new PatrimonialCrmError('CONFIG');
    const body = await this.request(binding.request(id), 'READ');
    let contact: PatrimonialCrmContact;
    try { contact = binding.decode(body); } catch { throw new PatrimonialCrmError('SCHEMA'); }
    const checked = checkedPatrimonialContact(contact, this.locationId);
    if (checked.id !== id) throw new PatrimonialCrmError('CONFIG');
    return checked;
  }
  async upsertContact(input: NewPatrimonialContact) {
    const binding = this.options.bindings?.create;
    if (this.capabilities.contactsWrite !== true || !binding?.verified || !binding.createOnly) throw new PatrimonialCrmError('CONFIG');
    const clean = { firstName: input.firstName, lastName: input.lastName, email: input.email, ...(input.phone ? { phone: input.phone } : {}) };
    const body = await this.request(binding.request(clean, this.locationId), 'CREATE');
    let contact: PatrimonialCrmContact;
    try { contact = checkedPatrimonialContact(binding.decode(body), this.locationId); } catch { throw new PatrimonialCrmError('SCHEMA', { outcomeUncertain: true }); }
    if (contact.email !== input.email || (input.phone && contact.phone !== input.phone)) throw new PatrimonialCrmError('IDENTITY', { outcomeUncertain: true });
    return contact;
  }
  async addTags(contactId: string, tags: string[]) {
    if (this.capabilities.tagsWrite !== true || !tags.length || tags.some(tag => !this.verifiedTags.has(tag))) throw new PatrimonialCrmError('CONFIG');
    this.config(true);
    await this.getContact(contactId); // resource scope, not only token/location config
    await this.request({ method: 'POST', path: `/contacts/${encodeURIComponent(contactId)}/tags`, body: { tags } }, 'TAGS');
  }
  async addNote(contactId: string, body: string) {
    if (this.capabilities.notesWrite !== true) throw new PatrimonialCrmError('CONFIG');
    this.config(true);
    await this.getContact(contactId);
    const value = await this.request({ method: 'POST', path: `/contacts/${encodeURIComponent(contactId)}/notes`, body: { body } }, 'NOTE') as { note?: { id?: unknown }; id?: unknown };
    const id = value?.note?.id ?? value?.id;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new PatrimonialCrmError('SCHEMA', { outcomeUncertain: true });
    return { id };
  }
  async findNoteByRequestMarker(contactId: string, marker: string) {
    const binding = this.options.bindings?.noteLookup;
    if (this.capabilities.notesRead !== true || !binding?.verified) throw new PatrimonialCrmError('CONFIG');
    const body = await this.request(binding.request(contactId, marker), 'READ');
    let page: { complete: boolean; notes: PatrimonialCrmNote[] };
    try { page = binding.decode(body); } catch { throw new PatrimonialCrmError('SCHEMA'); }
    if (!page || page.complete !== true || !Array.isArray(page.notes)) throw new PatrimonialCrmError('CONFIG');
    if (page.notes.some(note => !note || note.locationId !== this.locationId || note.contactId !== contactId || typeof note.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(note.id) || typeof note.marker !== 'string')) throw new PatrimonialCrmError('CONFIG');
    const matches = page.notes.filter(note => note.marker === marker);
    if (matches.length > 1) throw new PatrimonialCrmError('IDENTITY');
    const note = matches[0];
    if (note && (note.locationId !== this.locationId || note.contactId !== contactId || typeof note.id !== 'string' || !note.id)) throw new PatrimonialCrmError('CONFIG');
    return note ?? null;
  }
  // Deliberate stubs: no opportunity HTTP binding or real write is installed.
  async searchOpportunities(query: PatrimonialOpportunityQuery): Promise<PatrimonialRemoteOpportunity[]> { void query; throw new PatrimonialCrmError('CONFIG'); }
  async createOpportunity(input: PatrimonialOpportunityWrite): Promise<PatrimonialRemoteOpportunity> { void input; throw new PatrimonialCrmError('CONFIG'); }
  async updateOpportunity(id: string, input: PatrimonialOpportunityWrite & { expectedProviderVersion: string }): Promise<PatrimonialRemoteOpportunity> { void id; void input; throw new PatrimonialCrmError('CONFIG'); }
}

export type PatrimonialOpportunityQuery = { locationId: string; contactId: string; pipelineId: string };
export type PatrimonialOpportunityWrite = PatrimonialOpportunityQuery & {
  pipelineStageId: string; status: 'open' | 'won' | 'lost' | 'abandoned';
  customFields: Record<string, string>; assignedTo?: string; closeReason?: { mode: 'NATIVE' | 'CUSTOM'; key: string; value: string } | null;
};
export type PatrimonialRemoteOpportunity = PatrimonialOpportunityWrite & { id: string; version: string };
export interface PatrimonialOpportunityProvider {
  readonly locationId: string;
  readonly capabilities: Pick<PatrimonialCrmCapabilities, 'opportunitiesRead' | 'opportunitiesWrite'>;
  searchOpportunities(query: PatrimonialOpportunityQuery): Promise<PatrimonialRemoteOpportunity[]>;
  createOpportunity(input: PatrimonialOpportunityWrite): Promise<PatrimonialRemoteOpportunity>;
  updateOpportunity(id: string, input: PatrimonialOpportunityWrite & { expectedProviderVersion: string }): Promise<PatrimonialRemoteOpportunity>;
}

export type PatrimonialConfiguredHighLevelOptions = Omit<PatrimonialHighLevelOptions, 'verifiedTags'> & {
  // A future verified, complete inventory reader. No guessed tags endpoint is
  // installed. Missing/deleted/mismatched tags block POST instead of provisioning.
  verifiedTagInventory?: { verified: true; read: (locationId: string) => Promise<{ complete: true; tags: { id: string; name: string; locationId: string }[] }> };
};
export class PatrimonialConfiguredHighLevelProvider extends PatrimonialHighLevelProvider {
  private readonly mappingOptions: PatrimonialConfiguredHighLevelOptions;
  private readonly mappingSnapshot: PatrimonialRemoteMapping;
  constructor(options: PatrimonialConfiguredHighLevelOptions) {
    let resources: PatrimonialRemoteMapping;
    try { resources = getPatrimonialRemoteMapping((options.env ?? (() => process.env))()); } catch { throw new PatrimonialCrmError('CONFIG'); }
    super({ ...options, verifiedTags: Object.keys(resources.tags), capabilities: {
      ...options.capabilities, calendarsRead: 'UNKNOWN', workflowsRead: 'UNKNOWN', usersRead: 'UNKNOWN', bookingWrite: 'UNKNOWN', webhookRead: 'UNKNOWN', lostReasonsRead: 'UNKNOWN', messagingWrite: 'UNKNOWN',
    } });
    this.mappingOptions = options; this.mappingSnapshot = resources;
  }
  get remoteResources() { return structuredClone(this.mappingSnapshot); }
  get remoteMappingReady() { return validatePatrimonialRemoteMapping(this.mappingSnapshot).remoteMappingReady; }
  get pipelineMapping() {
    try {
      // Preserve one coherent snapshot even if process env changes later.
      const env = (this.mappingOptions.env ?? (() => process.env))();
      const latest = getPatrimonialRemoteMapping(env);
      if (JSON.stringify(latest) !== JSON.stringify(this.mappingSnapshot)) throw new PatrimonialCrmError('CONFIG');
      return createPatrimonialRemotePipelineMapping(this.mappingOptions.verifiedLocationId, env);
    } catch { throw new PatrimonialCrmError('CONFIG'); }
  }
  contactCustomFieldIds(values: Record<string, string>) { return patrimonialContactCustomFieldIds(values, this.mappingSnapshot); }
  override async addTags(contactId: string, tags: string[]) {
    this.assertReady(true); // flags/location/capabilities first; no network if off
    const binding = this.mappingOptions.verifiedTagInventory;
    if (!binding?.verified || !tags.length || tags.some(name => !Object.hasOwn(this.mappingSnapshot.tags, name))) throw new PatrimonialCrmError('CONFIG');
    let inventory: Awaited<ReturnType<NonNullable<PatrimonialConfiguredHighLevelOptions['verifiedTagInventory']>['read']>>;
    try { inventory = await binding.read(this.locationId); } catch { throw new PatrimonialCrmError('CONFIG'); }
    if (!inventory || inventory.complete !== true || !Array.isArray(inventory.tags) || tags.some(name => {
      const matches = inventory.tags.filter(tag => tag && tag.name === name);
      return matches.length !== 1 || matches[0].id !== this.mappingSnapshot.tags[name].id || matches[0].locationId !== this.locationId;
    })) throw new PatrimonialCrmError('CONFIG');
    await super.addTags(contactId, tags); // contact scope and flags rechecked
  }
}

export function createConfiguredPatrimonialHighLevelProvider(options: PatrimonialConfiguredHighLevelOptions) {
  return new PatrimonialConfiguredHighLevelProvider(options);
}

export type PatrimonialIdentity = { kind: 'NEW' } | { kind: 'REUSE'; contact: PatrimonialCrmContact } | { kind: 'IDENTITY_REVIEW' };
export async function resolvePatrimonialIdentity(provider: PatrimonialCrmProvider, lead: PatrimonialV2Lead): Promise<PatrimonialIdentity> {
  const emails = (await provider.findContactsByEmail(lead.email)).map(x => checkedPatrimonialContact(x, provider.locationId));
  const phones = lead.phone ? (await provider.findContactsByPhone(lead.phone)).map(x => checkedPatrimonialContact(x, provider.locationId)) : [];
  if (emails.some(x => x.email !== lead.email) || phones.some(x => x.phone !== lead.phone)) throw new PatrimonialCrmError('SCHEMA');
  if (emails.length > 1 || phones.length > 1) return { kind: 'IDENTITY_REVIEW' };
  if (!emails.length) return phones.length ? { kind: 'IDENTITY_REVIEW' } : { kind: 'NEW' };
  if (phones.some(x => x.id !== emails[0].id)) return { kind: 'IDENTITY_REVIEW' };
  const contact = checkedPatrimonialContact(await provider.getContact(emails[0].id), provider.locationId);
  if (contact.id !== emails[0].id || contact.email !== lead.email) return { kind: 'IDENTITY_REVIEW' };
  return { kind: 'REUSE', contact }; // no anonymous changes to reliable data
}
