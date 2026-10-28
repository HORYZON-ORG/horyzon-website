import {createHash} from 'node:crypto';
import {withoutReadableCacheHeaders} from './lib/readable-cache-config.mjs';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {assertSourcesAt} from './lib/patrimonial-integration-baselines.mjs';
import {assertRouteMoves} from './lib/patrimonial-public-preservation.mjs';
const baseline='d77bb70f6caf7ca2ba75e0b89c5b4ba5f12b57cd';
const read=f=>readFileSync(f,'utf8').replaceAll('\r\n','\n');
const old=f=>execFileSync('git',['show',baseline+':'+f],{encoding:'utf8'}).replaceAll('\r\n','\n');
assertRouteMoves();
const expected=old('src/app/layout.tsx')
 .replace("import { headers } from 'next/headers';\n",'')
 .replace("import { patrimonialRadarMode } from '@/lib/patrimonial-radar-ui/public-mode';\n",'')
 .replace('export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {','/* Shared static document: request-time APIs belong only to the Radar root layout. */\nexport default function SiteDocument({ children, isolated = false }: Readonly<{ children: React.ReactNode; isolated?: boolean }>) {')
 .replace(/^  const isolated = .*\n/m,'');
assert.equal(read('src/app/site-document.tsx'),expected,'Only request lookup extracted: scripts/metadata/fonts/CSS/markup preserved');
const ordinaryLayout=read('src/app/(site)/layout.tsx');
assert.match(ordinaryLayout,/export \{ metadata, viewport \} from '..\/site-document'/);
assert.match(ordinaryLayout,/export default function SiteLayout\(\{ children \}: \{ children: ReactNode \}\)/);
assert.match(ordinaryLayout,/return <SiteDocument>\{children\}<\/SiteDocument>/);
assert.doesNotMatch(ordinaryLayout,/next\/headers|force-dynamic|isolated\s*[=:]/,'Ordinary routes keep static default document; route props cannot include the internal isolation option');
assert.equal(createHash('sha256').update(ordinaryLayout).digest('hex'),JSON.parse(read('scripts/fixtures/patrimonial-foundation-source-manifest.json'))['src/app/(site)/layout.tsx'],'Exact reviewed Next-compatible layout adapter');
const radar=read('src/app/radar-patrimoniale/layout.tsx');
assert.match(radar,/anonymous && \(await headers\(\)\).get\('x-horyzon-radar-document'\) !== 'anonymous'\) notFound\(\)/);
assert.match(radar,/<SiteDocument isolated={anonymous \|\| identified}>/);
assertSourcesAt(baseline,['src/proxy.ts','src/lib/patrimonial-radar-ui/public-mode.ts','src/app/radar-patrimoniale/page.tsx','scripts/build-readable.mjs','package.json']);
for(const [file,from,to] of [
 ['src/components/patrimonial-pilot-shell.tsx','@/app/(patrimonial-pilot)/','@/app/(site)/(patrimonial-pilot)/'],
 ['src/components/job-ad-builder.tsx','@/app/annuncio-10x/','@/app/(site)/annuncio-10x/']
])assert.equal(read(file),old(file).replace(from,to),'Only import relocation: '+file);
// Negative proof: moved routes remain protected, not merely excluded from git diff.
const probe='src/app/(site)/radar/page.tsx',bytes=readFileSync(probe);
try{writeFileSync(probe,Buffer.concat([bytes,Buffer.from('\n// forbidden mutation\n')]));assert.throws(assertRouteMoves);}finally{writeFileSync(probe,bytes);}
console.log('PASS document layouts: static ordinary root; request lookup isolated to Radar; exact shell extraction/import-only changes; 33 protected moves; negative mutation rejected; Readable/flags/Proxy/clients untouched');

assert.equal(withoutReadableCacheHeaders(read('next.config.ts')),old('next.config.ts').replace('const nextConfig: NextConfig = {','const nextConfig: NextConfig = {\n experimental: { globalNotFound: true },'));
assert.match(read('src/app/global-not-found.tsx'), /<SiteDocument><NotFound \/><\/SiteDocument>/);

assert.throws(()=>withoutReadableCacheHeaders(read('next.config.ts').replace('private, no-store, max-age=0, must-revalidate','public, s-maxage=31536000')),'Unsafe cache declarations are never normalized away');
assert.throws(()=>withoutReadableCacheHeaders(read('next.config.ts').replace("value: 'no-store'","value: 's-maxage=300'")),'CDN caching override is never normalized away');

// Exact reviewed UX replacement; all isolation/layout gates above remain unchanged.
const uxPins=JSON.parse(read('scripts/fixtures/patrimonial-public-source-manifest.json'));assert.equal(createHash('sha256').update(read('src/components/patrimonial-radar/anonymous-client.tsx')).digest('hex'),uxPins['src/components/patrimonial-radar/anonymous-client.tsx']);
