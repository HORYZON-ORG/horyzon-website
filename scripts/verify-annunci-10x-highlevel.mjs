import assert from 'node:assert/strict';
import { MemoryAnnunci10xPersistenceAdapter, MockAnnunci10xProvider, createAnonymousAnalyzeSession, saveAnnunci10xLeadContact } from '../src/lib/annunci-10x/index.ts';
import { syncAnnunci10xLead } from '../src/lib/annunci-10x/highlevel.ts';

const env = { HIGHLEVEL_PRIVATE_TOKEN: 'test-only-mock-token', HIGHLEVEL_LOCATION_ID: 'test-location' };
async function fixture() {
 const persistence = new MemoryAnnunci10xPersistenceAdapter();
 const context = { persistence, provider: new MockAnnunci10xProvider(), configuredProvider: 'MOCK' };
 const created = await createAnonymousAnalyzeSession(context);
 const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
 await saveAnnunci10xLeadContact({ session, context, firstName:'Ada', lastName:'Example', email:'ada@example.test', companyName:'Example', businessRole:'HR', marketingConsent:false });
 const calls = [];
 const fetchImpl = async (url, init) => {
  calls.push({ path:new URL(url).pathname, body:JSON.parse(init.body) });
  if (url.endsWith('/upsert')) return Response.json({contact:{id:'crm-contact'}});
  if (url.endsWith('/tags')) return Response.json({tags:['preexisting', 'horyzon-annunci-10x', 'annunci10x-analyze']});
  return Response.json({note:{id:'crm-note'}});
 };
 return { session, persistence, calls, fetchImpl };
}
const a = await fixture();
assert.equal((await syncAnnunci10xLead({...a, env:{}})).status,'NOT_CONFIGURED');
assert.equal(a.calls.length,0);
const results = await Promise.all([syncAnnunci10xLead({...a,env}),syncAnnunci10xLead({...a,env})]);
assert(results.every(r=>r.status==='SYNCED'));
assert.equal(a.calls.length,3,'concurrent submissions must share one CRM operation');
assert.equal(a.calls[0].body.locationId,'test-location');
assert(!Object.hasOwn(a.calls[0].body,'tags'),'upsert must not overwrite existing tags');
assert(!Object.hasOwn(a.calls[0].body,'dnd'),'marketing choice must not overwrite existing DND');
assert(a.calls[1].body.tags.every(tag=>!tag.includes('radar')));
assert(a.calls[2].body.body.includes('Consenso marketing: non espresso'));
assert(a.calls[2].body.body.includes('Email verificata al momento della sincronizzazione: no'));
assert.equal((await syncAnnunci10xLead({...a,env})).status,'SYNCED');
assert.equal(a.calls.length,3,'persisted receipt must prevent a repeated note');

const b = await fixture();
let failTags=true;
const originalFetch=b.fetchImpl;
b.fetchImpl=async(url,init)=>url.endsWith('/tags')&&failTags?new Response('{}',{status:503}):originalFetch(url,init);
assert.equal((await syncAnnunci10xLead({...b,env})).status,'PARTIAL');
failTags=false;
// Model a retry after the database-backed lease has expired.
b.persistence.checkRateLimit=async()=>({allowed:true,retryAfterSeconds:0,resetAt:new Date(Date.now()+60000).toISOString()});
assert.equal((await syncAnnunci10xLead({...b,env})).status,'SYNCED');
assert.equal(b.calls.filter(c=>c.path.endsWith('/upsert')).length,1,'partial retry must reuse persisted contact ID');

const c=await fixture();
c.fetchImpl=async(url,init)=>{if(url.endsWith('/notes'))throw new Error('ambiguous network timeout');return originalFetch(url,init);};
assert.equal((await syncAnnunci10xLead({...c,env})).status,'UNCERTAIN');
c.persistence.checkRateLimit=async()=>({allowed:true,retryAfterSeconds:0,resetAt:new Date(Date.now()+60000).toISOString()});
assert.equal((await syncAnnunci10xLead({...c,env})).status,'UNCERTAIN','ambiguous note must not be retried automatically');
const serverError=await fixture();let noteAttempts=0;
serverError.fetchImpl=async(url,init)=>{if(url.endsWith('/notes')){noteAttempts++;return new Response('{}',{status:500});}return originalFetch(url,init);};
assert.equal((await syncAnnunci10xLead({...serverError,env})).status,'UNCERTAIN');
assert.equal((await syncAnnunci10xLead({...serverError,env})).status,'UNCERTAIN');
assert.equal(noteAttempts,1,'a server error does not prove that the note was not committed');
const expired=await fixture();expired.persistence.checkRateLimit=async()=>({allowed:true,resetAt:new Date(Date.now()-1).toISOString()});
assert.equal((await syncAnnunci10xLead({...expired,env})).status,'PENDING');
assert.equal(expired.calls.length,0,'an expired lease must never reach HighLevel');

// Distinct module instances have independent in-process Maps, like workers.
const secondWorker=(await import('../src/lib/annunci-10x/highlevel.ts?worker=second')).syncAnnunci10xLead;
const thirdWorker=(await import('../src/lib/annunci-10x/highlevel.ts?worker=restarted')).syncAnnunci10xLead;
const d=await fixture();
const concurrent=await Promise.all([syncAnnunci10xLead({...d,env}),secondWorker({...d,env})]);
assert(concurrent.some(r=>r.status==='SYNCED'));
assert(concurrent.some(r=>r.status==='PENDING'));
assert.equal(d.calls.length,3,'independent worker Maps must still respect the shared atomic lease');
assert.equal((await thirdWorker({...d,env})).status,'SYNCED');
assert.equal(d.calls.length,3,'a restarted worker must read the durable receipt');

let reads=0;
const getEvents=d.persistence.getEvents.bind(d.persistence);
d.persistence.getEvents=async(...args)=>++reads===1?[]:getEvents(...args);
d.persistence.checkRateLimit=async()=>({allowed:true,resetAt:new Date(Date.now()+60000).toISOString()});
assert.equal((await secondWorker({...d,env})).status,'SYNCED');
assert.equal(d.calls.length,3,'a stale read before a newly acquired lease must be refreshed');

await assert.rejects(()=>a.persistence.getEvents(a.session.sessionId,'invalid-session-secret-value-that-is-long-enough','annunci10x_crm_sync'),/ownership/i);
console.log('Annunci HighLevel: no live calls; upsert/tags/note, persistent receipts, concurrent deduplication, partial retry and ambiguous note verified.');
