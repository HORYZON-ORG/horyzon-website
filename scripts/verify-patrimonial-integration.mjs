import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { MAIN_BASELINE, FUNNEL_BASELINE, assertSourcesAt, assertAssetsAt, filesAt, sourceAt } from './lib/patrimonial-integration-baselines.mjs';
import { RADAR_QUESTIONNAIRE_VERSION } from '../src/lib/radar/types.ts';
import { radarSteps } from '../src/lib/radar/domain.ts';
import { create as parseFont } from 'fontkit';

assert.equal(RADAR_QUESTIONNAIRE_VERSION, 'radar-v4');
assert.equal(radarSteps().length, 34);
assert.equal(radarSteps().filter(step => step.kind === 'POSITIONING').length, 1);
const radar = assertSourcesAt(MAIN_BASELINE, ['src/lib/radar', 'src/components/radar', 'src/app/api/radar', 'src/app/radar', 'src/app/radar-impresa', 'docs/radar']);
const publicLeads = assertSourcesAt(FUNNEL_BASELINE, ['src/lib/public-leads', 'src/app/api/public-leads']);
assert(!existsSync('src/lib/public-leads/patrimonial-assignments.ts'), 'Concurrent assignment implementation must not enter this worktree');
assert(!existsSync('supabase/migrations/20261018094926_patrimonial_assignment_management.sql'));
assert(!existsSync('.env.local'), 'No original local configuration is copied');
const expectedSql = [...new Set([...filesAt(MAIN_BASELINE, ['supabase/migrations']), ...filesAt(FUNNEL_BASELINE, ['supabase/migrations'])])].sort();
const radarMigration = 'supabase/migrations/20261018191940_patrimonial_radar_identity_sessions.sql';
assert.deepEqual(readdirSync('supabase/migrations').map(name => `supabase/migrations/${name}`).sort(), [...expectedSql,radarMigration].sort(), 'Only the additive 4C.1 migration is allowed beyond the twenty protected migrations');
for (const file of expectedSql) {
  const ref = filesAt(MAIN_BASELINE, [file]).length ? MAIN_BASELINE : FUNNEL_BASELINE;
  assertSourcesAt(ref, [file]);
}
const assetRoot = 'public/benessere-patrimoniale';
const assets = assertAssetsAt(FUNNEL_BASELINE, [assetRoot]);
assert.equal(assets.length, 35);
assert.deepEqual(readdirSync(assetRoot, { recursive: true }).filter(name => /\.jpg$/.test(name)).map(name => `${assetRoot}/${name.replaceAll('\\', '/')}`).sort(), assets.slice().sort());
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const mainPackage = JSON.parse(sourceAt(MAIN_BASELINE, 'package.json'));
for (const ref of [MAIN_BASELINE, FUNNEL_BASELINE]) {
  const parent = JSON.parse(sourceAt(ref, 'package.json'));
  // Shared scripts evolved on main (v4, AI Score, Annunci). Preserve that
  // reviewed command plus every funnel-only script, rather than the older copy.
  for (const [key, value] of Object.entries(parent.scripts)) assert.equal(pkg.scripts[key], mainPackage.scripts[key] ?? value, `Keep reviewed script ${key}`);
  assert.deepEqual(pkg.dependencies, parent.dependencies, `Runtime dependencies unchanged from ${ref.slice(0,7)}`);
  assert.deepEqual(pkg.devDependencies, {...parent.devDependencies,'@electric-sql/pglite':'0.5.10'}, 'Only the pinned local PostgreSQL test runtime is additive');
}
const lock = JSON.parse(readFileSync('package-lock.json','utf8')), oldLock = JSON.parse(sourceAt(MAIN_BASELINE,'package-lock.json'));
assert.equal(lock.packages['node_modules/@electric-sql/pglite'].version,'0.5.10');
assert.equal(lock.packages['node_modules/@electric-sql/pglite'].dev,true);
delete lock.packages['node_modules/@electric-sql/pglite']; delete lock.packages[''].devDependencies['@electric-sql/pglite'];
assert.deepEqual(lock,oldLock,'Every pre-existing dependency resolution and integrity remains unchanged');
const oldRoute = sourceAt(MAIN_BASELINE, 'src/app/api/internal/ai-score/provider-preflight/route.ts');
const auth = readFileSync('src/lib/ai-score/internal-preflight-auth.ts', 'utf8').replaceAll('\r\n', '\n');
assert.equal(auth.slice(auth.indexOf('export function')).trim(), oldRoute.slice(oldRoute.indexOf('export function')).trim(), 'Authorization implementation extracted unchanged');
const route = readFileSync('src/app/api/internal/ai-score/provider-preflight/route.ts', 'utf8').replaceAll('\r\n', '\n');
assert.equal(route.slice(route.indexOf('export const')).trim(), oldRoute.slice(oldRoute.indexOf('export const'), oldRoute.indexOf('export function')).trim(), 'Route handling and report status unchanged');
const fontFile = 'src/app/(site)/(patrimonial-pilot)/fonts/jetbrains-mono-latin-wght-normal.woff2';
const fontBytes = readFileSync(fontFile);
assert.equal(fontBytes.toString('ascii', 0, 4), 'wOF2');
const font = parseFont(fontBytes);
assert.equal(font.familyName, 'JetBrains Mono');
assert(font.variationAxes.wght.min <= 500 && font.variationAxes.wght.max >= 600);
for (const character of 'àèéìòù') assert(font.hasGlyphForCodePoint(character.codePointAt(0)));
assert.equal(readFileSync('src/app/(site)/(patrimonial-pilot)/fonts/OFL-jetbrains-mono.txt', 'utf8').replaceAll('\r\n', '\n'), sourceAt(MAIN_BASELINE, 'src/lib/radar/fonts/OFL-jetbrains-mono.txt'));
console.log(`PASS integration: Radar v4/34 screens, ${radar.length} main Radar files, ${publicLeads.length} funnel CRM files, ${expectedSql.length} unchanged migration files + one additive 4C.1 candidate, all 35 byte-identical photos, parent scripts/runtime dependencies and old lock entries retained, one pinned dev-only PostgreSQL runtime, assignment work and secrets excluded. No remote calls.`);
