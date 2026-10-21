-- Forward-only correction; do not apply remotely without explicit authorization.
-- JSON extraction and containment operators share precedence and associate left.
-- Parenthesize each JSONB operand before @>; preserve every other function rule.
-- CREATE OR REPLACE preserves existing ACLs; INVOKER/search_path stay identical.
begin;

create or replace function public.patrimonial_execute_command(p_command jsonb) returns jsonb
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
        or not ((v_input->'requestIds') @> (v_parent.record->'requestIds')) or not ((v_input->'events') @> (v_parent.record->'events')))) then
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
      if not ((v_parent.record->'requestIds') @> (v_item->'requestIds')) then
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

commit;
