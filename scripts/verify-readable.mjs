import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {hasVary,forbidsSharedStorage,assertReadableCachePair} from './lib/readable-cache-contract.mjs';
import {verifyReadableHttp} from './lib/readable-http-checks.mjs';
import assert from 'node:assert/strict';
import { prefersMarkdown } from '../src/lib/accept-markdown.ts';

for (const [accept, expected] of [
 [null, false], ['*/*', false], ['text/html', false], ['text/markdown', true],
 ['text/markdown, text/html, */*', true], ['text/html, text/markdown', false],
 ['text/markdown;q=0, */*', false], ['text/markdown;q=0.5, text/html', false],
 ['text/html;q=0.5, text/markdown', true], ['TEXT/MARKDOWN; charset=utf-8', true],
 ['text/markdown;q=bad', false], ['text/markdown;q=2', false],
 ['text/markdown;q=0.8, text/html;q=0, */*', true],
]) assert.equal(prefersMarkdown(accept), expected, accept);


const h=value=>new Headers(value);
const safe=h({'cache-control':'private, no-store, max-age=0, must-revalidate','cdn-cache-control':'no-store','vercel-cdn-cache-control':'no-store'});
assert.equal(hasVary('Accept-Encoding','Accept'),false);
assert.equal(hasVary('RSC, Accept, Accept-Encoding','Accept'),true);
assert.equal(forbidsSharedStorage(safe),true);
assertReadableCachePair([safe,safe]);
const varied=h({vary:'Accept','cache-control':'public, s-maxage=300'});
assertReadableCachePair([varied,varied]);
for(const value of [
 {'cache-control':'public, s-maxage=31536000',vary:'Accept-Encoding'},
 {'cache-control':'private, max-age=0, must-revalidate'},
 {'cache-control':'private, no-store','cdn-cache-control':'public, s-maxage=300'},
 {'cache-control':'private, no-store','vercel-cdn-cache-control':'s-maxage=300'},
 {'cache-control':'private="Set-Cookie", no-store'},
])assert.throws(()=>assertReadableCachePair([safe,h(value)]));
assert.throws(()=>assertReadableCachePair([safe,varied]),'Fallback may not disable caching only for HTML or Markdown');

const base=process.argv[2],directory=process.argv.find(v=>v.startsWith('--artifacts='))?.slice(12);
if(base) {
 const evidence={base,status:'FAIL',requests:[]};
 try{await verifyReadableHttp(base,evidence);}
 catch(error){evidence.error=error.message;throw error;}
 finally{if(directory){await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'readable-http.json'),JSON.stringify(evidence,null,2)+'\n');}}
 console.log('PASS Readable HTTP: '+evidence.requests.length+' actual GET/HEAD/default/alternating/conditional/RSC checks; strategy '+evidence.strategy);
} else console.log('PASS Readable Accept/cache unit cases: exact Vary tokens, strict both-representation no-store, CDN overrides and unsafe policies rejected');
