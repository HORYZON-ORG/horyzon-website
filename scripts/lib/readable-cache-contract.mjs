import assert from 'node:assert/strict';

export const hasVary = (value, token) => (value ?? '').split(',').some(part => part.trim().toLowerCase() === token.toLowerCase());
const directives = value => (value ?? '').split(',').map(part => part.trim().toLowerCase()).filter(Boolean);
function forbidsStorage(value, requirePrivate = false) {
 const parts=directives(value);
 return parts.includes('no-store') && (!requirePrivate || parts.includes('private'))
  && !parts.includes('public') && !parts.some(p=>/^(?:s-maxage|stale-while-revalidate|stale-if-error)=/.test(p))
  && !parts.some(p=>p.startsWith('max-age=') && !/^max-age=(?:0|"0")$/.test(p));
}
export function forbidsSharedStorage(headers) {
 return forbidsStorage(headers.get('cache-control'),true)
  && ['cdn-cache-control','vercel-cdn-cache-control'].every(name=>!headers.has(name)||forbidsStorage(headers.get(name)));
}
export function assertReadableCache(headers) {
 assert(hasVary(headers.get('vary'),'Accept') || forbidsSharedStorage(headers),'Negotiated response needs exact Vary: Accept or effective private/no-store without CDN overrides');
}
export function assertReadableCachePair(responses) {
 for(const headers of responses)assertReadableCache(headers);
 if(responses.some(headers=>!hasVary(headers.get('vary'),'Accept'))) {
  for(const headers of responses)assert(forbidsSharedStorage(headers),'No-Vary fallback must forbid storage for BOTH representations, including HEAD/conditional responses');
 }
}
