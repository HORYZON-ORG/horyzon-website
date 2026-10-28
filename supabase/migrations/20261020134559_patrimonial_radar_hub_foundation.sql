-- 5A CANDIDATE ONLY: never applied remotely. Requires reviewed P1/P2B + 4C.1.
-- One person/answer/snapshot store; one P1 operator/assignment journal.
begin;
create schema if not exists hub;

alter table public.patrimonial_intents drop constraint patrimonial_intents_kind_check;
alter table public.patrimonial_intents add constraint patrimonial_intents_kind_check check (kind in ('PROVISIONAL','OPPORTUNITY','RADAR'));
alter table public.patrimonial_intents drop constraint patrimonial_intents_funnel_check;
alter table public.patrimonial_intents add constraint patrimonial_intents_funnel_check check (funnel in ('architect-path','patrimonial-event','patrimonial-consultation','patrimonial-radar'));
alter table public.patrimonial_intents add constraint patrimonial_radar_intent_minimal check (kind<>'RADAR' or (
  funnel='patrimonial-radar' and status='OPEN' and stage is null and next_step is null and next_step_at is null
  and remote_contact_id is null and remote_opportunity_id is null and location_ref is null and owner_ref is null
  and group_key is null and business_key is null and provisional_key is null and scope_key is null
  and record=jsonb_build_object('id',id::text,'kind','RADAR') and sync_state='MANUAL_REVIEW'));
alter table public.patrimonial_lead_snapshots drop constraint patrimonial_lead_snapshots_funnel_check;
alter table public.patrimonial_lead_snapshots add constraint patrimonial_lead_snapshots_funnel_check check (funnel in ('architect-path','patrimonial-event','patrimonial-consultation','patrimonial-radar'));

-- Minimal, fail-closed extension of the installed canonical P1 functions.
-- Abort rather than rewriting an unknown version or editing an applied migration.
do $$ declare def text; begin
  def:=pg_get_functiondef('public.patrimonial_assignment_guard()'::regprocedure);
  if strpos(def,$s$v_kind <> 'OPPORTUNITY'$s$)=0 then raise exception 'P1_GUARD_VERSION_MISMATCH'; end if;
  execute replace(def,$s$v_kind <> 'OPPORTUNITY'$s$,$s$v_kind not in ('OPPORTUNITY','RADAR')$s$);
  def:=pg_get_functiondef('public.patrimonial_assignment_commit(jsonb,bigint)'::regprocedure);
  if strpos(def,$s$kind='OPPORTUNITY' and operator_revision$s$)=0 then raise exception 'P1_COMMIT_VERSION_MISMATCH'; end if;
  execute replace(def,$s$kind='OPPORTUNITY' and operator_revision$s$,$s$kind in ('OPPORTUNITY','RADAR') and operator_revision$s$);
end $$;

create table patrimonial_radar_private.cases (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references patrimonial_radar_private.assessments(id),
  person_id uuid not null references patrimonial_radar_private.persons(id),
  intent_id uuid not null unique references public.patrimonial_intents(id),
  created_at timestamptz not null default clock_timestamp()
);
create index pr_cases_person on patrimonial_radar_private.cases(person_id);
create table patrimonial_radar_private.service_notice_acknowledgements (
  assessment_id uuid primary key references patrimonial_radar_private.assessments(id),
  person_id uuid not null references patrimonial_radar_private.persons(id),
  notice_version text not null check(notice_version='RP-SERVICE-5A-DRAFT-1'),
  acknowledged_at timestamptz not null default clock_timestamp()
);
create table patrimonial_radar_private.event_invitations (
  ticket_hash text primary key check(ticket_hash ~ '^[a-f0-9]{64}$'),
  request_id uuid not null references public.patrimonial_requests(request_id),
  email_key text not null check(email_key ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '24 hours',
  revoked_at timestamptz
);
create index pr_invitation_request on patrimonial_radar_private.event_invitations(request_id);
create table patrimonial_radar_private.reconciliations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references patrimonial_radar_private.persons(id),
  request_id uuid not null references public.patrimonial_requests(request_id),
  ticket_hash text not null references patrimonial_radar_private.event_invitations(ticket_hash),
  state text not null check(state in ('CANDIDATE','VERIFIED','CONFLICT','REVOKED')),
  source_revision integer not null default 0,
  evidence_ref text not null check(length(evidence_ref) between 1 and 180),
  revision integer not null default 0 check(revision>=0),
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  unique(person_id,request_id)
);
create index pr_reconciliation_request on patrimonial_radar_private.reconciliations(request_id);
create table patrimonial_radar_private.reconciliation_history (
  id bigint generated always as identity primary key, reconciliation_id uuid not null references patrimonial_radar_private.reconciliations(id),
  state text not null, revision integer not null, evidence_ref text not null, occurred_at timestamptz not null default clock_timestamp()
);
create table patrimonial_radar_private.assessment_origins (
  assessment_id uuid primary key references patrimonial_radar_private.assessments(id),
  reconciliation_id uuid not null references patrimonial_radar_private.reconciliations(id),
  created_at timestamptz not null default clock_timestamp()
);
-- Known shared/colliding/changed mailboxes require a separate identity review.
-- No automatic merge, move of verified email, or guessed alias normalization.
create table patrimonial_radar_private.mailbox_reviews (
  email_key text primary key check(email_key ~ '^[a-f0-9]{64}$'),
  reason text not null check(reason in ('SHARED','COLLISION','EMAIL_CHANGE')),
  state text not null check(state in ('CANDIDATE','VERIFIED','CONFLICT','REVOKED')),
  evidence_ref text not null, revision integer not null default 0
);
create table patrimonial_radar_private.highlevel_bindings (
  id uuid primary key default gen_random_uuid(), person_id uuid not null references patrimonial_radar_private.persons(id),
  location_id text not null, contact_id text not null,
  state text not null check(state in ('CANDIDATE','VERIFIED','CONFLICT','REVOKED')),
  evidence_ref text not null, revision integer not null default 0, created_at timestamptz not null default clock_timestamp(),
  check(length(location_id) between 1 and 160 and length(contact_id) between 1 and 160),
  unique(person_id,location_id,contact_id)
);
create unique index pr_hl_verified_contact on patrimonial_radar_private.highlevel_bindings(location_id,contact_id) where state='VERIFIED';
create unique index pr_hl_verified_person on patrimonial_radar_private.highlevel_bindings(person_id,location_id) where state='VERIFIED';
create table hub.patrimonial_radar_permissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  permission text not null check(permission in ('RADAR_PATRIMONIAL_LIST','RADAR_PATRIMONIAL_PERSON','RADAR_PATRIMONIAL_ASSIGN','RADAR_PATRIMONIAL_ADVISOR')),
  operator_id uuid references public.patrimonial_operators(id), revision integer not null default 0,
  expires_at timestamptz not null, revoked_at timestamptz, evidence_ref text not null,
  check(permission<>'RADAR_PATRIMONIAL_ADVISOR' or operator_id is not null)
);
create index pr_permissions_user on hub.patrimonial_radar_permissions(user_id,permission);
create unique index pr_permissions_current on hub.patrimonial_radar_permissions(user_id,permission) where revoked_at is null;
create table hub.patrimonial_radar_read_audit (
  id uuid primary key default gen_random_uuid(), actor_id uuid, session_id uuid,
  action text not null, target_id uuid, outcome text not null check(outcome in ('AUTHORIZED','DENIED')),
  permission_revision integer, assignment_revision integer, occurred_at timestamptz not null default clock_timestamp()
);
-- Provisioning these empty permissions requires separate authority review.
-- No superadmin/marketing/team role is translated to a dossier grant.

create table patrimonial_radar_private.foundation_metadata_history (
  id bigint generated always as identity primary key,
  registry text not null, subject_ref text not null, revision integer not null,
  evidence_ref text not null, record jsonb not null, occurred_at timestamptz not null default clock_timestamp(),
  unique(registry,subject_ref,revision)
);
create function patrimonial_radar_private.metadata_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
declare n jsonb:=to_jsonb(new); o jsonb:=to_jsonb(old); ref text; begin
  if tg_op='DELETE' then raise exception 'IMMUTABLE'; end if;
  ref:=coalesce(n->>'id',n->>'email_key');
  if length(n->>'evidence_ref')=0 or (n->>'revision')::integer<0 then raise exception 'EVIDENCE_REQUIRED'; end if;
  if tg_op='INSERT' and (n->>'revision')::integer<>0 then raise exception 'REVISION_CONFLICT'; end if;
  if tg_table_name='highlevel_bindings' and tg_op='INSERT' and n->>'state'<>'CANDIDATE' then raise exception 'CANDIDATE_REQUIRED'; end if;
  if tg_table_name='highlevel_bindings' and tg_op='UPDATE' and not
    ((o->>'state'='CANDIDATE' and n->>'state' in ('VERIFIED','CONFLICT','REVOKED')) or (o->>'state'='VERIFIED' and n->>'state' in ('CONFLICT','REVOKED')) or (o->>'state'='CONFLICT' and n->>'state'='REVOKED')) then raise exception 'RECONCILIATION_CONFLICT'; end if;
  if tg_op='UPDATE' and ((n->>'revision')::integer<>(o->>'revision')::integer+1
    or (n-'revision'-'state'-'evidence_ref'-'expires_at'-'revoked_at') is distinct from (o-'revision'-'state'-'evidence_ref'-'expires_at'-'revoked_at')
    or o->>'state'='REVOKED' or o->>'revoked_at' is not null) then raise exception 'REVISION_CONFLICT'; end if;
  insert into patrimonial_radar_private.foundation_metadata_history(registry,subject_ref,revision,evidence_ref,record)
    values(tg_table_schema||'.'||tg_table_name,ref,(n->>'revision')::integer,n->>'evidence_ref',n);
  return new;
end $$;
create trigger pr_binding_history after insert or update or delete on patrimonial_radar_private.highlevel_bindings for each row execute function patrimonial_radar_private.metadata_guard();
create trigger pr_mailbox_history after insert or update or delete on patrimonial_radar_private.mailbox_reviews for each row execute function patrimonial_radar_private.metadata_guard();
create trigger pr_permission_history after insert or update or delete on hub.patrimonial_radar_permissions for each row execute function patrimonial_radar_private.metadata_guard();
create function patrimonial_radar_private.foundation_append_only() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$ begin raise exception 'IMMUTABLE'; end $$;
create trigger pr_metadata_immutable before update or delete on patrimonial_radar_private.foundation_metadata_history for each row execute function patrimonial_radar_private.foundation_append_only();
create trigger pr_read_audit_immutable before update or delete on hub.patrimonial_radar_read_audit for each row execute function patrimonial_radar_private.foundation_append_only();
create trigger pr_reconciliation_audit_immutable before update or delete on patrimonial_radar_private.reconciliation_history for each row execute function patrimonial_radar_private.foundation_append_only();
create trigger pr_notice_immutable before update or delete on patrimonial_radar_private.service_notice_acknowledgements for each row execute function patrimonial_radar_private.foundation_append_only();

create function patrimonial_radar_private.reconciliation_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$ begin
  if tg_op='DELETE' then raise exception 'IMMUTABLE'; end if;
  if tg_op='UPDATE' and (new.person_id<>old.person_id or new.request_id<>old.request_id or new.ticket_hash<>old.ticket_hash
     or new.revision<>old.revision+1 or old.state in ('CONFLICT','REVOKED')
     or not ((old.state='CANDIDATE' and new.state in ('VERIFIED','CONFLICT','REVOKED')) or (old.state='VERIFIED' and new.state in ('CONFLICT','REVOKED'))))
    then raise exception 'RECONCILIATION_CONFLICT'; end if;
  insert into patrimonial_radar_private.reconciliation_history(reconciliation_id,state,revision,evidence_ref)
    values(new.id,new.state,new.revision,new.evidence_ref);
  return new;
end $$;
create trigger pr_reconciliation_history after insert or update on patrimonial_radar_private.reconciliations for each row execute function patrimonial_radar_private.reconciliation_guard();
create trigger pr_reconciliation_no_delete before delete on patrimonial_radar_private.reconciliations for each row execute function patrimonial_radar_private.reconciliation_guard();

create function patrimonial_radar_private.open_case() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
declare iid uuid:=gen_random_uuid(); begin
  insert into public.patrimonial_intents(id,kind,funnel,status,record,sync_state)
    values(iid,'RADAR','patrimonial-radar','OPEN',jsonb_build_object('id',iid::text,'kind','RADAR'),'MANUAL_REVIEW');
  insert into patrimonial_radar_private.cases(assessment_id,person_id,intent_id) values(new.id,new.person_id,iid);
  return new;
end $$;
create trigger pr_assessment_case after insert on patrimonial_radar_private.assessments for each row execute function patrimonial_radar_private.open_case();
-- Existing assessments are backfilled explicitly; no response/report is copied.
insert into public.patrimonial_intents(id,kind,funnel,status,record,sync_state)
 select a.id,'RADAR','patrimonial-radar','OPEN',jsonb_build_object('id',a.id::text,'kind','RADAR'),'MANUAL_REVIEW' from patrimonial_radar_private.assessments a;
insert into patrimonial_radar_private.cases(assessment_id,person_id,intent_id) select id,person_id,id from patrimonial_radar_private.assessments;

-- Reuse the 4C command for all identity/answer/snapshot operations; only add a
-- deny on mailboxes explicitly under review, including already-open sessions.
alter function public.patrimonial_radar_command(jsonb) rename to patrimonial_radar_command_pre_5a;
create function public.patrimonial_radar_command(p_command jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare k text; result jsonb; begin
  if p_command->>'method'='create' and p_command->>'noticeVersion' is distinct from 'RP-SERVICE-5A-DRAFT-1' then return jsonb_build_object('ok',false,'code','FORBIDDEN'); end if;
  if p_command->>'method' in ('save','complete') and not exists(select 1 from patrimonial_radar_private.service_notice_acknowledgements where assessment_id=(p_command->>'id')::uuid) then return jsonb_build_object('ok',false,'code','FORBIDDEN'); end if;
  if p_command->>'method'='verify_code' then select email_key into k from patrimonial_radar_private.challenges where id=(p_command->>'id')::uuid;
  else select e.email_key into k from patrimonial_radar_private.sessions s join patrimonial_radar_private.verified_emails e on e.person_id=s.person_id
    join patrimonial_radar_private.mailbox_reviews m on m.email_key=e.email_key where s.token_hash=p_command->>'sessionHash' limit 1; end if;
  if exists(select 1 from patrimonial_radar_private.mailbox_reviews where email_key=k) then return jsonb_build_object('ok',false,'code','FORBIDDEN'); end if;
  if p_command->>'method'='acknowledge_notice' then
    if p_command->>'noticeVersion' is distinct from 'RP-SERVICE-5A-DRAFT-1' then return jsonb_build_object('ok',false,'code','FORBIDDEN'); end if;
    -- Reuse 4C ownership/session checks for existing drafts; never fabricate an acknowledgement.
    result:=public.patrimonial_radar_command_pre_5a(jsonb_set(p_command,'{method}','"read"'));
    if not (result->>'ok')::boolean then return result; end if;
    insert into patrimonial_radar_private.service_notice_acknowledgements(assessment_id,person_id,notice_version)
      select id,person_id,'RP-SERVICE-5A-DRAFT-1' from patrimonial_radar_private.assessments where id=(p_command->>'id')::uuid on conflict do nothing;
    return jsonb_build_object('ok',true,'data',jsonb_build_object('noticeVersion','RP-SERVICE-5A-DRAFT-1'));
  end if;
  result:=public.patrimonial_radar_command_pre_5a(p_command);
  if p_command->>'method'='create' and (result->>'ok')::boolean then
    insert into patrimonial_radar_private.service_notice_acknowledgements(assessment_id,person_id,notice_version)
      select id,person_id,'RP-SERVICE-5A-DRAFT-1' from patrimonial_radar_private.assessments where id=(result#>>'{data,id}')::uuid on conflict do nothing;
  end if;
  return result;
end $$;

create function public.patrimonial_foundation_command(p_command jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare who uuid; inv patrimonial_radar_private.event_invitations; rec patrimonial_radar_private.reconciliations; state_value text; data jsonb; begin
  if p_command->>'contract' is distinct from 'patrimonial-foundation-5a-1' then return jsonb_build_object('ok',false,'code','VERSION_MISMATCH'); end if;
  if not exists(select 1 from patrimonial_radar_private.settings where key_binding=p_command->>'keyBinding') then return jsonb_build_object('ok',false,'code','UNAVAILABLE'); end if;
  perform pg_advisory_xact_lock(741921,1);
  if p_command->>'method'='prepare_event' then
    if not exists(select 1 from public.patrimonial_requests r where r.request_id=(p_command->>'requestId')::uuid and r.payload_hash=p_command->>'payloadHash'
      and r.contract_version='patrimonial-lead-v2' and r.mode='patrimonial-event' and r.receipt_status='received' and r.expires_at>clock_timestamp()
      and lower(btrim(r.record#>>'{payload,email}'))=p_command->>'email')
      or p_command->>'emailKey' !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
    insert into patrimonial_radar_private.event_invitations(ticket_hash,request_id,email_key) values(p_command->>'ticketHash',(p_command->>'requestId')::uuid,p_command->>'emailKey');
    return jsonb_build_object('ok',true,'data',null);
  end if;
  who:=patrimonial_radar_private.authorize(p_command->>'sessionHash');
  if who is null or exists(select 1 from patrimonial_radar_private.verified_emails e join patrimonial_radar_private.mailbox_reviews m using(email_key) where e.person_id=who)
    then return jsonb_build_object('ok',false,'code','UNAUTHENTICATED'); end if;
  if p_command->>'method'='propose_event' then
    select * into inv from patrimonial_radar_private.event_invitations where ticket_hash=p_command->>'ticketHash' and revoked_at is null and expires_at>clock_timestamp() for update;
    if not found then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
    state_value:=case when exists(select 1 from patrimonial_radar_private.verified_emails where person_id=who and email_key=inv.email_key)
      and not exists(select 1 from patrimonial_radar_private.reconciliations where request_id=inv.request_id and person_id<>who and state<>'REVOKED') then 'CANDIDATE' else 'CONFLICT' end;
    insert into patrimonial_radar_private.reconciliations(person_id,request_id,ticket_hash,state,evidence_ref)
      values(who,inv.request_id,inv.ticket_hash,state_value,'opaque-ticket+otp-v1') on conflict(person_id,request_id) do nothing;
    select * into rec from patrimonial_radar_private.reconciliations where person_id=who and request_id=inv.request_id;
    data:=jsonb_build_object('id',rec.id,'state',rec.state,'revision',rec.revision);
  elsif p_command->>'method'='confirm_event' then
    select * into rec from patrimonial_radar_private.reconciliations where id=(p_command->>'id')::uuid and person_id=who for update;
    if not found then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
    if rec.state<>'CANDIDATE' or rec.revision<>(p_command->>'expectedRevision')::integer
      or not exists(select 1 from patrimonial_radar_private.event_invitations i join patrimonial_radar_private.verified_emails e using(email_key)
        where i.ticket_hash=rec.ticket_hash and i.revoked_at is null and i.expires_at>clock_timestamp() and e.person_id=who)
      then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
    update patrimonial_radar_private.reconciliations set state='VERIFIED',revision=revision+1,updated_at=clock_timestamp(),evidence_ref='explicit-person-confirmation+opaque-ticket+otp-v1' where id=rec.id returning * into rec;
    data:=jsonb_build_object('state',rec.state,'revision',rec.revision);
  elsif p_command->>'method'='link_assessment' then
    if not exists(select 1 from patrimonial_radar_private.assessments where id=(p_command->>'assessmentId')::uuid and person_id=who)
      or not exists(select 1 from patrimonial_radar_private.reconciliations where id=(p_command->>'reconciliationId')::uuid and person_id=who and state='VERIFIED')
      then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
    insert into patrimonial_radar_private.assessment_origins(assessment_id,reconciliation_id) values((p_command->>'assessmentId')::uuid,(p_command->>'reconciliationId')::uuid) on conflict do nothing;
    if not exists(select 1 from patrimonial_radar_private.assessment_origins where assessment_id=(p_command->>'assessmentId')::uuid and reconciliation_id=(p_command->>'reconciliationId')::uuid)
      then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
    data:=jsonb_build_object('linked',true);
  else return jsonb_build_object('ok',false,'code','INVALID'); end if;
  return jsonb_build_object('ok',true,'data',data);
end $$;

-- SECURITY DEFINER is restricted to this database-side entry point, not a grant
-- of auth/session/table privileges to the browser. No user_metadata authorization.
-- Empty explicit permission registry; exact live auth session checked each call.
create function hub.patrimonial_radar_command(p_command jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare uid uuid:=auth.uid(); sid uuid; grant_row hub.patrimonial_radar_permissions; need text; m text:=p_command->>'method';
  target uuid; c patrimonial_radar_private.cases; i public.patrimonial_intents; a public.patrimonial_assignments;
  op public.patrimonial_operators; saved public.patrimonial_assignment_commands; state_revision bigint; active_total bigint;
  aid uuid:=gen_random_uuid(); cmd text; command_hash text; t timestamptz:=clock_timestamp(); writes jsonb:='[]'; data jsonb; permitted boolean:=false;
begin
  -- Invalid or missing claims never authorize; exceptions are sanitized below.
  sid:=nullif(auth.jwt()->>'session_id','')::uuid;
  target:=nullif(p_command->>'id','')::uuid;
  need:=case m when 'list' then 'RADAR_PATRIMONIAL_LIST' when 'person' then 'RADAR_PATRIMONIAL_PERSON'
    when 'report' then 'RADAR_PATRIMONIAL_ADVISOR' when 'assign' then 'RADAR_PATRIMONIAL_ASSIGN' when 'reassign' then 'RADAR_PATRIMONIAL_ASSIGN' when 'release' then 'RADAR_PATRIMONIAL_ASSIGN' end;
  if p_command->>'contract' is distinct from 'patrimonial-foundation-5a-1' or need is null then return jsonb_build_object('ok',false,'code','INVALID'); end if;
  -- Same fence as every P1 writer; lock current permission/session before release.
  perform pg_advisory_xact_lock(741920,2);
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=sid and s.user_id=uid
    and (s.not_after is null or s.not_after>clock_timestamp()) and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp()) for share of s,u;
  if found then
    select * into grant_row from hub.patrimonial_radar_permissions where user_id=uid and permission=need and revoked_at is null and expires_at>clock_timestamp() order by id limit 1 for share;
    permitted:=found;
  end if;
  if not permitted then
    insert into hub.patrimonial_radar_read_audit(actor_id,session_id,action,target_id,outcome) values(uid,sid,m,target,'DENIED');
    return jsonb_build_object('ok',false,'code','FORBIDDEN');
  end if;
  if m='list' then
    if jsonb_typeof(coalesce(p_command->'filters','{}'))<>'object' or exists(select 1 from jsonb_object_keys(coalesce(p_command->'filters','{}')) k where k not in ('status','origin','operatorId','from','to','search','sort','eventLinked'))
      then return jsonb_build_object('ok',false,'code','INVALID'); end if;
    select jsonb_build_object('totals',jsonb_build_object('all',count(*),'draft',count(*) filter(where ass.status='DRAFT'),'completed',count(*) filter(where ass.status='COMPLETED'),
      'unassigned',count(*) filter(where it.current_operator_id is null),'assigned',count(*) filter(where it.current_operator_id is not null),'reports',count(snap.id)),
      'rows',coalesce(jsonb_agg(jsonb_build_object('id',cc.id,'personId',cc.person_id,'assessmentId',ass.id,'status',ass.status,'createdAt',cc.created_at,
        'origin',case when orig.assessment_id is null then 'DIRECT' else 'EVENT' end,'eventLinked',coalesce(origin_reconciliation.state='VERIFIED',false),
        'operatorId',it.current_operator_id,'assignmentRevision',it.operator_revision,'reportId',snap.id)
        order by case when p_command#>>'{filters,sort}'='OLDEST' then cc.created_at end asc, case when p_command#>>'{filters,sort}' is distinct from 'OLDEST' then cc.created_at end desc,cc.id),'[]')) into data
      from patrimonial_radar_private.cases cc join patrimonial_radar_private.assessments ass on ass.id=cc.assessment_id
      join patrimonial_radar_private.persons subject on subject.id=cc.person_id and subject.deleted_at is null
      join public.patrimonial_intents it on it.id=cc.intent_id left join patrimonial_radar_private.snapshots snap on snap.assessment_id=ass.id
      left join patrimonial_radar_private.assessment_origins orig on orig.assessment_id=ass.id
      left join patrimonial_radar_private.reconciliations origin_reconciliation on origin_reconciliation.id=orig.reconciliation_id
      where (p_command#>>'{filters,status}' is null or ass.status=p_command#>>'{filters,status}')
        and (p_command#>>'{filters,origin}' is null or (case when orig.assessment_id is null then 'DIRECT' else 'EVENT' end)=p_command#>>'{filters,origin}')
        and (p_command#>>'{filters,operatorId}' is null or coalesce(it.current_operator_id::text,'UNASSIGNED')=p_command#>>'{filters,operatorId}')
        and (p_command#>>'{filters,from}' is null or cc.created_at>=(p_command#>>'{filters,from}')::timestamptz)
        and (p_command#>>'{filters,to}' is null or cc.created_at<(p_command#>>'{filters,to}')::timestamptz)
        and (p_command#>>'{filters,eventLinked}' is null or coalesce(origin_reconciliation.state='VERIFIED',false)=(p_command#>>'{filters,eventLinked}')::boolean)
        and (p_command#>>'{filters,search}' is null or cc.id::text like '%'||(p_command#>>'{filters,search}')||'%' or cc.person_id::text like '%'||(p_command#>>'{filters,search}')||'%');
    data:=data||jsonb_build_object('operators',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name,'active',active) order by display_name),'[]') from public.patrimonial_operators));
  elsif m='person' then
    perform 1 from patrimonial_radar_private.persons where id=target and deleted_at is null for share;
    if not found then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
    data:=jsonb_build_object('id',target,'emailVerified',exists(select 1 from patrimonial_radar_private.verified_emails where person_id=target),'identityScope','MAILBOX_POSSESSION_ONLY',
      'assessments',(select coalesce(jsonb_agg(jsonb_build_object('id',ass.id,'caseId',cc.id,'status',ass.status,'createdAt',ass.created_at,'reportId',s.id,'reportRevision',s.approved_revision,'operatorId',it.current_operator_id,'assignmentRevision',it.operator_revision) order by ass.created_at desc),'[]')
        from patrimonial_radar_private.assessments ass join patrimonial_radar_private.cases cc on cc.assessment_id=ass.id join public.patrimonial_intents it on it.id=cc.intent_id left join patrimonial_radar_private.snapshots s on s.assessment_id=ass.id where ass.person_id=target),
      'funnelHistory',(select coalesce(jsonb_agg(jsonb_build_object('requestId',r.request_id,'source',r.mode,'receivedAt',r.received_at,'requestStatus',r.receipt_status,'reconciliation',rec.state,
        'participations',(select coalesce(jsonb_agg(jsonb_build_object('id',pt.id,'registrationStatus',pt.registration_status,'attendance',pt.attendance,'editionId',pt.edition_id)),'[]') from public.patrimonial_participations pt where pt.intent_id=r.intent_id))), '[]')
        from patrimonial_radar_private.reconciliations rec join public.patrimonial_requests r on r.request_id=rec.request_id where rec.person_id=target and rec.state='VERIFIED'),
      'assignmentHistory',(select coalesce(jsonb_agg(jsonb_build_object('id',aa.id,'operatorId',aa.operator_id,'assignedAt',aa.assigned_at,'releasedAt',aa.released_at,'releaseReason',aa.release_reason,'revision',aa.revision) order by aa.assigned_at),'[]')
        from public.patrimonial_assignments aa join patrimonial_radar_private.cases cc on cc.intent_id=aa.intent_id where cc.person_id=target));
  else
    select * into c from patrimonial_radar_private.cases where id=target;
    if not found then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
    perform 1 from patrimonial_radar_private.persons where id=c.person_id and deleted_at is null for share;
    if not found then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
    select * into i from public.patrimonial_intents where id=c.intent_id for update;
    select * into a from public.patrimonial_assignments where intent_id=i.id and released_at is null;
    if m='report' then
      if exists(select 1 from patrimonial_radar_private.verified_emails e join patrimonial_radar_private.mailbox_reviews m on m.email_key=e.email_key where e.person_id=c.person_id) then return jsonb_build_object('ok',false,'code','FORBIDDEN'); end if;
      perform 1 from public.patrimonial_operators where id=grant_row.operator_id and active for share;
      if not found then return jsonb_build_object('ok',false,'code','FORBIDDEN'); end if;
      if grant_row.operator_id is distinct from i.current_operator_id or a.operator_id is distinct from grant_row.operator_id
        or not exists(select 1 from public.patrimonial_operators where id=grant_row.operator_id and active) then
        insert into hub.patrimonial_radar_read_audit(actor_id,session_id,action,target_id,outcome) values(uid,sid,m,target,'DENIED');
        return jsonb_build_object('ok',false,'code','FORBIDDEN'); end if;
      select jsonb_build_object('personId',c.person_id,'assessmentId',c.assessment_id,'snapshot',patrimonial_radar_private.snapshot_json(c.assessment_id),
        'approvedInput',patrimonial_radar_private.assessment_json(c.assessment_id)->'input') into data;
      if data#>>'{snapshot,id}' is null then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
    else
      cmd:='radar-hub:'||uid::text||':'||(p_command->>'requestId');
      if p_command->>'requestId' !~ '^[a-f0-9-]{36}$' then return jsonb_build_object('ok',false,'code','INVALID'); end if;
      command_hash:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
      select * into saved from public.patrimonial_assignment_commands where command_key=cmd;
      if found then
        if saved.payload_hash<>command_hash then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
        return jsonb_build_object('ok',true,'data',saved.result);
      end if;
      if (p_command->>'expectedRevision')::integer is distinct from i.operator_revision then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
      if (m='assign' and a.id is not null) or (m in ('reassign','release') and a.id is null) then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
      if m<>'release' then select * into op from public.patrimonial_operators where id=(p_command->>'operatorId')::uuid and active for share;
        if not found then return jsonb_build_object('ok',false,'code','FORBIDDEN'); end if;
        if op.capacity is not null then
          select count(*) into active_total from public.patrimonial_assignments where operator_id=op.id and released_at is null;
          if a.operator_id=op.id then active_total:=active_total-1; end if;
          if active_total>=op.capacity then return jsonb_build_object('ok',false,'code','FORBIDDEN'); end if;
        end if;
      end if;
      if a.id is not null then writes:=writes||jsonb_build_array(jsonb_build_object('kind','release','value',jsonb_build_object('id',a.id,'expectedRevision',a.revision,'releasedAt',t,'releaseReason',case when m='release' then 'MANUAL_RELEASE' else 'REASSIGNED' end))); end if;
      if m<>'release' then writes:=writes||jsonb_build_array(jsonb_build_object('kind','assignment','value',jsonb_build_object('id',aid,'assignmentKey',cmd,'intentId',i.id,'operatorId',op.id,'assignmentMethod','MANUAL','assignedAt',t,'assignedByType','ADMIN','assignedByRef',uid,'commandKey',cmd,'revision',0,'metadata','{}'::jsonb,'createdAt',t))); end if;
      writes:=writes||jsonb_build_array(jsonb_build_object('kind','intentOperator','value',jsonb_build_object('id',i.id,'expectedRevision',i.operator_revision,'currentOperatorId',case when m='release' then null else op.id end,'businessRevision',i.revision)),
        jsonb_build_object('kind','event','value',jsonb_build_object('id',gen_random_uuid(),'eventKey',cmd,'name',case m when 'assign' then 'prospect_assigned' when 'reassign' then 'prospect_reassigned' else 'prospect_released' end,'intentId',i.id,'revision',i.operator_revision+1,'at',t,'actor',jsonb_build_object('type','ADMIN','ref',uid),'metadata',jsonb_build_object('assignmentId',case when m='release' then a.id else aid end,'revisionSpace','assignment'))));
      data:=jsonb_build_object('revision',i.operator_revision+1,'operatorId',case when m='release' then null else op.id end,'localState',case when m='release' then 'UNASSIGNED' else 'LOCAL_ASSIGNED' end);
      select revision into state_revision from public.patrimonial_assignment_state where singleton;
      perform public.patrimonial_assignment_commit(jsonb_build_object('commandKey',cmd,'payloadHash',command_hash,'result',data,'writes',writes,'at',t),state_revision);
      -- Validate P1's deferred cross-table invariant while still inside the narrow
      -- privileged function; never grant browser SELECT to satisfy its trigger.
      set constraints public.patrimonial_assignment_projection_consistent, public.patrimonial_intent_operator_consistent immediate;
      set constraints public.patrimonial_assignment_projection_consistent, public.patrimonial_intent_operator_consistent deferred;
    end if;
  end if;
  if grant_row.expires_at<=clock_timestamp() or not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=sid and s.user_id=uid and (s.not_after is null or s.not_after>clock_timestamp()) and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp()))
    then raise exception using errcode='PT403',message='RADAR_ACCESS_EXPIRED'; end if;
  insert into hub.patrimonial_radar_read_audit(actor_id,session_id,action,target_id,outcome,permission_revision,assignment_revision) values(uid,sid,m,target,'AUTHORIZED',grant_row.revision,i.operator_revision);
  return jsonb_build_object('ok',true,'data',data);
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then return jsonb_build_object('ok',false,'code','INVALID');
  when sqlstate 'PT403' then
    insert into hub.patrimonial_radar_read_audit(actor_id,session_id,action,target_id,outcome) values(uid,sid,m,target,'DENIED');
    return jsonb_build_object('ok',false,'code','FORBIDDEN');
end $$;

-- No direct client access to identities, grants, answers, snapshots or audit.
do $$ declare tab text; begin
  foreach tab in array array['cases','service_notice_acknowledgements','event_invitations','reconciliations','reconciliation_history','assessment_origins','mailbox_reviews','highlevel_bindings'] loop
    execute format('alter table patrimonial_radar_private.%I enable row level security',tab);
    execute format('alter table patrimonial_radar_private.%I force row level security',tab);
    execute format('revoke all on patrimonial_radar_private.%I from public,anon,authenticated',tab);
    execute format('grant select,insert on patrimonial_radar_private.%I to service_role',tab);
  end loop;
  foreach tab in array array['patrimonial_radar_permissions','patrimonial_radar_read_audit'] loop
    execute format('alter table hub.%I enable row level security',tab);
    execute format('alter table hub.%I force row level security',tab);
    execute format('revoke all on hub.%I from public,anon,authenticated,service_role',tab);
  end loop;
end $$;
grant update(state,revision,evidence_ref,updated_at) on patrimonial_radar_private.reconciliations to service_role;
grant update(revoked_at) on patrimonial_radar_private.event_invitations to service_role;
alter table patrimonial_radar_private.foundation_metadata_history enable row level security;
alter table patrimonial_radar_private.foundation_metadata_history force row level security;
revoke all on patrimonial_radar_private.foundation_metadata_history from public,anon,authenticated;
grant select,insert on patrimonial_radar_private.foundation_metadata_history to service_role;
revoke all on function patrimonial_radar_private.metadata_guard(),patrimonial_radar_private.foundation_append_only() from public,anon,authenticated;
grant usage,select on all sequences in schema patrimonial_radar_private to service_role;
revoke all on function hub.patrimonial_radar_command(jsonb) from public,anon,service_role;
grant usage on schema hub to authenticated;
grant execute on function hub.patrimonial_radar_command(jsonb) to authenticated;
revoke all on function public.patrimonial_radar_command(jsonb),public.patrimonial_radar_command_pre_5a(jsonb),public.patrimonial_foundation_command(jsonb),patrimonial_radar_private.open_case(),patrimonial_radar_private.reconciliation_guard() from public,anon,authenticated;
grant execute on function public.patrimonial_radar_command(jsonb),public.patrimonial_radar_command_pre_5a(jsonb),public.patrimonial_foundation_command(jsonb),patrimonial_radar_private.open_case(),patrimonial_radar_private.reconciliation_guard() to service_role;
commit;
