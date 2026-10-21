-- P2B local only. P1 must be installed first. No seeds, credentials or activation.
begin;
alter table public.patrimonial_intents add column owner_checkpoint_revision integer not null default 0 check(owner_checkpoint_revision>=0);
alter table public.patrimonial_intents add column owner_checkpoint jsonb check(owner_checkpoint is null or jsonb_typeof(owner_checkpoint)='object');
alter table public.patrimonial_outbox_operations drop constraint patrimonial_outbox_operations_effect_type_check;
alter table public.patrimonial_outbox_operations add constraint patrimonial_outbox_operations_effect_type_check
  check(effect_type in ('SYNC_REQUEST','RESOLVE_CONTACT','UPSERT_CONTACT','ADD_TAGS','ADD_NOTE','ASSIGN_OPPORTUNITY_OWNER'));
create index patrimonial_owner_outbox on public.patrimonial_outbox_operations(intent_id,status,next_attempt_at)
  where effect_type='ASSIGN_OPPORTUNITY_OWNER';

create function public.patrimonial_owner_context(p_claim jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare op jsonb; i public.patrimonial_intents; a public.patrimonial_assignments; o public.patrimonial_operators; valid boolean;
begin
  op:=public.patrimonial_owned_operation(p_claim);
  if op->>'kind'<>'ASSIGN_OPPORTUNITY_OWNER' then raise exception using errcode='22023',message='PATRIMONIAL_INVALID_INPUT'; end if;
  select * into strict i from public.patrimonial_intents where id=(op->>'intentId')::uuid for update;
  select * into a from public.patrimonial_assignments where id=((op#>>'{owner,assignmentId}'))::uuid;
  select * into o from public.patrimonial_operators where id=((op#>>'{owner,operatorId}'))::uuid;
  valid:=coalesce(i.kind='OPPORTUNITY' and i.status='OPEN' and a.released_at is null and a.intent_id=i.id
    and a.operator_id=i.current_operator_id and a.operator_id=o.id and o.active
    and a.revision=((op#>>'{owner,assignmentRevision}'))::integer and i.operator_revision=((op#>>'{owner,operatorRevision}'))::integer
    and o.revision=((op#>>'{owner,registryRevision}'))::integer and o.remote_user_ref=(op#>>'{owner,targetRemoteUserRef}')
    and i.owner_ref is not distinct from (op#>>'{owner,expectedOwnerRef}')
    and i.owner_ref is not distinct from (i.record->>'ownerId')
    and i.remote_opportunity_id is not distinct from (i.record#>>'{remote,id}')
    and i.owner_checkpoint_revision=((op#>>'{owner,checkpointRevision}'))::integer and i.business_key=(op#>>'{owner,businessKey}'),false);
  return jsonb_build_object('operation',op,'valid',valid,'intent',jsonb_build_object('id',i.id,'locationId',i.location_ref,
    'contactId',i.remote_contact_id,'pipeline',i.record->>'pipeline','businessKey',i.business_key,'remote',i.record->'remote'));
end $$;

create function public.patrimonial_owner_event(p_op jsonb,p_name text) returns void
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  insert into public.patrimonial_domain_events(event_key,event_name,intent_id,revision,occurred_at,actor_type,metadata)
  values('owner:'||(p_op->>'id')||':'||p_name||':'||(p_op->>'leaseVersion'),p_name,(p_op->>'intentId')::uuid,
    (p_op#>>'{owner,checkpointRevision}')::integer,clock_timestamp(),'WORKER',jsonb_build_object('operationId',p_op->>'id','revisionSpace','owner-checkpoint'))
  on conflict(event_key) do nothing;
end $$;

create function public.patrimonial_owner_enqueue(p_value jsonb) returns void
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare op jsonb:=p_value->'operation'; old_op jsonb; i public.patrimonial_intents;
begin
  perform pg_advisory_xact_lock(741920,2);
  select * into strict i from public.patrimonial_intents where id=(op->>'intentId')::uuid for update;
  if op->>'kind'<>'ASSIGN_OPPORTUNITY_OWNER' or op->>'identityLockKey'<>'patrimonial-owner:'||i.id::text
    or (op#>>'{owner,businessKey}') is distinct from i.business_key
    or ((op#>>'{owner,checkpointRevision}'))::integer<>i.owner_checkpoint_revision
    or (op#>>'{owner,expectedOwnerRef}') is distinct from i.owner_ref
    or ((op#>>'{owner,operatorRevision}'))::integer<>i.operator_revision
    or not exists(select 1 from public.patrimonial_assignments a join public.patrimonial_operators o on o.id=a.operator_id
      where a.id=((op#>>'{owner,assignmentId}'))::uuid and a.intent_id=i.id and a.released_at is null and a.operator_id=i.current_operator_id
      and o.id=((op#>>'{owner,operatorId}'))::uuid and o.active and o.remote_user_ref=(op#>>'{owner,targetRemoteUserRef}')
      and o.revision=((op#>>'{owner,registryRevision}'))::integer and a.revision=((op#>>'{owner,assignmentRevision}'))::integer)
    then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
  select record into old_op from public.patrimonial_outbox_operations where operation_key=op->>'operationKey';
  if found then
    if coalesce((p_value->>'recover')::boolean,false) and old_op->>'technicalState' in ('MANUAL_REVIEW','REJECTED') then
      old_op:=old_op||jsonb_build_object('technicalState',case when (old_op#>>'{owner,effectMayHaveCommitted}')::boolean then 'RECONCILE_REQUIRED' else 'SYNC_PENDING' end,
        'attemptCount',0,'leaseVersion',(old_op->>'leaseVersion')::integer+1,'leaseToken',null,'leaseExpiresAt',null,'nextAttemptAt',op->>'createdAt');
      perform public.patrimonial_put_operation(old_op); perform public.patrimonial_owner_event(old_op,'owner_recovery_requested');
    end if;
    return;
  end if;
  perform public.patrimonial_put_operation(op); perform public.patrimonial_owner_event(op,'owner_sync_requested');
end $$;

create function public.patrimonial_owner_finish(p_input jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare ctx jsonb; op jsonb; obs jsonb:=p_input->'observation'; result text:=p_input->>'outcome'; i public.patrimonial_intents;
begin
  ctx:=public.patrimonial_owner_context(p_input);op:=ctx->'operation';
  if result not in ('CONFIRMED','SUPERSEDED','HOLD','RECONCILE_REQUIRED','REPLAN') then raise exception using errcode='22023',message='PATRIMONIAL_INVALID_INPUT'; end if;
  if result in ('CONFIRMED','REPLAN') then
    if not (ctx->>'valid')::boolean then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
    select * into strict i from public.patrimonial_intents where id=(op->>'intentId')::uuid for update;
    if obs is null or obs->>'id' is distinct from i.remote_opportunity_id or obs->>'id' is distinct from (i.record#>>'{remote,id}')
      or obs->>'locationId' is distinct from i.location_ref or obs->>'contactId' is distinct from i.remote_contact_id
      or obs->>'pipelineId' is distinct from (i.record#>>'{remote,pipelineId}')
      or (obs->>'businessKey' is not null and obs->>'businessKey' is distinct from i.business_key)
      or not (obs ? 'assignedTo')
      or (result='CONFIRMED' and obs->>'assignedTo' is distinct from (op#>>'{owner,targetRemoteUserRef}'))
      or (result='REPLAN' and obs->>'assignedTo' is distinct from (op#>>'{owner,expectedOwnerRef}')) then
      raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT';
    end if;
    if result='CONFIRMED' then
      update public.patrimonial_intents set owner_ref=obs->>'assignedTo',owner_checkpoint_revision=owner_checkpoint_revision+1,
        owner_checkpoint=obs||jsonb_build_object('observedAt',p_input->>'now','operationId',op->>'id'),
        record=jsonb_set(record||jsonb_build_object('ownerId',obs->>'assignedTo'),'{remote,assignedTo}',obs->'assignedTo'),updated_at=now()
        where id=i.id and owner_checkpoint_revision=((op#>>'{owner,checkpointRevision}'))::integer;
      if not found then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
    else
      op:=jsonb_set(op,'{owner,effectMayHaveCommitted}','false');
    end if;
  end if;
  -- A stale in-flight write is never described as a harmless supersession.
  if result='SUPERSEDED' and ((op#>>'{owner,effectMayHaveCommitted}'))::boolean then result:='HOLD'; end if;
  op:=op||jsonb_build_object('outcome',case when result='HOLD' then p_input->>'reason' else result end,
    'technicalState',case result when 'CONFIRMED' then 'SYNCED' when 'SUPERSEDED' then 'SYNCED' when 'HOLD' then 'MANUAL_REVIEW' when 'REPLAN' then 'SYNC_PENDING' else 'RECONCILE_REQUIRED' end,
    'reconcileRequired',result='RECONCILE_REQUIRED' or result='HOLD' and ((op#>>'{owner,effectMayHaveCommitted}'))::boolean,
    'leaseToken',null,'leaseExpiresAt',null,'nextAttemptAt',p_input->>'now');
  perform public.patrimonial_put_operation(op);perform public.patrimonial_owner_event(op,'owner_'||lower(result));return 'null'::jsonb;
end $$;

alter function public.patrimonial_execute_command(jsonb) rename to patrimonial_execute_command_pre_owner_sync;
create function public.patrimonial_execute_command(p_command jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare m text:=p_command->>'method'; args jsonb:=p_command->'args'; result jsonb; plan jsonb; w jsonb; op jsonb; i public.patrimonial_intents; replay boolean;
begin
  case m
  when 'claimOwnerOperations' then
    return public.claim_patrimonial_operations(jsonb_set(args->0,'{kinds}','["ASSIGN_OPPORTUNITY_OWNER"]'::jsonb),p_command->'tokens');
  when 'getAssignmentContext' then
    result:=public.patrimonial_execute_command_pre_owner_sync(p_command);
    return jsonb_set(result,'{intents}',coalesce((select jsonb_agg(v||jsonb_build_object('businessKey',n.business_key,'ownerCheckpointRevision',n.owner_checkpoint_revision) order by n.id)
      from jsonb_array_elements(result->'intents') v join public.patrimonial_intents n on n.id=(v->>'id')::uuid),'[]'));
  when 'commitAssignmentPlan' then
    plan:=args->0;select exists(select 1 from public.patrimonial_assignment_commands where command_key=plan->>'commandKey') into replay;
    result:=public.patrimonial_assignment_commit(jsonb_set(plan,'{writes}',coalesce((select jsonb_agg(v) from jsonb_array_elements(plan->'writes') v where v->>'kind'<>'ownerOperation'),'[]')),(args->>1)::bigint);
    if not replay then
      -- Close undispatched predecessors atomically with release/reassign. Keep
      -- uncertain predecessors in review so they fence newer writes for this intent.
      for w in select value from jsonb_array_elements(plan->'writes') where value->>'kind'='intentOperator' loop
        for op in select record from public.patrimonial_outbox_operations where intent_id=(w#>>'{value,id}')::uuid
          and effect_type='ASSIGN_OPPORTUNITY_OWNER' and status<>'SYNCED' loop
          op:=op||jsonb_build_object('outcome',case when ((op#>>'{owner,effectMayHaveCommitted}'))::boolean then 'STALE_UNCERTAIN' else 'SUPERSEDED' end,
            'technicalState',case when ((op#>>'{owner,effectMayHaveCommitted}'))::boolean then 'MANUAL_REVIEW' else 'SYNCED' end,
            'leaseVersion',(op->>'leaseVersion')::integer+1,'leaseToken',null,'leaseExpiresAt',null);
          perform public.patrimonial_put_operation(op);perform public.patrimonial_owner_event(op,'owner_superseded');
        end loop;
      end loop;
      for w in select value from jsonb_array_elements(plan->'writes') where value->>'kind'='ownerOperation' loop perform public.patrimonial_owner_enqueue(w->'value'); end loop;
    end if;
    return result;
  when 'getOwnerContext' then return public.patrimonial_owner_context(args->0);
  when 'authorizeOwnerWrite' then
    result:=public.patrimonial_owner_context(args->0);
    if (result->>'valid')::boolean then
      op:=jsonb_set(result->'operation','{owner,effectMayHaveCommitted}','true');
      perform public.patrimonial_put_operation(op);result:=jsonb_set(result,'{operation}',op);
    end if;
    return result;
  when 'finishOwnerOperation' then return public.patrimonial_owner_finish(args->0);
  when 'saveOpportunityIntent' then
    select * into i from public.patrimonial_intents where id=((args#>>'{0,id}'))::uuid;
    if found and i.owner_checkpoint_revision>0 and i.owner_ref is distinct from (args#>>'{0,ownerId}') then raise exception using errcode='PT409',message='PATRIMONIAL_CONFLICT'; end if;
    return public.patrimonial_execute_command_pre_owner_sync(p_command);
  else return public.patrimonial_execute_command_pre_owner_sync(p_command);
  end case;
end $$;

create or replace function public.claim_patrimonial_operations(p_input jsonb, p_tokens jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_row public.patrimonial_outbox_operations%rowtype;
  v_result jsonb := '[]'; v_record jsonb; v_count integer := 0;
  v_now timestamptz;
  v_seconds integer := coalesce((p_input->>'leaseSeconds')::integer, 60);
  v_limit integer := (p_input->>'limit')::integer;
  v_reconcile boolean := coalesce((p_input->>'reconciliationOnly')::boolean, false);
  v_expires timestamptz;
  v_kinds jsonb:=coalesce(p_input->'kinds','["SYNC_REQUEST","RESOLVE_CONTACT","UPSERT_CONTACT","ADD_TAGS","ADD_NOTE"]'::jsonb);
begin
  perform pg_advisory_xact_lock(741920, 2);
  if jsonb_typeof(v_kinds)<>'array' or jsonb_array_length(v_kinds)=0 or exists(select 1 from jsonb_array_elements_text(v_kinds) x where x not in ('SYNC_REQUEST','RESOLVE_CONTACT','UPSERT_CONTACT','ADD_TAGS','ADD_NOTE','ASSIGN_OPPORTUNITY_OWNER'))
    or (v_kinds ? 'ASSIGN_OPPORTUNITY_OWNER' and jsonb_array_length(v_kinds)<>1) then raise exception using errcode='22023',message='PATRIMONIAL_INVALID_INPUT'; end if;
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
    where v_kinds ? o.effect_type and o.next_attempt_at <= v_now
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



do $$ declare f record;begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'patrimonial_owner_%' or p.proname in ('patrimonial_execute_command','patrimonial_execute_command_pre_owner_sync','claim_patrimonial_operations')) loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
