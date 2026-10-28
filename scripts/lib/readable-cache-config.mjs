import assert from 'node:assert/strict';
export const readableCacheDeclaration = `// Both representations of / must bypass HTTP caches while Next overwrites Vary.
// This affects response caching only: the real home remains prerendered for Readable.
const readableCacheHeaders = [
 { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
 { key: 'CDN-Cache-Control', value: 'no-store' },
 { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
];
`;

// Historical baselines still compare the entire config after removing only
// these exact, reviewed additions on / and /home.md.
export function withoutReadableCacheHeaders(source) {
 assert.equal(source.split(readableCacheDeclaration).length,2,'Exactly one approved cache declaration');
 let result=source.replace(readableCacheDeclaration,'');
 for(const p of ['/','/home.md']) {
  const expected="{ source: '"+p+"', headers: [\n   ...readableCacheHeaders,\n";
  assert.equal(result.split(expected).length,2,'Cache policy must apply exactly once to '+p);
  result=result.replace(expected,"{ source: '"+p+"', headers: [\n");
 }
 assert(!result.includes('readableCacheHeaders'),'No cache policy changes on other routes');
 return result;
}
