-- Horyzon Platform / Architetti: webinar lead read model and Radar reference links.
-- PENDING REVIEW: code only, DO NOT apply to remote database until an authorized migration review.
-- Requires 0056_architetti_workspace.sql already applied. No backfill and no live messages.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regprocedure('architetti_private.ingest(jsonb)') IS NULL
     OR to_regprocedure('architetti_private.can_contact(uuid)') IS NULL
     OR to_regclass('public.patrimonial_contacts') IS NULL
  THEN
    RAISE EXCEPTION 'ARCHITETTI_WORKSPACE_PREREQUISITE_MISSING';
  END IF;
END $$;

CREATE TABLE public.patrimonial_contact_event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.patrimonial_contacts(id) ON DELETE RESTRICT,
  location_ref text NOT NULL CHECK(length(location_ref) BETWEEN 1 AND 160),
  event_key text NOT NULL CHECK(event_key ~ '^[a-zA-Z0-9_.:-]{1,200}$'),
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[0-9a-f]{32}$'),
  title text NOT NULL DEFAULT 'Quello che le banche non dicono',
  edition_ref text CHECK(edition_ref IS NULL OR edition_ref ~ '^[a-zA-Z0-9_-]{1,100}$'),
  registration_status text NOT NULL DEFAULT 'PENDING_EDITION'
    CHECK(registration_status IN ('PENDING_EDITION','REQUESTED','CONFIRMED','CANCELLED')),
  province text CHECK(province IS NULL OR length(province)<=80),
  profile text CHECK(profile IS NULL OR length(profile)<=120),
  message text CHECK(message IS NULL OR length(message)<=1500),
  source_path text NOT NULL CHECK(source_path='/benessere-patrimoniale/evento'),
  utm jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(utm)='object' AND pg_column_size(utm)<=1024),
  marketing_consent boolean NOT NULL DEFAULT false,
  privacy_version text CHECK(privacy_version IS NULL OR length(privacy_version)<=100),
  qualification jsonb CHECK(qualification IS NULL OR (jsonb_typeof(qualification)='object' AND pg_column_size(qualification)<=2500)),
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_ref,event_key)
);
CREATE INDEX patrimonial_event_registrations_contact_created
  ON public.patrimonial_contact_event_registrations(contact_id,registered_at DESC);

CREATE TABLE public.patrimonial_contact_radar_links (
  assessment_ref uuid PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.patrimonial_contacts(id) ON DELETE RESTRICT,
  registration_id uuid REFERENCES public.patrimonial_contact_event_registrations(id) ON DELETE RESTRICT,
  questionnaire_version text NOT NULL CHECK(length(questionnaire_version) BETWEEN 1 AND 100),
  status text NOT NULL CHECK(status IN ('STARTED','IN_PROGRESS','COMPLETED')),
  completed_at timestamptz,
  linked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status='COMPLETED' OR completed_at IS NULL)
);
CREATE INDEX patrimonial_contact_radar_links_contact ON public.patrimonial_contact_radar_links(contact_id,linked_at DESC);

ALTER TABLE public.patrimonial_contact_event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrimonial_contact_event_registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.patrimonial_contact_radar_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrimonial_contact_radar_links FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.patrimonial_contact_event_registrations, public.patrimonial_contact_radar_links
  FROM PUBLIC,anon,authenticated;
-- Access only through purpose-limited audited RPCs, not direct browser table grants.

CREATE FUNCTION architetti_private.ingest_event(p_event jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
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
    OR p_event->>'sourcePath' IS DISTINCT FROM '/benessere-patrimoniale/evento'
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
    CASE WHEN nullif(p_event->>'editionId','') IS NULL THEN 'PENDING_EDITION' ELSE 'REQUESTED' END,
    nullif(p_event->>'province',''),nullif(p_event->>'profile',''),
    nullif(p_event->>'message',''),'/benessere-patrimoniale/evento',
    v_utm,(p_event->>'marketingConsent')::boolean,nullif(p_event->>'privacyVersion',''),v_qualification
  ) ON CONFLICT(location_ref,event_key) DO NOTHING RETURNING id INTO v_inserted;

  IF v_inserted IS NOT NULL THEN
    INSERT INTO public.patrimonial_contact_history(contact_id,kind,summary)
    VALUES(v_contact,'webinar_request_received','Richiesta di partecipazione al webinar ricevuta; posto non ancora confermato');
  END IF;

  SELECT * INTO STRICT v_old FROM public.patrimonial_contact_event_registrations
    WHERE location_ref=p_event->>'locationId' AND event_key=v_key;
  IF v_old.contact_id<>v_contact OR v_old.payload_hash<>v_hash THEN
    RAISE EXCEPTION 'EVENT_INGRESS_IDEMPOTENCY_CONFLICT';
  END IF;
  RETURN jsonb_build_object('contactId',v_contact,'registrationId',v_old.id,'state',v_old.registration_status);
END $$;

-- Called only after a trusted Radar ownership + Horyzon identity binding.
-- This is a metadata/reference link; do not copy personal financial answers here.
CREATE FUNCTION architetti_private.link_radar(p_link jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_contact uuid; v_registration uuid; v_old public.patrimonial_contact_radar_links; v_assessment uuid; v_status text;
BEGIN
  IF p_link IS NULL OR jsonb_typeof(p_link)<>'object' OR
    EXISTS(SELECT 1 FROM jsonb_object_keys(p_link) AS keys(k) WHERE k NOT IN
      ('contactId','verifiedEmail','registrationId','assessmentId','questionnaireVersion','status','completedAt'))
  THEN RAISE EXCEPTION 'RADAR_LINK_INVALID_INPUT'; END IF;
  v_contact := (p_link->>'contactId')::uuid;
  v_assessment := (p_link->>'assessmentId')::uuid;
  v_registration := nullif(p_link->>'registrationId','')::uuid;
  v_status := p_link->>'status';
  IF v_status IS NULL OR v_status NOT IN ('STARTED','IN_PROGRESS','COMPLETED') OR
     length(coalesce(p_link->>'questionnaireVersion','')) NOT BETWEEN 1 AND 100 OR
     (v_status <> 'COMPLETED' AND nullif(p_link->>'completedAt','') IS NOT NULL) OR
     (v_status='COMPLETED' AND nullif(p_link->>'completedAt','') IS NULL)
  THEN RAISE EXCEPTION 'RADAR_LINK_INVALID_INPUT'; END IF;
  -- Email is supplied only by the trusted, OTP-verified Radar backend.
  -- Fail closed if it does not match the canonical Horyzon contact email.
  IF nullif(lower(btrim(p_link->>'verifiedEmail')),'') IS NULL
    OR length(p_link->>'verifiedEmail')>254
    OR NOT EXISTS(SELECT 1 FROM public.patrimonial_contacts
        WHERE id=v_contact AND email=lower(btrim(p_link->>'verifiedEmail')))
    OR (v_registration IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.patrimonial_contact_event_registrations
      WHERE id=v_registration AND contact_id=v_contact))
  THEN RAISE EXCEPTION 'RADAR_LINK_IDENTITY_CONFLICT'; END IF;

  PERFORM pg_advisory_xact_lock(741920,2);
  SELECT * INTO v_old FROM public.patrimonial_contact_radar_links WHERE assessment_ref=v_assessment FOR UPDATE;
  IF FOUND THEN
    IF v_old.contact_id<>v_contact OR v_old.registration_id IS DISTINCT FROM v_registration
      OR v_old.questionnaire_version<>(p_link->>'questionnaireVersion')
      OR (v_old.status='COMPLETED' AND v_status<>'COMPLETED')
      OR (v_old.status='IN_PROGRESS' AND v_status='STARTED')
      OR (v_old.completed_at IS NOT NULL AND
          v_old.completed_at IS DISTINCT FROM nullif(p_link->>'completedAt','')::timestamptz)
    THEN RAISE EXCEPTION 'RADAR_LINK_IDENTITY_CONFLICT'; END IF;
    UPDATE public.patrimonial_contact_radar_links
      SET status=v_status,completed_at=coalesce(v_old.completed_at,nullif(p_link->>'completedAt','')::timestamptz),
          updated_at=now() WHERE assessment_ref=v_assessment;
  ELSE
    INSERT INTO public.patrimonial_contact_radar_links(
      assessment_ref,contact_id,registration_id,questionnaire_version,status,completed_at)
    VALUES(v_assessment,v_contact,v_registration,p_link->>'questionnaireVersion',v_status,
      nullif(p_link->>'completedAt','')::timestamptz);
  END IF;
  RETURN jsonb_build_object('contactId',v_contact,'assessmentId',v_assessment,'status',v_status);
END $$;

CREATE FUNCTION architetti_private.contact_context(p_contact_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT architetti_private.can_contact(p_contact_id) THEN
    RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  RETURN jsonb_build_object(
    'registrations',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',r.id,'event_key',r.event_key,'title',r.title,'edition_ref',r.edition_ref,
        'registration_status',r.registration_status,'province',r.province,'profile',r.profile,
        'message',r.message,'source_path',r.source_path,'utm',r.utm,
        'marketing_consent',r.marketing_consent,'privacy_version',r.privacy_version,
        'qualification',r.qualification,'registered_at',r.registered_at
      ) ORDER BY r.registered_at DESC,r.id)
      FROM public.patrimonial_contact_event_registrations r WHERE r.contact_id=p_contact_id
    ),'[]'::jsonb),
    'radars',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'assessment_ref',a.assessment_ref,'registration_id',a.registration_id,
        'questionnaire_version',a.questionnaire_version,'status',a.status,
        'completed_at',a.completed_at
      ) ORDER BY a.linked_at DESC,a.assessment_ref)
      FROM public.patrimonial_contact_radar_links a WHERE a.contact_id=p_contact_id
    ),'[]'::jsonb)
  );
END $$;

-- Invoker facades are the only external RPC entrypoints.
CREATE FUNCTION public.architetti_event_ingest(p_event jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
  SELECT architetti_private.ingest_event(p_event)
$$;
CREATE FUNCTION public.architetti_radar_link(p_link jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
  SELECT architetti_private.link_radar(p_link)
$$;
CREATE FUNCTION hub.architetti_contact_context(p_contact_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
  SELECT architetti_private.contact_context(p_contact_id)
$$;

REVOKE ALL ON FUNCTION architetti_private.ingest_event(jsonb),architetti_private.link_radar(jsonb),
  architetti_private.contact_context(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION architetti_private.ingest_event(jsonb),architetti_private.link_radar(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION architetti_private.contact_context(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.architetti_event_ingest(jsonb),public.architetti_radar_link(jsonb),
  hub.architetti_contact_context(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.architetti_event_ingest(jsonb),public.architetti_radar_link(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION hub.architetti_contact_context(uuid) TO authenticated;

COMMIT;
