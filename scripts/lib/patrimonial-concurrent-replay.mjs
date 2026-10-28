import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Reviewed migration metadata only. No production rows, credentials or automatic
// remote application. Called only after foundationDatabase's loopback DB fence.
export async function replayConcurrent(client){
 const manifest=JSON.parse(await readFile(new URL('../fixtures/remote-schema-5b3/manifest.json',import.meta.url),'utf8'));
 for(const item of manifest){
  const sql=(await readFile(new URL('../fixtures/remote-schema-5b3/'+item.file,import.meta.url),'utf8')).replaceAll('\r\n','\n');
  assert.equal(createHash('sha256').update(sql).digest('hex'),item.sha256,'Concurrent migration metadata drift');
  await client.query(sql);
 }
}
export async function fingerprintConcurrent(client){
 const manifest=JSON.parse(await readFile(new URL('../fixtures/remote-schema-5b3/manifest.json',import.meta.url),'utf8'));
 const sql=(await Promise.all(manifest.map(i=>readFile(new URL('../fixtures/remote-schema-5b3/'+i.file,import.meta.url),'utf8')))).join('\n');
 const functions=[...new Set([...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-z_]+\.[a-z_]+)/gi)].map(m=>m[1]))];
 const tables=[...new Set([...sql.matchAll(/create\s+table\s+([a-z_]+\.[a-z_]+)/gi)].map(m=>m[1]))];
 return (await client.query(`select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname,'args',pg_get_function_identity_arguments(p.oid),'md5',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname=any($1)),
 'tables',(select jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text,
 'constraints',(select jsonb_agg(pg_get_constraintdef(x.oid) order by x.conname) from pg_constraint x where x.conrelid=c.oid),
 'triggers',(select jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal))
 order by c.oid::regclass::text) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname||'.'||c.relname=any($2))) value`,[functions,tables])).rows[0].value;
}
