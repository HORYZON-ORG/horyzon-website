// Local gates never construct a live runtime or execute custom binding code.
// The reviewed built-in alias can additionally supply a read-only validator.
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { SupabasePatrimonialStore } from '../../src/lib/public-leads/patrimonial-supabase.ts';
import { getPatrimonialRemoteMapping, validatePatrimonialRemoteMapping } from '../../src/lib/public-leads/patrimonial-highlevel-config.ts';

const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const present = value => typeof value === 'string' && value.trim().length > 0;
const flagNames = ['PATRIMONIAL_SYNTHETIC_TEST_ENABLED', 'PATRIMONIAL_V2_ENABLED', 'PATRIMONIAL_CRM_WRITE_ENABLED', 'PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED', 'PATRIMONIAL_DURABLE_STORE_READY', 'PATRIMONIAL_BOOKING_ENABLED', 'PATRIMONIAL_MESSAGES_ENABLED', 'PATRIMONIAL_WEBHOOK_ENABLED'];
const forbiddenFetch = () => { throw new Error('Offline pre-flight forbids network'); };

export function validSmokeReportPaths(paths) {
  if (!paths || ![paths.directory, paths.json, paths.markdown].every(p => typeof p === 'string')) return false;
  const directory = path.resolve('tmp'), json = path.resolve(paths.json), markdown = path.resolve(paths.markdown);
  return path.resolve(paths.directory) === directory && path.dirname(json) === directory && path.dirname(markdown) === directory
    && /^patrimonial-live-smoke-[A-Za-z0-9-]+\.json$/.test(path.basename(json)) && markdown === json.slice(0, -5) + '.md';
}

// Only a single declarative export is accepted; imports, helper calls, getters,
// spreads and top-level effects are BLOCKED instead of evaluated. Function bodies
// remain inert. Complex modules require review; there is no import/eval fallback.
export function parseSmokeBindingsMetadata(source, env) {
  const ast = ts.createSourceFile('bindings.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const statement = ast.statements[0];
  if (ast.parseDiagnostics.length || ast.statements.length !== 1 || !ts.isVariableStatement(statement)
    || !(statement.declarationList.flags & ts.NodeFlags.Const) || !statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
    || statement.declarationList.declarations.length !== 1 || statement.declarationList.declarations[0].name.getText(ast) !== 'bindings') throw new Error('Unsupported binding metadata');
  const inspect = node => {
    if (!node) throw new Error('Missing binding metadata');
    if (ts.isObjectLiteralExpression(node)) {
      const result = Object.create(null);
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) throw new Error('Unsupported binding metadata');
        const key = property.name.text;
        if (Object.hasOwn(result, key)) throw new Error('Duplicate binding metadata');
        result[key] = inspect(property.initializer);
      }
      return result;
    }
    if (ts.isStringLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return forbiddenFetch;
    if (ts.isPropertyAccessExpression(node) && node.getText(ast) === 'process.env.HIGHLEVEL_LOCATION_ID') return env.HIGHLEVEL_LOCATION_ID;
    throw new Error('Unsupported binding metadata');
  };
  return inspect(statement.declarationList.declarations[0].initializer);
}
export async function readSmokeBindingsMetadata(filename, env) {
  if (!filename) return { blockers: ['--bindings missing'] };
  const file = path.resolve(filename), relative = path.relative(path.resolve('tmp'), file);
  if (!file.endsWith('.mjs') || relative.split(path.sep)[0] !== '..') return { blockers: ['--bindings invalid path (requires .mjs outside tmp/)'] };
  let source;
  try { source = await readFile(file, 'utf8'); } catch { return { blockers: ['--bindings file unreadable'] }; }
  if (source.length > 262144) return { blockers: ['--bindings file too large'] };
  try { return { bindings: parseSmokeBindingsMetadata(source, env) }; }
  catch { return { blockers: ['--bindings not statically inspectable (requires declarative export const bindings)'] }; }
}

function bindingBlockers(bindings, env) {
  if (!bindings) return ['--bindings missing'];
  const blockers = [], check = (condition, name) => { if (!condition) blockers.push(`${name} missing or invalid`); };
  const http = b => b?.verified === true && typeof b.request === 'function' && typeof b.decode === 'function';
  check(bindings.verified === true, 'bindings.verified');
  check(bindings.sideEffectsReviewed === true, 'bindings.sideEffectsReviewed');
  check(id(bindings.locationId) && bindings.locationId === env.HIGHLEVEL_LOCATION_ID, 'bindings.locationId / HIGHLEVEL_LOCATION_ID');
  for (const key of ['email', 'phone', 'contact', 'create']) check(http(bindings.contacts?.bindings?.[key]), `bindings.contacts.bindings.${key}`);
  check(bindings.contacts?.bindings?.create?.createOnly === true, 'bindings.contacts.bindings.create.createOnly');
  if (bindings.contacts?.upsert) check(http(bindings.contacts.upsert), 'bindings.contacts.upsert');
  for (const key of ['contactsRead', 'contactsWrite', 'tagsWrite', 'notesWrite']) check(bindings.contacts?.capabilities?.[key] === true, `bindings.contacts.capabilities.${key}`);
  if (bindings.contacts?.capabilities?.notesRead === true) check(http(bindings.contacts?.bindings?.noteLookup), 'bindings.contacts.bindings.noteLookup');
  check(http(bindings.tags), 'bindings.tags'); check(bindings.opportunities?.verified === true, 'bindings.opportunities.verified');
  for (const key of ['search', 'get', 'create']) check(http(bindings.opportunities?.[key]), `bindings.opportunities.${key}`);
  return blockers;
}

export async function preflightPatrimonialSmoke({ env, reportPaths, bindings, loadBindings, syntheticGuard, validateRemote }) {
  const blockers = [], configBlockers = [], storeBlockers = [];
  for (const name of ['HIGHLEVEL_LOCATION_ID', 'HIGHLEVEL_PRIVATE_TOKEN']) if (!present(env[name])) configBlockers.push(`${name} missing`);
  if (present(env.HIGHLEVEL_LOCATION_ID) && !id(env.HIGHLEVEL_LOCATION_ID)) configBlockers.push('HIGHLEVEL_LOCATION_ID invalid');
  if (present(env.HIGHLEVEL_PRIVATE_TOKEN) && /[\r\n]/.test(env.HIGHLEVEL_PRIVATE_TOKEN)) configBlockers.push('HIGHLEVEL_PRIVATE_TOKEN invalid');
  const urlName = env.SUPABASE_URL !== undefined ? 'SUPABASE_URL' : 'NEXT_PUBLIC_SUPABASE_URL';
  const url = env[urlName]?.trim(), key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) storeBlockers.push(env.SUPABASE_URL === undefined && env.NEXT_PUBLIC_SUPABASE_URL === undefined ? 'SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL missing' : `${urlName} missing`);
  else {
    try {
      const parsed = new URL(url);
      if ((parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)))
        || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') storeBlockers.push(`${urlName} invalid`);
    } catch { storeBlockers.push(`${urlName} invalid`); }
  }
  if (!key) storeBlockers.push('SUPABASE_SERVICE_ROLE_KEY missing');
  else if (/^sb_publishable_/i.test(key) || /[\r\n]/.test(key)) storeBlockers.push('SUPABASE_SERVICE_ROLE_KEY invalid (server key required)');
  const flagBlockers = flagNames.filter(name => ![undefined, '', 'false', 'true'].includes(env[name])).map(name => `${name} invalid (expected true/false)`);
  for (const name of ['PATRIMONIAL_BOOKING_ENABLED', 'PATRIMONIAL_MESSAGES_ENABLED', 'PATRIMONIAL_WEBHOOK_ENABLED']) if (env[name] === 'true') flagBlockers.push(`${name} must be disabled`);
  configBlockers.push(...storeBlockers, ...flagBlockers); blockers.push(...configBlockers);
  let storeReady = storeBlockers.length === 0;
  if (storeReady) {
    try { new SupabasePatrimonialStore({ url, serviceRoleKey: key, fetchImpl: forbiddenFetch }); }
    catch { storeReady = false; blockers.push('Supabase server config invalid'); }
  }
  let mappingReady = false, mappingChecks = { architectPath: false, a01: false, tags: false, customFields: false };
  try {
    const resources = getPatrimonialRemoteMapping(env), validation = validatePatrimonialRemoteMapping(resources);
    mappingChecks = { architectPath: id(resources.pipelines.ARCHITECT_PATH.id), a01: id(resources.pipelines.ARCHITECT_PATH.stages.A01.id),
      tags: ['horyzon-patrimoniale', 'percorso-architetto-patrimoniale', 'pilot'].every(name => id(resources.tags[name]?.id)),
      customFields: Object.values(resources.contactFields).every(f => id(f.id)) && Object.values(resources.opportunityFields).every(f => id(f.id)) };
    mappingReady = validation.remoteMappingReady && Object.values(mappingChecks).every(Boolean);
  } catch { /* Only a constant diagnostic, never the JSON override or IDs. */ }
  if (!mappingReady) blockers.push('PATRIMONIAL_HIGHLEVEL_REMOTE_IDS_JSON / remote mapping invalid or incomplete');
  let syntheticGuardReady = flagBlockers.length === 0;
  try { syntheticGuard(); } catch { syntheticGuardReady = false; blockers.push('synthetic test data guard invalid'); }
  const reportPathReady = validSmokeReportPaths(reportPaths);
  if (!reportPathReady) blockers.push('report path missing or invalid (requires new JSON/MD under tmp/)');
  let metadataBlockers = [];
  if (loadBindings) {
    try { const loaded = await loadBindings(); bindings = loaded.bindings; metadataBlockers = loaded.blockers ?? []; }
    catch { metadataBlockers = ['--bindings metadata inspection failed']; }
  }
  if (!metadataBlockers.length) metadataBlockers = bindingBlockers(bindings, env);
  blockers.push(...metadataBlockers);
  const result = { configReady: configBlockers.length === 0, mappingReady, mappingChecks, storeReady, providerBindingReady: metadataBlockers.length === 0,
    syntheticGuardReady, reportPathReady, liveGuardsEnabled: flagNames.slice(0, 5).every(name => env[name] === 'true'),
    storeReadinessScope: 'LOCAL_CONFIG_ONLY', storeHealthChecked: false, remoteReads: [], writesAttempted: false, blockers };
  // Only the built-in real alias supplies this reviewed read-only validator.
  // Missing local config never causes a network request or enables a flag.
  if (validateRemote && blockers.length === 0) Object.assign(result, await validateRemote());
  return result;
}
