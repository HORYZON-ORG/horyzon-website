-- Metadata only. No Auth, Hub, P1 or Radar application rows are read.
begin read only;
select jsonb_build_object(
  'project_ref','pmkyeqrfkunypfkbjnyg',
  'inspected_at',clock_timestamp(),
  'database',current_database(),
  'inspection_role',current_user,
  'postgres_version',current_setting('server_version'),
  'radar_schema_exists',exists(select 1 from pg_namespace where nspname='patrimonial_radar_private'),
  'objects',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p')
    and ((n.nspname='auth' and c.relname in ('users','sessions')) or (n.nspname='hub' and c.relname='user_roles')
      or (n.nspname='public' and c.relname in ('patrimonial_operators','patrimonial_assignments','patrimonial_intents','patrimonial_assignment_commands','patrimonial_domain_events','patrimonial_performance_events'))
      or n.nspname='patrimonial_radar_private')),
  'session_columns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type) order by ordinal_position)
    from information_schema.columns where table_schema='auth' and table_name='sessions'),
  'privileges',(select jsonb_agg(jsonb_build_object('role',r.rolname,'bypass_rls',r.rolbypassrls,
    'auth_schema_usage',has_schema_privilege(r.oid,'auth','USAGE'),
    'sessions_select',has_table_privilege(r.oid,'auth.sessions','SELECT'),
    'users_select',has_table_privilege(r.oid,'auth.users','SELECT'),
    'operators_select',has_table_privilege(r.oid,'public.patrimonial_operators','SELECT'),
    'operators_update',has_table_privilege(r.oid,'public.patrimonial_operators','UPDATE'),
    'intents_update',has_table_privilege(r.oid,'public.patrimonial_intents','UPDATE')) order by r.rolname)
    from pg_roles r where rolname in ('anon','authenticated','service_role','supabase_auth_admin','postgres')),
  'identity_foreign_keys',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'definition',pg_get_constraintdef(oid)) order by conrelid::regclass::text,conname)
    from pg_constraint where contype='f' and conrelid in ('hub.user_roles'::regclass,'auth.sessions'::regclass,'public.patrimonial_operators'::regclass,'public.patrimonial_assignments'::regclass)),
  'sessions_policy_count',(select count(*) from pg_policies where schemaname='auth' and tablename='sessions'),
  'advisor_named_objects',(select coalesce(jsonb_agg(n.nspname||'.'||c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','hub','patrimonial_radar_private') and c.relname ~ '(advisor|staff_operator_binding|person_contact_binding|purpose_episode_scope)'),
  'recent_migration_metadata',(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version)
    from supabase_migrations.schema_migrations where version >= '20261018000000')
) as topology;
commit;
