import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import ts from 'typescript';
import dns from 'node:dns/promises';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { gzipSync } from 'node:zlib';
const build=await mkdtemp(resolve(tmpdir(),'horyzon-ai-score-fixture-'));
await mkdir(build,{recursive:true});
for (const file of await readdir('src/lib/ai-score')) if(file.endsWith('.ts')) {
 const source=await readFile(`src/lib/ai-score/${file}`,'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  .replace(/(from\s+['"])(\.\/[^'"]+)(['"])/g,(_,a,b,c)=>`${a}${b.replace(/\.ts$/,'')}.mjs${c}`);
 await writeFile(`${build}/${file.replace(/\.ts$/,'.mjs')}`,output);
}
const {runAiScoreAudit}=await import(pathToFileURL(`${build}/audit.mjs`));
const {handleAiScoreRequest}=await import(pathToFileURL(`${build}/handler.mjs`));
const {safeFetch,isPublicIp}=await import(pathToFileURL(`${build}/ssrf.mjs`));
const {GovernedOpenAIWebSearchAdapter}=await import(pathToFileURL(`${build}/governed-openai.mjs`));
const {MockOpenAIResponsesTransport,parseOpenAIWebSearchResponse,buildOpenAIWebSearchRequest}=await import(pathToFileURL(`${build}/openai-web-search.mjs`));
const {MemoryProviderRuntimeStore}=await import(pathToFileURL(`${build}/runtime-store.mjs`));
const {buildEntityProfile,generateVisibilityPrompts,visibilityScanProfiles,measureAiVisibility}=await import(pathToFileURL(`${build}/visibility.mjs`));
const responseFixture=JSON.parse(await readFile('test/fixtures/openai-web-search/branded-mention-horyzon-citation.json','utf8')).response;
const env={OPENAI_API_KEY:'test-only-mock-key',AI_SCORE_OPENAI_VISIBILITY_ENABLED:'1',AI_SCORE_LIVE_PROVIDERS:'1',AI_SCORE_DAILY_BUDGET_USD:'1',AI_SCORE_OPENAI_DAILY_BUDGET_USD:'1',AI_SCORE_RATE_LIMIT_HMAC_SECRET:'test-only-hmac'};
const entity={brandName:'Horyzon',description:'Consulenza per imprese',organizationType:'Consulting',services:['consulenza'],products:[],audience:['imprese'],people:[],locations:[],sameAs:[],ambiguitySignals:[],sourcePages:[]};
const profile=visibilityScanProfiles.FREE_QUICK_SCAN;
const prompts=generateVisibilityPrompts({auditId:'fixture-public',entity:buildEntityProfile('horyzon.it',entity),profile});
const context={auditId:'fixture-public',entity:buildEntityProfile('horyzon.it',entity),profileId:profile.id,timeoutMs:15000,startedAt:new Date().toISOString()};
function storeFixture(){const store=new MemoryProviderRuntimeStore({persistent:true});store.checkRateLimit=async()=>({allowed:true});return store;}
const transport=new MockOpenAIResponsesTransport({fixture:responseFixture});
const workingStore=storeFixture();
const working=new GovernedOpenAIWebSearchAdapter({env,store:workingStore,transport});
const measured=await measureAiVisibility({auditId:'fixture-public',domain:'horyzon.it',entity,registry:[working]});
assert.equal(measured.state,'not_measured','current public profile cannot cover the prudent GPT-5 estimate');
assert.equal(transport.realNetworkCalls,0);
assert.equal(transport.mockTransportCalls,0,'profile budget must block before transport');
const observation=await working.execute(prompts[0],context);
assert.equal(observation.status,'SUCCESS');
assert(observation.sources.some(s=>s.url.startsWith('https://')));
assert.equal((await working.estimateCost([prompts[0]])).estimatedCost,0.18);
const miniTransport=new MockOpenAIResponsesTransport({fixture:{...responseFixture,model:'gpt-4.1-mini'}});
const miniStore=storeFixture();
const mini=new GovernedOpenAIWebSearchAdapter({env:{...env,AI_SCORE_OPENAI_RESPONSES_MODEL:'gpt-4.1-mini'},store:miniStore,transport:miniTransport});
const miniResult=await measureAiVisibility({auditId:'fixture-mini',domain:'horyzon.it',entity,registry:[mini]});
assert.equal(miniResult.state,'partial');
assert.equal(miniResult.coverageDetail.plannedPrompts,5);
assert.equal(miniResult.coverageDetail.executedPrompts,3,'0.05 profile funds only three 0.016 reservations');
assert.equal(miniTransport.mockTransportCalls,3);
assert.equal((await mini.estimateCost([prompts[0]])).estimatedCost,0.016);
const negativeFixture=JSON.parse(await readFile('test/fixtures/openai-web-search/non-branded-no-match.json','utf8')).response;
const negative=await new GovernedOpenAIWebSearchAdapter({env,store:storeFixture(),transport:new MockOpenAIResponsesTransport({fixture:negativeFixture})}).execute(prompts[1],{...context,auditId:'negative'});
assert.equal(negative.status,'SUCCESS','real search with negative evidence is a measured observation');
assert.equal(negative.brandMentioned,false);assert.equal(negative.domainCited,false);
const sourceLess={...responseFixture,output:[{type:'web_search_call',status:'completed',action:{sources:[]}},{type:'message',content:[{type:'output_text',text:'unverified answer',annotations:[]}]}]};
assert.throws(()=>parseOpenAIWebSearchResponse(sourceLess),/source evidence/);
for(const scenario of [{status:429},{status:500},{delayMs:16000}]){
 const store=storeFixture();let reconciled=[];const reconcile=store.reconcileBudget.bind(store);
 store.reconcileBudget=async data=>{reconciled.push(data);return reconcile(data);};
 const failed=await new GovernedOpenAIWebSearchAdapter({env,store,transport:new MockOpenAIResponsesTransport({fixture:responseFixture,...scenario})}).execute(prompts[0],{...context,auditId:JSON.stringify(scenario)});
 assert.equal(failed.status,'FAILED');
 assert.equal(reconciled.length,1);assert.equal(reconciled[0].actualCostUsd,null,'ambiguous costs must not be refunded as zero');
}
const cancelController=new AbortController();const cancelledStore=storeFixture();let reserveStarted=false;
cancelledStore.reserveBudget=async()=>{reserveStarted=true;cancelController.abort();return {allowed:true};};
const cancelledTransport=new MockOpenAIResponsesTransport({fixture:responseFixture});
await new GovernedOpenAIWebSearchAdapter({env,store:cancelledStore,transport:cancelledTransport}).execute(prompts[0],{...context,auditId:'cancelled',signal:cancelController.signal});
assert(reserveStarted);assert.equal(cancelledTransport.mockTransportCalls,0,'cancellation during reservation must prevent a late SDK call');
assert.equal(buildOpenAIWebSearchRequest({prompt:prompts[0],context,model:'test-model'}).tool_choice,'required');
const noSearch={...responseFixture,output:responseFixture.output.filter(item=>item.type!=='web_search_call')};
assert.throws(()=>parseOpenAIWebSearchResponse(noSearch),/not executed/);
assert.throws(()=>parseOpenAIWebSearchResponse({...responseFixture,status:'incomplete'}),/incomplete/);
assert.equal(buildOpenAIWebSearchRequest({prompt:prompts[0],context,model:'gpt-5'}).max_tool_calls,1);
assert.throws(()=>buildOpenAIWebSearchRequest({prompt:{...prompts[0],query:'x'.repeat(3000)},context,model:'gpt-5'}),/bounded/);
for(const override of [{AI_SCORE_LIVE_PROVIDERS:'0'},{AI_SCORE_OPENAI_VISIBILITY_ENABLED:'0'},{OPENAI_API_KEY:''},{AI_SCORE_OPENAI_DAILY_BUDGET_USD:''},{AI_SCORE_RATE_LIMIT_HMAC_SECRET:''},{AI_SCORE_OPENAI_RESPONSES_MODEL:'unpriced-model'}]){
 const mock=new MockOpenAIResponsesTransport({fixture:responseFixture});
 const adapter=new GovernedOpenAIWebSearchAdapter({env:{...env,...override},store:storeFixture(),transport:mock});
 assert.equal((await adapter.execute(prompts[0],context)).status,'SKIPPED');assert.equal(mock.mockTransportCalls,0);
}
const noStoreTransport=new MockOpenAIResponsesTransport({fixture:responseFixture});
await new GovernedOpenAIWebSearchAdapter({env,store:new MemoryProviderRuntimeStore({persistent:false}),transport:noStoreTransport}).execute(prompts[0],context);
assert.equal(noStoreTransport.mockTransportCalls,0);
for(const restriction of ['quota','rate','circuit']){
 const store=storeFixture();
 if(restriction==='quota')store.reserveBudget=async()=>({allowed:false,reason:'exhausted'});
 if(restriction==='rate')store.checkRateLimit=async()=>({allowed:false});
 if(restriction==='circuit'){store.getCircuitState=async()=>({circuitState:'OPEN'});store.tryHalfOpen=async()=>({circuitState:'OPEN'});}
 const mock=new MockOpenAIResponsesTransport({fixture:responseFixture});
 assert.equal((await new GovernedOpenAIWebSearchAdapter({env,store,transport:mock}).execute(prompts[0],context)).status,'SKIPPED');assert.equal(mock.mockTransportCalls,0);
}
const brokenStore=storeFixture();brokenStore.reconcileBudget=async()=>{throw new Error('uncertain store acknowledgement');};
const preserved=await new GovernedOpenAIWebSearchAdapter({env,store:brokenStore,transport:new MockOpenAIResponsesTransport({fixture:responseFixture})}).execute(prompts[0],context);
assert.equal(preserved.status,'SUCCESS','valid evidence must survive store bookkeeping failure');
for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','::1','fc00::1','::ffff:a00:1','192.0.2.1'])assert.equal(isPublicIp(ip),false,ip);
for(const ip of ['8.8.8.8','192.0.78.24','2001:200::1','2001:4860:4860::8888'])assert.equal(isPublicIp(ip),true,ip);
const originalLookup=dns.lookup,originalRequest=https.request;
let requestCount=0;
let status=200,headers={'content-type':'text/html'},body=Buffer.from('valid html');
try {
 dns.lookup=async()=>[{address:'8.8.8.8',family:4}];
 https.request=(options,callback)=>{
  requestCount++;
  options.lookup(options.hostname,{all:true},(error,addresses)=>assert.deepEqual(addresses,[{address:'8.8.8.8',family:4}]));
  const req=new EventEmitter();
  req.end=()=>queueMicrotask(()=>{const res=new PassThrough();res.statusCode=status;res.headers=headers;callback(res);res.end(body);});
  req.destroy=error=>{if(error)queueMicrotask(()=>req.emit('error',error));return req;};
  return req;
 };
 assert.equal((await safeFetch('https://public.example.test')).body,'valid html');
 headers={'content-type':'text/html','content-encoding':'gzip'};body=gzipSync(Buffer.from('compressed html'));
 assert.equal((await safeFetch('https://public.example.test')).body,'compressed html');
 body=gzipSync(Buffer.from('x'.repeat(10000)));
 await assert.rejects(()=>safeFetch('https://public.example.test',{maxBytes:1000}),/grande/,'decoded compression bomb must be bounded');
 status=302;headers={location:'http://127.0.0.1/private'};body=Buffer.alloc(0);
 const before=requestCount;
 await assert.rejects(()=>safeFetch('https://public.example.test'),/pubblica|locale/);
 assert.equal(requestCount,before+1,'redirect must be rejected before connecting to a private IP');
 dns.lookup=async()=>[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}];
 const mixedBefore=requestCount;
 await assert.rejects(()=>safeFetch('https://mixed.example.test'),/non pubblici/);
 assert.equal(requestCount,mixedBefore,'mixed A/AAAA answers must be blocked before transport');
} finally {dns.lookup=originalLookup;https.request=originalRequest;}
const visibility={measure:async()=>({state:'not_measured',score:null,coverage:0,blocker:'Provider not configured',methodologyVersion:'test',weights:{},prompts:[],evidence:[],observations:[],metricBreakdown:{}})};
const footprint={measure:async()=>({state:'not_measured',score:null,coverage:0,blocker:'Provider not configured',methodologyVersion:'test',queries:[],searchResults:[],observations:[],metricBreakdown:{}})};
const html='<html lang="it"><head><title>Fixture — impresa</title><meta name="description" content="Un’impresa che offre servizi di analisi e organizzazione."></head><body><main><h1>Fixture</h1><p>'+('Persone servizi organizzazione imprese. '.repeat(100))+'</p></main></body></html>';
let calls=[];
const fixtureFetch=async(url)=>{calls.push(String(url)); return {url:'https://final.example.test/',status:String(url).endsWith('/')?200:404,body:String(url).endsWith('/')?html:'',headers:new Headers({'content-type':'text/html'}),redirects:[]};};
const options={fetchImpl:fixtureFetch,visibilityProvider:visibility,footprintProvider:footprint};
const result=await runAiScoreAudit('https://initial.example.test',undefined,options);
const partialProvider=await runAiScoreAudit('https://provider-error.example.test',undefined,{...options,visibilityProvider:{measure:async()=>{throw new Error('provider error');}}});
assert.equal(partialProvider.readiness.score,result.readiness.score,'provider failures must preserve technical evidence');
assert.equal(partialProvider.visibility.score,null);
const stalledProvider=await runAiScoreAudit('https://provider-stall.example.test',undefined,{...options,timeoutMs:1200,visibilityProvider:{measure:()=>new Promise(()=>{})}});
assert.equal(stalledProvider.readiness.score,result.readiness.score,'optional provider deadline must return available technical evidence');
assert.equal(stalledProvider.visibility.score,null);
assert.equal(result.domain,'final.example.test','redirected site identity must use final domain');
assert.equal(result.visibility.score,null,'missing provider must not invent visibility');
assert.equal(result.status,'partial');
assert(calls.length>=4,'homepage and optional files must be fetched');
await assert.rejects(()=>runAiScoreAudit('https://blocked.example.test',undefined,{...options,fetchImpl:async()=>({url:'https://blocked.example.test/',status:403,body:html,headers:new Headers(),redirects:[]})}),/403/,'blocked home must never produce a score');
await assert.rejects(()=>runAiScoreAudit('https://stalled.example.test',undefined,{...options,timeoutMs:20,fetchImpl:()=>new Promise(()=>{})}),/tempo|Timeout/i,'a stalled scan must terminate');
const request=new Request('http://localhost/api/ai-score',{method:'POST',body:JSON.stringify({url:'https://fixture.example.test'}),headers:{'content-type':'application/json'}});
const response=await handleAiScoreRequest(request,{runAudit:(url,onState,opts)=>runAiScoreAudit(url,onState,{...options,...opts})});
assert.equal(response.headers.get('content-type'),'application/x-ndjson; charset=utf-8');
const events=(await response.text()).trim().split('\n').map(JSON.parse);
assert.equal(events.at(-1).type,'result');
assert.equal(events.filter(e=>e.type==='result').length,1);
const invalid=await handleAiScoreRequest(new Request('http://localhost/api/ai-score',{method:'POST',body:JSON.stringify({url:'http://127.0.0.1'})}));
assert.equal(invalid.status,400,'private URL must fail before streaming/provider execution');
const big=await handleAiScoreRequest(new Request('http://localhost/api/ai-score',{method:'POST',body:'x'.repeat(5000)}));
assert.equal(big.status,413);
let cancelled=false;
const cancellingResponse=await handleAiScoreRequest(new Request('http://localhost/api/ai-score',{method:'POST',body:JSON.stringify({url:'https://cancelled.example.test'}),headers:{'x-forwarded-for':'test-cancellation'}}),{
 runAudit:async(_url,_onState,opts)=>{await new Promise(resolve=>opts.signal.addEventListener('abort',()=>{cancelled=true;resolve();},{once:true}));throw new Error('cancelled');}
});
await cancellingResponse.body.cancel();
assert(cancelled,'closing the response must abort the running audit immediately');
let publicOptions;
const boundedResponse=await handleAiScoreRequest(new Request('http://localhost/api/ai-score',{method:'POST',body:JSON.stringify({url:'https://only-url.example.test',profileId:'PREMIUM_COMPREHENSIVE',model:'arbitrary',timeoutMs:999999,provider:'mock',execute:true}),headers:{'x-forwarded-for':'test-only-url'}}),{
 runAudit:async(_url,_onState,opts)=>{publicOptions=opts;return result;}
});
await boundedResponse.text();
assert.deepEqual(Object.keys(publicOptions).sort(),['clientKey','signal'],'public input must not override model/profile/runtime options');
console.log('AI Score runtime: fixture scan, final-domain identity, missing visibility, blocked sites, deadline and terminal NDJSON verified; no paid provider calls.');
