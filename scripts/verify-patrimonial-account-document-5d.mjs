import assert from'node:assert/strict';import{writeFileSync}from'node:fs';
const results=[];const modes={local:17830,preview:17831,production:17832,'other-project':17833};
for(const[mode,port]of Object.entries(modes)){
 const origin='http://127.0.0.1:'+port,r=await fetch(origin+'/radar-patrimoniale',{headers:{'x-horyzon-radar-document':'anonymous'}}),html=await r.text(),enabled=['local','preview'].includes(mode);
 assert.equal(r.status,enabled?200:404,mode);
 if(enabled){assert(html.includes('data-radar-isolated="true"'));assert(!/iubenda|vercel-insights|speed-insights|vercel-toolbar/i.test(html));assert(!html.includes('SYNTHETIC_UI_5D_ONLY'));for(const m of html.matchAll(/<script[^>]+src="([^"]+)"/g))assert(m[1].startsWith('/_next/'),m[1]);const csp=r.headers.get('content-security-policy');assert(csp.includes("script-src 'self'"));assert(csp.includes("connect-src 'self'"));assert(!csp.includes('https://'));assert(r.headers.get('cache-control').includes('no-store'));}
 const api=await fetch(origin+'/api/patrimonial-radar/session');assert.equal(api.status,enabled?(mode==='local'?401:403):404,mode+' API');
 results.push({mode,pageStatus:r.status,apiStatus:api.status,isolated:enabled?true:null,externalScriptTags:enabled?0:null});
}
const root='http://127.0.0.1:17830',home=await fetch(root),homeHtml=await home.text();assert.equal(home.status,200);assert(homeHtml.includes('iubenda-autoblocking'));assert(!homeHtml.includes('data-radar-isolated="true"'));
const md=await fetch(root,{headers:{Accept:'text/markdown'}});assert.equal(md.status,200);assert(md.headers.get('content-type').includes('text/markdown'));
const varyAccept=(md.headers.get('vary')??'').split(',').map(s=>s.trim().toLowerCase()).includes('accept');
const radar=await fetch(root+'/radar');assert.equal(radar.status,200);
const result={scope:'LOCAL_BUILT_NEXT_HTTP_NOT_VERCEL',modes:results,home:{status:home.status,thirdPartyConfigurationPreserved:true,cacheControl:home.headers.get('cache-control')},markdown:{status:md.status,vary:md.headers.get('vary'),varyAcceptStatus:varyAccept?'PASS':'FAIL'},enterpriseRadarStatus:radar.status,realAuth:'NOT_RUN',remoteWrites:0,etag304:'HISTORICAL_FAIL_OPEN_NOT_RETESTED'};
const out=process.argv.find(x=>x.startsWith('--output='))?.slice(9);if(out)writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
if(!varyAccept)process.exitCode=1;
