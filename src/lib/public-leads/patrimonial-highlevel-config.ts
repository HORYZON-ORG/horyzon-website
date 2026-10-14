import {
  patrimonialPipelines, commonOpportunityFields, architectOpportunityFields, consultationOpportunityFields,
  type PatrimonialPipeline, type PatrimonialPipelineMapping,
} from './patrimonial-routing.ts';

// Server module: Node-only routing dependency; never import from a client/page.
// IDs are configuration, supplied and reread by the user on 2026-10-15. No token
// or location ID was supplied. This catalog certifies no HTTP binding/capability.
if (typeof window !== 'undefined') throw new Error('Patrimonial mapping is server-only.');
type Field = { id: string; fieldKey: string };
type Stage = { id: string; funnel: PatrimonialPipeline };
export type PatrimonialRemoteMapping = {
  pipelines: Record<PatrimonialPipeline, { id: string; stages: Record<string, Stage> }>;
  tags: Record<string, { id: string; name: string }>;
  contactFields: Record<string, Field>;
  opportunityFields: Record<string, Field>;
};
const stages = (funnel: PatrimonialPipeline, ids: Record<string, string>): Record<string, Stage> => Object.fromEntries(Object.entries(ids).map(([code, id]) => [code, { id, funnel }]));
const field = (id: string, fieldKey: string): Field => ({ id, fieldKey });
const baseline: PatrimonialRemoteMapping = {
  pipelines: {
    ARCHITECT_PATH: { id: 'N2hsjiShcdMbzAITjxOA', stages: stages('ARCHITECT_PATH', {
      A01: '1506fbbf-c48e-4896-a52e-1464a7105460', A02: 'fcdfe082-9a69-43ba-b178-4550bc968b46',
      A03: 'c0068e27-ac31-4a11-99e4-2782979c2423', A04: '3397939f-cf52-4968-8ec8-ff6d49824d66',
      A05: '532486a4-a535-47d2-831a-bf9757011f12', A06: '245983c2-c9fb-4d58-815e-314122c2e2c0',
      A07: '26a1d1cf-a342-4611-9fb8-26938c1f0348', A08: 'c8cd21c8-183b-486d-b7bf-765567f3b5f1',
      A09: '0ea40507-5b7b-4ffc-830b-d229b315f1ec', A10: 'f4ce3546-f85a-4c70-b712-e76e0afd5bbe',
    }) },
    PATRIMONIAL_EVENT: { id: 'RGRNXX0TAFbZc24Q4n77', stages: stages('PATRIMONIAL_EVENT', {
      E01: 'ed092495-1c21-436f-bcc2-a947a6935199', E02: '92e4a7fe-44eb-42e5-a2be-cfd2f961a1f4',
      E03: '9b055010-2f18-449f-8fcc-8c45d1bea38d', E04: '4086106a-8c16-437c-962e-7525dab0ee4d', E05: '2df3bad4-4c8b-4ac1-b4c1-ead23ba15bc2',
    }) },
    PATRIMONIAL_CONSULTATION: { id: 'QVwH7wecGsa0ioikWGWY', stages: stages('PATRIMONIAL_CONSULTATION', {
      C01: '03598a30-3fe1-418d-ad9e-35a2c882ac62', C02: '30d57714-d3d7-403d-9da5-238e671e2c5e',
      C03: 'a17018a1-1550-4cb2-84a7-ac89b804159f', C04: '8617a182-5827-498f-b81c-e1257a512957', C05: '02736391-0c2a-41bf-8cf5-1fdcaed4e3b8',
    }) },
  },
  tags: {
    'horyzon-patrimoniale': { name: 'horyzon-patrimoniale', id: 'SuXLkEShKLQlqgmYnFbu' },
    'percorso-architetto-patrimoniale': { name: 'percorso-architetto-patrimoniale', id: 'QVyrGrtgpiiWWLhEvvbN' },
    'evento-patrimoniale': { name: 'evento-patrimoniale', id: 'kE1ZmZ6Ike2wpdSSdd8V' },
    pilot: { name: 'pilot', id: 'SgxFYbhfAaNT7LGJ2t5r' },
  },
  contactFields: {
    hz_province: field('pCvZBUAinEedVU3Jwela', 'contact.hz__provincia_dichiarata'),
    hz_marketing_consent: field('VHlJ4N0aCgfF3xqndH8O', 'contact.hz__stato_marketing_horyzon'),
    hz_marketing_consent_version: field('TxEceyk4t3r3HF1a0GjX', 'contact.hz__versione_consenso_marketing'),
    hz_marketing_consent_at: field('f6MsN8R5PbvwdHXdQQkE', 'contact.hz__data_consenso_marketing'),
  },
  opportunityFields: {
    hz_intent_key: field('pI0y1xJa8yjqbAHNmclB', 'opportunity.hz__chiave_intenzione'),
    hz_funnel: field('g0nkIYMwFaE2UUVFAvSp', 'opportunity.hz__funnel'),
    hz_source: field('KamTKT48CFYp09Kv8YKH', 'opportunity.hz__sorgente'),
    hz_source_path: field('dWZm1ZHuYxXxF0yqyU8k', 'opportunity.hz__pagina_origine'),
    hz_utm_source: field('wHfqIFPPMRbwnLjVSJt0', 'opportunity.hz__utm_source'),
    hz_utm_medium: field('bwJRb19iqGdvF1f90WgM', 'opportunity.hz__utm_medium'),
    hz_utm_campaign: field('NerfgW45rNekgPkc3fsX', 'opportunity.hz__utm_campaign'),
    hz_utm_content: field('Uiwkjch5Nh9t2PdWFiGS', 'opportunity.hz__utm_content'),
    hz_utm_term: field('FboXsJqc7YnbuiRQlwFQ', 'opportunity.hz__utm_term'),
    hz_requested_at: field('9YAEADdZXJLBa7NpMXwR', 'opportunity.hz__prima_richiesta'),
    hz_privacy_version: field('PUQPCllXsUtaD4ij3xDG', 'opportunity.hz__versione_privacy'),
    hz_marketing_consent_snapshot: field('urj0sLimkqZIyAA6lMzu', 'opportunity.hz__marketing_richiesta_iniziale'),
    hz_next_step: field('ZQOMAVhnDHop3pwD6sda', 'opportunity.hz__prossimo_passo'),
    hz_next_step_at: field('EaDpyLACj7IKV49l1Mb9', 'opportunity.hz__scadenza_prossimo_passo'),
    hz_architect_profile: field('rLq7Y0r60U80oiUVAVmk', 'opportunity.hz__profilo_professionale'),
    hz_architect_sales_experience: field('wjJiaEgsrbmvr1Cm6n5o', 'opportunity.hz__esperienza_commerciale_relazionale'),
    hz_architect_goal: field('MGdqgomupLhfnplrI2pk', 'opportunity.hz__obiettivo_professionale'),
    hz_architect_availability: field('f3damUBztULdvHZZuzZ4', 'opportunity.hz__disponibilit'),
    hz_architect_open_answer: field('OIseBlcF2qODIjEHFcuV', 'opportunity.hz__motivazione_dichiarata'),
    hz_architect_presentation_date: field('HuJlbVvvvstcaJr3THem', 'opportunity.hz__data_presentazione'),
    hz_architect_presentation_attended: field('69WgIaeUdOM7vhuaPvA4', 'opportunity.hz__presenza_presentazione'),
    hz_architect_interview_date: field('JvLZ2qdylvrI36LZkIAU', 'opportunity.hz__data_colloquio'),
    hz_architect_interview_outcome: field('IOn0ysAeE9khPQL4oFbG', 'opportunity.hz__esito_colloquio'),
    hz_architect_eligibility: field('MyfNLmX2Ju22nE4t1fWR', 'opportunity.hz__idoneit'),
    // Inventory only: edition/registration/attendance truth stays in Participation.
    hz_event_slug: field('rSr8Xij19IPvmx9MJpVV', 'opportunity.hz__evento_logico'),
    hz_event_registration_status: field('Gg3JNZkYVv1atOCFIxK2', 'opportunity.hz__stato_registrazione_evento'),
    hz_event_attendance: field('SKWm2XBiJ2JAzO2uIuKV', 'opportunity.hz__presenza_evento'),
    hz_origin_event_edition: field('AJVDbvBjZHzrlllvaMHJ', 'opportunity.hz__edizione_evento_origine'),
    hz_consultation_outcome: field('e1veVo5oWBY3SAq59gv1', 'opportunity.hz__esito_confronto'),
  },
};

export class PatrimonialMappingConfigError extends Error { constructor() { super('Invalid patrimonial remote resource mapping.'); } }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const exactKeys = (value: unknown, expected: string[]) => object(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const cloneBaseline = () => structuredClone(baseline);
const eventInventoryFields = ['hz_event_slug','hz_event_registration_status','hz_event_attendance'];

export function validatePatrimonialRemoteMapping(mapping: unknown = cloneBaseline()) {
  const issues: string[] = [], seen = new Set<string>();
  const counts = { pipelines: 0, stages: 0, tags: 0, contactFields: 0, opportunityFields: 0 };
  const baselineSlots = new Map<string, string>();
  for (const [funnel, pipeline] of Object.entries(baseline.pipelines)) {
    baselineSlots.set(pipeline.id, `pipeline:${funnel}`);
    for (const [code, stage] of Object.entries(pipeline.stages)) baselineSlots.set(stage.id, `stage:${funnel}:${code}`);
  }
  for (const section of ['tags','contactFields','opportunityFields'] as const) for (const [key, resource] of Object.entries(baseline[section])) baselineSlots.set(resource.id, `${section}:${key}`);
  const checkId = (value: unknown, slot: string) => {
    if (!id(value)) { issues.push(`MISSING_OR_INVALID:${slot}`); return; }
    if (seen.has(value)) issues.push(`DUPLICATE_ID:${slot}`);
    seen.add(value);
    if (baselineSlots.has(value) && baselineSlots.get(value) !== slot) issues.push(`WRONG_RESOURCE:${slot}`);
  };
  if (!object(mapping) || !exactKeys(mapping, ['pipelines','tags','contactFields','opportunityFields'])) return { remoteMappingReady: false, issues: ['INVALID_SHAPE'], counts };
  const pipelines = mapping.pipelines;
  if (!exactKeys(pipelines, Object.keys(patrimonialPipelines))) issues.push('PIPELINES_INCOMPLETE');
  for (const funnel of Object.keys(patrimonialPipelines) as PatrimonialPipeline[]) {
    const p = object(pipelines) ? pipelines[funnel] : null;
    if (!object(p)) { issues.push(`MISSING_PIPELINE:${funnel}`); continue; }
    counts.pipelines++; checkId(p.id, `pipeline:${funnel}`);
    const codes = Object.keys(patrimonialPipelines[funnel].stages);
    if (!exactKeys(p.stages, codes)) issues.push(`STAGES_INCOMPLETE:${funnel}`);
    for (const code of codes) {
      const stage = object(p.stages) ? p.stages[code] : null;
      if (!object(stage)) { issues.push(`MISSING_STAGE:${funnel}:${code}`); continue; }
      counts.stages++; checkId(stage.id, `stage:${funnel}:${code}`);
      if (stage.funnel !== funnel) issues.push(`WRONG_FUNNEL:${funnel}:${code}`);
      if (id(stage.id) && baseline.pipelines[funnel].stages[code]?.id === stage.id && p.id !== baseline.pipelines[funnel].id) issues.push(`STAGE_PIPELINE_MISMATCH:${funnel}:${code}`);
    }
  }
  for (const section of ['tags','contactFields','opportunityFields'] as const) {
    const resources = mapping[section];
    if (!exactKeys(resources, Object.keys(baseline[section]))) issues.push(`INCOMPLETE:${section}`);
    for (const key of Object.keys(baseline[section])) {
      const resource = object(resources) ? resources[key] : null;
      if (!object(resource)) { issues.push(`MISSING:${section}:${key}`); continue; }
      counts[section]++; checkId(resource.id, `${section}:${key}`);
      if (section === 'tags') { if (resource.name !== key) issues.push(`WRONG_TAG:${key}`); }
      else if (resource.fieldKey !== (baseline[section][key] as Field).fieldKey) issues.push(`WRONG_FIELD_KEY:${section}:${key}`);
    }
  }
  return { remoteMappingReady: issues.length === 0, issues, counts };
}

// Optional server-only JSON: { pipelines: { FUNNEL: id }, stages: { A01: id },
// tags: { logicalName: id }, contactFields: { hz_key: id }, opportunityFields: {...} }.
// Overrides express an operator-approved binding; validation is structural, not a
// remote verification. Unknown slots/invalid JSON are rejected, never ignored.
export function getPatrimonialRemoteMapping(env: Record<string, string | undefined> = process.env): PatrimonialRemoteMapping {
  if (typeof window !== 'undefined') throw new PatrimonialMappingConfigError();
  const mapping = cloneBaseline(), raw = env.PATRIMONIAL_HIGHLEVEL_REMOTE_IDS_JSON;
  if (raw !== undefined) {
    let overrides: unknown;
    try { if (raw.length > 20000) throw new Error(); overrides = JSON.parse(raw); } catch { throw new PatrimonialMappingConfigError(); }
    if (!object(overrides) || Object.keys(overrides).some(key => !['pipelines','stages','tags','contactFields','opportunityFields'].includes(key))) throw new PatrimonialMappingConfigError();
    for (const [section, values] of Object.entries(overrides)) {
      if (!object(values)) throw new PatrimonialMappingConfigError();
      for (const [key, value] of Object.entries(values)) {
        if (!id(value)) throw new PatrimonialMappingConfigError();
        if (section === 'pipelines') {
          if (!Object.hasOwn(mapping.pipelines, key)) throw new PatrimonialMappingConfigError();
          mapping.pipelines[key as PatrimonialPipeline].id = value;
        } else if (section === 'stages') {
          const pipeline = Object.values(mapping.pipelines).find(p => Object.hasOwn(p.stages, key));
          if (!pipeline) throw new PatrimonialMappingConfigError(); pipeline.stages[key].id = value;
        } else {
          const resources = mapping[section as 'tags' | 'contactFields' | 'opportunityFields'];
          if (!Object.hasOwn(resources, key)) throw new PatrimonialMappingConfigError(); resources[key].id = value;
        }
      }
    }
  }
  if (!validatePatrimonialRemoteMapping(mapping).remoteMappingReady) throw new PatrimonialMappingConfigError();
  return mapping; // Detached snapshot; callers cannot mutate the versioned baseline.
}

export function createPatrimonialRemotePipelineMapping(verifiedLocationId: string, env: Record<string, string | undefined> = process.env): PatrimonialPipelineMapping {
  const resources = getPatrimonialRemoteMapping(env);
  if (!id(verifiedLocationId) || (env.HIGHLEVEL_LOCATION_ID !== undefined && env.HIGHLEVEL_LOCATION_ID.trim() !== verifiedLocationId)) throw new PatrimonialMappingConfigError();
  return {
    locationId: verifiedLocationId,
    pipelines: Object.fromEntries((Object.keys(patrimonialPipelines) as PatrimonialPipeline[]).map(funnel => {
      const fields = [...commonOpportunityFields, ...(funnel === 'ARCHITECT_PATH' ? architectOpportunityFields : funnel === 'PATRIMONIAL_CONSULTATION' ? consultationOpportunityFields : [])];
      return [funnel, { pipelineId: resources.pipelines[funnel].id, stages: Object.fromEntries(Object.entries(resources.pipelines[funnel].stages).map(([code, value]) => [code, value.id])), fields: Object.fromEntries(fields.map(key => [key, resources.opportunityFields[key].id])) }];
    })) as PatrimonialPipelineMapping['pipelines'],
    // Empty remote catalog: no native reason ID or conditional custom field exists.
    closeReason: { mode: 'UNRESOLVED', key: null },
  };
}

export function patrimonialContactCustomFieldIds(values: Record<string, string>, mapping: PatrimonialRemoteMapping = getPatrimonialRemoteMapping()) {
  if (!validatePatrimonialRemoteMapping(mapping).remoteMappingReady || Object.keys(values).some(key => !Object.hasOwn(mapping.contactFields, key))) throw new PatrimonialMappingConfigError();
  return Object.entries(values).map(([key, value]) => ({ id: mapping.contactFields[key].id, value }));
}
export const patrimonialEventFieldsInventoryOnly = () => [...eventInventoryFields];
