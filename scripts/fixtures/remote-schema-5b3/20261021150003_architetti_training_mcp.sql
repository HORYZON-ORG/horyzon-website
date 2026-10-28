-- Canonical additive extension. Apply ONLY after explicit approval; outside active runner.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('hub.architetti_snapshot(text)') IS NULL OR
     to_regclass('public.mcp_oauth_access_tokens') IS NULL THEN
    RAISE EXCEPTION 'Requires workspace 0056 and OAuth renewal 0057/0058';
  END IF;
END $$;

-- Reuse credentials and renewal history. A network grant has no company tenant.
ALTER TABLE public.patrimonial_operators ADD CONSTRAINT training_operator_user_binding UNIQUE(id,user_id);
ALTER TABLE public.mcp_connections ADD COLUMN network_operator_id uuid;
ALTER TABLE public.mcp_connections ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.mcp_connections ADD CONSTRAINT mcp_network_operator_user
  FOREIGN KEY(network_operator_id,user_id) REFERENCES public.patrimonial_operators(id,user_id);
ALTER TABLE public.mcp_connections ADD CONSTRAINT mcp_connection_context CHECK (
  (tenant_id IS NOT NULL AND network_operator_id IS NULL) OR
  (tenant_id IS NULL AND network_operator_id IS NOT NULL AND auth_method='oauth21'
   AND created_by=user_id AND audience=issuer||'/v1/architetti/mcp'
   AND scopes <@ ARRAY['training:read','training:write']::text[])
);
CREATE INDEX mcp_network_connection_owner ON public.mcp_connections(user_id,created_at DESC)
  WHERE network_operator_id IS NOT NULL;
ALTER TABLE public.mcp_oauth_authorization_codes ADD COLUMN network_operator_id uuid;
ALTER TABLE public.mcp_oauth_authorization_codes ALTER COLUMN bound_tenant_id DROP NOT NULL;
ALTER TABLE public.mcp_oauth_authorization_codes ALTER COLUMN membership_id DROP NOT NULL;
ALTER TABLE public.mcp_oauth_authorization_codes ADD CONSTRAINT mcp_code_network_operator_user
  FOREIGN KEY(network_operator_id,user_id) REFERENCES public.patrimonial_operators(id,user_id);
ALTER TABLE public.mcp_oauth_authorization_codes ADD CONSTRAINT mcp_code_context CHECK (
  (bound_tenant_id IS NOT NULL AND membership_id IS NOT NULL AND network_operator_id IS NULL) OR
  (bound_tenant_id IS NULL AND membership_id IS NULL AND network_operator_id IS NOT NULL
   AND resource=issuer||'/v1/architetti/mcp'
   AND scopes <@ ARRAY['training:read','training:write']::text[])
);
CREATE INDEX mcp_network_codes_operator ON public.mcp_oauth_authorization_codes(network_operator_id)
  WHERE network_operator_id IS NOT NULL;

CREATE TABLE architetti_private.training_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id),
  session_id uuid NOT NULL,
  report jsonb NOT NULL CHECK(jsonb_typeof(report)='object' AND octet_length(report::text)<=16000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,session_id),
  FOREIGN KEY(operator_id,user_id) REFERENCES public.patrimonial_operators(id,user_id)
);
CREATE INDEX training_reports_operator_time ON architetti_private.training_reports(operator_id,created_at DESC,id);
CREATE INDEX training_reports_time ON architetti_private.training_reports(created_at DESC,id);
ALTER TABLE architetti_private.training_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE architetti_private.training_reports FORCE ROW LEVEL SECURITY;
REVOKE ALL ON architetti_private.training_reports FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;

CREATE FUNCTION architetti_private.training_actor() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path='' AS $$
 SELECT o.id FROM public.patrimonial_operators o JOIN auth.users a ON a.id=o.user_id
 LEFT JOIN public.users u ON u.id=o.user_id
 WHERE o.user_id=auth.uid() AND o.active AND o.network_enabled AND u.disabled_at IS NULL
 AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now())
$$;
CREATE FUNCTION architetti_private.training_supervisor() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users a LEFT JOIN public.users u ON u.id=a.id
 WHERE a.id=auth.uid() AND u.disabled_at IS NULL AND a.deleted_at IS NULL
 AND (a.banned_until IS NULL OR a.banned_until<=now()))
 AND architetti_private.is_supervisor()
$$;
CREATE FUNCTION architetti_private.training_profile() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path='' AS $$ DECLARE op uuid:=architetti_private.training_actor(); BEGIN
 IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('id',o.id,'name',o.display_name) FROM public.patrimonial_operators o WHERE id=op);
END $$;

-- The existing public.users table is the minimal Auth mirror (0002), not a
-- second account. Populate it lazily only on explicit OAuth approval, using
-- the same Auth UUID and authoritative email, without any company membership.
CREATE FUNCTION architetti_private.training_prepare_connection() RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' AS $$ BEGIN
 IF architetti_private.training_actor() IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid()) THEN
   BEGIN
     INSERT INTO public.users(id,email) SELECT id,email FROM auth.users WHERE id=auth.uid() AND nullif(email,'') IS NOT NULL
     ON CONFLICT(id) DO NOTHING;
   EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'IDENTITY_REVIEW_REQUIRED'; END;
   IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid()) THEN RAISE EXCEPTION 'IDENTITY_REVIEW_REQUIRED'; END IF;
 END IF;
END $$;

CREATE FUNCTION architetti_private.training_save(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' AS $$
DECLARE op uuid:=architetti_private.training_actor(); sid uuid; previous architetti_private.training_reports;
 stored architetti_private.training_reports; payload jsonb; item jsonb; list_name text;
BEGIN
 IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>16000 OR
   (p_input-'sessionId'-'mode'-'scenarioId'-'scenarioVersion'-'promptVersion'-'outcome'-'summary'-'strengths'-'improvements'-'nextPractice'-'limitations'-'confirmSave')<>'{}'::jsonb OR
   p_input->'confirmSave' IS DISTINCT FROM 'true'::jsonb OR
   p_input->>'mode' IS DISTINCT FROM 'SIMULATION' OR p_input->>'scenarioId' IS DISTINCT FROM 'cliente-prudente' OR
   p_input->>'scenarioVersion' IS DISTINCT FROM '0.2' OR p_input->>'promptVersion' IS DISTINCT FROM '0.2' OR
   p_input->>'outcome' IS NULL OR p_input->>'outcome' NOT IN ('FOLLOW_UP','DECLINED','INTERRUPTED') OR
   jsonb_typeof(p_input->'summary') IS DISTINCT FROM 'string' OR length(btrim(p_input->>'summary')) NOT BETWEEN 1 AND 4000 OR
   jsonb_typeof(p_input->'nextPractice') IS DISTINCT FROM 'string' OR length(btrim(p_input->>'nextPractice')) NOT BETWEEN 1 AND 1000
 THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
 BEGIN sid:=(p_input->>'sessionId')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END;
 IF sid IS NULL THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
 FOREACH list_name IN ARRAY ARRAY['strengths','improvements','limitations'] LOOP
   IF jsonb_typeof(p_input->list_name) IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->list_name)>6 THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(p_input->list_name) LOOP
     IF jsonb_typeof(item)<>'string' OR length(btrim(item#>>'{}')) NOT BETWEEN 1 AND 600 THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
   END LOOP;
 END LOOP;
 payload:=p_input-'confirmSave';
 -- Serialize one person's idempotency key, including concurrent requests.
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||sid::text,0));
 SELECT * INTO previous FROM architetti_private.training_reports WHERE user_id=auth.uid() AND session_id=sid;
 IF FOUND THEN
   IF previous.report IS DISTINCT FROM payload THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN jsonb_build_object('id',previous.id,'sessionId',sid,'savedAt',previous.created_at,'status','SAVED','replayed',true);
 END IF;
 INSERT INTO architetti_private.training_reports(operator_id,user_id,session_id,report)
 VALUES(op,auth.uid(),sid,payload) RETURNING * INTO stored;
 PERFORM architetti_private.audit(NULL,'training_saved','Resoconto esercitazione salvato',stored.id,
   jsonb_build_object('operator_id',op,'session_id',sid,'scenario_version','0.2','source','model_self_report'));
 RETURN jsonb_build_object('id',stored.id,'sessionId',sid,'savedAt',stored.created_at,'status','SAVED','replayed',false);
END $$;

CREATE FUNCTION architetti_private.training_receipt(p_session uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path='' AS $$ DECLARE op uuid:=architetti_private.training_actor(); result jsonb; BEGIN
 IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('id',id,'sessionId',session_id,'savedAt',created_at,'status','SAVED') INTO result
 FROM architetti_private.training_reports WHERE operator_id=op AND user_id=auth.uid() AND session_id=p_session;
 RETURN coalesce(result,jsonb_build_object('sessionId',p_session,'status','NOT_FOUND'));
END $$;

CREATE FUNCTION architetti_private.training_list(p_operator uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path='' AS $$ DECLARE op uuid:=architetti_private.training_actor(); supervisor boolean:=architetti_private.training_supervisor(); result jsonb; BEGIN
 IF NOT supervisor AND op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF NOT supervisor AND p_operator IS NOT NULL AND p_operator<>op THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 WITH allowed AS (
   SELECT r.*,o.display_name FROM architetti_private.training_reports r JOIN public.patrimonial_operators o ON o.id=r.operator_id
   WHERE (supervisor OR (r.operator_id=op AND r.user_id=auth.uid())) AND (p_operator IS NULL OR r.operator_id=p_operator)
 ), recent AS (SELECT * FROM allowed ORDER BY created_at DESC,id DESC LIMIT 50)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM allowed),'reports',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',id,'operatorId',operator_id,'displayName',display_name,'createdAt',created_at,'report',report) ORDER BY created_at DESC,id DESC) FROM recent),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;

CREATE FUNCTION architetti_private.training_no_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Training history is append-only'; END $$;
CREATE TRIGGER training_reports_append_only BEFORE UPDATE OR DELETE ON architetti_private.training_reports
FOR EACH ROW EXECUTE FUNCTION architetti_private.training_no_mutation();

CREATE FUNCTION hub.architetti_training_profile() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT architetti_private.training_profile() $$;
CREATE FUNCTION hub.architetti_training_save(p_input jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT architetti_private.training_save(p_input) $$;
CREATE FUNCTION hub.architetti_training_receipt(p_session uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT architetti_private.training_receipt(p_session) $$;
CREATE FUNCTION hub.architetti_training_list(p_operator uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT architetti_private.training_list(p_operator) $$;
REVOKE ALL ON FUNCTION architetti_private.training_actor(),architetti_private.training_supervisor(),architetti_private.training_profile(),architetti_private.training_save(jsonb),architetti_private.training_receipt(uuid),architetti_private.training_list(uuid),architetti_private.training_no_mutation() FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
REVOKE ALL ON FUNCTION architetti_private.training_prepare_connection() FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_prepare_connection() TO horyzon_platform;
REVOKE ALL ON FUNCTION hub.architetti_training_profile(),hub.architetti_training_save(jsonb),hub.architetti_training_receipt(uuid),hub.architetti_training_list(uuid) FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
GRANT USAGE ON SCHEMA hub,architetti_private TO horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_profile(),architetti_private.training_save(jsonb),architetti_private.training_receipt(uuid),architetti_private.training_list(uuid),hub.architetti_training_profile(),hub.architetti_training_save(jsonb),hub.architetti_training_receipt(uuid),hub.architetti_training_list(uuid) TO authenticated,horyzon_platform;
NOTIFY pgrst,'reload schema';
COMMIT;
