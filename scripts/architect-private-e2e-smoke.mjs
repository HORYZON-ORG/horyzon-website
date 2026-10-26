import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { handleArchitectCvUpload } from '../src/lib/public-leads/architect-cv-upload.ts';
import { handlePublicLead } from '../src/lib/public-leads/handler.ts';
import { cvStorage, isCvId, readCandidateCv } from '../src/lib/public-leads/architect-cv.ts';

// One-off, fail-closed, preview-only E2E smoke: ONE synthetic PDF and Hub
// candidate, then exact-object cleanup. Never calls HighLevel, emails or SMS.
const ROOT = 'https://pmkyeqrfkunypfkbjnyg.supabase.co';
const BRANCH = 'feat/patrimonial-pilot-funnels';
const PDF_SHA = '84ec46e00d2b1238e697804cf252a3e58383fc0b4197862be2f0f52ff6074c30';
const EMAIL = 'andrea.collaudo@example.invalid';
const SOURCE = 'horyzon-qa-smoke';

if (process.env.PATRIMONIAL_ARCHITECT_PRIVATE_E2E_SMOKE !== 'true') {
  console.log('ARCHITECT_PRIVATE_E2E: SKIPPED (disabled)');
} else {
  const env = process.env;
  if (env.VERCEL_ENV !== 'preview' ||
      env.VERCEL_GIT_COMMIT_REF !== BRANCH ||
      env.PATRIMONIAL_ARCHITECT_HUB_INTAKE_ENABLED !== 'false' ||
      env.SUPABASE_URL?.replace(/\/+$/, '') !== ROOT ||
      !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('ARCHITECT_PRIVATE_E2E_GUARD_FAILED');
  }
  const isolated = {
    ...env, NODE_ENV: 'test', HIGHLEVEL_PRIVATE_TOKEN: '',
    PATRIMONIAL_ARCHITECT_HUB_INTAKE_ENABLED: 'true',
  };
  const store = cvStorage(isolated);
  assert.ok(store);
  const headers = {
    Authorization: 'Bearer ' + store.key,
    apikey: store.key, Accept: 'application/json', 'Cache-Control': 'no-store',
  };
  const hubRead = { ...headers, 'Accept-Profile': 'hub' };
  const hubWrite = { ...headers, 'Content-Profile': 'hub' };

  const readJson = async (route, moreHeaders = {}) => {
    const r = await fetch(store.url + route, {
      method: 'GET', headers: { ...headers, ...moreHeaders },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error('E2E_READ_NOT_CONFIRMED');
    return r.json();
  };
  const deleteHub = async route => {
    const r = await fetch(store.url + route, {
      method: 'DELETE', headers: hubWrite, redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error('E2E_HUB_CLEANUP_ERROR');
  };
  const find = cvId => readJson(
    '/rest/v1/architect_candidates?select=id,cv_id,first_name,last_name,email,status,current_step,crm_state,utm,marketing_consent&cv_id=eq.' + cvId,
    hubRead,
  );

  let cvId = null, stage = 'starting', failed = false, cleanupFailed = false;
  try {
    const b64 = (await readFile(new URL('./fixtures/architect-cv-horyzon-qa.b64',import.meta.url),'utf8')).trim();
    const pdf = Buffer.from(b64,'base64');
    assert.equal(pdf.length,2560,'fixture must match actual downloadable E2E PDF');
    assert.equal(createHash('sha256').update(pdf).digest('hex'),PDF_SHA,'fixture digest mismatch');

    const local = 'http://localhost:3000';
    const upload = await handleArchitectCvUpload(new Request(local+'/api/public-leads/cv',{
      method:'POST',headers:{Origin:local,'Content-Type':'application/pdf'},body:pdf,
    }),{env:isolated,storage:store});
    assert.equal(upload.status,200,'real Storage upload via production handler');
    const receipt = await upload.json();
    assert.equal(receipt.ok,true);
    assert.ok(isCvId(receipt.cvId));
    cvId = receipt.cvId; stage = 'pdf-uploaded';

    const data = {
      mode:'architect-path', sourcePath:'/benessere-patrimoniale/percorso-architetto-patrimoniale',
      firstName:'Andrea',lastName:'Collaudo',email:EMAIL,phone:'3331234567',province:'Bari',
      profile:'',message:'SOLO COLLAUDO - NON CONTATTARE',
      consent:true,marketingConsent:false,website:'',
      utm:{utm_source:SOURCE},experience:'',goal:'',availability:'',cvId,
    };
    const submit = () => handlePublicLead(new Request(local+'/api/public-leads',{
      method:'POST',headers:{Origin:local,'Content-Type':'application/json'},
      body:JSON.stringify(data),
    }),{
      env:isolated,cvStorage:store,
      fetchImpl:async()=>{throw new Error('UNEXPECTED_HIGHLEVEL_TRANSPORT');},
    });

    const first=await submit();
    assert.equal(first.status,200,'Hub-first submission must succeed independently of CRM');
    assert.equal((await first.json()).ok,true);
    stage='hub-receipt';

    const rows=await find(cvId);
    assert.equal(rows.length,1,'exactly one candidate');
    const c=rows[0];
    assert.equal(c.first_name,'Andrea');
    assert.equal(c.last_name,'Collaudo');
    assert.equal(c.email,EMAIL);
    assert.equal(c.status,'received');
    assert.equal(c.current_step,0);
    assert.equal(c.crm_state,'pending');
    assert.equal(c.marketing_consent,false);
    assert.equal(c.utm?.utm_source,SOURCE);

    const saved=await readCandidateCv(store,cvId);
    assert.equal(createHash('sha256').update(saved).digest('hex'),PDF_SHA);
    stage='private-file-verified';

    const replay=await submit();
    assert.equal(replay.status,200,'idempotent second submission');
    const replayRows=await find(cvId);
    assert.equal(replayRows.length,1);
    assert.equal(replayRows[0].id,c.id);
    const history=await readJson(
      '/rest/v1/architect_candidate_history?select=id,kind&candidate_id=eq.'+c.id,hubRead
    );
    assert.equal(history.filter(h=>h.kind==='received').length,1);
    stage='replay-verified';
    console.log('ARCHITECT_PRIVATE_E2E: PASS (PDF upload, Hub receipt, private CV read-back and idempotent replay; no HighLevel)');
  }catch(e){
    failed=true;
  }finally{
    if(cvId){
      try{
        const rows=await find(cvId);
        for(const c of rows){
          if(c.email!==EMAIL || c.utm?.utm_source!==SOURCE || c.status!=='received' || c.current_step!==0)
            throw new Error('E2E_UNSAFE_CLEANUP_TARGET');
          await deleteHub('/rest/v1/architect_candidate_history?candidate_id=eq.'+c.id);
          await deleteHub('/rest/v1/architect_candidates?id=eq.'+c.id);
        }
        const deleted=await fetch(store.url+'/storage/v1/object/architect-cv',{
          method:'DELETE',headers:{...headers,'Content-Type':'application/json'},
          body:JSON.stringify({prefixes:['pending/'+cvId+'.pdf','candidates/'+cvId+'.pdf']}),
          redirect:'error',signal:AbortSignal.timeout(10000),
        });
        if(!deleted.ok)throw new Error('E2E_STORAGE_CLEANUP_ERROR');
        if((await find(cvId)).length!==0)throw new Error('E2E_CANDIDATE_STILL_PRESENT');
        const info=await fetch(store.url+'/storage/v1/object/info/architect-cv/candidates/'+cvId+'.pdf',{
          method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(10000),
        });
        if(info.ok || ![400,404].includes(info.status))throw new Error('E2E_STORAGE_CLEANUP_NOT_CONFIRMED');
        console.log('ARCHITECT_PRIVATE_E2E: CLEANUP_PASS (zero synthetic records or PDFs retained)');
      }catch(e){cleanupFailed=true;}
    }
  }
  if(cleanupFailed){
    console.error('ARCHITECT_PRIVATE_E2E: CLEANUP_FAILED (manual reconciliation required)');
    process.exitCode=1;
  }else if(failed || !cvId){
    console.error('ARCHITECT_PRIVATE_E2E: FAILED at stage '+stage+' (sanitized, no provider response exposed)');
    process.exitCode=1;
  }
}