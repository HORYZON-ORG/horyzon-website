-- Horyzon live webinar: 9 December 2026 21:00-22:00 Europe/Rome.
-- Three legacy registrations were test requests: do not backfill or email them.
INSERT INTO public.patrimonial_event_editions
 (edition_key,event_slug,title_snapshot,starts_at,ends_at,timezone,status,capacity,access_mode,revision,record)
 VALUES (
 'qclbnd_20261209_2100','quello-che-le-banche-non-dicono','Quello che le banche non dicono',
 '2026-12-09 20:00:00+00'::timestamptz,'2026-12-09 21:00:00+00'::timestamptz,
 'Europe/Rome','ACTIVE',NULL,'ONLINE',1,
 '{"sessions":[{"startsAt":"2026-12-09T20:00:00+00:00","endsAt":"2026-12-09T21:00:00+00:00"}],"durationMinutes":60,"liveQuestions":true,"linkStatus":"AWAITING_ORGANIZER"}'::jsonb
 ) ON CONFLICT (edition_key) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS patrimonial_event_one_confirmed_contact_per_edition
 ON public.patrimonial_contact_event_registrations(contact_id,edition_ref)
 WHERE edition_ref IS NOT NULL AND registration_status='CONFIRMED';

CREATE TABLE IF NOT EXISTS public.patrimonial_event_reminder_deliveries (
 registration_id uuid NOT NULL REFERENCES public.patrimonial_contact_event_registrations(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('DAY_BEFORE','HALF_HOUR')),
 send_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENDING','FAILED','SCHEDULED')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
 lease_token uuid NULL, lease_until timestamptz NULL, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 scheduled_at timestamptz NULL, provider_message_id text NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(registration_id,kind)
);
ALTER TABLE public.patrimonial_event_reminder_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patrimonial_event_reminder_deliveries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.patrimonial_event_reminder_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.patrimonial_event_reminder_enqueue() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $fn$
DECLARE v_start timestamptz; v_day timestamptz; v_half timestamptz;
BEGIN
 IF new.source_path<>'/evento/quello-che-le-banche-non-dicono'
 OR new.registration_status<>'CONFIRMED' OR new.edition_ref IS NULL THEN RETURN new; END IF;
 SELECT starts_at INTO v_start FROM public.patrimonial_event_editions
 WHERE edition_key=new.edition_ref AND status='ACTIVE' AND starts_at>now()
 AND event_slug='quello-che-le-banche-non-dicono';
 IF v_start IS NULL THEN RETURN new; END IF;
 v_day:=v_start-interval '1 day'; v_half:=v_start-interval '30 minutes';
 IF v_day > greatest(new.registered_at,now())+interval '1 minute' THEN
  INSERT INTO public.patrimonial_event_reminder_deliveries(registration_id,kind,send_at)
  VALUES(new.id,'DAY_BEFORE',v_day) ON CONFLICT DO NOTHING;
 END IF;
 IF v_half > greatest(new.registered_at,now())+interval '1 minute' THEN
  INSERT INTO public.patrimonial_event_reminder_deliveries(registration_id,kind,send_at)
  VALUES(new.id,'HALF_HOUR',v_half) ON CONFLICT DO NOTHING;
 END IF;
 RETURN new;
END $fn$;

DROP TRIGGER IF EXISTS trg_patrimonial_event_reminder_enqueue ON public.patrimonial_contact_event_registrations;
CREATE TRIGGER trg_patrimonial_event_reminder_enqueue
 AFTER INSERT OR UPDATE OF edition_ref,registration_status ON public.patrimonial_contact_event_registrations
 FOR EACH ROW EXECUTE FUNCTION public.patrimonial_event_reminder_enqueue();

CREATE OR REPLACE FUNCTION public.patrimonial_event_reminder_claim(p_registration_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $fn$
DECLARE chosen record; token uuid;
BEGIN
 SELECT d.registration_id,d.kind,d.send_at,c.email,c.full_name INTO chosen
 FROM public.patrimonial_event_reminder_deliveries d
 JOIN public.patrimonial_contact_event_registrations r ON r.id=d.registration_id
 JOIN public.patrimonial_contacts c ON c.id=r.contact_id
 JOIN public.patrimonial_event_editions e ON e.edition_key=r.edition_ref
 WHERE (p_registration_id IS NULL OR d.registration_id=p_registration_id)
 AND (d.status IN ('PENDING','FAILED') OR (d.status='SENDING' AND d.lease_until<now()))
 AND d.attempt_count<8 AND d.next_attempt_at<=now()
 AND d.send_at>now()+interval '1 minute' AND d.send_at<=now()+interval '29 days'
 AND r.registered_at<d.send_at AND r.registration_status='CONFIRMED'
 AND e.status='ACTIVE' AND e.starts_at>now()
 AND c.email IS NOT NULL AND c.email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 ORDER BY d.send_at,d.registration_id,d.kind LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN RETURN null; END IF;
 token:=gen_random_uuid();
 UPDATE public.patrimonial_event_reminder_deliveries
 SET status='SENDING',attempt_count=attempt_count+1,lease_token=token,
 lease_until=now()+interval '2 minutes',updated_at=now()
 WHERE registration_id=chosen.registration_id AND kind=chosen.kind;
 RETURN jsonb_build_object('registrationId',chosen.registration_id,'kind',chosen.kind,
 'recipient',chosen.email,'firstName',split_part(chosen.full_name,' ',1),
 'leaseToken',token,'sendAt',chosen.send_at);
END $fn$;

CREATE OR REPLACE FUNCTION public.patrimonial_event_reminder_finish(
 p_registration_id uuid,p_kind text,p_lease_token uuid,p_success boolean,p_provider_message_id text DEFAULT NULL)
 RETURNS boolean LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $fn$
BEGIN
 UPDATE public.patrimonial_event_reminder_deliveries
 SET status=CASE WHEN p_success THEN 'SCHEDULED' ELSE 'FAILED' END,
 scheduled_at=CASE WHEN p_success THEN now() ELSE NULL END,
 next_attempt_at=CASE WHEN p_success THEN next_attempt_at
   ELSE now()+make_interval(secs=>least(3600,60*(2^least(attempt_count,6))::integer)) END,
 provider_message_id=CASE WHEN p_success THEN left(p_provider_message_id,200) ELSE provider_message_id END,
 lease_until=NULL,lease_token=NULL,updated_at=now()
 WHERE registration_id=p_registration_id AND kind=p_kind AND status='SENDING' AND lease_token=p_lease_token;
 RETURN FOUND;
END $fn$;

REVOKE ALL ON FUNCTION public.patrimonial_event_reminder_claim(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.patrimonial_event_reminder_finish(uuid,text,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.patrimonial_event_reminder_claim(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.patrimonial_event_reminder_finish(uuid,text,uuid,boolean,text) TO service_role;
REVOKE ALL ON FUNCTION public.patrimonial_event_reminder_enqueue() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION architetti_private.ingest_event(p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  identity_receipt jsonb;
  v_contact uuid;
  v_old public.patrimonial_contact_event_registrations;
  v_key text;
  v_hash text;
  v_inserted uuid;
  v_utm jsonb;
  v_qualification jsonb;
BEGIN
  IF p_event IS NULL OR jsonb_typeof(p_event)<>'object' OR pg_column_size(p_event)>10000
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_event) AS keys(k) WHERE k NOT IN (
      'eventId','locationId','externalContactId','fullName','email','phone','source',
      'sourcePath','editionId','province','profile','message','utm','marketingConsent',
      'privacyVersion','consent','qualification'))
    OR coalesce(p_event->>'sourcePath','') NOT IN ('/benessere-patrimoniale/evento','/evento/quello-che-le-banche-non-dicono')
    OR p_event->'consent' IS DISTINCT FROM 'true'::jsonb
    OR jsonb_typeof(p_event->'marketingConsent') IS DISTINCT FROM 'boolean'
  THEN RAISE EXCEPTION 'EVENT_INGRESS_INVALID_INPUT'; END IF;
  v_key := p_event->>'eventId';
  IF v_key IS NULL OR v_key !~ '^[a-zA-Z0-9_.:-]{1,200}$'
    OR length(coalesce(p_event->>'province',''))>80
    OR length(coalesce(p_event->>'profile',''))>120
    OR length(coalesce(p_event->>'message',''))>1500
    OR length(coalesce(p_event->>'privacyVersion',''))>100
    OR (p_event->>'editionId' IS NOT NULL AND p_event->>'editionId' !~ '^[a-zA-Z0-9_-]{1,100}$')
  THEN RAISE EXCEPTION 'EVENT_INGRESS_INVALID_INPUT'; END IF;
  -- Future approved event must match the official one-hour webinar.
  IF p_event->>'sourcePath' = '/evento/quello-che-le-banche-non-dicono' AND NOT EXISTS (
    SELECT 1 FROM public.patrimonial_event_editions e
    WHERE e.edition_key = p_event->>'editionId'
      AND e.event_slug = 'quello-che-le-banche-non-dicono'
      AND e.status = 'ACTIVE' AND e.starts_at > now()
      AND e.starts_at = '2026-12-09 20:00:00+00'::timestamptz
      AND e.ends_at = '2026-12-09 21:00:00+00'::timestamptz
      AND jsonb_typeof(e.record->'sessions')='array'
      AND jsonb_array_length(e.record->'sessions')=1
  ) THEN RAISE EXCEPTION 'EVENT_EDITION_UNAVAILABLE'; END IF;
  v_utm := coalesce(p_event->'utm','{}'::jsonb);
  v_qualification := p_event->'qualification';
  IF jsonb_typeof(v_utm)<>'object' OR pg_column_size(v_utm)>1024
    OR EXISTS(SELECT 1 FROM jsonb_each(v_utm) AS kv WHERE
      kv.key NOT IN ('utm_source','utm_medium','utm_campaign','utm_content','utm_term')
      OR jsonb_typeof(kv.value)<>'string' OR length(kv.value #>> '{}')>100)
    OR (v_qualification IS NOT NULL AND
      (jsonb_typeof(v_qualification)<>'object' OR pg_column_size(v_qualification)>2500))
  THEN RAISE EXCEPTION 'EVENT_INGRESS_INVALID_INPUT'; END IF;

  -- The existing resolver is the sole owner of identity merging/conflict decisions.
  -- Pass only canonical identity fields to its idempotent ingress journal.
  identity_receipt := architetti_private.ingest(jsonb_build_object(
    'eventId',v_key,'locationId',p_event->>'locationId',
    'externalContactId',p_event->>'externalContactId',
    'fullName',p_event->>'fullName','email',p_event->>'email',
    'phone',p_event->>'phone','source',p_event->>'source'
  ));
  v_contact := (identity_receipt->>'contactId')::uuid;
  v_hash := md5(p_event::text);

  INSERT INTO public.patrimonial_contact_event_registrations (
    contact_id,location_ref,event_key,payload_hash,edition_ref,registration_status,
    province,profile,message,source_path,utm,marketing_consent,privacy_version,qualification
  ) VALUES (
    v_contact,p_event->>'locationId',v_key,v_hash,nullif(p_event->>'editionId',''),
    CASE WHEN p_event->>'sourcePath'='/evento/quello-che-le-banche-non-dicono' THEN 'CONFIRMED'
         WHEN nullif(p_event->>'editionId','') IS NULL THEN 'PENDING_EDITION' ELSE 'REQUESTED' END,
    nullif(p_event->>'province',''),nullif(p_event->>'profile',''),
    nullif(p_event->>'message',''),p_event->>'sourcePath',
    v_utm,(p_event->>'marketingConsent')::boolean,nullif(p_event->>'privacyVersion',''),v_qualification
  ) ON CONFLICT DO NOTHING RETURNING id INTO v_inserted;

  IF v_inserted IS NOT NULL THEN
    INSERT INTO public.patrimonial_contact_history(contact_id,kind,summary)
    VALUES(v_contact,'webinar_request_received','Iscrizione webinar confermata per 9 dicembre 2026 alle 21:00');
  END IF;

  SELECT * INTO v_old FROM public.patrimonial_contact_event_registrations
    WHERE location_ref=p_event->>'locationId' AND event_key=v_key;
  IF NOT FOUND AND p_event->>'sourcePath'='/evento/quello-che-le-banche-non-dicono' THEN
    SELECT * INTO v_old FROM public.patrimonial_contact_event_registrations
      WHERE contact_id=v_contact AND edition_ref=p_event->>'editionId'
        AND registration_status='CONFIRMED'
      ORDER BY registered_at ASC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('contactId',v_contact,'registrationId',v_old.id,'state',v_old.registration_status);
    END IF;
  END IF;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'EVENT_INGRESS_UNCONFIRMED'; END IF;
  IF v_old.event_key<>v_key AND v_old.contact_id=v_contact AND v_old.edition_ref=p_event->>'editionId'
     AND v_old.registration_status='CONFIRMED' THEN
     RETURN jsonb_build_object('contactId',v_contact,'registrationId',v_old.id,'state',v_old.registration_status);
  END IF;
  IF v_old.contact_id<>v_contact OR v_old.payload_hash<>v_hash THEN
    RAISE EXCEPTION 'EVENT_INGRESS_IDEMPOTENCY_CONFLICT';
  END IF;
  RETURN jsonb_build_object('contactId',v_contact,'registrationId',v_old.id,'state',v_old.registration_status);
END $function$;


CREATE OR REPLACE FUNCTION architetti_private.ingest_event_referred(p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_code text; v_op uuid; v_preexisting uuid; v_contact uuid; v_registration uuid;
  v_current_op uuid; v_state text; v_receipt jsonb; v_previous_code text;
  v_seen boolean;
  v_email text; v_phone text;
BEGIN
  IF p_event IS NULL OR jsonb_typeof(p_event)<>'object'
    OR pg_column_size(p_event)>10000
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_event) AS keys(k) WHERE k NOT IN (
      'eventId','locationId','externalContactId','fullName','email','phone',
      'source','sourcePath','editionId','province','profile','message','utm',
      'marketingConsent','privacyVersion','consent','qualification','referralCode'))
    THEN RAISE EXCEPTION 'EVENT_INGRESS_INVALID_INPUT'; END IF;
  v_code := nullif(p_event->>'referralCode','');
  IF p_event ? 'referralCode' AND (v_code IS NULL OR v_code !~ '^[0-9a-f]{32}$')
    THEN RAISE EXCEPTION 'REFERRAL_NOT_ACTIVE'; END IF;
  PERFORM pg_advisory_xact_lock(741920,2);
  IF v_code IS NOT NULL THEN
    PERFORM architetti_private.validate_referral(v_code);
    SELECT operator_id INTO STRICT v_op FROM public.patrimonial_architect_referral_links WHERE code=v_code;
  END IF;
  SELECT referral_code INTO v_previous_code
    FROM public.patrimonial_contact_event_registrations
    WHERE location_ref=p_event->>'locationId' AND event_key=p_event->>'eventId';
  v_seen:=FOUND;
  IF v_seen AND v_previous_code IS DISTINCT FROM v_code
    THEN RAISE EXCEPTION 'REFERRAL_IDEMPOTENCY_CONFLICT'; END IF;

  v_email := nullif(lower(btrim(p_event->>'email')),'');
  v_phone := nullif(p_event->>'phone','');
  SELECT contact_id INTO v_preexisting FROM public.patrimonial_contact_external_refs
    WHERE provider='highlevel' AND location_ref=p_event->>'locationId'
      AND external_id=p_event->>'externalContactId';
  IF v_preexisting IS NULL THEN
    SELECT id INTO v_preexisting FROM public.patrimonial_contacts
      WHERE (v_email IS NOT NULL AND email=v_email)
        OR (v_phone IS NOT NULL AND phone=v_phone) LIMIT 1;
  END IF;

  -- The baseline ingress checks contact identity, payload replay and source.
  v_receipt := architetti_private.ingest_event(p_event - 'referralCode');
  v_contact := (v_receipt->>'contactId')::uuid;
  v_registration := (v_receipt->>'registrationId')::uuid;
  IF EXISTS (
    SELECT 1 FROM public.patrimonial_contact_event_registrations
    WHERE id=v_registration AND event_key IS DISTINCT FROM p_event->>'eventId'
  ) THEN
    SELECT attribution_status INTO v_state FROM public.patrimonial_contact_event_registrations WHERE id=v_registration;
    RETURN v_receipt || jsonb_build_object('attributionStatus',v_state);
  END IF;
  IF v_code IS NULL THEN RETURN v_receipt || jsonb_build_object('attributionStatus','DIRECT'); END IF;

  -- Replays return the previously committed owner attribution unchanged.
  IF v_seen THEN
    SELECT attribution_status INTO v_state FROM public.patrimonial_contact_event_registrations
      WHERE id=v_registration;
    RETURN v_receipt || jsonb_build_object('attributionStatus',v_state);
  END IF;

  SELECT assigned_operator_id INTO v_current_op FROM public.patrimonial_contacts
    WHERE id=v_contact FOR UPDATE;
  IF v_preexisting IS NULL AND v_current_op IS NULL THEN
    UPDATE public.patrimonial_contacts SET assigned_operator_id=v_op,
      assigned_at=now(),revision=revision+1,updated_at=now()
      WHERE id=v_contact AND assigned_operator_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'REFERRAL_ASSIGNMENT_CONFLICT'; END IF;
    v_state:='ASSIGNED_NEW';
  ELSIF v_current_op=v_op THEN
    v_state:='EXISTING_SAME_OWNER';
  ELSIF v_current_op IS NOT NULL THEN
    v_state:='EXISTING_OTHER_OWNER';
  ELSE
    v_state:='EXISTING_UNASSIGNED_REVIEW';
  END IF;
  UPDATE public.patrimonial_contact_event_registrations
    SET referral_code=v_code,referred_operator_id=v_op,attribution_status=v_state
    WHERE id=v_registration AND referral_code IS NULL AND attribution_status='DIRECT';
  IF NOT FOUND THEN RAISE EXCEPTION 'REFERRAL_REGISTRATION_CONFLICT'; END IF;
  INSERT INTO public.patrimonial_contact_history(contact_id,kind,summary)
    VALUES(v_contact,CASE WHEN v_state='ASSIGNED_NEW' THEN 'referral_assigned'
                         ELSE 'referral_attributed' END,
      'Iscrizione webinar da link personale · '||v_state);
  RETURN v_receipt || jsonb_build_object('attributionStatus',v_state);
END $function$;


CREATE OR REPLACE FUNCTION public.patrimonial_event_email_enqueue()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if new.source_path='/evento/quello-che-le-banche-non-dicono' and new.registration_status in ('PENDING_EDITION','REQUESTED','CONFIRMED') then
    insert into public.patrimonial_event_email_deliveries(registration_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end; $function$;


CREATE OR REPLACE FUNCTION public.patrimonial_event_email_claim(p_registration_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare chosen record; token uuid;
begin
  select d.registration_id, c.email, c.full_name, d.attempt_count into chosen
  from public.patrimonial_event_email_deliveries d
  join public.patrimonial_contact_event_registrations r on r.id=d.registration_id
  join public.patrimonial_contacts c on c.id=r.contact_id
  where (p_registration_id is null or d.registration_id=p_registration_id)
    and (d.status in ('PENDING','FAILED') or (d.status='SENDING' and d.lease_until<now()))
    and d.attempt_count<8 and d.next_attempt_at<=now()
    and r.registration_status='CONFIRMED'
    and c.email is not null and c.email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  order by d.next_attempt_at, d.registration_id
  limit 1 for update of d skip locked;
  if not found then return null; end if;
  token:=gen_random_uuid();
  update public.patrimonial_event_email_deliveries
     set status='SENDING',attempt_count=attempt_count+1,lease_token=token,
         lease_until=now()+interval '2 minutes',updated_at=now()
   where registration_id=chosen.registration_id;
  return jsonb_build_object('registrationId',chosen.registration_id,'recipient',chosen.email,
       'firstName',split_part(chosen.full_name,' ',1),'leaseToken',token);
end; $function$;
