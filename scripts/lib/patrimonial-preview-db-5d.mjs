// 5D-only native rehearsal. Independent fenced loopback DB; never used by the app.
import {readFile as readRaw} from 'node:fs/promises';
const readFile=async(...args)=>{const value=await readRaw(...args);return typeof value==='string'?value.replace(/\r\n/g,'\n'):value;};
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {unwrap} from '../../src/lib/patrimonial-radar-server/store.ts';
import {SupabasePatrimonialStore} from '../../src/lib/public-leads/patrimonial-supabase.ts';
export const foundationMigration='supabase/migrations/20261020134559_patrimonial_radar_hub_foundation.sql';
export async function foundationDatabase(options={}){
  const arg=process.argv.find(a=>a.startsWith('--pg-module='));
  if(!arg)throw Error('NATIVE_PG_REQUIRED: supply --pg-module and a loopback radar_5d_test database; no remote fallback');
  const {default:pg}=await import(pathToFileURL(resolve(arg.slice(12))).href);
  const url=new URL(process.env.PATRIMONIAL_TEST_DATABASE_URL??'postgres://postgres@127.0.0.1:15449/radar_5d_test');
  if(url.hostname!=='127.0.0.1'||url.port!=='15449'||url.pathname!=='/radar_5d_test')throw Error('Only dedicated synthetic local database is allowed');
  const pool=new pg.Pool({connectionString:url.href,max:8});
  const admin=await pool.connect();
  try{
    await admin.query(`drop schema if exists architetti_private cascade; drop schema if exists patrimonial_radar_private cascade; drop schema if exists hub cascade; drop schema if exists auth cascade; drop schema public cascade; create schema public;
      create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;
      do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
      if not exists(select 1 from pg_roles where rolname='authenticator') then create role authenticator noinherit login; end if; end $$;
      grant anon,authenticated,service_role to authenticator;
      create schema auth; create table auth.users(id uuid primary key,deleted_at timestamptz,banned_until timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz);
      alter table auth.users enable row level security; alter table auth.sessions enable row level security;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
      -- Match the verified Horyzon ACL, never widen public for account tests.
      revoke all on schema public from public,anon,authenticated;
      grant usage on schema public to service_role;`);
    const baseFiles=['supabase/migrations/20261014225059_patrimonial_lead_v2.sql','supabase/migrations/20261015100912_patrimonial_opportunity_jsonb_precedence.sql','supabase/migrations/20261018094926_patrimonial_assignment_management.sql','supabase/migrations/20261018163245_patrimonial_owner_sync.sql','supabase/migrations/20261018180107_patrimonial_runtime_capabilities.sql','supabase/migrations/20261018224500_patrimonial_performance_tracking.sql','supabase/migrations/20261018191940_patrimonial_radar_identity_sessions.sql',foundationMigration,'supabase/migrations/20261020165515_patrimonial_foundation_first_event.sql'];
    if(options.networkPlatform){
      for(const file of baseFiles.slice(0,6))await admin.query(await readFile(file,'utf8'));
      // The concurrent replay uses canonical Platform identity/OAuth/Hub DDL.
      // Provider auth rows and the unrelated audit sink remain synthetic fixtures.
      if(options.replayConcurrent){
        for(const name of ['0001_roles.sql','0002_identity.sql','0005_seed_roles_permissions.sql','0020_hub_schema_tables.sql','0022_mcp_connections.sql','0043_mcp_oauth21.sql','0057_mcp_refresh_and_primary_admin.sql'])
          await admin.query(await readFile(resolve(options.networkPlatform,'packages/database/migrations',name),'utf8'));
        await admin.query("alter table auth.users add column email text,add column raw_user_meta_data jsonb default '{}',add column is_anonymous boolean default false");
      }else await admin.query("create schema hub; create table hub.user_roles(id uuid primary key default gen_random_uuid(),user_id uuid not null,email text not null,role text not null,company_id uuid,created_at timestamptz default now())");
      await admin.query("create table public.audit_events(seq bigserial primary key,id uuid default gen_random_uuid(),action text not null,outcome text not null,actor jsonb not null,target jsonb not null,data jsonb not null default '{}',hash text not null)");
      await admin.query(await readFile(resolve(options.networkPlatform,'packages/database/pending/0056_architetti_workspace.sql'),'utf8'));
      if(options.replayConcurrent){
        const {replayConcurrent,fingerprintConcurrent}=await import('./patrimonial-concurrent-replay.mjs');
        await replayConcurrent(admin);
        const {createHash}=await import('node:crypto');
        const manifest=JSON.parse(await readFile(new URL('../fixtures/remote-schema-5d/manifest.json',import.meta.url),'utf8'));
        for(const item of manifest){const sql=await readFile(new URL('../fixtures/remote-schema-5d/'+item.file,import.meta.url),'utf8');if(createHash('sha256').update(sql).digest('hex')!==item.sha256)throw Error('Current schema metadata drift');await admin.query(sql);}
        pool.concurrentFingerprint=await fingerprintConcurrent(admin);
        if(options.beforeCandidate)await options.beforeCandidate(admin);
      }
      await admin.query(await readFile(baseFiles[6],'utf8'));
      await admin.query(await readFile(resolve(options.networkPlatform,'packages/database/pending/20261026160057_patrimonial_radar_preview_foundation.sql'),'utf8'));
      if(process.argv.includes('--activation-candidate')){
        // Schema reset above removed only objects in the dedicated synthetic DB.
        await admin.query('drop role if exists patrimonial_radar_runtime');
        await admin.query(await readFile(resolve(options.networkPlatform,'packages/database/pending/20261021191024_patrimonial_radar_activation_candidate.sql'),'utf8'));
      }
    }else for(const file of baseFiles)await admin.query(await readFile(file,'utf8'));
  }catch(e){await admin.query('rollback');throw e;}finally{admin.release();}
  const transaction=async(work,role='service_role',claims={})=>{const client=await pool.connect();try{await client.query('begin');await client.query(`set local role ${role}`);await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);const result=await work(client);await client.query('commit');return result;}catch(e){await client.query('rollback');throw e;}finally{client.release();}};
  const leadStore=new SupabasePatrimonialStore({url:'http://127.0.0.1:15449',serviceRoleKey:'SYNTHETIC_FIXTURE_ONLY',fetchImpl:async(url,init)=>{
    const name=new URL(url).pathname.split('/').at(-1),body=JSON.parse(init.body);assertLocal(name,url);
    try{const result=await transaction(c=>name==='acquire_patrimonial_request_v2'?c.query('select public.acquire_patrimonial_request_v2($1::jsonb,$2::jsonb) reply',[JSON.stringify(body.p_commands),JSON.stringify(body.p_expected)]):name==='patrimonial_store_transaction'?c.query('select public.patrimonial_store_transaction($1::jsonb,$2::jsonb,$3::boolean) reply',[JSON.stringify(body.p_commands),JSON.stringify(body.p_expected),body.p_preview]):c.query(`select public.${name}() reply`));return Response.json(result.rows[0].reply);}
    catch(e){console.error('Synthetic native ledger SQL:',e.code,e.message,e.where);return Response.json({code:e.code,message:e.message},{status:e.code==='PT409'?409:500});}
  }});
  function assertLocal(name,url){if(new URL(url).origin!=='http://127.0.0.1:15449'||!['patrimonial_store_health','patrimonial_store_capabilities','patrimonial_store_transaction','acquire_patrimonial_request_v2'].includes(name))throw Error('Nonlocal or unapproved fixture RPC');}
  return {pool,transaction,leadStore,legacyRpc:{async invoke(command){return unwrap((await transaction(c=>c.query('select public.patrimonial_radar_command_pre_5a($1::jsonb) reply',[JSON.stringify(command)]))).rows[0].reply);}},async query(sql,params){return pool.query(sql,params);},rpc:{async invoke(command){const fn=command.contract==='patrimonial-foundation-5a-1'?'patrimonial_foundation_command':'patrimonial_radar_command';return unwrap((await transaction(c=>c.query(`select public.${fn}($1::jsonb) reply`,[JSON.stringify(command)]))).rows[0].reply);}},async hub(claims,command){return (await transaction(c=>c.query('select hub.patrimonial_radar_command($1::jsonb) reply',[JSON.stringify({contract:'patrimonial-foundation-5a-1',...command})]),'authenticated',claims)).rows[0].reply;},async close(){await pool.end();}};
}
