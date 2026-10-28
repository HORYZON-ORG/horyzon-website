-- P3 local foundation: performance event ledger and attribution.
-- Requires P1 assignment management. No seed, webhook activation, dashboard or provider write.
begin;

create table public.patrimonial_performance_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (event_key ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  intent_id uuid not null references public.patrimonial_intents(id),
  assignment_id uuid not null references public.patrimonial_assignments(id),
  operator_id uuid not null references public.patrimonial_operators(id),
  event_type text not null check (event_type in (
    'OWNERSHIP_TAKEN','CONTACT_ATTEMPTED','CONTACT_ESTABLISHED',
    'APPOINTMENT_BOOKED','APPOINTMENT_RESCHEDULED','APPOINTMENT_CANCELLED','APPOINTMENT_ATTENDED','APPOINTMENT_NO_SHOW',
    'FOLLOW_UP_STARTED','STAGE_CHANGED','CLOSED_WON','CLOSED_LOST','CLOSED_ABANDONED'
  )),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null check (source in ('HORYZON_INTERNAL','HIGHLEVEL_WEBHOOK','HIGHLEVEL_RECONCILIATION','MANUAL')),
  source_ref text,
  provider_event_type text,
  remote_opportunity_id text,
  remote_contact_id text,
  remote_appointment_id text,
  pipeline_stage_from text,
  pipeline_stage_to text,
  provider_status text check (provider_status is null or provider_status in ('open','won','lost','abandoned')),
  appointment_status text check (appointment_status is null or appointment_status in ('new','confirmed','cancelled','showed','noshow','invalid','completed','active')),
  channel text check (channel is null or channel in ('CALL','VOICEMAIL','SMS','EMAIL','WHATSAPP','SOCIAL','CHAT','OTHER')),
  recorded_by_type text not null check (recorded_by_type in ('SYSTEM','ADMIN','WORKER','WEBHOOK','OPERATOR')),
  recorded_by_ref text,
  schema_version integer not null default 1 check (schema_version = 1),
  check (source_ref is null or (length(source_ref) between 1 and 200 and source_ref !~ E'[\\r\\n]')),
  check (provider_event_type is null or (length(provider_event_type) between 1 and 80 and provider_event_type !~ E'[\\r\\n]')),
  check (remote_opportunity_id is null or (length(remote_opportunity_id) between 1 and 160 and remote_opportunity_id !~ E'[\\r\\n]')),
  check (remote_contact_id is null or (length(remote_contact_id) between 1 and 160 and remote_contact_id !~ E'[\\r\\n]')),
  check (remote_appointment_id is null or (length(remote_appointment_id) between 1 and 160 and remote_appointment_id !~ E'[\\r\\n]')),
  check (pipeline_stage_from is null or (length(pipeline_stage_from) between 1 and 160 and pipeline_stage_from !~ E'[\\r\\n]')),
  check (pipeline_stage_to is null or (length(pipeline_stage_to) between 1 and 160 and pipeline_stage_to !~ E'[\\r\\n]')),
  check (recorded_by_ref is null or (length(recorded_by_ref) between 1 and 160 and recorded_by_ref !~ E'[\\r\\n]')),
  check (
    source not in ('HIGHLEVEL_WEBHOOK','HIGHLEVEL_RECONCILIATION')
    or (source_ref is not null and provider_event_type is not null
      and (remote_opportunity_id is not null or remote_contact_id is not null or remote_appointment_id is not null))
  ),
  check (event_type <> 'STAGE_CHANGED' or pipeline_stage_to is not null),
  check (event_type not like 'APPOINTMENT_%' or remote_appointment_id is not null),
  check (event_type <> 'APPOINTMENT_BOOKED' or appointment_status is null or appointment_status in ('new','confirmed','active')),
  check (event_type <> 'APPOINTMENT_ATTENDED' or appointment_status is null or appointment_status in ('showed','completed')),
  check (event_type <> 'APPOINTMENT_NO_SHOW' or appointment_status is null or appointment_status = 'noshow'),
  check (event_type <> 'APPOINTMENT_CANCELLED' or appointment_status is null or appointment_status = 'cancelled'),
  check (event_type <> 'CLOSED_WON' or provider_status is null or provider_status = 'won'),
  check (event_type <> 'CLOSED_LOST' or provider_status is null or provider_status = 'lost'),
  check (event_type <> 'CLOSED_ABANDONED' or provider_status is null or provider_status = 'abandoned')
);

create unique index patrimonial_performance_source_ref
  on public.patrimonial_performance_events(source,source_ref)
  where source_ref is not null;
create index patrimonial_performance_assignment_time
  on public.patrimonial_performance_events(assignment_id,occurred_at,id);
create index patrimonial_performance_operator_time
  on public.patrimonial_performance_events(operator_id,occurred_at,id);
create index patrimonial_performance_intent_type_time
  on public.patrimonial_performance_events(intent_id,event_type,occurred_at,id);
create index patrimonial_performance_remote_opportunity
  on public.patrimonial_performance_events(remote_opportunity_id,occurred_at)
  where remote_opportunity_id is not null;

create function public.patrimonial_performance_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare a public.patrimonial_assignments; i public.patrimonial_intents;
begin
  select * into a from public.patrimonial_assignments where id=new.assignment_id;
  if not found or a.intent_id<>new.intent_id or a.operator_id<>new.operator_id then
    raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
  end if;
  if new.occurred_at<a.assigned_at or (a.released_at is not null and new.occurred_at>a.released_at)
    or new.occurred_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
  end if;
  select * into i from public.patrimonial_intents where id=new.intent_id and kind='OPPORTUNITY';
  if not found then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
  if new.remote_opportunity_id is not null
    and new.remote_opportunity_id is distinct from i.remote_opportunity_id
    and new.remote_opportunity_id is distinct from i.record#>>'{remote,id}' then
    raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
  end if;
  if new.remote_contact_id is not null and new.remote_contact_id is distinct from i.remote_contact_id then
    raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
  end if;
  return new;
end $$;

create function public.patrimonial_performance_immutable() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
end $$;

create trigger patrimonial_performance_guard
  before insert on public.patrimonial_performance_events
  for each row execute function public.patrimonial_performance_guard();
create trigger patrimonial_performance_immutable
  before update or delete on public.patrimonial_performance_events
  for each row execute function public.patrimonial_performance_immutable();

create function public.patrimonial_performance_resolve(p_remote_opportunity_id text,p_occurred_at timestamptz) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare i public.patrimonial_intents; a public.patrimonial_assignments; n integer;
begin
  if p_remote_opportunity_id is null or length(p_remote_opportunity_id) not between 1 and 160 or p_occurred_at is null then
    raise exception using errcode='22023',message='PATRIMONIAL_INVALID_INPUT';
  end if;
  select count(*) into n from public.patrimonial_intents
    where kind='OPPORTUNITY' and (remote_opportunity_id=p_remote_opportunity_id or record#>>'{remote,id}'=p_remote_opportunity_id);
  if n=0 then return 'null'::jsonb; end if;
  if n<>1 then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
  select * into strict i from public.patrimonial_intents
    where kind='OPPORTUNITY' and (remote_opportunity_id=p_remote_opportunity_id or record#>>'{remote,id}'=p_remote_opportunity_id);
  select count(*) into n from public.patrimonial_assignments
    where intent_id=i.id and assigned_at<=p_occurred_at and (released_at is null or p_occurred_at<=released_at);
  if n=0 then return 'null'::jsonb; end if;
  if n<>1 then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
  select * into strict a from public.patrimonial_assignments
    where intent_id=i.id and assigned_at<=p_occurred_at and (released_at is null or p_occurred_at<=released_at);
  return jsonb_build_object(
    'intentId',i.id,'assignmentId',a.id,'operatorId',a.operator_id,
    'qualitySnapshotId',a.quality_snapshot_id,'experimentId',a.experiment_id,
    'funnel',i.funnel,'remoteContactId',i.remote_contact_id,'remoteOpportunityId',p_remote_opportunity_id
  );
end $$;

create function public.patrimonial_record_performance_event(p_event jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare existing public.patrimonial_performance_events; inserted public.patrimonial_performance_events;
begin
  if jsonb_typeof(p_event)<>'object'
    or exists(select 1 from jsonb_object_keys(p_event) k where k not in (
      'eventKey','payloadHash','intentId','assignmentId','operatorId','eventType','occurredAt','source','sourceRef',
      'providerEventType','remoteOpportunityId','remoteContactId','remoteAppointmentId','pipelineStageFrom','pipelineStageTo',
      'providerStatus','appointmentStatus','channel','recordedByType','recordedByRef','schemaVersion'
    ))
    or p_event->>'eventKey' is null or p_event->>'payloadHash' is null or p_event->>'intentId' is null
    or p_event->>'assignmentId' is null or p_event->>'operatorId' is null or p_event->>'eventType' is null
    or p_event->>'occurredAt' is null or p_event->>'source' is null or p_event->>'recordedByType' is null
    or coalesce((p_event->>'schemaVersion')::integer,0)<>1 then
    raise exception using errcode='22023',message='PATRIMONIAL_INVALID_INPUT';
  end if;

  select * into existing from public.patrimonial_performance_events where event_key=p_event->>'eventKey';
  if found then
    if existing.payload_hash<>p_event->>'payloadHash' then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
    return public.patrimonial_assignment_camel(to_jsonb(existing));
  end if;

  if nullif(p_event->>'sourceRef','') is not null then
    select * into existing from public.patrimonial_performance_events
      where source=p_event->>'source' and source_ref=p_event->>'sourceRef';
    if found then
      if existing.payload_hash<>p_event->>'payloadHash' then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
      return public.patrimonial_assignment_camel(to_jsonb(existing));
    end if;
  end if;

  insert into public.patrimonial_performance_events(
    event_key,payload_hash,intent_id,assignment_id,operator_id,event_type,occurred_at,source,source_ref,provider_event_type,
    remote_opportunity_id,remote_contact_id,remote_appointment_id,pipeline_stage_from,pipeline_stage_to,provider_status,
    appointment_status,channel,recorded_by_type,recorded_by_ref,schema_version
  ) values (
    p_event->>'eventKey',p_event->>'payloadHash',(p_event->>'intentId')::uuid,(p_event->>'assignmentId')::uuid,(p_event->>'operatorId')::uuid,
    p_event->>'eventType',(p_event->>'occurredAt')::timestamptz,p_event->>'source',nullif(p_event->>'sourceRef',''),nullif(p_event->>'providerEventType',''),
    nullif(p_event->>'remoteOpportunityId',''),nullif(p_event->>'remoteContactId',''),nullif(p_event->>'remoteAppointmentId',''),
    nullif(p_event->>'pipelineStageFrom',''),nullif(p_event->>'pipelineStageTo',''),nullif(p_event->>'providerStatus',''),
    nullif(p_event->>'appointmentStatus',''),nullif(p_event->>'channel',''),p_event->>'recordedByType',nullif(p_event->>'recordedByRef',''),1
  ) returning * into inserted;
  return public.patrimonial_assignment_camel(to_jsonb(inserted));
end $$;

create view public.patrimonial_assignment_performance_v1
with (security_invoker=true) as
with aggregate as (
  select
    a.id as assignment_id,a.intent_id,a.operator_id,a.pool_id,a.experiment_id,a.assignment_method,
    a.quality_snapshot_id,a.assigned_at,a.released_at,a.release_reason,
    i.funnel,s.source,s.medium,s.campaign,s.profile,
    min(e.occurred_at) filter (where e.event_type='OWNERSHIP_TAKEN') as ownership_taken_at,
    min(e.occurred_at) filter (where e.event_type='CONTACT_ATTEMPTED') as first_contact_attempt_at,
    min(e.occurred_at) filter (where e.event_type='CONTACT_ESTABLISHED') as first_contact_established_at,
    min(e.occurred_at) filter (where e.event_type='APPOINTMENT_BOOKED') as first_appointment_booked_at,
    min(e.occurred_at) filter (where e.event_type='APPOINTMENT_ATTENDED') as first_appointment_attended_at,
    min(e.occurred_at) filter (where e.event_type='APPOINTMENT_NO_SHOW') as first_no_show_at,
    min(e.occurred_at) filter (where e.event_type='FOLLOW_UP_STARTED') as first_follow_up_at,
    min(e.occurred_at) filter (where e.event_type='STAGE_CHANGED') as first_stage_change_at,
    min(e.occurred_at) filter (where e.event_type='CLOSED_WON') as closed_won_at,
    min(e.occurred_at) filter (where e.event_type='CLOSED_LOST') as closed_lost_at,
    min(e.occurred_at) filter (where e.event_type='CLOSED_ABANDONED') as closed_abandoned_at,
    count(e.id) filter (where e.event_type='CONTACT_ATTEMPTED')::integer as contact_attempt_count,
    count(e.id) filter (where e.event_type='CONTACT_ESTABLISHED')::integer as contact_established_count,
    count(e.id) filter (where e.event_type='APPOINTMENT_BOOKED')::integer as appointment_booked_count,
    count(e.id) filter (where e.event_type='APPOINTMENT_ATTENDED')::integer as appointment_attended_count,
    count(e.id) filter (where e.event_type='APPOINTMENT_NO_SHOW')::integer as appointment_no_show_count,
    count(e.id) filter (where e.event_type='FOLLOW_UP_STARTED')::integer as follow_up_count,
    count(e.id) filter (where e.event_type='STAGE_CHANGED')::integer as stage_change_count
  from public.patrimonial_assignments a
  join public.patrimonial_intents i on i.id=a.intent_id
  left join public.patrimonial_lead_snapshots s on s.id=a.quality_snapshot_id
  left join public.patrimonial_performance_events e on e.assignment_id=a.id
  group by a.id,a.intent_id,a.operator_id,a.pool_id,a.experiment_id,a.assignment_method,a.quality_snapshot_id,
    a.assigned_at,a.released_at,a.release_reason,i.funnel,s.source,s.medium,s.campaign,s.profile
)
select aggregate.*,
  case when ownership_taken_at is null then null else extract(epoch from (ownership_taken_at-assigned_at))/60 end as minutes_to_ownership,
  case when first_contact_attempt_at is null then null else extract(epoch from (first_contact_attempt_at-assigned_at))/60 end as minutes_to_first_contact_attempt,
  case when first_contact_established_at is null then null else extract(epoch from (first_contact_established_at-assigned_at))/60 end as minutes_to_contact_established,
  case when first_appointment_booked_at is null then null else extract(epoch from (first_appointment_booked_at-assigned_at))/60 end as minutes_to_first_booking,
  case when first_appointment_attended_at is null then null else extract(epoch from (first_appointment_attended_at-assigned_at))/60 end as minutes_to_first_show
from aggregate;

create function public.patrimonial_performance_capabilities() returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare t oid:=to_regclass('public.patrimonial_performance_events'); v oid:=to_regclass('public.patrimonial_assignment_performance_v1'); ok boolean;
begin
  select t is not null and v is not null
    and exists(select 1 from pg_class where oid=t and relkind='r' and relrowsecurity and relforcerowsecurity)
    and to_regprocedure('public.patrimonial_record_performance_event(jsonb)') is not null
    and to_regprocedure('public.patrimonial_performance_resolve(text,timestamp with time zone)') is not null
    and to_regprocedure('public.patrimonial_performance_guard()') is not null
    and to_regprocedure('public.patrimonial_performance_immutable()') is not null
    and has_table_privilege('service_role',t,'SELECT,INSERT')
    and not has_table_privilege('anon',t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    and not has_table_privilege('authenticated',t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    and has_function_privilege('service_role','public.patrimonial_record_performance_event(jsonb)','EXECUTE')
    and has_function_privilege('service_role','public.patrimonial_performance_resolve(text,timestamp with time zone)','EXECUTE')
    and not has_function_privilege('anon','public.patrimonial_record_performance_event(jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','public.patrimonial_record_performance_event(jsonb)','EXECUTE')
  into ok;
  return jsonb_build_object('contract','patrimonial-performance-capabilities-v1','performanceTracking',case when coalesce(ok,false) then 'p3-v1' end);
end $$;

alter table public.patrimonial_performance_events enable row level security;
alter table public.patrimonial_performance_events force row level security;

revoke all on table public.patrimonial_performance_events from public,anon,authenticated;
grant select,insert on table public.patrimonial_performance_events to service_role;
revoke all on table public.patrimonial_assignment_performance_v1 from public,anon,authenticated;
grant select on table public.patrimonial_assignment_performance_v1 to service_role;

revoke all on function public.patrimonial_performance_guard() from public,anon,authenticated;
revoke all on function public.patrimonial_performance_immutable() from public,anon,authenticated;
revoke all on function public.patrimonial_performance_resolve(text,timestamptz) from public,anon,authenticated;
revoke all on function public.patrimonial_record_performance_event(jsonb) from public,anon,authenticated;
revoke all on function public.patrimonial_performance_capabilities() from public,anon,authenticated;
grant execute on function public.patrimonial_performance_guard() to service_role;
grant execute on function public.patrimonial_performance_immutable() to service_role;
grant execute on function public.patrimonial_performance_resolve(text,timestamptz) to service_role;
grant execute on function public.patrimonial_record_performance_event(jsonb) to service_role;
grant execute on function public.patrimonial_performance_capabilities() to service_role;

commit;
