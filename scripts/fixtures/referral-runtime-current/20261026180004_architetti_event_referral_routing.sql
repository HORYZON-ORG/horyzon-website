-- Horyzon Platform / draft preview-only: immutable architect referral attribution.
-- Do NOT apply automatically: verify identity, RLS, migrations and test in a rollback
-- transaction before authorizing live intake. Requires applied event/radar bridge.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $preflight$
BEGIN
  IF to_regprocedure('architetti_private.ingest_event(jsonb)') IS NULL
    OR to_regclass('public.patrimonial_contact_event_registrations') IS NULL
    OR to_regclass('public.patrimonial_contact_external_refs') IS NULL
    OR to_regclass('public.patrimonial_operators') IS NULL THEN
    RAISE EXCEPTION 'REFERRAL_BRIDGE_PREREQUISITES_MISSING';
  END IF;
END $preflight$;

CREATE TABLE public.patrimonial_architect_referral_links (
  operator_id uuid PRIMARY KEY REFERENCES public.patrimonial_operators(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE CHECK (code ~ '^[0-9a-f]{32}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
ALTER TABLE public.patrimonial_architect_referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrimonial_architect_referral_links FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.patrimonial_architect_referral_links FROM PUBLIC, anon, authenticated;
-- No direct browser table access; management must be per-account RPC.

ALTER TABLE public.patrimonial_contact_event_registrations
  ADD COLUMN referral_code text REFERENCES public.patrimonial_architect_referral_links(code),
  ADD COLUMN referred_operator_id uuid REFERENCES public.patrimonial_operators(id),
  ADD COLUMN attribution_status text NOT NULL DEFAULT 'DIRECT'
    CHECK(attribution_status IN (
      'DIRECT','ASSIGNED_NEW','EXISTING_SAME_OWNER',
      'EXISTING_OTHER_OWNER','EXISTING_UNASSIGNED_REVIEW'
    ));
CREATE INDEX patrimonial_webinar_referral_operator_idx
  ON public.patrimonial_contact_event_registrations(referred_operator_id,registered_at DESC)
  WHERE referred_operator_id IS NOT NULL;
ALTER TABLE public.patrimonial_contact_event_registrations
  ADD CONSTRAINT webinar_referral_consistent CHECK (
    (referral_code IS NULL AND referred_operator_id IS NULL AND attribution_status='DIRECT')
    OR
    (referral_code IS NOT NULL AND referred_operator_id IS NOT NULL AND attribution_status<>'DIRECT')
  );

CREATE FUNCTION architetti_private.my_referral_link() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE op uuid; row_ref public.patrimonial_architect_referral_links;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(741920,2);
  SELECT id INTO op FROM public.patrimonial_operators
    WHERE user_id=auth.uid() AND active AND network_enabled AND network_role='architect';
  IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  INSERT INTO public.patrimonial_architect_referral_links(operator_id,code)
    VALUES(op,replace(gen_random_uuid()::text,'-',''))
    ON CONFLICT(operator_id) DO NOTHING;
  SELECT * INTO STRICT row_ref FROM public.patrimonial_architect_referral_links WHERE operator_id=op;
  IF row_ref.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'REFERRAL_LINK_INACTIVE' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'code',row_ref.code,
    'url','https://horyzon.it/benessere-patrimoniale/evento?ref='||row_ref.code,
    'state','READY_FOR_EVENT_LAUNCH'
  );
END $fn$;

-- No operator name, id, email or ownership is publicly revealed.
CREATE FUNCTION architetti_private.validate_referral(p_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
  IF p_code IS NULL OR p_code !~ '^[0-9a-f]{32}$' OR
    NOT EXISTS (
      SELECT 1 FROM public.patrimonial_architect_referral_links l
      JOIN public.patrimonial_operators o ON o.id=l.operator_id
      WHERE l.code=p_code AND l.revoked_at IS NULL
        AND o.active AND o.network_enabled AND o.network_role='architect'
    ) THEN RAISE EXCEPTION 'REFERRAL_NOT_ACTIVE'; END IF;
  RETURN jsonb_build_object('valid',true);
END $fn$;

-- Ingest is transactional. The original resolver remains the sole Horyzon UUID
-- authority. For existing contacts, a new referral NEVER steals ownership.
CREATE FUNCTION architetti_private.ingest_event_referred(p_event jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
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
END $fn$;

-- Replace only the invoker facade; the existing original ingest remains intact.
CREATE OR REPLACE FUNCTION public.architetti_event_ingest(p_event jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
  SELECT architetti_private.ingest_event_referred(p_event)
$fn$;
CREATE FUNCTION public.architetti_referral_validate(p_code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $fn$
  SELECT architetti_private.validate_referral(p_code)
$fn$;
CREATE FUNCTION hub.architetti_referral_link() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
  SELECT architetti_private.my_referral_link()
$fn$;

REVOKE ALL ON FUNCTION architetti_private.my_referral_link(),
  architetti_private.validate_referral(text),architetti_private.ingest_event_referred(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION architetti_private.my_referral_link() TO authenticated;
GRANT EXECUTE ON FUNCTION architetti_private.validate_referral(text),
  architetti_private.ingest_event_referred(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.architetti_referral_validate(text),
  hub.architetti_referral_link() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.architetti_referral_validate(text) TO service_role;
GRANT EXECUTE ON FUNCTION hub.architetti_referral_link() TO authenticated;
COMMIT;
