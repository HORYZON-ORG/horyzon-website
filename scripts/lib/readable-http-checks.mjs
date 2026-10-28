import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {hasVary,forbidsSharedStorage,assertReadableCachePair} from './readable-cache-contract.mjs';

// Node HTTP sends no Accept header unless explicitly provided (fetch defaults to */*).
export function readableRequest(base, pathname='/', {method='GET',headers={}}={}) {
 const url=new URL(pathname,base);
 return new Promise((resolve,reject)=>{
  const request=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method,headers},response=>{
   const chunks=[];let size=0;
   response.on('data',chunk=>{size+=chunk.length;if(size>2_000_000)request.destroy(Error('Readable response too large'));else chunks.push(chunk);});
   response.on('end',()=>resolve({status:response.statusCode,headers:new Headers(Object.entries(response.headers).filter(([,v])=>v!==undefined).map(([k,v])=>[k,Array.isArray(v)?v.join(', '):v])),body:Buffer.concat(chunks).toString('utf8')}));
   response.on('error',reject);
  });
  request.setTimeout(15000,()=>request.destroy(Error('Readable HTTP timeout')));request.on('error',reject);request.end();
 });
}
export async function verifyReadableHttp(base,evidence) {
 const entries=evidence.requests,rootResponses=[];
 const record=async(label,pathname='/',options={})=>{
  const r=await readableRequest(base,pathname,options);
  const entry={label,path:pathname,method:options.method??'GET',accept:options.headers?.accept??null,ifNoneMatch:options.headers?.['if-none-match']??null,status:r.status,headers:Object.fromEntries([...r.headers].filter(([k])=>['content-type','vary','cache-control','cdn-cache-control','vercel-cdn-cache-control','etag','location','link','x-robots-tag'].includes(k))),bodyBytes:Buffer.byteLength(r.body),bodySha256:createHash('sha256').update(r.body).digest('hex')};
  entries.push(entry);
  if(options.headers?.rsc==='1' && !pathname.includes('_rsc')) {
   assert.equal(r.status,307,'Next requires its native RSC cache-busting query');assert.equal(r.headers.get('location'),'/?_rsc');
  } else assert(!r.headers.has('location'),'No redirect may replace negotiated content');
  if(new URL(pathname,base).pathname==='/') {
   for(const token of ['RSC','Next-Router-State-Tree','Next-Router-Prefetch','Next-Router-Segment-Prefetch'])assert(hasVary(r.headers.get('vary'),token),'Flight Vary token retained: '+token);
   assert(!r.headers.get('x-robots-tag')?.includes('noindex'),'Negotiation must not noindex the homepage');
   rootResponses.push(r.headers);
  }
  return r;
 };
 const content=(r,kind)=>{
  assert.equal(r.status,200);
  assert.match(r.headers.get('content-type'),kind==='html'?/^text\/html/i:/^text\/markdown; charset=utf-8$/i);
  if(kind==='html') {
   const heading=r.body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
   assert.equal(heading,'Far stare bene un’impresa, davvero.','Actual H1 including emphasized text');
   assert.match(r.body,/<link[^>]*rel="canonical"[^>]*href="https:\/\/horyzon.it"/);
   assert(r.body.includes('https://hub.horyzon.it/radar'));
  } else {
   assert(/^# Far stare bene un’impresa, _?davvero\._?$/m.test(r.body));
   assert(r.body.includes('https://hub.horyzon.it/radar'));assert(!r.body.includes('<script')&&!r.body.includes('self.__next_f'));
   assert.equal(r.headers.get('link'),'<https://horyzon.it>; rel="canonical"');
  }
 };
 const html=await record('GET HTML','/',{headers:{accept:'text/html'}});content(html,'html');
 const md=await record('GET Markdown','/',{headers:{accept:'text/markdown'}});content(md,'markdown');
 assert(hasVary(md.headers.get('vary'),'Accept'),'Markdown rewrite preserves exact Accept token');
 assert.notEqual(html.headers.get('etag'),md.headers.get('etag'));
 for(const [label,headers] of [['GET absent Accept',{}],['GET default wildcard',{accept:'*/*'}],['GET Markdown rejected',{accept:'text/markdown;q=0, text/html'}]])content(await record(label,'/',{headers}),'html');
 for(const [kind,original,accept] of [['html',html,'text/html'],['markdown',md,'text/markdown']]) {
  const head=await record('HEAD '+kind,'/',{method:'HEAD',headers:{accept}});
  assert.equal(head.status,200);assert.equal(head.body,'');
  for(const name of ['content-type','vary','cache-control','cdn-cache-control','vercel-cdn-cache-control','etag','link','x-robots-tag'])assert.equal(head.headers.get(name),original.headers.get(name),'GET/HEAD '+kind+' '+name);
 }
 const direct=await record('Direct Markdown','/home.md');content(direct,'markdown');assert.match(direct.headers.get('x-robots-tag'),/noindex/);assert.equal(direct.body,md.body);
 for(let n=0;n<6;n++) {
  const kind=n%2?'markdown':'html',original=kind==='html'?html:md;
  const r=await record('Alternate '+n,'/',{headers:{accept:kind==='html'?'text/html':'text/markdown'}});content(r,kind);assert.equal(r.body,original.body);assert.equal(r.headers.get('etag'),original.headers.get('etag'));
 }
 for(const [kind,original,other,accept] of [['html',html,md,'text/html'],['markdown',md,html,'text/markdown']]) {
  assert(original.headers.get('etag')&&other.headers.get('etag'));
  for(const method of ['GET','HEAD']) {
   const foreign=await record('Foreign ETag '+method+' '+kind,'/',{method,headers:{accept,'if-none-match':other.headers.get('etag')}});
   assert.equal(foreign.status,200,'Foreign representation must not return 304');
   assert.equal(foreign.headers.get('etag'),original.headers.get('etag'));
   assert.match(foreign.headers.get('content-type'),new RegExp('^text/'+kind));assert.equal(foreign.body,method==='HEAD'?'':original.body);
   const matching=await record('Matching ETag '+method+' '+kind,'/',{method,headers:{accept,'if-none-match':original.headers.get('etag')}});
   assert([200,304].includes(matching.status));assert.equal(matching.headers.get('etag'),original.headers.get('etag'));
   assert.equal(matching.body,matching.status===304||method==='HEAD'?'':original.body);
   if(matching.headers.has('content-type'))assert.match(matching.headers.get('content-type'),new RegExp('^text/'+kind));
  }
 }
 const rscRedirect=await record('RSC native normalization','/',{headers:{accept:'text/markdown',rsc:'1'}});
 const flight=await record('RSC bypasses Markdown',rscRedirect.headers.get('location'),{headers:{accept:'text/markdown',rsc:'1'}});
 assert.equal(flight.status,200);assert.match(flight.headers.get('content-type'),/^text\/x-component/i);assert(!/^# Far stare bene/m.test(flight.body));
 assertReadableCachePair(rootResponses);
 if(rootResponses.some(h=>!hasVary(h.get('vary'),'Accept')))assert(forbidsSharedStorage(direct.headers),'Direct Markdown also follows explicit no-store policy');
 evidence.strategy=rootResponses.every(h=>hasVary(h.get('vary'),'Accept'))?'VARY_ACCEPT':'PRIVATE_NO_STORE_BOTH_REPRESENTATIONS';
 evidence.status='PASS';
}
