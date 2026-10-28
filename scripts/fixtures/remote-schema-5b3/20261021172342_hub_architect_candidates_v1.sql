-- Horyzon | recruitment Architetti: archivio candidature interno, additive v1.
-- Scope: Hub, nessuna apertura pubblica, nessun invito, HighLevel o operatore creato.
-- Un CV gia' validato nel bucket privato architect-cv e' il riferimento idempotente.
BEGIN;

CREATE TABLE hub.architect_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_id uuid NOT NULL UNIQUE,
  intake_hash text NOT NULL CHECK (intake_hash ~ '^[0-9a-f]{64}$'),
  first_name text NOT NULL CHECK (length(first_name) BETWEEN 1 AND 120),
  last_name text NOT NULL CHECK (length(last_name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  phone text NOT NULL CHECK (length(phone) BETWEEN 8 AND 40),
  province text NOT NULL CHECK (length(province) BETWEEN 2 AND 80),
  profile text NOT NULL DEFAULT '' CHECK (length(profile) <= 160),
  experience text NOT NULL DEFAULT '' CHECK (length(experience) <= 180),
  goal text NOT NULL DEFAULT '' CHECK (length(goal) <= 180),
  availability text NOT NULL DEFAULT '' CHECK (length(availability) <= 180),
  motivation text NOT NULL DEFAULT '' CHECK (length(motivation) <= 1500),
  source_path text NOT NULL CHECK (length(source_path) BETWEEN 1 AND 200),
  utm jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(utm) = 'object' AND pg_column_size(utm) < 4000),
  privacy_version text NOT NULL CHECK (length(privacy_version) BETWEEN 1 AND 80),
  marketing_consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','training','final_review','approved','rejected','withdrawn')),
  current_step smallint NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 4),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  crm_contact_id text CHECK (crm_contact_id IS NULL OR length(crm_contact_id) BETWEEN 1 AND 200),
  crm_state text NOT NULL DEFAULT 'pending' CHECK (crm_state IN ('pending','synced','error')),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approved_only_after_review CHECK (status <> 'approved' OR
    (current_step = 4 AND approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE INDEX architect_candidates_status_received ON hub.architect_candidates(status, received_at DESC);
CREATE INDEX architect_candidates_email_received ON hub.architect_candidates(email, received_at DESC);

CREATE TABLE hub.architect_candidate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES hub.architect_candidates(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('received','crm_synced','crm_error','status','step_completed','cv_link_requested')),
  step smallint CHECK (step IS NULL OR step BETWEEN 1 AND 4),
  from_status text,
  to_status text,
  actor_id uuid REFERENCES auth.users(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX architect_candidate_history_candidate ON hub.architect_candidate_history(candidate_id, recorded_at DESC);

ALTER TABLE hub.architect_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.architect_candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE hub.architect_candidate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.architect_candidate_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON hub.architect_candidates, hub.architect_candidate_history FROM PUBLIC, anon, authenticated;
-- Only server-side RPCs below; candidate accounts get no Hub grant.

CREATE FUNCTION hub.architect_candidate_intake_v1(p_cv_id uuid, p_hash text, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, hub
AS $$
DECLARE v_id uuid; v_hash text; v_new boolean := false;
BEGIN
  IF p_cv_id IS NULL OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
    OR p_data IS NULL OR jsonb_typeof(p_data) <> 'object'
    OR p_data->>'consent' IS DISTINCT FROM 'true'
    OR jsonb_typeof(COALESCE(p_data->'utm','{}'::jsonb)) <> 'object'
    OR pg_column_size(COALESCE(p_data->'utm','{}'::jsonb)) >= 4000
  THEN RAISE EXCEPTION 'INVALID_INTAKE'; END IF;
  INSERT INTO hub.architect_candidates(
    cv_id, intake_hash, first_name, last_name, email, phone, province,
    profile, experience, goal, availability, motivation, source_path, utm,
    privacy_version, marketing_consent
  ) VALUES (
    p_cv_id, p_hash, btrim(p_data->>'firstName'), btrim(p_data->>'lastName'),
    lower(btrim(p_data->>'email')), btrim(p_data->>'phone'), btrim(p_data->>'province'),
    COALESCE(btrim(p_data->>'profile'), ''), COALESCE(btrim(p_data->>'experience'), ''),
    COALESCE(btrim(p_data->>'goal'), ''), COALESCE(btrim(p_data->>'availability'), ''),
    COALESCE(btrim(p_data->>'message'), ''), btrim(p_data->>'sourcePath'),
    COALESCE(p_data->'utm','{}'::jsonb), btrim(p_data->>'privacyVersion'),
    COALESCE((p_data->>'marketingConsent')::boolean, false)
  ) ON CONFLICT (cv_id) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    v_new := true;
    INSERT INTO hub.architect_candidate_history(candidate_id,kind) VALUES (v_id,'received');
  ELSE
    SELECT id, intake_hash INTO v_id, v_hash FROM hub.architect_candidates WHERE cv_id=p_cv_id;
    IF v_id IS NULL OR v_hash IS DISTINCT FROM p_hash THEN
      RAISE EXCEPTION 'INTAKE_IDEMPOTENCY_CONFLICT';
    END IF;
  END IF;
  RETURN v_id;
END $$;

CREATE FUNCTION hub.architect_candidate_crm_v1(p_cv_id uuid, p_contact_id text, p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hub
AS $$
DECLARE c hub.architect_candidates;
BEGIN
  SELECT * INTO c FROM hub.architect_candidates WHERE cv_id=p_cv_id FOR UPDATE;
  IF c.id IS NULL OR p_success IS NULL THEN RAISE EXCEPTION 'CANDIDATE_NOT_FOUND'; END IF;
  IF p_success AND (p_contact_id IS NULL OR length(p_contact_id) NOT BETWEEN 1 AND 200)
    THEN RAISE EXCEPTION 'INVALID_CONTACT_REFERENCE'; END IF;
  IF p_success AND c.crm_contact_id IS NOT NULL AND c.crm_contact_id <> p_contact_id
    THEN RAISE EXCEPTION 'CONTACT_REFERENCE_CONFLICT'; END IF;
  IF p_success AND c.crm_state='synced' AND c.crm_contact_id=p_contact_id THEN RETURN; END IF;
  IF NOT p_success AND c.crm_state='error' THEN RETURN; END IF;
  UPDATE hub.architect_candidates
    SET crm_contact_id=CASE WHEN p_success THEN p_contact_id ELSE crm_contact_id END,
        crm_state=CASE WHEN p_success THEN 'synced' ELSE 'error' END,
        updated_at=now()
    WHERE id=c.id;
  INSERT INTO hub.architect_candidate_history(candidate_id,kind)
  VALUES (c.id,CASE WHEN p_success THEN 'crm_synced' ELSE 'crm_error' END);
END $$;

CREATE FUNCTION hub.architect_candidate_admin_list_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hub
AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM hub.user_roles WHERE user_id=auth.uid() AND role='superadmin'
  ) THEN RAISE EXCEPTION 'CANDIDATE_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'candidates',COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.received_at DESC)
      FROM (SELECT * FROM hub.architect_candidates ORDER BY received_at DESC LIMIT 200) c
    ),'[]'::jsonb),
    'history',COALESCE((
      SELECT jsonb_agg(to_jsonb(h) ORDER BY h.recorded_at DESC)
      FROM (SELECT * FROM hub.architect_candidate_history ORDER BY recorded_at DESC LIMIT 500) h
    ),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

CREATE FUNCTION hub.architect_candidate_command_v1(
  p_candidate_id uuid, p_action text, p_expected_revision integer, p_step smallint DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hub
AS $$
DECLARE c hub.architect_candidates; new_status text; new_step smallint; kind text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM hub.user_roles WHERE user_id=auth.uid() AND role='superadmin'
  ) THEN RAISE EXCEPTION 'CANDIDATE_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM hub.architect_candidates WHERE id=p_candidate_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'CANDIDATE_NOT_FOUND'; END IF;
  IF p_expected_revision IS DISTINCT FROM c.revision THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
  new_status := c.status; new_step := c.current_step; kind := 'status';
  IF p_action='start_review' AND c.status='received' THEN
    new_status := 'reviewing';
  ELSIF p_action='start_training' AND c.status='reviewing' THEN
    new_status := 'training';
  ELSIF p_action='complete_step' AND c.status='training'
      AND p_step=c.current_step+1 AND p_step BETWEEN 1 AND 4 THEN
    new_step := p_step; kind := 'step_completed';
    IF new_step=4 THEN new_status := 'final_review'; END IF;
  ELSIF p_action='approve' AND c.status='final_review' AND c.current_step=4 THEN
    new_status := 'approved';
  ELSIF p_action='reject' AND c.status IN ('received','reviewing','training','final_review') THEN
    new_status := 'rejected';
  ELSE RAISE EXCEPTION 'INVALID_CANDIDATE_TRANSITION'; END IF;
  UPDATE hub.architect_candidates
  SET status=new_status, current_step=new_step, revision=revision+1,
      approved_by=CASE WHEN p_action='approve' THEN auth.uid() ELSE approved_by END,
      approved_at=CASE WHEN p_action='approve' THEN now() ELSE approved_at END,
      updated_at=now()
  WHERE id=c.id;
  INSERT INTO hub.architect_candidate_history(
    candidate_id,kind,step,from_status,to_status,actor_id
  ) VALUES (
    c.id,kind,CASE WHEN kind='step_completed' THEN new_step ELSE NULL END,
    c.status,new_status,auth.uid()
  );
  RETURN jsonb_build_object('id',c.id,'status',new_status,'current_step',new_step,'revision',c.revision+1);
END $$;

CREATE FUNCTION hub.architect_candidate_cv_v1(p_candidate_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hub
AS $$
DECLARE v_cv uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM hub.user_roles WHERE user_id=auth.uid() AND role='superadmin'
  ) THEN RAISE EXCEPTION 'CANDIDATE_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  SELECT cv_id INTO v_cv FROM hub.architect_candidates WHERE id=p_candidate_id;
  IF v_cv IS NULL THEN RAISE EXCEPTION 'CV_NOT_FOUND'; END IF;
  INSERT INTO hub.architect_candidate_history(candidate_id,kind,actor_id)
  VALUES(p_candidate_id,'cv_link_requested',auth.uid());
  RETURN v_cv;
END $$;

REVOKE ALL ON FUNCTION
  hub.architect_candidate_intake_v1(uuid,text,jsonb),
  hub.architect_candidate_crm_v1(uuid,text,boolean),
  hub.architect_candidate_admin_list_v1(),
  hub.architect_candidate_command_v1(uuid,text,integer,smallint),
  hub.architect_candidate_cv_v1(uuid)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION hub.architect_candidate_intake_v1(uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION hub.architect_candidate_crm_v1(uuid,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION hub.architect_candidate_admin_list_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION hub.architect_candidate_command_v1(uuid,text,integer,smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION hub.architect_candidate_cv_v1(uuid) TO authenticated;
COMMIT;
