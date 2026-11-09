import assert from 'node:assert/strict';
import {categoryNames,kitPaths,taskCatalog,comparison,scenarioText} from '../src/lib/tempo-funnel/model.ts';
import {accessToken} from '../src/lib/tempo-funnel/access.ts';
import {serveTempoKitWithComparison,kitComparisonMarkup} from '../src/lib/tempo-funnel/kit-delivery.ts';

const requestId='12345678-1234-4234-8234-123456789012';
const env={
 CRON_SECRET:'test-only-hmac-secret-not-production-12345',
 SUPABASE_URL:'https://test.example.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'fake-service-role-for-tests-only'
};
const doc='<!doctype html><html><head><title>Kit</title></head><body><main><section class="hero">Hero</section><p>Materiali gratuiti</p></main></body></html>';
let authorizedFetches=0;
for(const category of Object.keys(categoryNames)){
 const id=Object.keys(taskCatalog).find(k=>taskCatalog[k].category===category);
 assert(id,'Catalog category must include a real task: '+category);
 const scenario={entries:[{id,volume:10,minutes:8,rate:25,period:'day',scope:'company',people:1}],days:5,weeks:46,category};
 const t=accessToken(category,requestId,env);
 const path='/benessere-digitale/dai-valore-al-tuo-tempo/'+kitPaths[category];
 const request=new Request('https://horyzon.it'+path,{headers:{cookie:'horyzon-tempo-'+category+'='+t}});
 const mock=async(url,options)=>{
  authorizedFetches++;
  const parsed=new URL(String(url));
  assert.equal(parsed.pathname,'/rest/v1/tempo_kit_requests');
  assert.equal(parsed.searchParams.get('request_id'),'eq.'+requestId);
  assert.equal(parsed.searchParams.get('category'),'eq.'+category);
  assert.equal(options.method,'GET');
  assert.equal(options.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
  return Response.json([{category,snapshot:scenario}]);
 };
 const response=await serveTempoKitWithComparison(request,category,doc,env,mock);
 assert.equal(response.status,200);
 assert.match(response.headers.get('cache-control'),/no-store/);
 const html=await response.text(),comp=comparison(scenario);
 assert(html.includes('id="kit-confronto"'));
 assert(html.includes(categoryNames[category]));
 assert(html.includes('10%'));
 assert(html.includes(String(comp.single.pct)+'%'));
 assert(html.includes('h / settimana')&&html.includes('di tempo / anno'));
 assert(html.includes('Quali attività comprende?'));
 assert(html.includes('setup')&&html.includes('/mese'));
 assert.equal((html.match(/id="kit-confronto"/g)||[]).length,1);
 const text=scenarioText(scenario);
 assert(text.includes('VALORE DEL TEMPO')||text.includes('Valore del tempo'));
 assert(text.includes('ore/anno'));
 assert(text.includes('Costo del primo anno'));
 assert(text.includes(categoryNames[category]));
 assert(text.includes('KIT HORYZON'));
 const denied=new Request('https://horyzon.it'+path);
 const before=authorizedFetches;
 const deniedResponse=await serveTempoKitWithComparison(denied,category,doc,env,mock);
 assert.equal(deniedResponse.status,303);
 assert.equal(authorizedFetches,before,'Unauthorized access must never touch protected DB');
 const wrong=new Request('https://horyzon.it'+path,{headers:{cookie:'horyzon-tempo-'+category+'='+accessToken(Object.keys(categoryNames).find(x=>x!==category),requestId,env)}});
 const wrongResponse=await serveTempoKitWithComparison(wrong,category,doc,env,mock);
 assert.equal(wrongResponse.status,303);
 const fallback=await serveTempoKitWithComparison(request,category,doc,env,async()=>Response.json([], {status:200}));
 assert.equal(fallback.status,200);
 assert.equal(await fallback.text(),doc,'The free kit remains usable even when the personalized snapshot is not reachable');
 const markup=kitComparisonMarkup(scenario);
 assert(!markup.includes('<script>'));
 assert(markup.includes('0 €'));
}
assert.equal(authorizedFetches,Object.keys(categoryNames).length);
console.log('PASS: 8 category-gated kits, signed session, no unauthorized DB read, fallback, weekly/annual hours and euro, full kit scope and costs, email comparison. No live email sent.');
