-- P1: LOCAL FILE ONLY. Applying to a remote project requires separate authorization.
-- Extends the existing service-role journal. No owner_ref writes or provider effects.
begin;

create table public.patrimonial_operators (
  id uuid primary key default gen_random_uuid(),
  operator_key text not null unique check (operator_key ~ '^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,159}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  remote_user_ref text,
  active boolean not null default true,
  role text,
  capacity integer check (capacity is null or capacity >= 0),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.patrimonial_intents
  add column current_operator_id uuid references public.patrimonial_operators(id),
  add column operator_revision integer not null default 0 check (operator_revision >= 0);
comment on column public.patrimonial_intents.owner_ref is 'Remote CRM/provider owner reference. P1 assignments never modify this field.';
comment on column public.patrimonial_intents.current_operator_id is 'Internal Horyzon operator UUID; NEVER a HighLevel assignedTo value.';
comment on column public.patrimonial_intents.operator_revision is 'Internal assignment CAS, independent of business/CRM revision.';
create index patrimonial_intents_current_operator on public.patrimonial_intents(current_operator_id) where current_operator_id is not null;

create table public.patrimonial_operator_pools (
  id uuid primary key default gen_random_uuid(), pool_key text not null unique,
  name text not null, active boolean not null default true,
  assignment_policy text not null default 'ROUND_ROBIN' check (assignment_policy in ('MANUAL','ROUND_ROBIN','BALANCED_BATCH')),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.patrimonial_operator_pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.patrimonial_operator_pools(id),
  operator_id uuid not null references public.patrimonial_operators(id),
  active boolean not null default true, weight numeric check (weight is null or weight > 0),
  joined_at timestamptz not null default now(), left_at timestamptz,
  check (active = (left_at is null)),
  check (left_at is null or left_at >= joined_at)
);
create unique index patrimonial_pool_member_active on public.patrimonial_operator_pool_members(pool_id,operator_id) where active;
create index patrimonial_pool_members_operator on public.patrimonial_operator_pool_members(operator_id);

create table public.patrimonial_assignment_experiments (
  id uuid primary key default gen_random_uuid(), experiment_key text not null unique, name text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED','COMPLETED','CANCELLED')),
  pool_id uuid references public.patrimonial_operator_pools(id),
  assignment_method text not null check (assignment_method in ('MANUAL','ROUND_ROBIN','BALANCED_BATCH')),
  target_per_operator integer check (target_per_operator is null or target_per_operator > 0),
  configuration jsonb not null default '{}' check (jsonb_typeof(configuration) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  started_at timestamptz, ended_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (status = 'DRAFT' or started_at is not null),
  check ((status in ('COMPLETED','CANCELLED')) = (ended_at is not null)),
  check (ended_at is null or ended_at >= started_at)
);
create index patrimonial_experiments_pool on public.patrimonial_assignment_experiments(pool_id);
create table public.patrimonial_assignment_experiment_operators (
  experiment_id uuid not null references public.patrimonial_assignment_experiments(id),
  operator_id uuid not null references public.patrimonial_operators(id),
  included boolean not null default true,
  primary key (experiment_id,operator_id)
);
create index patrimonial_experiment_operators_operator on public.patrimonial_assignment_experiment_operators(operator_id);

create table public.patrimonial_lead_snapshots (
  id uuid primary key default gen_random_uuid(), snapshot_key text not null unique,
  intent_id uuid not null references public.patrimonial_intents(id),
  request_id uuid references public.patrimonial_requests(request_id),
  funnel text not null check (funnel in ('architect-path','patrimonial-event','patrimonial-consultation')),
  source text, medium text, campaign text, profile text, maturity_level text,
  consultation_requested boolean,
  attributes jsonb not null default '{}' check (attributes = '{}'),
  schema_version integer not null check (schema_version = 1),
  captured_at timestamptz not null default now(),
  -- P1 has no structured v3 qualification: never infer values from message.
  check (maturity_level is null and consultation_requested is null)
);
create index patrimonial_snapshots_intent on public.patrimonial_lead_snapshots(intent_id);
create index patrimonial_snapshots_request on public.patrimonial_lead_snapshots(request_id);
create table public.patrimonial_assignments (
  id uuid primary key default gen_random_uuid(), assignment_key text not null unique,
  intent_id uuid not null references public.patrimonial_intents(id),
  operator_id uuid not null references public.patrimonial_operators(id),
  pool_id uuid references public.patrimonial_operator_pools(id),
  experiment_id uuid references public.patrimonial_assignment_experiments(id),
  assignment_method text not null check (assignment_method in ('MANUAL','ROUND_ROBIN','BALANCED_BATCH')),
  quality_snapshot_id uuid references public.patrimonial_lead_snapshots(id),
  assigned_at timestamptz not null default now(), released_at timestamptz,
  release_reason text check (release_reason in ('REASSIGNED','MANUAL_RELEASE','INTENT_CLOSED')),
  assigned_by_type text not null check (assigned_by_type in ('SYSTEM','ADMIN','WORKER')),
  assigned_by_ref text, command_key text not null,
  revision integer not null default 0 check (revision >= 0),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  check ((released_at is null) = (release_reason is null)),
  check (released_at is null or released_at >= assigned_at)
);
create unique index patrimonial_assignment_active_intent on public.patrimonial_assignments(intent_id) where released_at is null;
create index patrimonial_assignments_operator_active on public.patrimonial_assignments(operator_id) where released_at is null;
create index patrimonial_assignments_pool on public.patrimonial_assignments(pool_id);
create index patrimonial_assignments_experiment_operator on public.patrimonial_assignments(experiment_id,operator_id);
create index patrimonial_assignments_snapshot on public.patrimonial_assignments(quality_snapshot_id);
create index patrimonial_assignments_command on public.patrimonial_assignments(command_key);

-- Technical state, not a second event ledger or retry queue. No person seeds.
create table public.patrimonial_assignment_state (
  singleton boolean primary key default true check (singleton), revision bigint not null default 0 check (revision >= 0)
);
insert into public.patrimonial_assignment_state(singleton) values(true);
create table public.patrimonial_assignment_cursors (
  scope text primary key, operator_id uuid not null references public.patrimonial_operators(id)
);
create index patrimonial_assignment_cursors_operator on public.patrimonial_assignment_cursors(operator_id);
create table public.patrimonial_assignment_commands (
  command_key text primary key, payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'), created_at timestamptz not null
);

-- Reuse the existing ledger for experiment aggregate events before any lead exists.
-- All old/assignment intent events still require intent_id; no synthetic intent.
alter table public.patrimonial_domain_events
  add column experiment_id uuid references public.patrimonial_assignment_experiments(id),
  alter column intent_id drop not null,
  add constraint patrimonial_event_aggregate_required check (
    (event_name in ('assignment_experiment_created','assignment_experiment_activated','assignment_experiment_paused','assignment_experiment_completed') and experiment_id is not null and intent_id is null)
    or (event_name not in ('assignment_experiment_created','assignment_experiment_activated','assignment_experiment_paused','assignment_experiment_completed') and intent_id is not null)
  );
create index patrimonial_domain_events_experiment on public.patrimonial_domain_events(experiment_id) where experiment_id is not null;

-- Top-level key conversion only; never traverses user metadata or request payload.
create function public.patrimonial_assignment_camel(p_value jsonb) returns jsonb
language sql immutable security invoker set search_path = pg_catalog, public as $$
  select coalesce(jsonb_object_agg(
    (select string_agg(case when ordinality=1 then part else initcap(part) end,'' order by ordinality)
     from unnest(string_to_array(k,'_')) with ordinality t(part,ordinality)),v),'{}')
  from jsonb_each(p_value) e(k,v)
$$;
create function public.patrimonial_assignment_snake(p_value jsonb) returns jsonb
language sql immutable security invoker set search_path = pg_catalog, public as $$
  select coalesce(jsonb_object_agg(lower(regexp_replace(k,'([A-Z])','_\1','g')),v),'{}') from jsonb_each(p_value) e(k,v)
$$;

create function public.patrimonial_assignment_immutable() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
end $$;
create trigger patrimonial_snapshot_immutable before update or delete on public.patrimonial_lead_snapshots
  for each row execute function public.patrimonial_assignment_immutable();
create trigger patrimonial_assignment_no_delete before delete on public.patrimonial_assignments
  for each row execute function public.patrimonial_assignment_immutable();
create trigger patrimonial_operator_no_delete before delete on public.patrimonial_operators
  for each row execute function public.patrimonial_assignment_immutable();
create trigger patrimonial_assignment_command_immutable before update or delete on public.patrimonial_assignment_commands
  for each row execute function public.patrimonial_assignment_immutable();

create function public.patrimonial_assignment_guard() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_id uuid; v_operator uuid; v_current uuid; v_kind text;
begin
  -- Same lock as the existing journal: manual/automatic assignment and capacity share a boundary.
  perform pg_advisory_xact_lock(741920,2);
  if tg_table_name = 'patrimonial_operators' then
    if new.operator_key <> old.operator_key or new.id <> old.id or new.created_at <> old.created_at or new.revision <> old.revision+1 then
      raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
    end if;
  elsif tg_table_name = 'patrimonial_assignment_experiment_operators' then
    v_id := case when tg_op='DELETE' then old.experiment_id else new.experiment_id end;
    if tg_op='UPDATE' and (new.experiment_id <> old.experiment_id or new.operator_id <> old.operator_id) then
      raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
    end if;
    if (select status <> 'DRAFT' from public.patrimonial_assignment_experiments where id=v_id) then
      raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
    end if;
    if tg_op='DELETE' then return old; end if;
  elsif tg_table_name = 'patrimonial_assignment_experiments' then
    if new.id <> old.id or new.experiment_key <> old.experiment_key or new.created_at <> old.created_at or new.revision <> old.revision+1
      or (old.status <> 'DRAFT' and (new.pool_id is distinct from old.pool_id or new.assignment_method <> old.assignment_method
        or new.target_per_operator is distinct from old.target_per_operator or new.configuration <> old.configuration))
      or not ((old.status='DRAFT' and new.status in ('DRAFT','ACTIVE')) or (old.status='ACTIVE' and new.status in ('PAUSED','COMPLETED'))
        or (old.status='PAUSED' and new.status in ('ACTIVE','COMPLETED'))) then
      raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
    end if;
  elsif tg_table_name = 'patrimonial_assignments' then
    if tg_op='UPDATE' then
      if old.released_at is not null or new.released_at is null or new.revision <> old.revision+1
        or (to_jsonb(new)-array['released_at','release_reason','revision']) <> (to_jsonb(old)-array['released_at','release_reason','revision']) then
        raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
      end if;
    else
      select current_operator_id,kind into v_current,v_kind from public.patrimonial_intents where id=new.intent_id;
      if v_kind <> 'OPPORTUNITY' or not exists(select 1 from public.patrimonial_intents where id=new.intent_id and status='OPEN')
        or not exists(select 1 from public.patrimonial_operators where id=new.operator_id and active
          and (capacity is null or (select count(*) from public.patrimonial_assignments where operator_id=new.operator_id and released_at is null)<capacity
            or (new.assignment_method='MANUAL' and new.assigned_by_type='ADMIN' and new.metadata->>'reasonCode'='capacity-override')))
        or (new.pool_id is not null and not exists(select 1 from public.patrimonial_operator_pools p join public.patrimonial_operator_pool_members m on m.pool_id=p.id
          where p.id=new.pool_id and p.active and m.operator_id=new.operator_id and m.active))
        or (new.experiment_id is not null and not exists(select 1 from public.patrimonial_assignment_experiments e join public.patrimonial_assignment_experiment_operators m on m.experiment_id=e.id
          where e.id=new.experiment_id and e.status='ACTIVE' and m.included and m.operator_id=new.operator_id and e.assignment_method=new.assignment_method
          and e.pool_id is not distinct from new.pool_id and (e.target_per_operator is null or
            (select count(*) from public.patrimonial_assignments a where a.experiment_id=e.id and a.operator_id=new.operator_id)<e.target_per_operator)))
        or (new.quality_snapshot_id is not null and not exists(select 1 from public.patrimonial_lead_snapshots where id=new.quality_snapshot_id and intent_id=new.intent_id)) then
        raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger patrimonial_operator_stable before update on public.patrimonial_operators for each row execute function public.patrimonial_assignment_guard();
create trigger patrimonial_experiment_stable before update on public.patrimonial_assignment_experiments for each row execute function public.patrimonial_assignment_guard();
create trigger patrimonial_experiment_members_frozen before insert or update or delete on public.patrimonial_assignment_experiment_operators for each row execute function public.patrimonial_assignment_guard();
create trigger patrimonial_assignment_history_guard before insert or update on public.patrimonial_assignments for each row execute function public.patrimonial_assignment_guard();

-- Deferred: reassign closes history before inserting the successor and projecting it.
-- Also protects direct service-role writes, not just the TypeScript command path.
create function public.patrimonial_assignment_projection() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_intent uuid; v_current uuid; v_assigned uuid;
begin
  perform pg_advisory_xact_lock(741920,2);
  if tg_table_name='patrimonial_intents' then v_intent:=new.id; else v_intent:=new.intent_id; end if;
  select current_operator_id into v_current from public.patrimonial_intents where id=v_intent;
  select operator_id into v_assigned from public.patrimonial_assignments where intent_id=v_intent and released_at is null;
  if v_current is distinct from v_assigned then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
  return null;
end $$;
create constraint trigger patrimonial_assignment_projection_consistent after insert or update on public.patrimonial_assignments
  deferrable initially deferred for each row execute function public.patrimonial_assignment_projection();
create constraint trigger patrimonial_intent_operator_consistent after insert or update of current_operator_id on public.patrimonial_intents
  deferrable initially deferred for each row execute function public.patrimonial_assignment_projection();

create function public.patrimonial_assignment_context(p_key text,p_intents jsonb,p_experiment uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_result jsonb;
begin
  -- The enclosing journal holds this lock through decision validation and commit.
  perform pg_advisory_xact_lock(741920,2);
  select jsonb_build_object(
    'revision',(select revision from public.patrimonial_assignment_state where singleton),
    'receipt',(select jsonb_build_object('payloadHash',payload_hash,'result',result) from public.patrimonial_assignment_commands where command_key=p_key),
    'operators',(select coalesce(jsonb_agg(public.patrimonial_assignment_camel(to_jsonb(o)) order by id),'[]') from public.patrimonial_operators o),
    'pools',(select coalesce(jsonb_agg(public.patrimonial_assignment_camel(to_jsonb(p)) order by id),'[]') from public.patrimonial_operator_pools p),
    'members',(select coalesce(jsonb_agg(public.patrimonial_assignment_camel(to_jsonb(m)) order by id),'[]') from public.patrimonial_operator_pool_members m),
    'experiments',(select coalesce(jsonb_agg(public.patrimonial_assignment_camel(to_jsonb(e)) order by id),'[]') from public.patrimonial_assignment_experiments e),
    'experimentOperators',(select coalesce(jsonb_agg(jsonb_build_object('experimentId',experiment_id,'operatorId',operator_id) order by experiment_id,operator_id),'[]') from public.patrimonial_assignment_experiment_operators where included),
    'assignments',(select coalesce(jsonb_agg(public.patrimonial_assignment_camel(to_jsonb(a)) order by id),'[]') from public.patrimonial_assignments a where released_at is null or experiment_id=p_experiment),
    'snapshots',(select coalesce(jsonb_agg(public.patrimonial_assignment_camel(to_jsonb(s)) order by id),'[]') from public.patrimonial_lead_snapshots s where exists(select 1 from public.patrimonial_assignments a where a.quality_snapshot_id=s.id and (a.released_at is null or a.experiment_id=p_experiment))),
    'cursors',(select coalesce(jsonb_object_agg(scope,operator_id),'{}') from public.patrimonial_assignment_cursors),
    'intents',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',i.id,'kind',i.kind,'status',i.status,'revision',i.revision,'operatorRevision',i.operator_revision,
      'currentOperatorId',i.current_operator_id,'ownerRef',i.owner_ref,
      'quality',jsonb_build_object('requestId',r.request_id,'funnel',i.funnel,
        'source',coalesce(r.record#>>'{payload,utm,utm_source}',i.record#>>'{firstRequest,source}'),
        'medium',r.record#>>'{payload,utm,utm_medium}','campaign',r.record#>>'{payload,utm,utm_campaign}',
        'profile',r.record#>>'{payload,profile}','maturityLevel',null,'consultationRequested',null,'attributes','{}'::jsonb)) order by i.id),'[]')
      from public.patrimonial_intents i left join public.patrimonial_requests r
        on r.request_id::text=i.record#>>'{firstRequest,requestId}' and r.mode=i.funnel
          and i.record->'requestIds' ? r.request_id::text
      where i.id::text in (select jsonb_array_elements_text(p_intents)))
  ) into v_result;
  return v_result;
end $$;

create function public.patrimonial_assignment_commit(p_plan jsonb,p_revision bigint) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare w jsonb; v jsonb; s jsonb; n integer; old_revision bigint; saved public.patrimonial_assignment_commands; eid uuid; oid uuid;
begin
  perform pg_advisory_xact_lock(741920,2);
  select * into saved from public.patrimonial_assignment_commands where command_key=p_plan->>'commandKey';
  if found then
    if saved.payload_hash <> p_plan->>'payloadHash' then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
    return 'null'::jsonb;
  end if;
  select revision into old_revision from public.patrimonial_assignment_state where singleton for update;
  if old_revision <> p_revision then raise exception using errcode='PT409',message='PATRIMONIAL_SNAPSHOT_CHANGED'; end if;
  if jsonb_typeof(p_plan->'writes') <> 'array' then raise exception using errcode='22023',message='Invalid assignment plan'; end if;
  for w in select jsonb_array_elements(p_plan->'writes') loop
    v:=w->'value'; s:=public.patrimonial_assignment_snake(v);
    case w->>'kind'
    when 'operator' then
      if (v->>'revision')::integer=0 then
        insert into public.patrimonial_operators select (jsonb_populate_record(null::public.patrimonial_operators,s)).*;
      else
        update public.patrimonial_operators set display_name=v->>'displayName',remote_user_ref=v->>'remoteUserRef',active=(v->>'active')::boolean,
          role=v->>'role',capacity=(v->>'capacity')::integer,sort_order=(v->>'sortOrder')::integer,metadata=v->'metadata',
          revision=(v->>'revision')::integer,updated_at=(v->>'updatedAt')::timestamptz
          where id=(v->>'id')::uuid and revision=(v->>'revision')::integer-1;
        get diagnostics n=row_count; if n<>1 then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
      end if;
    when 'pool' then
      if (v->>'revision')::integer=0 then
        insert into public.patrimonial_operator_pools select (jsonb_populate_record(null::public.patrimonial_operator_pools,s)).*;
      else
        update public.patrimonial_operator_pools set revision=(v->>'revision')::integer,updated_at=(v->>'updatedAt')::timestamptz
          where id=(v->>'id')::uuid and revision=(v->>'revision')::integer-1;
        get diagnostics n=row_count; if n<>1 then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
      end if;
    when 'member' then
      if (v->>'active')::boolean then
        insert into public.patrimonial_operator_pool_members select (jsonb_populate_record(null::public.patrimonial_operator_pool_members,s)).*;
      else
        update public.patrimonial_operator_pool_members set active=false,left_at=(v->>'leftAt')::timestamptz where id=(v->>'id')::uuid and active;
        get diagnostics n=row_count; if n<>1 then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
      end if;
    when 'experimentOperators' then
      eid:=(v->>'experimentId')::uuid;
      update public.patrimonial_assignment_experiment_operators set included=false where experiment_id=eid and included;
      for oid in select value::uuid from jsonb_array_elements_text(v->'operatorIds') loop
        insert into public.patrimonial_assignment_experiment_operators(experiment_id,operator_id) values(eid,oid)
          on conflict (experiment_id,operator_id) do update set included=true;
      end loop;
    when 'experiment' then
      if (v->>'revision')::integer=0 then
        insert into public.patrimonial_assignment_experiments select (jsonb_populate_record(null::public.patrimonial_assignment_experiments,s)).*;
      else
        update public.patrimonial_assignment_experiments set status=v->>'status',revision=(v->>'revision')::integer,
          started_at=(v->>'startedAt')::timestamptz,ended_at=(v->>'endedAt')::timestamptz,updated_at=(v->>'updatedAt')::timestamptz
          where id=(v->>'id')::uuid and revision=(v->>'revision')::integer-1;
        get diagnostics n=row_count; if n<>1 then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
      end if;
    when 'snapshot' then
      if exists(select 1 from jsonb_object_keys(v) k where k not in ('id','snapshotKey','intentId','requestId','funnel','source','medium','campaign','profile','maturityLevel','consultationRequested','attributes','schemaVersion','capturedAt')) then
        raise exception using errcode='22023',message='Invalid snapshot fields';
      end if;
      insert into public.patrimonial_lead_snapshots select (jsonb_populate_record(null::public.patrimonial_lead_snapshots,s)).*;
    when 'assignment' then
      insert into public.patrimonial_assignments select (jsonb_populate_record(null::public.patrimonial_assignments,s)).*;
    when 'release' then
      update public.patrimonial_assignments set released_at=(v->>'releasedAt')::timestamptz,release_reason=v->>'releaseReason',revision=revision+1
        where id=(v->>'id')::uuid and released_at is null and revision=(v->>'expectedRevision')::integer;
      get diagnostics n=row_count; if n<>1 then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
    when 'intentOperator' then
      update public.patrimonial_intents set current_operator_id=(v->>'currentOperatorId')::uuid,operator_revision=operator_revision+1
        where id=(v->>'id')::uuid and kind='OPPORTUNITY' and operator_revision=(v->>'expectedRevision')::integer and revision=(v->>'businessRevision')::integer;
      get diagnostics n=row_count; if n<>1 then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
    when 'event' then
      if v->>'name' not in ('prospect_assigned','prospect_reassigned','prospect_released','assignment_experiment_created','assignment_experiment_activated','assignment_experiment_paused','assignment_experiment_completed')
        or v#>>'{actor,type}' not in ('SYSTEM','ADMIN','WORKER')
        or exists(select 1 from jsonb_object_keys(v->'metadata') k where k not in ('assignmentId','operatorId','previousAssignmentId','qualitySnapshotId','method','reason','experimentId','revisionSpace')) then
        raise exception using errcode='22023',message='Invalid assignment event';
      end if;
      insert into public.patrimonial_domain_events(event_id,event_key,event_name,intent_id,experiment_id,revision,occurred_at,actor_type,actor_ref,metadata)
        values((v->>'id')::uuid,v->>'eventKey',v->>'name',(v->>'intentId')::uuid,(v->>'experimentId')::uuid,(v->>'revision')::integer,(v->>'at')::timestamptz,v#>>'{actor,type}',v#>>'{actor,ref}',v->'metadata');
    when 'cursor' then
      insert into public.patrimonial_assignment_cursors(scope,operator_id) values(v->>'scope',(v->>'operatorId')::uuid)
        on conflict (scope) do update set operator_id=excluded.operator_id;
    else raise exception using errcode='22023',message='Unknown assignment write';
    end case;
  end loop;
  insert into public.patrimonial_assignment_commands(command_key,payload_hash,result,created_at)
    values(p_plan->>'commandKey',p_plan->>'payloadHash',p_plan->'result',(p_plan->>'at')::timestamptz);
  update public.patrimonial_assignment_state set revision=revision+1 where singleton;
  return 'null'::jsonb;
end $$;

-- Keep applied migration bodies immutable: delegate every legacy command unchanged.
alter function public.patrimonial_execute_command(jsonb) rename to patrimonial_execute_command_pre_assignments;
create function public.patrimonial_execute_command(p_command jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  case p_command->>'method'
    when 'getAssignmentContext' then return public.patrimonial_assignment_context(p_command#>>'{args,0}',p_command#>'{args,1}',(p_command#>>'{args,2}')::uuid);
    when 'commitAssignmentPlan' then return public.patrimonial_assignment_commit(p_command#>'{args,0}',(p_command#>>'{args,1}')::bigint);
    else return public.patrimonial_execute_command_pre_assignments(p_command);
  end case;
end $$;

-- Explicitly remove inherited default privileges as well as client access.
do $$
declare t text; f record;
begin
  foreach t in array array['patrimonial_operators','patrimonial_operator_pools','patrimonial_operator_pool_members',
    'patrimonial_assignment_experiments','patrimonial_assignment_experiment_operators','patrimonial_lead_snapshots',
    'patrimonial_assignments','patrimonial_assignment_state','patrimonial_assignment_cursors','patrimonial_assignment_commands'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select,insert on table public.%I to service_role',t);
    if t not in ('patrimonial_lead_snapshots','patrimonial_assignment_commands') then execute format('grant update on table public.%I to service_role',t); end if;
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'patrimonial_assignment_%' or p.proname in ('patrimonial_execute_command','patrimonial_execute_command_pre_assignments')) loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
