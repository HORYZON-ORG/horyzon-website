-- Annunci 10x Stripe commerce foundation.
-- Additive only. Do not enable checkout until this migration and Stripe config are live.

create table if not exists public.annunci10x_purchases (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  lead_id uuid not null references public.annunci10x_leads(id) on delete cascade,
  offer_code text not null,
  status text not null default 'PENDING',
  provider text not null default 'STRIPE',
  currency text not null default 'EUR',
  expected_amount_cents integer not null,
  stripe_price_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  checkout_created_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint annunci10x_purchases_offer_code check (offer_code in ('ANNUNCI10X_REWRITE', 'ANNUNCI10X_CREATE', 'AGENT_RECRUITER')),
  constraint annunci10x_purchases_status check (status in ('PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED')),
  constraint annunci10x_purchases_provider check (provider = 'STRIPE'),
  constraint annunci10x_purchases_currency check (currency = 'EUR'),
  constraint annunci10x_purchases_amount check (expected_amount_cents > 0),
  constraint annunci10x_purchases_paid check (status <> 'PAID' or paid_at is not null),
  constraint annunci10x_purchases_failed check (status <> 'FAILED' or failed_at is not null),
  constraint annunci10x_purchases_canceled check (status <> 'CANCELED' or canceled_at is not null),
  constraint annunci10x_purchases_refunded check (status <> 'REFUNDED' or refunded_at is not null)
);

create unique index if not exists annunci10x_purchases_checkout_session_uidx
  on public.annunci10x_purchases(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists annunci10x_purchases_payment_intent_uidx
  on public.annunci10x_purchases(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists annunci10x_purchases_one_pending_offer_idx
  on public.annunci10x_purchases(session_id, offer_code)
  where status = 'PENDING';

create index if not exists annunci10x_purchases_session_idx on public.annunci10x_purchases(session_id);
create index if not exists annunci10x_purchases_lead_idx on public.annunci10x_purchases(lead_id);
create index if not exists annunci10x_purchases_checkout_lookup_idx on public.annunci10x_purchases(stripe_checkout_session_id);
create index if not exists annunci10x_purchases_payment_lookup_idx on public.annunci10x_purchases(stripe_payment_intent_id);

create table if not exists public.annunci10x_entitlement_grants (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  lead_id uuid not null references public.annunci10x_leads(id) on delete cascade,
  purchase_id uuid not null references public.annunci10x_purchases(id) on delete cascade,
  capability text not null,
  quantity integer not null,
  created_at timestamptz not null default now(),
  constraint annunci10x_entitlement_grants_capability check (capability in ('REWRITE_CREDIT', 'CREATE_CREDIT', 'GUIDE_ACCESS', 'AGENT_RECRUITER_ACCESS')),
  constraint annunci10x_entitlement_grants_quantity check (quantity > 0),
  constraint annunci10x_entitlement_grants_unique unique (purchase_id, capability)
);

create index if not exists annunci10x_entitlement_grants_session_idx on public.annunci10x_entitlement_grants(session_id);
create index if not exists annunci10x_entitlement_grants_lead_idx on public.annunci10x_entitlement_grants(lead_id);
create index if not exists annunci10x_entitlement_grants_purchase_idx on public.annunci10x_entitlement_grants(purchase_id);

create table if not exists public.annunci10x_stripe_events (
  id uuid primary key default extensions.gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  object_id text,
  status text not null default 'RECEIVED',
  error_code text,
  attempt_count integer not null default 0,
  processing_started_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint annunci10x_stripe_events_status check (status in ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED')),
  constraint annunci10x_stripe_events_attempts check (attempt_count >= 0)
);

create index if not exists annunci10x_stripe_events_event_id_idx on public.annunci10x_stripe_events(stripe_event_id);
create index if not exists annunci10x_stripe_events_object_idx on public.annunci10x_stripe_events(object_id);

alter table public.annunci10x_purchases enable row level security;
alter table public.annunci10x_entitlement_grants enable row level security;
alter table public.annunci10x_stripe_events enable row level security;

create or replace function public.annunci10x_create_or_get_purchase(
  p_session_id uuid,
  p_owner_secret_hash text,
  p_lead_id uuid,
  p_offer_code text,
  p_expected_amount_cents integer,
  p_currency text,
  p_stripe_price_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.annunci10x_sessions%rowtype;
  v_lead public.annunci10x_leads%rowtype;
  v_purchase public.annunci10x_purchases%rowtype;
  v_now timestamptz := now();
begin
  if not public.annunci10x_verify_session_secret(p_session_id, p_owner_secret_hash) then
    raise exception 'session ownership verification failed';
  end if;

  select * into v_session from public.annunci10x_sessions where id = p_session_id for update;
  if v_session.id is null or (v_session.expires_at is not null and v_session.expires_at <= v_now) then
    raise exception 'session expired or missing';
  end if;

  select * into v_lead
  from public.annunci10x_leads
  where id = p_lead_id and session_id = p_session_id
  for update;

  if v_lead.id is null or v_lead.email_verified_at is null then
    raise exception 'verified lead required';
  end if;

  if p_offer_code not in ('ANNUNCI10X_REWRITE', 'ANNUNCI10X_CREATE', 'AGENT_RECRUITER') then
    raise exception 'invalid offer code';
  end if;

  select * into v_purchase
  from public.annunci10x_purchases
  where session_id = p_session_id
    and offer_code = p_offer_code
    and status = 'PENDING'
  for update;

  if v_purchase.id is not null then
    return to_jsonb(v_purchase);
  end if;

  insert into public.annunci10x_purchases (
    session_id, lead_id, offer_code, status, provider, currency, expected_amount_cents, stripe_price_id
  )
  values (
    p_session_id, p_lead_id, p_offer_code, 'PENDING', 'STRIPE', p_currency, p_expected_amount_cents, p_stripe_price_id
  )
  returning * into v_purchase;

  return to_jsonb(v_purchase);
end;
$$;

create or replace function public.annunci10x_attach_checkout_session(
  p_purchase_id uuid,
  p_owner_secret_hash text,
  p_stripe_checkout_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_purchase public.annunci10x_purchases%rowtype;
  v_now timestamptz := now();
begin
  select p.* into v_purchase
  from public.annunci10x_purchases p
  join public.annunci10x_sessions s on s.id = p.session_id
  where p.id = p_purchase_id
    and s.owner_secret_hash = p_owner_secret_hash
  for update of p;

  if v_purchase.id is null or v_purchase.status <> 'PENDING' then
    raise exception 'pending purchase not found';
  end if;

  if v_purchase.stripe_checkout_session_id is not null and v_purchase.stripe_checkout_session_id <> p_stripe_checkout_session_id then
    raise exception 'different checkout session already attached';
  end if;

  update public.annunci10x_purchases
  set stripe_checkout_session_id = p_stripe_checkout_session_id,
      checkout_created_at = coalesce(checkout_created_at, v_now),
      updated_at = v_now
  where id = p_purchase_id
  returning * into v_purchase;

  return to_jsonb(v_purchase);
end;
$$;

create or replace function public.annunci10x_claim_stripe_event(
  p_stripe_event_id text,
  p_event_type text,
  p_object_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.annunci10x_stripe_events%rowtype;
  v_now timestamptz := now();
begin
  insert into public.annunci10x_stripe_events (stripe_event_id, event_type, object_id, status)
  values (p_stripe_event_id, p_event_type, p_object_id, 'RECEIVED')
  on conflict (stripe_event_id) do nothing;

  select * into v_event
  from public.annunci10x_stripe_events
  where stripe_event_id = p_stripe_event_id
  for update;

  if v_event.status in ('PROCESSED', 'IGNORED')
    or v_event.attempt_count >= 5
    or (v_event.status = 'RECEIVED' and v_event.processing_started_at is not null and v_event.processing_started_at > v_now - interval '120 seconds') then
    return null;
  end if;

  update public.annunci10x_stripe_events
  set status = 'RECEIVED',
      event_type = p_event_type,
      object_id = coalesce(p_object_id, object_id),
      attempt_count = attempt_count + 1,
      processing_started_at = v_now,
      error_code = null
  where id = v_event.id
  returning * into v_event;

  return to_jsonb(v_event);
end;
$$;

create or replace function public.annunci10x_mark_stripe_event(
  p_stripe_event_id text,
  p_status text,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.annunci10x_stripe_events%rowtype;
begin
  if p_status not in ('PROCESSED', 'IGNORED', 'FAILED') then
    raise exception 'invalid stripe event status';
  end if;

  update public.annunci10x_stripe_events
  set status = p_status,
      error_code = left(p_error_code, 80),
      processed_at = case when p_status in ('PROCESSED', 'IGNORED') then now() else processed_at end,
      processing_started_at = case when p_status = 'FAILED' then processing_started_at else null end
  where stripe_event_id = p_stripe_event_id
  returning * into v_event;

  if v_event.id is null then
    raise exception 'stripe event not found';
  end if;

  return to_jsonb(v_event);
end;
$$;

create or replace function public.annunci10x_complete_paid_purchase(
  p_purchase_id uuid,
  p_stripe_checkout_session_id text,
  p_amount_cents integer,
  p_currency text,
  p_stripe_payment_intent_id text,
  p_stripe_customer_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_purchase public.annunci10x_purchases%rowtype;
  v_now timestamptz := now();
begin
  select * into v_purchase
  from public.annunci10x_purchases
  where id = p_purchase_id
  for update;

  if v_purchase.id is null
    or v_purchase.stripe_checkout_session_id <> p_stripe_checkout_session_id
    or v_purchase.expected_amount_cents <> p_amount_cents
    or lower(v_purchase.currency) <> lower(p_currency)
    or v_purchase.status not in ('PENDING', 'PAID') then
    raise exception 'paid purchase verification failed';
  end if;

  update public.annunci10x_purchases
  set status = 'PAID',
      paid_at = coalesce(paid_at, v_now),
      stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id),
      stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
      updated_at = v_now
  where id = p_purchase_id
  returning * into v_purchase;

  if v_purchase.offer_code = 'ANNUNCI10X_REWRITE' then
    insert into public.annunci10x_entitlement_grants(session_id, lead_id, purchase_id, capability, quantity)
    values (v_purchase.session_id, v_purchase.lead_id, v_purchase.id, 'REWRITE_CREDIT', 1)
    on conflict (purchase_id, capability) do nothing;
  elsif v_purchase.offer_code = 'ANNUNCI10X_CREATE' then
    insert into public.annunci10x_entitlement_grants(session_id, lead_id, purchase_id, capability, quantity)
    values (v_purchase.session_id, v_purchase.lead_id, v_purchase.id, 'CREATE_CREDIT', 1)
    on conflict (purchase_id, capability) do nothing;
  elsif v_purchase.offer_code = 'AGENT_RECRUITER' then
    insert into public.annunci10x_entitlement_grants(session_id, lead_id, purchase_id, capability, quantity)
    values
      (v_purchase.session_id, v_purchase.lead_id, v_purchase.id, 'GUIDE_ACCESS', 1),
      (v_purchase.session_id, v_purchase.lead_id, v_purchase.id, 'AGENT_RECRUITER_ACCESS', 1)
    on conflict (purchase_id, capability) do nothing;
  end if;

  return to_jsonb(v_purchase);
end;
$$;

create or replace function public.annunci10x_mark_purchase_canceled(p_stripe_checkout_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_purchase public.annunci10x_purchases%rowtype;
begin
  select * into v_purchase from public.annunci10x_purchases where stripe_checkout_session_id = p_stripe_checkout_session_id for update;
  if v_purchase.id is null then return null; end if;
  if v_purchase.status = 'PENDING' then
    update public.annunci10x_purchases set status = 'CANCELED', canceled_at = now(), updated_at = now() where id = v_purchase.id returning * into v_purchase;
  end if;
  return to_jsonb(v_purchase);
end;
$$;

create or replace function public.annunci10x_mark_purchase_failed(p_stripe_payment_intent_id text, p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_purchase public.annunci10x_purchases%rowtype;
begin
  select * into v_purchase
  from public.annunci10x_purchases
  where (p_purchase_id is not null and id = p_purchase_id)
     or (p_purchase_id is null and stripe_payment_intent_id = p_stripe_payment_intent_id)
  for update;
  if v_purchase.id is null then return null; end if;
  if v_purchase.status = 'PENDING' then
    update public.annunci10x_purchases
    set status = 'FAILED', stripe_payment_intent_id = p_stripe_payment_intent_id, failed_at = now(), updated_at = now()
    where id = v_purchase.id returning * into v_purchase;
  end if;
  return to_jsonb(v_purchase);
end;
$$;

create or replace function public.annunci10x_mark_purchase_refunded(p_stripe_payment_intent_id text, p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_purchase public.annunci10x_purchases%rowtype;
begin
  select * into v_purchase
  from public.annunci10x_purchases
  where (p_purchase_id is not null and id = p_purchase_id)
     or (p_purchase_id is null and stripe_payment_intent_id = p_stripe_payment_intent_id)
  for update;
  if v_purchase.id is null then return null; end if;
  if v_purchase.status = 'PAID' then
    update public.annunci10x_purchases
    set status = 'REFUNDED', stripe_payment_intent_id = p_stripe_payment_intent_id, refunded_at = now(), updated_at = now()
    where id = v_purchase.id returning * into v_purchase;
  end if;
  return to_jsonb(v_purchase);
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

  select
    coalesce(sum(case when g.capability = 'REWRITE_CREDIT' then g.quantity else 0 end), 0)::integer,
    coalesce(sum(case when g.capability = 'CREATE_CREDIT' then g.quantity else 0 end), 0)::integer,
    coalesce(bool_or(g.capability = 'GUIDE_ACCESS'), false),
    coalesce(bool_or(g.capability = 'AGENT_RECRUITER_ACCESS'), false)
  into v_rewrite, v_create, v_guide, v_agent
  from public.annunci10x_entitlement_grants g
  join public.annunci10x_purchases p on p.id = g.purchase_id
  where g.session_id = p_session_id
    and p.status = 'PAID';

  return jsonb_build_object(
    'rewrite_credits', v_rewrite,
    'create_credits', v_create,
    'guide_access', v_guide,
    'agent_recruiter_access', v_agent,
    'checked_at', now()
  );
end;
$$;

comment on table public.annunci10x_purchases is 'Annunci 10x Stripe purchase state. Server-authoritative price and offer only.';
comment on table public.annunci10x_entitlement_grants is 'Append-only Annunci 10x entitlement grants created by paid purchases.';
comment on table public.annunci10x_stripe_events is 'Stripe webhook idempotency state. Full Stripe event bodies are intentionally not stored.';

revoke all on table public.annunci10x_purchases from public, anon, authenticated;
revoke all on table public.annunci10x_entitlement_grants from public, anon, authenticated;
revoke all on table public.annunci10x_stripe_events from public, anon, authenticated;

grant select, insert, update on table public.annunci10x_purchases to service_role;
grant select, insert on table public.annunci10x_entitlement_grants to service_role;
grant select, insert, update on table public.annunci10x_stripe_events to service_role;

revoke all on function public.annunci10x_create_or_get_purchase(uuid, text, uuid, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.annunci10x_attach_checkout_session(uuid, text, text) from public, anon, authenticated;
revoke all on function public.annunci10x_claim_stripe_event(text, text, text) from public, anon, authenticated;
revoke all on function public.annunci10x_mark_stripe_event(text, text, text) from public, anon, authenticated;
revoke all on function public.annunci10x_complete_paid_purchase(uuid, text, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.annunci10x_mark_purchase_canceled(text) from public, anon, authenticated;
revoke all on function public.annunci10x_mark_purchase_failed(text, uuid) from public, anon, authenticated;
revoke all on function public.annunci10x_mark_purchase_refunded(text, uuid) from public, anon, authenticated;
revoke all on function public.annunci10x_get_effective_entitlements(uuid, text) from public, anon, authenticated;

grant execute on function public.annunci10x_create_or_get_purchase(uuid, text, uuid, text, integer, text, text) to service_role;
grant execute on function public.annunci10x_attach_checkout_session(uuid, text, text) to service_role;
grant execute on function public.annunci10x_claim_stripe_event(text, text, text) to service_role;
grant execute on function public.annunci10x_mark_stripe_event(text, text, text) to service_role;
grant execute on function public.annunci10x_complete_paid_purchase(uuid, text, integer, text, text, text) to service_role;
grant execute on function public.annunci10x_mark_purchase_canceled(text) to service_role;
grant execute on function public.annunci10x_mark_purchase_failed(text, uuid) to service_role;
grant execute on function public.annunci10x_mark_purchase_refunded(text, uuid) to service_role;
grant execute on function public.annunci10x_get_effective_entitlements(uuid, text) to service_role;

notify pgrst, 'reload schema';
