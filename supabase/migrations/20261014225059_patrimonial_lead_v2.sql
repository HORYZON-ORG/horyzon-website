-- FASE 2B.2B-4A: LOCAL ONLY. Do not apply without a separate authorization.
-- Dedicated public-schema tables, as in Annunci; no reuse of product/session data.
-- All RPCs are SECURITY INVOKER. Only the server service_role has privileges.
begin;

create table public.patrimonial_intents (
  id uuid primary key,
  kind text not null check (kind in ('PROVISIONAL','OPPORTUNITY')),
  funnel text not null check (funnel in ('architect-path','patrimonial-event','patrimonial-consultation')),
  provisional_key text unique,
  group_key text unique,
  business_key text,
  location_ref text,
  remote_contact_id text,
  remote_opportunity_id text,
  scope_key text,
  cycle integer not null default 1 check (cycle > 0),
  status text not null,
  stage text,
  revision integer not null default 0 check (revision >= 0),
  next_step text,
  next_step_at timestamptz,
  owner_ref text,
  close_reason text,
  closed_at timestamptz,
  record jsonb not null check (jsonb_typeof(record) = 'object' and record->>'id' = id::text),
  sync_state text not null default 'SYNC_PENDING' check (sync_state in ('SYNC_PENDING','SYNCING','SYNCED','MANUAL_REVIEW','RECONCILE_REQUIRED')),
  sync_token uuid,
  sync_lease_version integer not null default 0,
  sync_lease_expires_at timestamptz,
  sync_write_started boolean not null default false,
  sync_reconcile_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  review_after timestamptz, -- Policy/period not approved: no default or purge.
  check (kind <> 'PROVISIONAL' or (provisional_key is not null and group_key is null)),
  check (kind <> 'OPPORTUNITY' or (
    group_key is not null and business_key is not null and location_ref is not null and remote_contact_id is not null and scope_key is not null
    and record->>'groupKey' = group_key and record->>'businessKey' = business_key
    and (record->>'revision')::integer = revision and record->>'status' = status and record->>'stage' = stage
    and next_step is not null
    and status in ('OPEN','WON','LOST','ABANDONED') and stage is not null
    and next_step in ('ASSIGN','INVITE_PRESENTATION','BOOK_PRESENTATION','QUALIFY','BOOK_INTERVIEW','RECORD_OUTCOME','AGREE_PATH_START','CONFIRM_EDITION','RECORD_ATTENDANCE','FOLLOW_UP','BOOK_CONSULTATION','REVIEW','NONE')
    and ((funnel = 'architect-path' and stage in ('A01','A02','A03','A04','A05','A06','A07','A08','A09','A10'))
      or (funnel = 'patrimonial-event' and stage in ('E01','E02','E03','E04','E05'))
      or (funnel = 'patrimonial-consultation' and stage in ('C01','C02','C03','C04','C05')))
    and ((status = 'OPEN' and next_step is not null and next_step <> 'NONE' and next_step_at is not null)
      or (status <> 'OPEN' and next_step = 'NONE' and next_step_at is null))
    and (case when stage = 'A09' then status = 'WON'
      when stage = 'A10' then status in ('LOST','ABANDONED')
      when stage in ('E05','C05') then status <> 'OPEN' else status = 'OPEN' end)
  ))
);
create unique index patrimonial_architect_open on public.patrimonial_intents(location_ref, remote_contact_id, scope_key)
  where kind = 'OPPORTUNITY' and funnel = 'architect-path' and status = 'OPEN';
-- One relationship row across cycles: explicit reopen reuses its native ID.
create unique index patrimonial_event_relationship on public.patrimonial_intents(location_ref, remote_contact_id)
  where kind = 'OPPORTUNITY' and funnel = 'patrimonial-event';
create unique index patrimonial_consultation_open on public.patrimonial_intents(location_ref, remote_contact_id, scope_key)
  where kind = 'OPPORTUNITY' and funnel = 'patrimonial-consultation' and status = 'OPEN';
create unique index patrimonial_business_cycle on public.patrimonial_intents(business_key, cycle) where kind = 'OPPORTUNITY';
create index patrimonial_intents_review on public.patrimonial_intents(review_after) where review_after is not null;

create table public.patrimonial_requests (
  request_id uuid primary key,
  contract_version text not null check (contract_version = 'patrimonial-lead-v2'),
  mode text not null check (mode in ('architect-path','patrimonial-event')),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  source_path text not null,
  received_at timestamptz not null,
  status text not null,
  contact_ref text,
  intent_id uuid references public.patrimonial_intents(id),
  receipt_status text not null check (receipt_status = 'received'),
  crm_status text not null,
  -- Validated request snapshot contains PII ONCE: needed by the deferred contact/
  -- note worker and canonical replay. No credentials, raw HTTP body or log copy.
  record jsonb not null check (jsonb_typeof(record) = 'object' and record->>'id' = request_id::text
    and record->>'payloadHash' = payload_hash and record->>'contractVersion' = contract_version),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_review_at timestamptz -- No automatic deletion or legal duration.
);
create index patrimonial_requests_intent on public.patrimonial_requests(intent_id);
create index patrimonial_requests_retention on public.patrimonial_requests(expires_at);

create table public.patrimonial_consent_evidence (
  id uuid primary key default gen_random_uuid(),
  evidence_key text not null unique, -- Existing contract uses request:purpose keys.
  request_id uuid not null references public.patrimonial_requests(request_id),
  intent_id uuid references public.patrimonial_intents(id),
  purpose text not null check (purpose in ('requested-contact','marketing')),
  channel text,
  choice boolean not null,
  state text not null check (state in ('RECORDED_TRUE','RECORDED_FALSE')),
  policy_version text not null,
  source_path text not null,
  received_at timestamptz not null,
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  created_at timestamptz not null default now(),
  unique (request_id, purpose)
);

create table public.patrimonial_event_editions (
  id uuid primary key default gen_random_uuid(),
  edition_key text not null unique, -- Domain key, not a remote appointment ID.
  event_slug text not null,
  title_snapshot text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null,
  status text not null check (status in ('DRAFT','ACTIVE','CANCELLED','COMPLETED')),
  capacity integer check (capacity is null or capacity >= 0),
  access_mode text, -- Null means unresolved; this table alone grants no access.
  revision integer not null check (revision >= 0),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.patrimonial_participations (
  id uuid primary key,
  intent_id uuid not null references public.patrimonial_intents(id),
  location_ref text not null,
  contact_ref text not null,
  event_slug text not null,
  edition_id uuid references public.patrimonial_event_editions(id),
  registration_status text not null check (registration_status in ('REQUESTED','PENDING_EDITION','PENDING_CONFIRMATION','CONFIRMED','CANCELLED','DECLINED')),
  attendance text not null check (attendance in ('UNKNOWN','ATTENDED','NO_SHOW','CANCELLED','NOT_APPLICABLE')),
  revision integer not null check (revision >= 0),
  requested_at timestamptz not null,
  confirmed_at timestamptz,
  attendance_recorded_at timestamptz,
  source_request_id uuid not null references public.patrimonial_requests(request_id),
  record jsonb not null check (jsonb_typeof(record) = 'object' and record->>'id' = id::text
    and (record->>'revision')::integer = revision and record->>'relationId' = intent_id::text),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration_status not in ('PENDING_CONFIRMATION','CONFIRMED') or edition_id is not null),
  check (registration_status <> 'PENDING_EDITION' or edition_id is null),
  check (attendance not in ('ATTENDED','NO_SHOW') or (registration_status = 'CONFIRMED' and edition_id is not null))
);
create unique index patrimonial_participation_edition on public.patrimonial_participations(location_ref, contact_ref, edition_id) where edition_id is not null;
create unique index patrimonial_participation_generic on public.patrimonial_participations(location_ref, contact_ref, event_slug)
  where edition_id is null and registration_status = 'PENDING_EDITION';
create index patrimonial_participations_intent on public.patrimonial_participations(intent_id);
create index patrimonial_participations_source on public.patrimonial_participations(source_request_id);

create table public.patrimonial_outbox_operations (
  id uuid primary key,
  operation_key text not null unique,
  intent_id uuid not null references public.patrimonial_intents(id),
  request_id uuid references public.patrimonial_requests(request_id),
  effect_type text not null check (effect_type in ('SYNC_REQUEST','RESOLVE_CONTACT','UPSERT_CONTACT','ADD_TAGS','ADD_NOTE')),
  effect_version text not null,
  identity_lock_key text not null,
  depends_on uuid references public.patrimonial_outbox_operations(id),
  status text not null check (status in ('RECEIVED','IDENTITY_REVIEW','SYNC_PENDING','SYNCING','RETRY_SCHEDULED','RECONCILE_REQUIRED','SYNCED','MANUAL_REVIEW','REJECTED')),
  attempt_count integer not null check (attempt_count >= 0),
  next_attempt_at timestamptz not null,
  lease_token uuid,
  lease_version integer not null check (lease_version >= 0),
  lease_expires_at timestamptz,
  reconcile_required boolean not null default false,
  remote_id text,
  last_error_class text,
  last_error_code text,
  last_error_at timestamptz,
  record jsonb not null check (jsonb_typeof(record) = 'object' and record->>'id' = id::text
    and record->>'technicalState' = status and (record->>'leaseVersion')::integer = lease_version),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Request identity is part of effect_version: fresh requests can add fresh notes.
  unique (intent_id, effect_type, effect_version),
  check ((status = 'SYNCING' and lease_token is not null and lease_expires_at is not null)
    or (status <> 'SYNCING' and lease_token is null and lease_expires_at is null))
);
create index patrimonial_outbox_due on public.patrimonial_outbox_operations(next_attempt_at, id)
  where status in ('SYNC_PENDING','RETRY_SCHEDULED','SYNCING','RECONCILE_REQUIRED');
create index patrimonial_outbox_identity on public.patrimonial_outbox_operations(identity_lock_key, status);
create index patrimonial_outbox_request on public.patrimonial_outbox_operations(request_id);
create index patrimonial_outbox_dependency on public.patrimonial_outbox_operations(depends_on) where depends_on is not null;

create table public.patrimonial_domain_events (
  event_id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_name text not null,
  intent_id uuid not null references public.patrimonial_intents(id),
  request_id uuid references public.patrimonial_requests(request_id),
  participation_id uuid references public.patrimonial_participations(id) deferrable initially deferred,
  revision integer not null check (revision >= 0),
  occurred_at timestamptz not null,
  actor_type text not null,
  actor_ref text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  supersedes_event_id uuid references public.patrimonial_domain_events(event_id),
  created_at timestamptz not null default now()
);
create index patrimonial_events_intent on public.patrimonial_domain_events(intent_id, revision);
create index patrimonial_events_request on public.patrimonial_domain_events(request_id);
create index patrimonial_events_participation on public.patrimonial_domain_events(participation_id) where participation_id is not null;
create index patrimonial_events_supersedes on public.patrimonial_domain_events(supersedes_event_id) where supersedes_event_id is not null;

-- JSON snapshots preserve existing TS contracts. Indexed columns are written in
-- the same statement; no independent REST patch is used by the adapter.
create function public.patrimonial_put_operation(p_record jsonb) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  perform pg_advisory_xact_lock(741920, 2);
  insert into public.patrimonial_outbox_operations (
    id, operation_key, intent_id, request_id, effect_type, effect_version, identity_lock_key, depends_on,
    status, attempt_count, next_attempt_at, lease_token, lease_version, lease_expires_at, reconcile_required,
    remote_id, last_error_class, last_error_code, last_error_at, record, created_at, completed_at
  ) values (
    (p_record->>'id')::uuid, p_record->>'operationKey', (p_record->>'intentId')::uuid, (p_record->>'requestId')::uuid,
    p_record->>'kind', p_record->>'operationKey', coalesce(p_record->>'identityLockKey', p_record->>'intentId'), (p_record->>'dependsOn')::uuid,
    p_record->>'technicalState', (p_record->>'attemptCount')::integer, (p_record->>'nextAttemptAt')::timestamptz,
    (p_record->>'leaseToken')::uuid, (p_record->>'leaseVersion')::integer, (p_record->>'leaseExpiresAt')::timestamptz,
    (p_record->>'reconcileRequired')::boolean, p_record->>'remoteId',
    case when p_record->>'lastErrorCode' is not null then 'SANITIZED' end, p_record->>'lastErrorCode',
    case when p_record->>'lastErrorCode' is not null then now() end, p_record, (p_record->>'createdAt')::timestamptz,
    case when p_record->>'technicalState' = 'SYNCED' then now() end
  ) on conflict (id) do update set
    status = excluded.status, attempt_count = excluded.attempt_count, next_attempt_at = excluded.next_attempt_at,
    lease_token = excluded.lease_token, lease_version = excluded.lease_version, lease_expires_at = excluded.lease_expires_at,
    reconcile_required = excluded.reconcile_required, remote_id = excluded.remote_id,
    last_error_class = excluded.last_error_class, last_error_code = excluded.last_error_code, last_error_at = excluded.last_error_at,
    record = excluded.record, updated_at = now(), completed_at = excluded.completed_at;
end;
$$;

create function public.patrimonial_execute_command(p_command jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_method text := p_command->>'method'; v_args jsonb := p_command->'args';
  v_input jsonb := v_args->0; v_record jsonb; v_old jsonb; v_result jsonb; v_item jsonb; v_event jsonb;
  v_parent public.patrimonial_intents%rowtype; v_edition_id uuid;
  v_now timestamptz; v_expires timestamptz; v_actual jsonb;
begin
  perform pg_advisory_xact_lock(741920, 2);
  v_now := clock_timestamp();
  case v_method
  when 'getRequest' then
    select record into v_result from public.patrimonial_requests where request_id = (v_args->>0)::uuid;
  when 'getOperation' then
    select record into v_result from public.patrimonial_outbox_operations where id = (v_args->>0)::uuid;
  when 'getConsentEvidence' then
    select coalesce(jsonb_agg(record order by purpose),'[]'::jsonb) into v_result from public.patrimonial_consent_evidence where request_id = (v_args->>0)::uuid;
  when 'createOrReplayRequest' then
    select record into v_old from public.patrimonial_requests where request_id = (v_input->>'id')::uuid for update;
    if found then
      if v_old->>'payloadHash' <> v_input->>'payloadHash' then
        raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
      end if;
      if (v_old->>'replayExpiresAt')::timestamptz <= v_now then
        raise exception using errcode = 'PT410', message = 'PATRIMONIAL_REPLAY_EXPIRED';
      end if;
      v_result := jsonb_build_object('request',v_old,'replay',true);
    else
      insert into public.patrimonial_requests(request_id,contract_version,mode,payload_hash,source_path,received_at,status,receipt_status,crm_status,expires_at,record)
      values ((v_input->>'id')::uuid,v_input->>'contractVersion',v_input#>>'{payload,mode}',v_input->>'payloadHash',v_input#>>'{payload,sourcePath}',
        (v_input->>'receivedAt')::timestamptz,v_input->>'technicalState',v_input#>>'{receipt,receiptStatus}',v_input#>>'{receipt,crmStatus}',(v_input->>'replayExpiresAt')::timestamptz,v_input);
      v_result := jsonb_build_object('request',v_input,'replay',false);
    end if;
  when 'createOrReuseIntent' then
    select record into v_result from public.patrimonial_intents where provisional_key = v_input->>'provisionalKey' and kind = 'PROVISIONAL' for update;
    if not found then
      insert into public.patrimonial_intents(id,kind,funnel,provisional_key,status,record,created_at)
      values ((v_input->>'id')::uuid,'PROVISIONAL',v_input->>'mode',v_input->>'provisionalKey',v_input->>'technicalState',v_input,(v_input->>'createdAt')::timestamptz);
      v_result := v_input;
    end if;
  when 'attachIntent' then
    select * into strict v_parent from public.patrimonial_intents where id = (v_args->>1)::uuid and kind = 'PROVISIONAL' for update;
    select record into strict v_old from public.patrimonial_requests where request_id = (v_args->>0)::uuid for update;
    if v_old->>'intentId' is not null and v_old->>'intentId' <> v_args->>1 then
      raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
    end if;
    update public.patrimonial_requests set intent_id = v_parent.id, status = 'SYNC_PENDING',
      record = v_old || jsonb_build_object('intentId',v_parent.id::text,'technicalState','SYNC_PENDING'), updated_at = now() where request_id = (v_args->>0)::uuid;
    update public.patrimonial_intents set status = 'SYNC_PENDING', record = record || jsonb_build_object('technicalState','SYNC_PENDING'), updated_at = now() where id = v_parent.id;
    update public.patrimonial_consent_evidence set intent_id = v_parent.id where request_id = (v_args->>0)::uuid;
  when 'appendConsentEvidence' then
    if exists(select 1 from public.patrimonial_consent_evidence where request_id = (v_input->>'requestId')::uuid and purpose = v_input->>'purpose' and record <> v_input) then
      raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
    end if;
    insert into public.patrimonial_consent_evidence(evidence_key,request_id,intent_id,purpose,channel,choice,state,policy_version,source_path,received_at,record)
    select v_input->>'id',r.request_id,r.intent_id,v_input->>'purpose',v_input->>'channel',(v_input->>'choice')::boolean,
      case when (v_input->>'choice')::boolean then 'RECORDED_TRUE' else 'RECORDED_FALSE' end,
      v_input->>'version',v_input->>'sourcePath',(v_input->>'receivedAt')::timestamptz,v_input
    from public.patrimonial_requests r where r.request_id = (v_input->>'requestId')::uuid on conflict (request_id,purpose) do nothing;
    if not exists(select 1 from public.patrimonial_requests where request_id = (v_input->>'requestId')::uuid) then
      raise exception using errcode = '22023', message = 'PATRIMONIAL_INVALID_INPUT';
    end if;
  when 'enqueueOperation' then
    if not exists(select 1 from public.patrimonial_outbox_operations where operation_key = v_input->>'operationKey') then
      perform public.patrimonial_put_operation(v_input);
    end if;
  when 'appendEvent' then
    insert into public.patrimonial_domain_events(event_key,event_name,intent_id,request_id,revision,occurred_at,actor_type,metadata)
    values (v_input->>'id',v_input->>'name',(v_input->>'intentId')::uuid,(v_input->>'requestId')::uuid,0,(v_input->>'occurredAt')::timestamptz,'SYSTEM',jsonb_build_object('contractVersion',v_input->>'contractVersion'))
    on conflict (event_key) do nothing;
  when 'claimOperations' then v_result := public.claim_patrimonial_operations(v_input,p_command->'tokens');
  when 'renewLease' then perform public.renew_patrimonial_operation_lease(v_input);
  when 'completeOperation', 'completeCrmOperation' then perform public.complete_patrimonial_operation(v_input);
  when 'failOperation' then perform public.fail_patrimonial_operation(v_input);
  when 'markManualReview' then perform public.fail_patrimonial_operation(v_input || jsonb_build_object('state','MANUAL_REVIEW'));
  when 'holdOperation', 'scheduleRetry' then
    v_record := public.patrimonial_owned_operation(v_input);
    if v_method = 'scheduleRetry' then
      if (v_record->>'reconcileRequired')::boolean or (v_input->>'nextAttemptAt')::timestamptz <= v_now
        or v_input->>'errorCode' not in ('NETWORK','RATE_LIMIT','PROVIDER','SCHEMA','AUTH','CONFIG','IDENTITY','UNKNOWN') then
        raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
      end if;
      v_record := v_record || jsonb_build_object('technicalState',case when (v_record->>'attemptCount')::integer >= 5 then 'MANUAL_REVIEW' else 'RETRY_SCHEDULED' end,
        'nextAttemptAt',v_input->>'nextAttemptAt','lastErrorCode',v_input->>'errorCode');
    else
      v_record := v_record || jsonb_build_object('technicalState',case when (v_record->>'reconcileRequired')::boolean then 'RECONCILE_REQUIRED' else 'SYNC_PENDING' end);
    end if;
    perform public.patrimonial_put_operation(v_record || jsonb_build_object('leaseToken',null,'leaseExpiresAt',null));
  when 'findOpportunityIntent' then
    select record into v_result from public.patrimonial_intents where group_key = v_args->>0 and kind = 'OPPORTUNITY';
  when 'getOpportunityIntent' then
    select record into v_result from public.patrimonial_intents where id = (v_args->>0)::uuid and kind = 'OPPORTUNITY';
  when 'saveOpportunityIntent' then
    select * into v_parent from public.patrimonial_intents where id = (v_input->>'id')::uuid for update;
    if (v_args->>1 is null and found) or (v_args->>1 is not null and (not found or v_parent.revision <> (v_args->>1)::integer)) then
      raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
    end if;
    if (v_args->>1 is null and (v_input->>'revision')::integer <> 1)
      or (v_args->>1 is not null and ((v_input->>'revision')::integer <> v_parent.revision + 1 or v_parent.kind <> 'OPPORTUNITY'
        or v_input->>'groupKey' <> v_parent.group_key or v_input->>'contactId' <> v_parent.remote_contact_id
        or v_input->>'locationId' <> v_parent.location_ref or v_input->>'scopeKey' <> v_parent.scope_key
        or v_input->'firstRequest' <> v_parent.record->'firstRequest' or v_input->'remote' is distinct from v_parent.record->'remote'
        or not (v_input->'requestIds' @> v_parent.record->'requestIds') or not (v_input->'events' @> v_parent.record->'events'))) then
      raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
    end if;
    if exists(select 1 from jsonb_array_elements_text(v_input->'requestIds') x where not exists(select 1 from public.patrimonial_requests r where r.request_id = x.value::uuid)) then
      raise exception using errcode = '22023', message = 'PATRIMONIAL_INVALID_INPUT';
    end if;
    insert into public.patrimonial_intents(id,kind,funnel,group_key,business_key,location_ref,remote_contact_id,remote_opportunity_id,scope_key,cycle,status,stage,revision,next_step,next_step_at,owner_ref,close_reason,closed_at,record)
    values ((v_input->>'id')::uuid,'OPPORTUNITY',case v_input->>'pipeline' when 'ARCHITECT_PATH' then 'architect-path' when 'PATRIMONIAL_EVENT' then 'patrimonial-event' when 'PATRIMONIAL_CONSULTATION' then 'patrimonial-consultation' end,
      v_input->>'groupKey',v_input->>'businessKey',v_input->>'locationId',v_input->>'contactId',v_input#>>'{remote,id}',v_input->>'scopeKey',
      (v_input->>'cycle')::integer,v_input->>'status',v_input->>'stage',(v_input->>'revision')::integer,v_input->>'nextStep',(v_input->>'nextStepAt')::timestamptz,
      v_input->>'ownerId',v_input->>'closeReason',case when v_input->>'status' <> 'OPEN' then now() end,v_input)
    on conflict (id) do update set business_key = excluded.business_key, cycle = excluded.cycle, status = excluded.status, stage = excluded.stage,
      revision = excluded.revision, next_step = excluded.next_step, next_step_at = excluded.next_step_at, owner_ref = excluded.owner_ref,
      close_reason = excluded.close_reason, closed_at = excluded.closed_at, record = excluded.record, updated_at = now(),
      sync_state = case when public.patrimonial_intents.sync_reconcile_required or public.patrimonial_intents.sync_write_started then 'RECONCILE_REQUIRED' else 'SYNC_PENDING' end,
      sync_reconcile_required = public.patrimonial_intents.sync_reconcile_required or public.patrimonial_intents.sync_write_started, sync_token = null, sync_lease_expires_at = null;
    for v_event in select value from jsonb_array_elements(v_input->'events') loop
      select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_actual from jsonb_each(coalesce(v_event->'facts','{}'::jsonb))
      where key in ('bookingId','startsAt','eligibility','criteriaVersion','agreementEvidence','startedAt','participationId','editionId','attendance','reason','requestId','originEditionId');
      insert into public.patrimonial_domain_events(event_key,event_name,intent_id,request_id,participation_id,revision,occurred_at,actor_type,actor_ref,metadata)
      values ((v_input->>'id') || ':' || (v_event->>'revision'),v_event->>'command',(v_input->>'id')::uuid,(v_event#>>'{facts,requestId}')::uuid,
        (v_event#>>'{facts,participationId}')::uuid,(v_event->>'revision')::integer,(v_event->>'at')::timestamptz,v_event#>>'{actor,type}',v_event#>>'{actor,id}',
        jsonb_build_object('cycle',v_event->'cycle','evidenceId',v_event->'evidenceId','facts',v_actual)) on conflict (event_key) do nothing;
    end loop;
  when 'listParticipations' then
    select coalesce(jsonb_agg(record order by id),'[]'::jsonb) into v_result from public.patrimonial_participations where intent_id = (v_args->>0)::uuid;
  when 'saveParticipations' then
    select * into strict v_parent from public.patrimonial_intents where id = (v_args->>0)::uuid and kind = 'OPPORTUNITY' and funnel = 'patrimonial-event' for update;
    select coalesce(jsonb_agg(record order by id),'[]'::jsonb) into v_actual from public.patrimonial_participations where intent_id = v_parent.id;
    -- JSONB array order does not define a participation snapshot.
    if not (v_actual @> (v_args->2) and (v_args->2) @> v_actual and jsonb_array_length(v_actual) = jsonb_array_length(v_args->2)) then
      raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
    end if;
    if exists(select 1 from jsonb_array_elements(v_actual) o where not exists(select 1 from jsonb_array_elements(v_args->1) n where n.value->>'id' = o.value->>'id')) then
      raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
    end if;
    for v_item in select value from jsonb_array_elements(v_args->1) loop
      if v_item->>'relationId' <> v_parent.id::text or v_item->>'contactId' <> v_parent.remote_contact_id then
        raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
      end if;
      if not (v_parent.record->'requestIds' @> v_item->'requestIds') then
        raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
      end if;
      select record into v_old from public.patrimonial_participations where id = (v_item->>'id')::uuid for update;
      if (found and v_old <> v_item and (v_item->>'revision')::integer <> (v_old->>'revision')::integer + 1)
        or (not found and (v_item->>'revision')::integer <> 0) then
        raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
      end if;
      v_edition_id := null;
      if v_item->>'editionId' is not null then
        if v_item->>'editionId' is distinct from v_item#>>'{edition,id}' or v_item->>'eventSlug' is distinct from v_item#>>'{edition,eventSlug}' then
          raise exception using errcode = '22023', message = 'PATRIMONIAL_INVALID_INPUT';
        end if;
        if not exists(select 1 from pg_timezone_names where name = v_item#>>'{edition,timeZone}') then
          raise exception using errcode = '22023', message = 'PATRIMONIAL_INVALID_INPUT';
        end if;
        select record into v_record from public.patrimonial_event_editions where edition_key = v_item->>'editionId' for update;
        if found and v_record <> v_item->'edition' then
          -- Updating an existing edition is a separate future registry operation.
          raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
        end if;
        insert into public.patrimonial_event_editions(edition_key,event_slug,title_snapshot,starts_at,ends_at,timezone,status,revision,record)
        values (v_item->>'editionId',v_item#>>'{edition,eventSlug}',v_item#>>'{edition,title}',(v_item#>>'{edition,startsAt}')::timestamptz,
          (v_item#>>'{edition,endsAt}')::timestamptz,v_item#>>'{edition,timeZone}',v_item#>>'{edition,status}',(v_item#>>'{edition,revision}')::integer,v_item->'edition')
        on conflict (edition_key) do nothing;
        select id into strict v_edition_id from public.patrimonial_event_editions where edition_key = v_item->>'editionId';
      end if;
      insert into public.patrimonial_participations(id,intent_id,location_ref,contact_ref,event_slug,edition_id,registration_status,attendance,revision,requested_at,confirmed_at,attendance_recorded_at,source_request_id,record)
      select (v_item->>'id')::uuid,v_parent.id,v_parent.location_ref,md5(jsonb_build_array(v_parent.location_ref,v_parent.remote_contact_id)::text),v_item->>'eventSlug',v_edition_id,
        v_item->>'status',v_item->>'attendance',(v_item->>'revision')::integer,r.received_at,
        case when v_item->>'status' = 'CONFIRMED' then now() end,case when v_item->>'attendance' <> 'UNKNOWN' then now() end,r.request_id,v_item
      from public.patrimonial_requests r where r.request_id = (v_item#>>'{requestIds,0}')::uuid
      on conflict (id) do update set edition_id = excluded.edition_id, registration_status = excluded.registration_status, attendance = excluded.attendance,
        revision = excluded.revision, confirmed_at = coalesce(public.patrimonial_participations.confirmed_at,excluded.confirmed_at),
        attendance_recorded_at = case when public.patrimonial_participations.attendance <> excluded.attendance then excluded.attendance_recorded_at else public.patrimonial_participations.attendance_recorded_at end,
        record = excluded.record, updated_at = now();
      if not found then raise exception using errcode = '22023', message = 'PATRIMONIAL_INVALID_INPUT'; end if;
    end loop;
  when 'claimOpportunitySync', 'authorizeOpportunityWrite', 'finishOpportunitySync' then
    select * into v_parent from public.patrimonial_intents where id = (v_args->>0)::uuid and kind = 'OPPORTUNITY' for update;
    if not found or v_parent.revision <> (v_args->>1)::integer then raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT'; end if;
    if v_method = 'claimOpportunitySync' then
      if v_parent.sync_token is not null and v_parent.sync_lease_expires_at > v_now then return 'null'::jsonb; end if;
      v_expires := (v_args->>2)::timestamptz + interval '60 seconds';
      if v_expires <= v_now or v_expires > v_now + interval '600 seconds' then raise exception using errcode = 'PT409', message = 'PATRIMONIAL_STALE_LEASE'; end if;
      update public.patrimonial_intents set sync_token = (p_command#>>'{tokens,0}')::uuid, sync_lease_version = sync_lease_version + 1,
        sync_lease_expires_at = v_expires, sync_state = 'SYNCING', sync_reconcile_required = sync_reconcile_required or sync_write_started, sync_write_started = false, updated_at = now() where id = v_parent.id;
      v_result := jsonb_build_object('intent',v_parent.record,'token',p_command#>>'{tokens,0}','reconcileRequired',v_parent.sync_reconcile_required or v_parent.sync_write_started);
    else
      if v_parent.sync_token is distinct from (v_args->>2)::uuid or v_parent.sync_lease_expires_at <= v_now then
        raise exception using errcode = 'PT409', message = 'PATRIMONIAL_STALE_LEASE';
      end if;
      if v_method = 'authorizeOpportunityWrite' then
        update public.patrimonial_intents set sync_write_started = true, updated_at = now() where id = v_parent.id;
      else
        if v_args->>4 not in ('SYNC_PENDING','SYNCED','MANUAL_REVIEW','RECONCILE_REQUIRED') then raise exception using errcode = '22023', message = 'PATRIMONIAL_INVALID_INPUT'; end if;
        update public.patrimonial_intents set sync_state = v_args->>4, sync_token = null, sync_lease_expires_at = null, sync_write_started = false,
          sync_reconcile_required = (v_args->>4 = 'RECONCILE_REQUIRED') or (v_args->>4 = 'MANUAL_REVIEW' and sync_reconcile_required),
          remote_opportunity_id = coalesce(v_args#>>'{5,id}',remote_opportunity_id),
          record = case when v_args->5 is not null and v_args->5 <> 'null'::jsonb then record || jsonb_build_object('remote',v_args->5) else record end, updated_at = now() where id = v_parent.id;
      end if;
    end if;
  else raise exception using errcode = '22023', message = 'PATRIMONIAL_INVALID_COMMAND';
  end case;
  return coalesce(v_result,'null'::jsonb);
end;
$$;

-- All mutating entry points take the same short transaction advisory lock. This
-- also serializes identity locks across funnels. It is never held over HTTP.
create function public.claim_patrimonial_operations(p_input jsonb, p_tokens jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_row public.patrimonial_outbox_operations%rowtype;
  v_result jsonb := '[]'; v_record jsonb; v_count integer := 0;
  v_now timestamptz;
  v_seconds integer := coalesce((p_input->>'leaseSeconds')::integer, 60);
  v_limit integer := (p_input->>'limit')::integer;
  v_reconcile boolean := coalesce((p_input->>'reconciliationOnly')::boolean, false);
  v_expires timestamptz;
begin
  perform pg_advisory_xact_lock(741920, 2);
  v_now := clock_timestamp();
  if v_seconds not between 1 and 600 or v_limit not between 1 and 100 or jsonb_array_length(p_tokens) <> v_limit then
    raise exception using errcode = '22023', message = 'PATRIMONIAL_INVALID_INPUT';
  end if;
  v_expires := (p_input->>'now')::timestamptz + make_interval(secs => v_seconds);
  if v_expires <= v_now or v_expires > v_now + interval '600 seconds' then
    raise exception using errcode = 'PT409', message = 'PATRIMONIAL_STALE_LEASE';
  end if;
  for v_row in
    select * from public.patrimonial_outbox_operations o
    where o.next_attempt_at <= v_now
      and ((v_reconcile and o.status = 'RECONCILE_REQUIRED') or (not v_reconcile and
        (o.status in ('SYNC_PENDING','RETRY_SCHEDULED') or (o.status = 'SYNCING' and o.lease_expires_at <= v_now))))
      and (o.depends_on is null or exists (select 1 from public.patrimonial_outbox_operations d where d.id = o.depends_on and d.status = 'SYNCED'))
    order by case when o.status = 'SYNCING' then 0 else 1 end, o.next_attempt_at, o.id
    for update skip locked
  loop
    -- An unresolved expired/uncertain effect takes precedence over fresh work.
    if exists (select 1 from public.patrimonial_outbox_operations b where b.id <> v_row.id and b.identity_lock_key = v_row.identity_lock_key and (
      (b.status = 'SYNCING' and (b.lease_expires_at > v_now or v_row.status <> 'SYNCING'))
      or b.status in ('IDENTITY_REVIEW','MANUAL_REVIEW') or (b.status = 'RECONCILE_REQUIRED' and (not v_reconcile or v_row.status <> 'RECONCILE_REQUIRED'))
    )) then continue; end if;
    v_record := v_row.record;
    if v_row.attempt_count >= 5 then
      v_record := v_record || jsonb_build_object('technicalState','MANUAL_REVIEW','leaseToken',null,'leaseExpiresAt',null,
        'reconcileRequired',v_row.reconcile_required or v_row.status = 'SYNCING');
      perform public.patrimonial_put_operation(v_record);
      continue;
    end if;
    v_record := v_record || jsonb_build_object('technicalState','SYNCING','attemptCount',v_row.attempt_count + 1,
      'leaseToken',p_tokens->>v_count,'leaseVersion',v_row.lease_version + 1,
      'leaseExpiresAt',to_char(v_expires at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'reconcileRequired',v_row.reconcile_required or v_row.status = 'SYNCING');
    perform public.patrimonial_put_operation(v_record);
    v_result := v_result || jsonb_build_array(v_record); v_count := v_count + 1;
    exit when v_count >= v_limit;
  end loop;
  return v_result;
end;
$$;

create function public.patrimonial_owned_operation(p_input jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_row public.patrimonial_outbox_operations%rowtype;
begin
  perform pg_advisory_xact_lock(741920, 2);
  select * into v_row from public.patrimonial_outbox_operations where id = (p_input->>'operationId')::uuid for update;
  if not found or v_row.status <> 'SYNCING' or v_row.lease_token is distinct from (p_input->>'leaseToken')::uuid
    or v_row.lease_version is distinct from (p_input->>'leaseVersion')::integer or v_row.lease_expires_at <= clock_timestamp() then
    raise exception using errcode = 'PT409', message = 'PATRIMONIAL_STALE_LEASE';
  end if;
  return v_row.record;
end;
$$;

create function public.renew_patrimonial_operation_lease(p_input jsonb) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_record jsonb; v_seconds integer := coalesce((p_input->>'leaseSeconds')::integer,60); v_expires timestamptz;
begin
  v_record := public.patrimonial_owned_operation(p_input);
  v_expires := (p_input->>'now')::timestamptz + make_interval(secs => v_seconds);
  if v_seconds not between 1 and 600 or v_expires <= clock_timestamp() or v_expires > clock_timestamp() + interval '600 seconds'
    or v_expires < (v_record->>'leaseExpiresAt')::timestamptz then
    raise exception using errcode = 'PT409', message = 'PATRIMONIAL_STALE_LEASE';
  end if;
  perform public.patrimonial_put_operation(v_record || jsonb_build_object('leaseExpiresAt',to_char(v_expires at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
end;
$$;

create function public.fail_patrimonial_operation(p_input jsonb) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_record jsonb; v_state text := p_input->>'state'; v_error text := p_input->>'errorCode';
begin
  v_record := public.patrimonial_owned_operation(p_input);
  if v_state not in ('IDENTITY_REVIEW','RECONCILE_REQUIRED','MANUAL_REVIEW','REJECTED') or v_error not in ('NETWORK','RATE_LIMIT','PROVIDER','SCHEMA','AUTH','CONFIG','IDENTITY','UNKNOWN') then
    raise exception using errcode = '22023', message = 'PATRIMONIAL_INVALID_INPUT';
  end if;
  perform public.patrimonial_put_operation(v_record || jsonb_build_object('technicalState',v_state,'lastErrorCode',v_error,
    'reconcileRequired',(v_record->>'reconcileRequired')::boolean or v_state = 'RECONCILE_REQUIRED' or coalesce((p_input->>'reconcileRequired')::boolean,false),
    'leaseToken',null,'leaseExpiresAt',null));
end;
$$;

create function public.complete_patrimonial_operation(p_input jsonb) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_record jsonb; v_request jsonb; v_intent jsonb; v_checkpoint jsonb; v_op jsonb;
begin
  v_record := public.patrimonial_owned_operation(p_input);
  if (v_record->>'reconcileRequired')::boolean and not coalesce((p_input->>'reconciliationConfirmed')::boolean,false) then
    raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
  end if;
  v_checkpoint := p_input->'checkpoint';
  if v_checkpoint is not null and v_checkpoint <> 'null'::jsonb then
    select record into strict v_request from public.patrimonial_requests where request_id = (v_record->>'requestId')::uuid for update;
    select record into strict v_intent from public.patrimonial_intents where id = (v_record->>'intentId')::uuid and kind = 'PROVISIONAL' for update;
    if (v_request#>>'{crm,locationId}' is not null and v_request#>>'{crm,locationId}' is distinct from v_checkpoint->>'locationId')
      or (v_request#>>'{crm,contactId}' is not null and v_request#>>'{crm,contactId}' is distinct from v_checkpoint->>'contactId')
      or (v_intent->>'contactId' is not null and v_checkpoint->>'contactId' is not null and v_intent->>'contactId' <> v_checkpoint->>'contactId') then
      raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
    end if;
    update public.patrimonial_requests set record = v_request || jsonb_build_object('crm',v_checkpoint),
      contact_ref = case when v_checkpoint->>'contactId' is not null then md5(jsonb_build_array(v_checkpoint->>'locationId',v_checkpoint->>'contactId')::text) end,
      updated_at = now() where request_id = (v_record->>'requestId')::uuid;
    if v_checkpoint->>'contactId' is not null then
      update public.patrimonial_intents set remote_contact_id = v_checkpoint->>'contactId', location_ref = v_checkpoint->>'locationId',
        record = v_intent || jsonb_build_object('contactId',v_checkpoint->>'contactId','identityResolved',true), updated_at = now()
        where id = (v_record->>'intentId')::uuid;
    end if;
  end if;
  for v_op in select value from jsonb_array_elements(coalesce(p_input->'followUps','[]'::jsonb)) loop
    if v_op->>'requestId' <> v_record->>'requestId' or v_op->>'intentId' <> v_record->>'intentId' then
      raise exception using errcode = 'PT409', message = 'PATRIMONIAL_CONFLICT';
    end if;
    perform public.patrimonial_put_operation(v_op);
  end loop;
  perform public.patrimonial_put_operation(v_record || jsonb_build_object('technicalState','SYNCED','reconcileRequired',false,
    'leaseToken',null,'leaseExpiresAt',null) || case when p_input->>'remoteId' is not null then jsonb_build_object('remoteId',p_input->>'remoteId') else '{}'::jsonb end);
end;
$$;

create function public.patrimonial_store_transaction(p_commands jsonb, p_expected jsonb, p_preview boolean default false) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_results jsonb := '[]'; v_command jsonb; v_result jsonb; v_index integer := 0; v_request_id uuid;
begin
  if jsonb_typeof(p_commands) <> 'array' or jsonb_array_length(p_commands) not between 1 and 128 or jsonb_typeof(p_expected) <> 'object' then
    raise exception using errcode = '22023', message = 'PATRIMONIAL_INVALID_INPUT';
  end if;
  -- Rolling back a preview also rolls back all row/advisory locks acquired here.
  begin
    perform pg_advisory_xact_lock(741920, 2);
    for v_command in select value from jsonb_array_elements(p_commands) loop
      v_result := public.patrimonial_execute_command(v_command);
      if p_expected ? v_index::text and p_expected->(v_index::text) is distinct from v_result then
        raise exception using errcode = 'PT409', message = 'PATRIMONIAL_SNAPSHOT_CHANGED';
      end if;
      v_results := v_results || jsonb_build_array(v_result); v_index := v_index + 1;
    end loop;
    if p_preview then
      raise exception using errcode = 'PZ001', message = 'PATRIMONIAL_PREVIEW_ROLLBACK';
    end if;
    -- No NEW request can commit a partial receipt, even via the generic RPC.
    for v_command in select value from jsonb_array_elements(p_commands) where value->>'method' = 'createOrReplayRequest' loop
      v_request_id := (v_command#>>'{args,0,id}')::uuid;
      if not exists(select 1 from public.patrimonial_requests r where r.request_id = v_request_id and r.intent_id is not null
        and (select count(*) from public.patrimonial_consent_evidence c where c.request_id = r.request_id) = 2
        and exists(select 1 from public.patrimonial_consent_evidence c where c.request_id = r.request_id and c.purpose = 'requested-contact' and c.choice)
        and exists(select 1 from public.patrimonial_outbox_operations o where o.request_id = r.request_id and o.intent_id = r.intent_id and o.effect_type = 'SYNC_REQUEST')
        and exists(select 1 from public.patrimonial_domain_events e where e.request_id = r.request_id and e.intent_id = r.intent_id and e.event_name = 'request_received')) then
        raise exception using errcode = '22023', message = 'PATRIMONIAL_INCOMPLETE_ACQUISITION';
      end if;
    end loop;
  exception when sqlstate 'PZ001' then
    return v_results; -- Only this controlled exception is swallowed; all writes rolled back.
  end;
  return v_results;
end;
$$;

create function public.acquire_patrimonial_request_v2(p_commands jsonb, p_expected jsonb) returns jsonb
language sql security invoker set search_path = pg_catalog, public as $$
  select public.patrimonial_store_transaction(p_commands, p_expected, false);
$$;

create function public.patrimonial_store_health() returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  -- Resolve the actual schema and permissions, not just configuration strings.
  perform request_id, payload_hash from public.patrimonial_requests limit 0;
  perform group_key, revision from public.patrimonial_intents limit 0;
  perform evidence_key from public.patrimonial_consent_evidence limit 0;
  perform registration_status from public.patrimonial_participations limit 0;
  perform edition_key from public.patrimonial_event_editions limit 0;
  perform lease_token, lease_version from public.patrimonial_outbox_operations limit 0;
  perform event_key from public.patrimonial_domain_events limit 0;
  return jsonb_build_object('version','patrimonial-v2-store-1');
end;
$$;

-- Explicitly limited to these new objects; no existing product privileges change.
do $$
declare v_name text; v_function record;
begin
  foreach v_name in array array['patrimonial_requests','patrimonial_intents','patrimonial_consent_evidence','patrimonial_event_editions',
    'patrimonial_participations','patrimonial_outbox_operations','patrimonial_domain_events'] loop
    execute format('alter table public.%I enable row level security',v_name);
    execute format('alter table public.%I force row level security',v_name);
    execute format('revoke all on table public.%I from public, anon, authenticated',v_name);
    execute format('grant select, insert on table public.%I to service_role',v_name);
    if v_name not in ('patrimonial_consent_evidence','patrimonial_domain_events') then
      execute format('grant update on table public.%I to service_role',v_name);
    end if;
  end loop;
  -- Evidence content is append-oriented; only the deferred intent link is mutable.
  grant update (intent_id) on public.patrimonial_consent_evidence to service_role;
  for v_function in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'patrimonial_put_operation','patrimonial_execute_command','claim_patrimonial_operations','patrimonial_owned_operation',
      'renew_patrimonial_operation_lease','fail_patrimonial_operation','complete_patrimonial_operation',
      'patrimonial_store_transaction','acquire_patrimonial_request_v2','patrimonial_store_health'
    ]) loop
    execute format('revoke all on function %s from public, anon, authenticated',v_function.signature);
    execute format('grant execute on function %s to service_role',v_function.signature);
  end loop;
end;
$$;

-- No seed edition, policy duration, purge, scheduler, webhook, remote CRM or SQL
-- reference to Annunci/Radar/AI Score tables. Applying is a separate future step.
commit;
