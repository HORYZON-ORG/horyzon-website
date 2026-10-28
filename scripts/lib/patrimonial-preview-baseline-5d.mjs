import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{readFile}from'node:fs/promises';
export const baseline5d={passed:[]};const claims={sub:randomUUID(),session_id:randomUUID()};
async function fingerprint(client){return(await client.query("select n.nspname||'.'||p.proname as name,pg_get_function_identity_arguments(p.oid) args,md5(replace(pg_get_functiondef(p.oid),E'\\r\\n',E'\\n')) as hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','hub','architetti_private')")).rows;}
export async function beforePreviewCandidate(client){
 const observed=JSON.parse(await readFile(new URL('../fixtures/remote-schema-5d/baseline-fingerprints.json',import.meta.url),'utf8'));
 const local=await fingerprint(client),compared=[],missing=[];
 for(const row of observed.functions){const found=local.find(r=>r.name===row.schema+'.'+row.name&&r.args===row.args);if(!found){missing.push(row.schema+'.'+row.name);continue;}assert.equal(found.hash,row.definition_md5,'Current shared function drift: '+found.name);compared.push(found.name+'('+found.args+')');}
 assert(compared.includes('architetti_private.command(p_action text, p_input jsonb)'));assert(compared.includes('architetti_private.snapshot(p_query text)'));
 for(const table of observed.tables){const actual=(await client.query('select c.relrowsecurity rls,c.relforcerowsecurity force from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relname=$2',[table.schema,table.name])).rows[0];assert(actual,table.schema+'.'+table.name);assert.deepEqual(actual,{rls:table.rls,force:table.force},table.name);}
 for(const c of observed.constraints){const actual=(await client.query('select pg_get_constraintdef(oid) definition from pg_constraint where conrelid=to_regclass($1) and conname=$2',['public.'+c.table,c.name])).rows[0];assert.equal(actual?.definition,c.definition,c.name);}
 baseline5d.tablesCompared=observed.tables.length;baseline5d.constraintsCompared=observed.constraints.length;
 baseline5d.functionComparisons=compared;baseline5d.unreplayedFunctions=missing;
 const candidate=(await readFile(new URL('../../../platform/packages/database/pending/20261026160057_patrimonial_radar_preview_foundation.sql',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
 const preflight=candidate.match(/do \$baseline\$[\s\S]*?end \$baseline\$;/)?.[0];assert(preflight);
 await client.query('begin');
 try{await client.query("alter function public.patrimonial_assignment_commit(jsonb,bigint) set search_path=pg_catalog,synthetic_5d_drift_only");
  await assert.rejects(client.query(preflight),/SHARED_FUNCTION_BASELINE_DRIFT/);
 }finally{await client.query('rollback');}
 baseline5d.passed.push('M2 rejects altered shared function configuration before any global constraint change');
 baseline5d.p1=(await client.query("select p.proname,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('patrimonial_assignment_guard','patrimonial_assignment_commit')")).rows;
 baseline5d.ledgerTriggers=(await client.query("select tgname,pg_get_triggerdef(oid) def from pg_trigger where tgrelid='public.patrimonial_requests'::regclass and not tgisinternal order by tgname")).rows;
 await client.query("insert into auth.users(id,email) values($1,'baseline-admin@example.invalid')",[claims.sub]);
 await client.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[claims.session_id,claims.sub]);
 await client.query("insert into hub.user_roles(user_id,email,role) values($1,'baseline-admin@example.invalid','superadmin')",[claims.sub]);
 await client.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
 const event={eventId:'baseline-event-5d',locationId:'synthetic-5d',externalContactId:'baseline-person-5d',fullName:'Persona Baseline',email:'baseline-event@example.invalid',phone:null,source:'Funnel Evento',sourcePath:'/benessere-patrimoniale/evento',consent:true,marketingConsent:false};
 baseline5d.event=event;baseline5d.eventResult=(await client.query('select public.architetti_event_ingest($1) d',[event])).rows[0].d;
 baseline5d.snapshot=(await client.query("select hub.architetti_snapshot('') d")).rows[0].d;
 baseline5d.passed.push('current shared-schema fingerprints match the read-only preflight catalog');
}
export async function afterPreviewCandidate(db){
 assert.equal((await db.query('select patrimonial_radar_private.pilot_enabled() enabled')).rows[0].enabled,false);
 assert.equal((await db.query('select count(*)::int n from patrimonial_radar_private.account_gate')).rows[0].n,0);
 // Use one transaction/client for Auth context; pool-wide set_config is never an authority.
 const snapshot=(await db.transaction(c=>c.query("select hub.architetti_snapshot('') d"),'authenticated',claims)).rows[0].d;
 assert.deepEqual(snapshot,baseline5d.snapshot,'OFF must preserve the exact current network snapshot');
 const currentTriggers=(await db.query("select tgname,pg_get_triggerdef(oid) def from pg_trigger where tgrelid='public.patrimonial_requests'::regclass and not tgisinternal order by tgname")).rows;
 assert.deepEqual(currentTriggers,baseline5d.ledgerTriggers,'No new Event request trigger');
 const receipt=(await db.transaction(c=>c.query('select public.architetti_event_ingest($1) d',[baseline5d.event]),'service_role')).rows[0].d;
 assert.deepEqual(receipt,baseline5d.eventResult);
 assert.equal((await db.query('select count(*)::int n from patrimonial_radar_private.contact_requests')).rows[0].n,0);
 for(const old of baseline5d.p1){
  const actual=(await db.query("select prosrc from pg_proc where oid=($1)::regprocedure",[old.proname==='patrimonial_assignment_guard'?'public.patrimonial_assignment_guard()':'public.patrimonial_assignment_commit(jsonb,bigint)'])).rows[0].prosrc;
  const expected=old.proname==='patrimonial_assignment_guard'?old.prosrc.replace("v_kind NOT IN ('OPPORTUNITY','HORYZON_OPPORTUNITY')","v_kind NOT IN ('OPPORTUNITY','HORYZON_OPPORTUNITY','RADAR')"):old.prosrc.replace("kind='OPPORTUNITY' and operator_revision","kind in ('OPPORTUNITY','RADAR') and operator_revision");
  assert.equal(actual,expected,'Only the declared RADAR extension may change P1');
 }
 for(const command of [{method:'list'},{method:'contacts'}]){
  const result=(await db.transaction(c=>c.query('select hub.patrimonial_radar_simple_command($1) d',[command]),'authenticated',claims)).rows[0].d;assert.equal(result.ok,false);assert.equal(result.code,'UNAVAILABLE');
 }
 await assert.rejects(db.transaction(c=>c.query('select hub.architetti_client_detail($1)',[receipt.contactId]),'authenticated',claims));
 baseline5d.passed.push('M2/M3 default OFF; current snapshot and Event replay unchanged; no global ledger hook','P1 body diff limited to the declared RADAR literals','Hub and Clienti Radar entrypoints denied while the single gate is OFF');
}
