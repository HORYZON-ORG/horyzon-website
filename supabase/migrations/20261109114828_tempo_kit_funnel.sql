begin;
create table if not exists hub.tempo_kit_requests (
 request_id uuid primary key references hub.digital_inquiries(request_id) on delete cascade,
 category text not null check(category in ('email','docs','sales','calendar','ops','marketing','people','reports')),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<30000),
 email_state text not null default 'pending' check(email_state in ('pending','sending','retry','sent','needs_review')),
 attempts integer not null default 0,
 lease_token uuid, lease_until timestamptz,
 next_retry_at timestamptz not null default now(),
 provider_id text,created_at timestamptz not null default now(),sent_at timestamptz
);
alter table hub.tempo_kit_requests enable row level security;
revoke all on hub.tempo_kit_requests from public,anon,authenticated;
grant select,insert,update,delete on hub.tempo_kit_requests to service_role;
create index if not exists tempo_kit_pending_idx on hub.tempo_kit_requests(next_retry_at) where email_state in ('pending','retry','sending');
create or replace function hub.tempo_kit_submit_v1(p_request_id uuid,p_hash text,p_payload jsonb,p_bucket text,p_category text,p_snapshot jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare receipt jsonb;
begin
 if p_category not in ('email','docs','sales','calendar','ops','marketing','people','reports') or jsonb_typeof(p_snapshot)<>'object' or octet_length(p_snapshot::text)>30000 then raise exception 'DIGITAL_INVALID_INPUT'; end if;
 receipt:=hub.digital_intake_submit_v1(p_request_id,p_hash,p_payload,p_bucket);
 insert into hub.tempo_kit_requests(request_id,category,snapshot) values(p_request_id,p_category,p_snapshot) on conflict(request_id) do nothing;
 update hub.digital_inquiries set source='tempo-kit' where request_id=p_request_id;
 return receipt;
end; $$;
create or replace function hub.tempo_kit_email_claim_v1(p_request_id uuid default null)
returns table(request_id uuid,inquiry_id uuid,category text,snapshot jsonb,email text,first_name text,lease_token uuid,attempts integer,requested_at timestamptz)
language plpgsql set search_path='' as $$
declare target uuid; token uuid:=gen_random_uuid();
begin
 select q.request_id into target from hub.tempo_kit_requests q where (p_request_id is null or q.request_id=p_request_id)
 and q.attempts<6 and q.created_at>now()-interval '23 hours'
 and ((q.email_state in ('pending','retry') and q.next_retry_at<=now()) or (q.email_state='sending' and q.lease_until<now()))
 order by q.next_retry_at for update skip locked limit 1;
 if target is null then return; end if;
 update hub.tempo_kit_requests q set email_state='sending',attempts=q.attempts+1,lease_token=token,lease_until=now()+interval '2 minutes' where q.request_id=target;
 return query select q.request_id,i.id,q.category,q.snapshot,i.email,i.first_name,token,q.attempts,q.created_at from hub.tempo_kit_requests q join hub.digital_inquiries i on i.request_id=q.request_id where q.request_id=target;
end; $$;
create or replace function hub.tempo_kit_email_finish_v1(p_request_id uuid,p_token uuid,p_success boolean,p_provider_id text default null)
returns boolean language plpgsql set search_path='' as $$
begin
 update hub.tempo_kit_requests q set email_state=case when p_success then 'sent' when q.attempts>=6 then 'needs_review' else 'retry' end,
 provider_id=case when p_success then left(p_provider_id,100) else q.provider_id end,
 sent_at=case when p_success then now() else q.sent_at end,
 next_retry_at=now()+interval '5 minutes'*power(2,least(q.attempts,5)),lease_token=null,lease_until=null
 where q.request_id=p_request_id and q.lease_token=p_token and q.email_state='sending';
 return found;
end; $$;
revoke all on function hub.tempo_kit_submit_v1(uuid,text,jsonb,text,text,jsonb),hub.tempo_kit_email_claim_v1(uuid),hub.tempo_kit_email_finish_v1(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function hub.tempo_kit_submit_v1(uuid,text,jsonb,text,text,jsonb),hub.tempo_kit_email_claim_v1(uuid),hub.tempo_kit_email_finish_v1(uuid,uuid,boolean,text) to service_role;
commit;
