import {createHash} from 'node:crypto';
import {withoutReadableCacheHeaders} from './lib/readable-cache-config.mjs';
import {assertPublicPilotPreservation} from './lib/patrimonial-public-preservation.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { patrimonialRadarDemoEnabled } from '../src/lib/patrimonial-radar-ui/demo-gate.ts';
import { route, confirmDraft, initialValue, latestDraft, field, label } from '../src/lib/patrimonial-radar-ui/presentation.ts';
import { QUESTION_CATALOG } from '../src/lib/patrimonial-radar/catalog.ts';
import { resolveAnswers } from '../src/lib/patrimonial-radar/answers.ts';
import { diagnose } from '../src/lib/patrimonial-radar/result.ts';
import { validateValue } from '../src/lib/patrimonial-radar/validation.ts';
import { buildFixture, set, money } from './patrimonial-radar-fixtures.mjs';
assert.equal(patrimonialRadarDemoEnabled({}), false);
for (const env of [{ PATRIMONIAL_RADAR_DEMO_ENABLED: 'true' }, { PATRIMONIAL_RADAR_DEMO_ENABLED: 'true', PATRIMONIAL_RADAR_DEMO_CONTEXT: 'production' }, { PATRIMONIAL_RADAR_DEMO_ENABLED: 'false', PATRIMONIAL_RADAR_DEMO_CONTEXT: 'local-test' }, { PATRIMONIAL_RADAR_DEMO_ENABLED: 'true', PATRIMONIAL_RADAR_DEMO_CONTEXT: 'local-test', VERCEL: '1' }, { PATRIMONIAL_RADAR_DEMO_ENABLED: 'true', PATRIMONIAL_RADAR_DEMO_CONTEXT: 'local-test', VERCEL_ENV: 'production' }]) assert.equal(patrimonialRadarDemoEnabled(env), false);
assert.equal(patrimonialRadarDemoEnabled({ PATRIMONIAL_RADAR_DEMO_ENABLED: 'true', PATRIMONIAL_RADAR_DEMO_CONTEXT: 'local-test', NODE_ENV: 'production' }), true, 'Explicit local production-mode browser tests only');
assert.equal(route(buildFixture('T02')).length, 29);
const t1 = buildFixture('T01'); assert.equal(route(t1).length, 26); assert.ok(!route(t1).includes('RP-F04')); assert.ok(!route(t1).includes('RP-C02'));
assert.deepEqual(route(t1).filter(q => q.startsWith('RP-C')), ['RP-C01', 'RP-C03']);
assert.equal(route(t1).indexOf('RP-C01') < route(t1).indexOf('RP-B01'), true);
assert.equal(confirmDraft(t1, 'RP-A01', latestDraft(t1, 'RP-A01')), t1, 'Unchanged confirmations do not invalidate dependents');
let revised = confirmDraft(buildFixture('T02'), 'RP-S01', { state: 'VALUE', value: 'INDIVIDUAL' });
assert.equal(resolveAnswers(revised)['RP-A01'].lifecycle, 'RECONFIRM');
assert.equal(diagnose(revised).indicators['I-A01'].usable, false);
revised = confirmDraft(revised, 'RP-A01', latestDraft(revised, 'RP-A01'));
assert.equal(resolveAnswers(revised)['RP-A01'].value.scope, 'INDIVIDUAL');
const branch = set(buildFixture('T02'), 'RP-D01', ['LIABILITY']);
const matrix = confirmDraft(branch, 'RP-X03', { state: 'VALUE', value: initialValue('RP-X03', branch) });
assert.equal(validateValue('RP-X03', latestDraft(matrix, 'RP-X03').value).length, 0);
assert.deepEqual(Object.keys(latestDraft(matrix, 'RP-X03').value), ['LIABILITY']);
const noFinancial = set(t1, 'RP-E01', { complete: true, categories: ['CASH'] });
const amounts = confirmDraft(noFinancial, 'RP-X04', { state: 'VALUE', value: { complete: true, rows: { FINANCIAL: field(money(90000)) } } });
assert.deepEqual(latestDraft(amounts, 'RP-X04').value.rows, {});
for (const state of ['UNKNOWN', 'DECLINED', 'UNANSWERED']) { const changed = confirmDraft(t1, 'RP-B02', { state }); assert.equal(resolveAnswers(changed)['RP-B02'].state, state); assert.equal(diagnose(changed).indicators['I-B01'].usable, false); }
for (const q of QUESTION_CATALOG) for (const code of q.options) assert.notEqual(label(code, q.id), 'Da precisare', `${q.id}/${code}: all catalog options have human labels`);
const sources = fs.readdirSync('src/components/patrimonial-radar').filter(f => /\.(tsx|css)$/.test(f)).map(f => fs.readFileSync(`src/components/patrimonial-radar/${f}`, 'utf8')).join('\n');
assert.doesNotMatch(sources, /localStorage|sessionStorage|sendBeacon|console\.|fetch\(|XMLHttpRequest|\/api\/radar/);
assert.doesNotMatch(sources, /<polygon|overflow(?:-x)?:\s*hidden/);
const api = fs.readFileSync('src/lib/patrimonial-radar-ui/api.ts', 'utf8'); assert.match(api, /credentials: 'same-origin'/); assert.match(api, /cache: 'no-store'/); assert.doesNotMatch(api, /localStorage|sessionStorage|sendBeacon|console\.|NEXT_PUBLIC/);
// Authorized 4C.2 changes preserve the 4B question widgets, palette and radar geometry.
for (const file of ['controls.tsx','question-fields.tsx','goals-fields.tsx']) {
 const path = `src/components/patrimonial-radar/${file}`;
 if(file==='question-fields.tsx'){ assert.equal(fs.readFileSync(path,'utf8').replaceAll('\r\n','\n'),execFileSync('git',['show',`90592d99f3bf930a968cadab71ea312abfacc858:${path}`],{encoding:'utf8'}).replaceAll('\r\n','\n'));} else {const pins=JSON.parse(fs.readFileSync('scripts/fixtures/patrimonial-public-source-manifest.json','utf8'));assert.equal(createHash('sha256').update(fs.readFileSync(path,'utf8').replaceAll('\r\n','\n')).digest('hex'),pins[path],'Precisely reviewed 4P.4B widget; no broad baseline exception');}
}
const oldStyles = execFileSync('git',['show','90592d99f3bf930a968cadab71ea312abfacc858:src/components/patrimonial-radar/radar.module.css'],{encoding:'utf8'}).replaceAll('\r\n','\n').trimEnd();
assert.ok(fs.readFileSync('src/components/patrimonial-radar/radar.module.css','utf8').replaceAll('\r\n','\n').startsWith(oldStyles));
const oldResult = execFileSync('git',['show','90592d99f3bf930a968cadab71ea312abfacc858:src/components/patrimonial-radar/result-preview.tsx'],{encoding:'utf8'}).replaceAll('\r\n','\n');
const newResult = fs.readFileSync('src/components/patrimonial-radar/result-preview.tsx','utf8').replaceAll('\r\n','\n');
for (const [begin,end] of [['const states:', 'export function ResultPreview'],['<svg ', '</svg>']]) assert.equal(newResult.slice(newResult.indexOf(begin),newResult.indexOf(end)),oldResult.slice(oldResult.indexOf(begin),oldResult.indexOf(end)));
const page = fs.readFileSync('src/app/radar-patrimoniale/page.tsx', 'utf8'); assert.match(page, /notFound\(\)/); assert.match(page, /patrimonialRadarDemoEnabled\(process.env\)/); assert.match(page, /index: false, follow: false/);
const originalConfig = execFileSync('git', ['show', '489ed590b113bca1b9530c2c177a8d275a477fc5:next.config.ts'], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
const rawConfig = withoutReadableCacheHeaders(fs.readFileSync('next.config.ts', 'utf8').replaceAll('\r\n', '\n')).replace(' experimental: { globalNotFound: true },\n','');
const advisorPolicy = rawConfig.indexOf("{ source: '/internal/radar-patrimoniale/advisor-preview', headers: [");
const customerPolicy = rawConfig.indexOf("{ source: '/radar-patrimoniale', headers: [");
assert.ok(advisorPolicy > 0 && customerPolicy > advisorPolicy);
const config = rawConfig.slice(0,advisorPolicy)+rawConfig.slice(customerPolicy);
const routePolicy = config.indexOf("{ source: '/radar-patrimoniale', headers: [");
const nextPolicy = config.indexOf("{ source: '/annunci-10x', headers: [", routePolicy);
assert.ok(routePolicy > 0 && nextPolicy > routePolicy);
assert.equal(config.slice(0, routePolicy) + config.slice(nextPolicy), originalConfig, 'Existing global and product headers are byte-preserved; only the new route receives the restrictive demo policy');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')), originalPkg = JSON.parse(execFileSync('git', ['show', '489ed590b113bca1b9530c2c177a8d275a477fc5:package.json'], { encoding: 'utf8' }));
// 5B.4 adds only the reviewed server-side OIDC SDK and JOSE verifier. Every
// historical dependency remains pinned by the same exact comparison.
assert.deepEqual(pkg.dependencies, {...originalPkg.dependencies,'@vercel/oidc':'4.0.0','jose':'6.2.12'}); assert.deepEqual(pkg.devDependencies, {...originalPkg.devDependencies,'@electric-sql/pglite':'0.5.10'});
// Preserve every historical API/SQL file while allowing only the explicitly authorized additive backend.
const oldApiSql = execFileSync('git',['ls-tree','-r','--name-only','489ed590b113bca1b9530c2c177a8d275a477fc5','--','src/app/api','supabase'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const apiSqlChanges = execFileSync('git',['diff','--name-only','489ed590b113bca1b9530c2c177a8d275a477fc5','--','src/app/api','supabase'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const reviewed5A=JSON.parse(fs.readFileSync('scripts/fixtures/patrimonial-foundation-source-manifest.json','utf8'));
assert.ok(apiSqlChanges.every(p=>['src/app/api/patrimonial-radar/[...segments]/route.ts','supabase/migrations/20261018191940_patrimonial_radar_identity_sessions.sql',...Object.keys(reviewed5A)].includes(p)));
assertPublicPilotPreservation('33724abcfc04ebf6b073f14cf5039948a83a4cb4',apiSqlChanges);
const allProtected = [...oldApiSql, 'src/lib/radar', 'src/components/radar', 'src/app/radar', 'src/app/radar-impresa', 'src/lib/public-leads', 'src/lib/annunci-10x', 'src/lib/ai-score', 'src/components/patrimonial-event-landing.tsx', 'src/components/patrimonial-event.module.css', 'src/components/patrimonial-architect-landing.tsx', 'src/components/patrimonial-architect.module.css', 'public', 'src/lib/patrimonial-radar', 'src/app/layout.tsx', 'src/app/sitemap.ts'];
assertPublicPilotPreservation('489ed590b113bca1b9530c2c177a8d275a477fc5',[...allProtected]);
console.log('PASS UI contracts: default-off/local-only gate, 40 catalog options, 29 ordinary/11 optional render paths, adaptive routing, reconfirmation, unchanged revisions, explicit missing states, linked liquidity, matrices, no storage/logs or transport in components (same-origin API adapter tested separately), no scores, protected products unchanged. Browser verification is a separate command.');
