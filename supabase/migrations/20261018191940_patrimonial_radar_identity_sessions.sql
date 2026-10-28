-- FASE 4C.1: candidate only, never applied remotely in this phase.
-- PostgreSQL 17-compatible SQL. No changes to existing products, ledger or assignments.
begin;
create schema patrimonial_radar_private;
revoke all on schema patrimonial_radar_private from public, anon, authenticated;
grant usage on schema patrimonial_radar_private to service_role;

-- Fail closed on accidental pepper replacement across instances: never fork verified identities.
create table patrimonial_radar_private.settings (
  singleton boolean primary key default true check (singleton),
  key_binding text not null check (key_binding ~ '^[0-9a-f]{64}$')
);

create table patrimonial_radar_private.persons (
  id uuid primary key,
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  retention_review_at timestamptz -- Review marker, not an approved retention duration or scheduled purge.
);
create table patrimonial_radar_private.verified_emails (
  email_key text primary key check (email_key ~ '^[0-9a-f]{64}$'),
  person_id uuid not null references patrimonial_radar_private.persons(id),
  verified_at timestamptz not null default clock_timestamp()
);
create index pr_verified_emails_person on patrimonial_radar_private.verified_emails(person_id);
create table patrimonial_radar_private.rate_limits (
  rate_key text primary key,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0)
);
create table patrimonial_radar_private.challenges (
  id uuid primary key,
  email_key text not null check (email_key ~ '^[0-9a-f]{64}$'),
  binding_hash text not null check (binding_hash ~ '^[0-9a-f]{64}$'),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  delivery text not null default 'PENDING' check (delivery in ('PENDING','SENT','FAILED')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '10 minutes',
  consumed_at timestamptz,
  revoked_at timestamptz
);
create index pr_challenges_email on patrimonial_radar_private.challenges(email_key, created_at);
create index pr_challenges_expiry on patrimonial_radar_private.challenges(expires_at);
create table patrimonial_radar_private.sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  person_id uuid not null references patrimonial_radar_private.persons(id),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '8 hours',
  idle_expires_at timestamptz not null default clock_timestamp() + interval '30 minutes',
  last_seen_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz
);
create index pr_sessions_person on patrimonial_radar_private.sessions(person_id);
create index pr_sessions_expiry on patrimonial_radar_private.sessions(expires_at);
create table patrimonial_radar_private.assessments (
  id uuid primary key,
  person_id uuid not null references patrimonial_radar_private.persons(id),
  creation_key uuid not null,
  creation_hash text not null check (creation_hash ~ '^[0-9a-f]{64}$'),
  entry_mode text not null check (entry_mode in ('DIRECT','EVENT','POST_EVENT')),
  as_of date not null default (clock_timestamp() at time zone 'UTC')::date,
  versions jsonb not null check (jsonb_typeof(versions) = 'object'),
  revision integer not null default 0 check (revision between 0 and 1000000),
  status text not null default 'DRAFT' check (status in ('DRAFT','COMPLETED')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  retention_review_at timestamptz,
  unique (person_id, creation_key)
);
create index pr_assessments_history on patrimonial_radar_private.assessments(person_id, created_at desc, id);
create table patrimonial_radar_private.answer_revisions (
  assessment_id uuid not null references patrimonial_radar_private.assessments(id),
  question_id text not null check (question_id ~ '^RP-(S0[1-4]|A0[1-5]|B0[1-4]|C0[1-4]|D0[1-2]|E0[1-4]|F0[1-6]|X(0[1-9]|1[01]))$'),
  answer_revision integer not null check (answer_revision > 0),
  assessment_revision integer not null check (assessment_revision > 0),
  record jsonb not null check (jsonb_typeof(record) = 'object'
    and record->>'id' = question_id and (record->>'revision')::integer = answer_revision
    and record->>'state' in ('VALUE','UNKNOWN','DECLINED','UNANSWERED')
    and (record->>'state' = 'VALUE' or not (record ? 'value'))),
  created_at timestamptz not null default clock_timestamp(),
  primary key (assessment_id, question_id, answer_revision),
  unique (assessment_id, assessment_revision)
);
create table patrimonial_radar_private.receipts (
  assessment_id uuid not null references patrimonial_radar_private.assessments(id),
  request_id uuid not null,
  kind text not null check (kind in ('ANSWER','COMPLETE')),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  response jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (assessment_id, request_id)
);
create table patrimonial_radar_private.snapshots (
  id uuid primary key,
  assessment_id uuid not null unique references patrimonial_radar_private.assessments(id),
  approved_revision integer not null,
  versions jsonb not null,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  answer_refs jsonb not null check (jsonb_typeof(answer_refs) = 'array'),
  result jsonb not null check (jsonb_typeof(result) = 'object' and result->'versions' = versions),
  completed_at timestamptz not null default clock_timestamp()
);
-- Future linking evidence only. This is not a queue and is never read by CRM workers.
-- No claim from a funnel email, request ID or URL can populate a verified relation.
create table patrimonial_radar_private.integration_links (
  id uuid primary key,
  person_id uuid not null references patrimonial_radar_private.persons(id),
  assessment_id uuid references patrimonial_radar_private.assessments(id),
  participation_ref uuid,
  crm_contact_ref text,
  crm_opportunity_ref text,
  verification_state text not null default 'UNRESOLVED' check (verification_state = 'UNRESOLVED'),
  created_at timestamptz not null default clock_timestamp()
);
create index pr_integration_person on patrimonial_radar_private.integration_links(person_id);
create index pr_integration_assessment on patrimonial_radar_private.integration_links(assessment_id);
create table patrimonial_radar_private.audit_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references patrimonial_radar_private.persons(id),
  assessment_id uuid references patrimonial_radar_private.assessments(id),
  action text not null check (action in ('IDENTITY_VERIFIED','ASSESSMENT_CREATED','ANSWER_SAVED','COMPLETED','SESSION_REVOKED')),
  revision integer,
  occurred_at timestamptz not null default clock_timestamp()
);
create index pr_audit_person on patrimonial_radar_private.audit_events(person_id, occurred_at);
create index pr_audit_assessment on patrimonial_radar_private.audit_events(assessment_id);

create function patrimonial_radar_private.immutable_record() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin raise exception using errcode = 'PT409', message = 'RADAR_IMMUTABLE'; end;
$$;
create trigger pr_answer_immutable before update or delete on patrimonial_radar_private.answer_revisions
for each row execute function patrimonial_radar_private.immutable_record();
create trigger pr_snapshot_immutable before update or delete on patrimonial_radar_private.snapshots
for each row execute function patrimonial_radar_private.immutable_record();
create trigger pr_receipt_immutable before update or delete on patrimonial_radar_private.receipts
for each row execute function patrimonial_radar_private.immutable_record();

create function patrimonial_radar_private.rate(p_key text, p_seconds integer, p_limit integer) returns boolean
language plpgsql security invoker set search_path = pg_catalog as $$
declare v patrimonial_radar_private.rate_limits%rowtype; t timestamptz := clock_timestamp();
begin
  insert into patrimonial_radar_private.rate_limits values (p_key,t,1) on conflict do nothing;
  if found then return true; end if;
  select * into v from patrimonial_radar_private.rate_limits where rate_key=p_key for update;
  if v.window_start + make_interval(secs => p_seconds) <= t then
    update patrimonial_radar_private.rate_limits set window_start=t, attempts=1 where rate_key=p_key;
    return true;
  end if;
  if v.attempts >= p_limit then return false; end if;
  update patrimonial_radar_private.rate_limits set attempts=attempts+1 where rate_key=p_key;
  return true;
end;
$$;

create function patrimonial_radar_private.authorize(p_hash text) returns uuid
language plpgsql security invoker set search_path = pg_catalog as $$
declare who uuid; s patrimonial_radar_private.sessions%rowtype; t timestamptz;
begin
  select person_id into who from patrimonial_radar_private.sessions where token_hash=p_hash;
  if who is null then return null; end if;
  -- A common person lock serializes revocation with access on all devices.
  perform 1 from patrimonial_radar_private.persons where id=who and deleted_at is null for update;
  if not found then return null; end if;
  select * into s from patrimonial_radar_private.sessions where token_hash=p_hash for update;
  t:=clock_timestamp();
  if s.revoked_at is not null or s.expires_at<=t or s.idle_expires_at<=t then return null; end if;
  update patrimonial_radar_private.sessions set last_seen_at=t, idle_expires_at=least(expires_at,t+interval '30 minutes') where token_hash=p_hash;
  return who;
end;
$$;

create function patrimonial_radar_private.assessment_json(p_id uuid) returns jsonb
language sql stable security invoker set search_path = pg_catalog as $$
  select jsonb_build_object('id',a.id,'revision',a.revision,'status',a.status,'entryMode',a.entry_mode,
    'versions',a.versions,'createdAt',a.created_at,'updatedAt',a.updated_at,
    'input',jsonb_build_object('asOf',to_char(a.as_of,'YYYY-MM-DD'),'answers',
      coalesce((select jsonb_agg(r.record order by r.assessment_revision) from patrimonial_radar_private.answer_revisions r where r.assessment_id=a.id),'[]'::jsonb)))
  from patrimonial_radar_private.assessments a where a.id=p_id;
$$;
create function patrimonial_radar_private.snapshot_json(p_id uuid) returns jsonb
language sql stable security invoker set search_path = pg_catalog as $$
  select jsonb_build_object('id',id,'assessmentId',assessment_id,'approvedRevision',approved_revision,
    'versions',versions,'inputHash',input_hash,'resultHash',result_hash,'answerRefs',answer_refs,'result',result,'completedAt',completed_at)
  from patrimonial_radar_private.snapshots where assessment_id=p_id;
$$;

create function public.patrimonial_radar_command(p_command jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog as $$
declare
  m text:=p_command->>'method'; who uuid; t timestamptz;
  c patrimonial_radar_private.challenges%rowtype;
  a patrimonial_radar_private.assessments%rowtype;
  r patrimonial_radar_private.receipts%rowtype;
  data jsonb; answer jsonb; n integer; days integer;
begin
  if p_command->>'contract' is distinct from 'patrimonial-radar-backend-1' then return jsonb_build_object('ok',false,'code','VERSION_MISMATCH'); end if;
  if m='health' then return jsonb_build_object('ok',true,'data',jsonb_build_object('version','patrimonial-radar-backend-1')); end if;
  if not coalesce(p_command->>'keyBinding' ~ '^[0-9a-f]{64}$',false) then return jsonb_build_object('ok',false,'code','UNAVAILABLE'); end if;
  insert into patrimonial_radar_private.settings(singleton,key_binding) values(true,p_command->>'keyBinding') on conflict do nothing;
  if not exists(select 1 from patrimonial_radar_private.settings where key_binding=p_command->>'keyBinding') then return jsonb_build_object('ok',false,'code','UNAVAILABLE'); end if;
  if m='request_code' then
    -- Namespace independent of the existing CRM ledger. DB time, persistent limits.
    perform pg_advisory_xact_lock(741921,1);
    if not patrimonial_radar_private.rate('request-ip:'||(p_command->>'networkKey'),3600,20)
      or not patrimonial_radar_private.rate('request-email-short:'||(p_command->>'emailKey'),60,1)
      or not patrimonial_radar_private.rate('request-email-long:'||(p_command->>'emailKey'),1800,5)
    then return jsonb_build_object('ok',true,'data',false); end if;
    update patrimonial_radar_private.challenges set revoked_at=clock_timestamp() where email_key=p_command->>'emailKey' and consumed_at is null and revoked_at is null;
    insert into patrimonial_radar_private.challenges(id,email_key,binding_hash,code_hash)
      values((p_command->>'id')::uuid,p_command->>'emailKey',p_command->>'bindingHash',p_command->>'codeHash');
    return jsonb_build_object('ok',true,'data',true);
  end if;
  if m='delivery' then
    update patrimonial_radar_private.challenges set delivery=case when (p_command->>'sent')::boolean then 'SENT' else 'FAILED' end
      where id=(p_command->>'id')::uuid and binding_hash=p_command->>'bindingHash' and delivery='PENDING';
    return jsonb_build_object('ok',true,'data',null);
  end if;
  if m='verify_code' then
    perform pg_advisory_xact_lock(741921,1);
    if not patrimonial_radar_private.rate('verify-ip:'||(p_command->>'networkKey'),600,30) then return jsonb_build_object('ok',false,'code','UNAUTHENTICATED'); end if;
    select * into c from patrimonial_radar_private.challenges where id=(p_command->>'id')::uuid for update;
    t:=clock_timestamp();
    if not found or c.binding_hash<>p_command->>'bindingHash' or c.consumed_at is not null or c.revoked_at is not null or c.expires_at<=t or c.attempts>=5 or c.delivery<>'SENT' then
      return jsonb_build_object('ok',false,'code','UNAUTHENTICATED');
    end if;
    update patrimonial_radar_private.challenges set attempts=attempts+1 where id=c.id;
    if c.code_hash<>p_command->>'codeHash' then return jsonb_build_object('ok',false,'code','UNAUTHENTICATED'); end if;
    select person_id into who from patrimonial_radar_private.verified_emails where email_key=c.email_key;
    if who is null then
      who:=(p_command->>'personId')::uuid; days:=(p_command->>'retentionReviewDays')::integer;
      insert into patrimonial_radar_private.persons(id,retention_review_at) values(who,case when days is not null then t+make_interval(days=>days) end);
      insert into patrimonial_radar_private.verified_emails(email_key,person_id) values(c.email_key,who);
    end if;
    perform 1 from patrimonial_radar_private.persons where id=who and deleted_at is null for update;
    if not found then return jsonb_build_object('ok',false,'code','UNAUTHENTICATED'); end if;
    update patrimonial_radar_private.challenges set consumed_at=t where id=c.id;
    update patrimonial_radar_private.verified_emails set verified_at=t where email_key=c.email_key;
    insert into patrimonial_radar_private.sessions(token_hash,person_id) values(p_command->>'sessionHash',who);
    insert into patrimonial_radar_private.audit_events(person_id,action) values(who,'IDENTITY_VERIFIED');
    select jsonb_build_object('personId',who,'expiresAt',expires_at) into data from patrimonial_radar_private.sessions where token_hash=p_command->>'sessionHash';
    return jsonb_build_object('ok',true,'data',data);
  end if;

  who:=patrimonial_radar_private.authorize(p_command->>'sessionHash');
  if who is null then return jsonb_build_object('ok',false,'code','UNAUTHENTICATED'); end if;
  if m='session' then
    select jsonb_build_object('personId',who,'expiresAt',expires_at) into data from patrimonial_radar_private.sessions where token_hash=p_command->>'sessionHash';
  elsif m='revoke' then
    update patrimonial_radar_private.sessions set revoked_at=clock_timestamp() where person_id=who and (coalesce((p_command->>'allDevices')::boolean,false) or token_hash=p_command->>'sessionHash') and revoked_at is null;
    insert into patrimonial_radar_private.audit_events(person_id,action) values(who,'SESSION_REVOKED');
    data:='null'::jsonb;
  elsif m='history' then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,'status',status,'createdAt',created_at,'updatedAt',updated_at) order by created_at desc,id),'[]'::jsonb) into data
      from patrimonial_radar_private.assessments where person_id=who;
  elsif m='create' then
    select * into a from patrimonial_radar_private.assessments where person_id=who and creation_key=(p_command->>'requestId')::uuid for update;
    if found then
      if a.creation_hash<>p_command->>'payloadHash' then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
      data:=jsonb_build_object('id',a.id,'revision',a.revision,'replay',true);
    else
      days:=(p_command->>'retentionReviewDays')::integer;
      insert into patrimonial_radar_private.assessments(id,person_id,creation_key,creation_hash,entry_mode,versions,retention_review_at)
        values((p_command->>'id')::uuid,who,(p_command->>'requestId')::uuid,p_command->>'payloadHash',p_command->>'entryMode',p_command->'versions',case when days is not null then clock_timestamp()+make_interval(days=>days) end) returning * into a;
      insert into patrimonial_radar_private.audit_events(person_id,assessment_id,action,revision) values(who,a.id,'ASSESSMENT_CREATED',0);
      data:=jsonb_build_object('id',a.id,'revision',0,'replay',false);
    end if;
  elsif m in ('read','receipt','save','complete','snapshot') then
    select * into a from patrimonial_radar_private.assessments where id=(p_command->>'id')::uuid and person_id=who for update;
    if not found then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
    if m='read' then data:=patrimonial_radar_private.assessment_json(a.id);
    elsif m='snapshot' then
      data:=patrimonial_radar_private.snapshot_json(a.id);
      if data is null then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
    elsif m in ('receipt','save') then
      select * into r from patrimonial_radar_private.receipts where assessment_id=a.id and request_id=(p_command->>'requestId')::uuid;
      if found then
        if r.kind<>'ANSWER' or r.payload_hash<>p_command->>'payloadHash' then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
        data:=r.response||jsonb_build_object('replay',true);
      elsif m='receipt' then data:='null'::jsonb;
      else
        if a.status<>'DRAFT' or a.revision<>(p_command->>'expectedRevision')::integer then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
        if a.versions is distinct from p_command->'versions' then return jsonb_build_object('ok',false,'code','VERSION_MISMATCH'); end if;
        answer:=p_command->'answer';
        select coalesce(max(answer_revision),0) into n from patrimonial_radar_private.answer_revisions where assessment_id=a.id and question_id=p_command->>'questionId';
        if answer is not null and answer<>'null'::jsonb then
          if answer->>'id' is distinct from p_command->>'questionId' or (answer->>'revision')::integer<>n+1 or answer->>'asOf'<>to_char(a.as_of,'YYYY-MM-DD') then return jsonb_build_object('ok',false,'code','INVALID'); end if;
          n:=n+1;
          update patrimonial_radar_private.assessments set revision=revision+1,updated_at=clock_timestamp() where id=a.id returning * into a;
          insert into patrimonial_radar_private.answer_revisions values(a.id,p_command->>'questionId',n,a.revision,answer,clock_timestamp());
          insert into patrimonial_radar_private.audit_events(person_id,assessment_id,action,revision) values(who,a.id,'ANSWER_SAVED',a.revision);
        end if;
        data:=jsonb_build_object('revision',a.revision,'answerRevision',n,'replay',false);
        insert into patrimonial_radar_private.receipts(assessment_id,request_id,kind,payload_hash,response) values(a.id,(p_command->>'requestId')::uuid,'ANSWER',p_command->>'payloadHash',data);
      end if;
    elsif m='complete' then
      if a.versions is distinct from p_command->'versions' then return jsonb_build_object('ok',false,'code','VERSION_MISMATCH'); end if;
      if a.status='COMPLETED' then
        data:=patrimonial_radar_private.snapshot_json(a.id);
        if (data->>'approvedRevision')::integer<>(p_command->>'expectedRevision')::integer then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
      else
        if a.revision<>(p_command->>'expectedRevision')::integer then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
        if exists(select 1 from patrimonial_radar_private.receipts where assessment_id=a.id and request_id=(p_command->>'requestId')::uuid) then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
        if p_command#>'{result,versions}' is distinct from a.versions then return jsonb_build_object('ok',false,'code','VERSION_MISMATCH'); end if;
        -- Only the trusted server computes this value; no HTTP endpoint accepts caller results.
        insert into patrimonial_radar_private.snapshots(id,assessment_id,approved_revision,versions,input_hash,result_hash,answer_refs,result)
          values((p_command->>'snapshotId')::uuid,a.id,a.revision,a.versions,p_command->>'inputHash',p_command->>'resultHash',p_command->'answerRefs',p_command->'result');
        update patrimonial_radar_private.assessments set status='COMPLETED',revision=revision+1,updated_at=clock_timestamp() where id=a.id;
        data:=patrimonial_radar_private.snapshot_json(a.id);
        insert into patrimonial_radar_private.receipts(assessment_id,request_id,kind,payload_hash,response)
          values(a.id,(p_command->>'requestId')::uuid,'COMPLETE',p_command->>'inputHash',jsonb_build_object('snapshotId',data->>'id','approvedRevision',a.revision));
        insert into patrimonial_radar_private.audit_events(person_id,assessment_id,action,revision) values(who,a.id,'COMPLETED',a.revision);
      end if;
    end if;
  else return jsonb_build_object('ok',false,'code','INVALID');
  end if;
  return jsonb_build_object('ok',true,'data',data);
end;
$$;

-- Deny browser roles at BOTH privilege and row levels. There are no public user policies.
do $$
declare tab text;
begin
  foreach tab in array array['settings','persons','verified_emails','rate_limits','challenges','sessions','assessments','answer_revisions','receipts','snapshots','integration_links','audit_events'] loop
    execute format('alter table patrimonial_radar_private.%I enable row level security',tab);
    execute format('alter table patrimonial_radar_private.%I force row level security',tab);
    execute format('revoke all on patrimonial_radar_private.%I from public, anon, authenticated',tab);
  end loop;
end;
$$;
grant select,insert on patrimonial_radar_private.persons,patrimonial_radar_private.verified_emails,
  patrimonial_radar_private.rate_limits,patrimonial_radar_private.challenges,patrimonial_radar_private.sessions,
  patrimonial_radar_private.assessments to service_role;
grant update(deleted_at) on patrimonial_radar_private.persons to service_role;
grant update(verified_at) on patrimonial_radar_private.verified_emails to service_role;
grant update(window_start,attempts) on patrimonial_radar_private.rate_limits to service_role;
grant update(delivery,attempts,consumed_at,revoked_at) on patrimonial_radar_private.challenges to service_role;
grant update(last_seen_at,idle_expires_at,revoked_at) on patrimonial_radar_private.sessions to service_role;
grant update(revision,status,updated_at) on patrimonial_radar_private.assessments to service_role;
grant select,insert on patrimonial_radar_private.answer_revisions,patrimonial_radar_private.receipts,
  patrimonial_radar_private.snapshots,patrimonial_radar_private.audit_events,patrimonial_radar_private.settings to service_role;
-- integration_links has no runtime writer yet, including for service_role.
revoke all on all functions in schema patrimonial_radar_private from public,anon,authenticated;
grant execute on all functions in schema patrimonial_radar_private to service_role;
revoke all on function public.patrimonial_radar_command(jsonb) from public,anon,authenticated;
grant execute on function public.patrimonial_radar_command(jsonb) to service_role;
commit;
