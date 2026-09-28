create table if not exists public.annunci10x_credit_reservations (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  grant_id uuid not null references public.annunci10x_entitlement_grants(id) on delete cascade,
  capability text not null,
  status text not null,
  quantity integer not null default 1,
  lease_expires_at timestamptz not null,
  output_id uuid null references public.annunci10x_outputs(id) on delete set null,
  release_reason_code text null,
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz null,
  released_at timestamptz null,
  expired_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint annunci10x_credit_reservations_capability_check check (capability in ('REWRITE_CREDIT', 'CREATE_CREDIT')),
  constraint annunci10x_credit_reservations_status_check check (status in ('RESERVED', 'CONSUMED', 'RELEASED', 'EXPIRED')),
  constraint annunci10x_credit_reservations_quantity_check check (quantity = 1),
  constraint annunci10x_credit_reservations_timestamps_check check (
    (status <> 'CONSUMED' or consumed_at is not null)
    and (status <> 'RELEASED' or released_at is not null)
    and (status <> 'EXPIRED' or expired_at is not null)
  )
);

create index if not exists annunci10x_credit_reservations_session_idx
  on public.annunci10x_credit_reservations(session_id);

create index if not exists annunci10x_credit_reservations_grant_idx
  on public.annunci10x_credit_reservations(grant_id);

create index if not exists annunci10x_credit_reservations_status_lease_idx
  on public.annunci10x_credit_reservations(status, lease_expires_at);

create index if not exists annunci10x_credit_reservations_output_idx
  on public.annunci10x_credit_reservations(output_id);

create unique index if not exists annunci10x_credit_reservations_active_session_capability_uidx
  on public.annunci10x_credit_reservations(session_id, capability)
  where status = 'RESERVED';

create unique index if not exists annunci10x_credit_reservations_output_uidx
  on public.annunci10x_credit_reservations(output_id)
  where output_id is not null;

alter table public.annunci10x_credit_reservations enable row level security;

create or replace function public.annunci10x_reserve_generation_credit(
  p_session_id uuid,
  p_owner_secret_hash text,
  p_capability text,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.annunci10x_sessions%rowtype;
  v_lead public.annunci10x_leads%rowtype;
  v_reservation public.annunci10x_credit_reservations%rowtype;
  v_grant public.annunci10x_entitlement_grants%rowtype;
  v_now timestamptz := now();
begin
  if p_capability not in ('REWRITE_CREDIT', 'CREATE_CREDIT') then
    raise exception 'invalid generation credit capability';
  end if;

  if p_lease_seconds < 60 or p_lease_seconds > 1800 then
    raise exception 'generation credit lease out of range';
  end if;

  select * into v_session
  from public.annunci10x_sessions
  where id = p_session_id
    and owner_secret_hash = p_owner_secret_hash
  for update;

  if v_session.id is null or (v_session.expires_at is not null and v_session.expires_at <= v_now) then
    raise exception 'session ownership verification failed';
  end if;

  select * into v_lead
  from public.annunci10x_leads
  where session_id = p_session_id
  for update;

  if v_lead.id is null or v_lead.email_verified_at is null then
    raise exception 'verified lead required';
  end if;

  update public.annunci10x_credit_reservations
  set status = 'EXPIRED',
      expired_at = coalesce(expired_at, v_now),
      updated_at = v_now
  where session_id = p_session_id
    and capability = p_capability
    and status = 'RESERVED'
    and lease_expires_at <= v_now;

  select * into v_reservation
  from public.annunci10x_credit_reservations
  where session_id = p_session_id
    and capability = p_capability
    and status = 'RESERVED'
    and lease_expires_at > v_now
  for update;

  if v_reservation.id is not null then
    return to_jsonb(v_reservation);
  end if;

  if v_session.flow = 'ANALYZE' then
    if p_capability <> 'REWRITE_CREDIT' then
      raise exception 'ANALYZE sessions can reserve only REWRITE_CREDIT';
    end if;
    if not exists (
      select 1
      from public.annunci10x_analysis_runs ar
      where ar.session_id = p_session_id
        and ar.status = 'READY'
        and ar.source_status = 'READY'
        and ar.evaluation_id is not null
    ) then
      raise exception 'READY analysis run required';
    end if;
  elsif v_session.flow = 'CREATE' then
    if p_capability <> 'CREATE_CREDIT' then
      raise exception 'CREATE sessions can reserve only CREATE_CREDIT';
    end if;
    if v_session.state not in ('PAYMENT_REQUIRED', 'ENTITLED', 'OUTPUT_READY', 'NEEDS_VERIFICATION') then
      raise exception 'CREATE session is not ready for generation credit reservation';
    end if;
    if not exists (
      select 1
      from public.annunci10x_snapshots s
      where s.session_id = p_session_id
    ) then
      raise exception 'CREATE snapshot required';
    end if;
  else
    raise exception 'unsupported generation credit flow';
  end if;

  select g.* into v_grant
  from public.annunci10x_entitlement_grants g
  join public.annunci10x_purchases p on p.id = g.purchase_id
  where g.session_id = p_session_id
    and g.capability = p_capability
    and p.status = 'PAID'
    and greatest(
      g.quantity - coalesce((
        select sum(r.quantity)::integer
        from public.annunci10x_credit_reservations r
        where r.grant_id = g.id
          and (
            r.status = 'CONSUMED'
            or (r.status = 'RESERVED' and r.lease_expires_at > v_now)
          )
      ), 0),
      0
    ) > 0
  order by g.created_at asc
  for update of g
  limit 1;

  if v_grant.id is null then
    return null;
  end if;

  insert into public.annunci10x_credit_reservations (
    session_id,
    grant_id,
    capability,
    status,
    quantity,
    lease_expires_at,
    reserved_at,
    created_at,
    updated_at
  )
  values (
    p_session_id,
    v_grant.id,
    p_capability,
    'RESERVED',
    1,
    v_now + (p_lease_seconds || ' seconds')::interval,
    v_now,
    v_now,
    v_now
  )
  returning * into v_reservation;

  return to_jsonb(v_reservation);
end;
$$;

create or replace function public.annunci10x_consume_generation_credit(
  p_reservation_id uuid,
  p_owner_secret_hash text,
  p_output_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_reservation public.annunci10x_credit_reservations%rowtype;
  v_output public.annunci10x_outputs%rowtype;
  v_purchase public.annunci10x_purchases%rowtype;
  v_now timestamptz := now();
begin
  select r.* into v_reservation
  from public.annunci10x_credit_reservations r
  join public.annunci10x_sessions s on s.id = r.session_id
  where r.id = p_reservation_id
    and s.owner_secret_hash = p_owner_secret_hash
  for update of r;

  if v_reservation.id is null then
    raise exception 'generation credit reservation not found';
  end if;

  if v_reservation.status = 'CONSUMED' then
    if v_reservation.output_id = p_output_id then
      return to_jsonb(v_reservation);
    end if;
    raise exception 'generation credit reservation already consumed by a different output';
  end if;

  if v_reservation.status in ('RELEASED', 'EXPIRED') then
    raise exception 'generation credit reservation is not consumable';
  end if;

  if v_reservation.lease_expires_at <= v_now then
    update public.annunci10x_credit_reservations
    set status = 'EXPIRED',
        expired_at = coalesce(expired_at, v_now),
        updated_at = v_now
    where id = v_reservation.id
    returning * into v_reservation;
    raise exception 'generation credit reservation expired';
  end if;

  select * into v_output
  from public.annunci10x_outputs
  where id = p_output_id
  for update;

  if v_output.id is null or v_output.session_id <> v_reservation.session_id then
    raise exception 'generation output does not belong to reserved session';
  end if;

  select p.* into v_purchase
  from public.annunci10x_entitlement_grants g
  join public.annunci10x_purchases p on p.id = g.purchase_id
  where g.id = v_reservation.grant_id
  for update of p;

  if v_purchase.id is null or v_purchase.status <> 'PAID' then
    raise exception 'paid purchase required to consume generation credit';
  end if;

  update public.annunci10x_credit_reservations
  set status = 'CONSUMED',
      output_id = p_output_id,
      consumed_at = v_now,
      updated_at = v_now
  where id = v_reservation.id
  returning * into v_reservation;

  return to_jsonb(v_reservation);
end;
$$;

create or replace function public.annunci10x_release_generation_credit(
  p_reservation_id uuid,
  p_owner_secret_hash text,
  p_reason_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_reservation public.annunci10x_credit_reservations%rowtype;
  v_reason text;
  v_now timestamptz := now();
begin
  select r.* into v_reservation
  from public.annunci10x_credit_reservations r
  join public.annunci10x_sessions s on s.id = r.session_id
  where r.id = p_reservation_id
    and s.owner_secret_hash = p_owner_secret_hash
  for update of r;

  if v_reservation.id is null then
    raise exception 'generation credit reservation not found';
  end if;

  if v_reservation.status = 'CONSUMED' then
    raise exception 'consumed generation credit cannot be released';
  end if;

  if v_reservation.status in ('RELEASED', 'EXPIRED') then
    return to_jsonb(v_reservation);
  end if;

  v_reason := left(regexp_replace(coalesce(p_reason_code, 'UNSPECIFIED'), '[^A-Za-z0-9_.:-]', '_', 'g'), 80);
  if v_reason = '' then
    v_reason := 'UNSPECIFIED';
  end if;

  update public.annunci10x_credit_reservations
  set status = 'RELEASED',
      release_reason_code = v_reason,
      released_at = v_now,
      updated_at = v_now
  where id = v_reservation.id
  returning * into v_reservation;

  return to_jsonb(v_reservation);
end;
$$;

create or replace function public.annunci10x_get_effective_entitlements(
  p_session_id uuid,
  p_owner_secret_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rewrite integer := 0;
  v_create integer := 0;
  v_guide boolean := false;
  v_agent boolean := false;
begin
  if not public.annunci10x_verify_session_secret(p_session_id, p_owner_secret_hash) then
    raise exception 'session ownership verification failed';
  end if;

  with paid_grants as (
    select
      g.id,
      g.capability,
      g.quantity,
      greatest(
        g.quantity - coalesce((
          select sum(r.quantity)::integer
          from public.annunci10x_credit_reservations r
          where r.grant_id = g.id
            and (
              r.status = 'CONSUMED'
              or (r.status = 'RESERVED' and r.lease_expires_at > now())
            )
        ), 0),
        0
      ) as available_quantity
    from public.annunci10x_entitlement_grants g
    join public.annunci10x_purchases p on p.id = g.purchase_id
    where g.session_id = p_session_id
      and p.status = 'PAID'
  )
  select
    coalesce(sum(case when capability = 'REWRITE_CREDIT' then available_quantity else 0 end), 0)::integer,
    coalesce(sum(case when capability = 'CREATE_CREDIT' then available_quantity else 0 end), 0)::integer,
    coalesce(bool_or(capability = 'GUIDE_ACCESS' and quantity > 0), false),
    coalesce(bool_or(capability = 'AGENT_RECRUITER_ACCESS' and quantity > 0), false)
  into v_rewrite, v_create, v_guide, v_agent
  from paid_grants;

  return jsonb_build_object(
    'rewrite_credits', v_rewrite,
    'create_credits', v_create,
    'guide_access', v_guide,
    'agent_recruiter_access', v_agent,
    'checked_at', now()
  );
end;
$$;

comment on table public.annunci10x_credit_reservations is 'Annunci 10x server-side ledger for one-credit generation reservations. Contains no lead PII, Stripe raw data, prompts, or job-ad text.';

revoke all on table public.annunci10x_credit_reservations from public, anon, authenticated;
grant select, insert, update on table public.annunci10x_credit_reservations to service_role;

revoke all on function public.annunci10x_reserve_generation_credit(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.annunci10x_consume_generation_credit(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.annunci10x_release_generation_credit(uuid, text, text) from public, anon, authenticated;
revoke all on function public.annunci10x_get_effective_entitlements(uuid, text) from public, anon, authenticated;

grant execute on function public.annunci10x_reserve_generation_credit(uuid, text, text, integer) to service_role;
grant execute on function public.annunci10x_consume_generation_credit(uuid, text, uuid) to service_role;
grant execute on function public.annunci10x_release_generation_credit(uuid, text, text) to service_role;
grant execute on function public.annunci10x_get_effective_entitlements(uuid, text) to service_role;

notify pgrst, 'reload schema';
