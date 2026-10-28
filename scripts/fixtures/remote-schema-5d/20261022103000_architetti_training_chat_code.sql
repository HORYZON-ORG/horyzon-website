-- Architetti training · per-chat code for sessions (additive).
-- ChatGPT answers later turns and voice from the visible chat, not from earlier tool
-- results, so the issued sessionId is unavailable when the call ends. The portal adds a
-- random code to each copied start command; the session records it and the end-of-call
-- save resolves the session by that code. A code identifies one chat, so two parallel
-- chats with the same persona never share a session and nothing is inferred from recency.
BEGIN;

ALTER TABLE architetti_private.training_sessions ADD COLUMN chat_code text;
ALTER TABLE architetti_private.training_sessions ADD CONSTRAINT training_sessions_chat_code_check
  CHECK (chat_code IS NULL OR chat_code ~ '^[A-HJ-NP-Z2-9]{6}$');
CREATE UNIQUE INDEX training_sessions_user_chat_code_key
  ON architetti_private.training_sessions(user_id, chat_code) WHERE chat_code IS NOT NULL;

-- Same validation as before plus an optional chatCode. A code already issued to this
-- account returns that session (existing=true) instead of issuing a second one.
CREATE OR REPLACE FUNCTION architetti_private.training_start_session(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE op uuid:=architetti_private.training_actor(); key_name text; code text;
  issued architetti_private.training_sessions;
BEGIN
  IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>2000 THEN
    RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
  END IF;
  IF (p_input-'caseId'-'caseVersion'-'promptVersion'-'batchVersion'-'caseName'-'kind'-'difficulty'-'materialVersion'-'chatCode')<>'{}'::jsonb THEN
    RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
  END IF;
  FOREACH key_name IN ARRAY ARRAY['caseId','caseVersion','promptVersion','batchVersion','caseName','kind','difficulty','materialVersion'] LOOP
    IF jsonb_typeof(p_input->key_name) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
  END LOOP;
  IF p_input ? 'chatCode' THEN
    IF jsonb_typeof(p_input->'chatCode') IS DISTINCT FROM 'string' OR (p_input->>'chatCode') !~ '^[A-HJ-NP-Z2-9]{6}$' THEN
      RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
    END IF;
    code:=p_input->>'chatCode';
  END IF;
  IF (p_input->>'caseId') !~ '^[a-z][a-z0-9-]{0,79}$' OR
     NOT ((p_input->>'caseVersion'='1.0' AND p_input->>'promptVersion'='0.3') OR
          (p_input->>'caseVersion'='1.1' AND p_input->>'promptVersion'='0.4')) OR
     p_input->>'batchVersion'<>'pilot-2026w43-v1' OR
     length(btrim(p_input->>'caseName')) NOT BETWEEN 1 AND 160 OR
     length(btrim(p_input->>'materialVersion')) NOT BETWEEN 1 AND 120 OR
     p_input->>'kind' NOT IN ('LEAD','ARCHITECT') OR
     p_input->>'difficulty' NOT IN ('EASY','MEDIUM','HARD','EXTREME','GUIDED') OR
     ((p_input->>'kind'='ARCHITECT') IS DISTINCT FROM (p_input->>'difficulty'='GUIDED')) THEN
    RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
  END IF;
  IF code IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':chat:'||code,0));
    SELECT * INTO issued FROM architetti_private.training_sessions
      WHERE operator_id=op AND user_id=auth.uid() AND chat_code=code;
    IF FOUND THEN
      RETURN jsonb_build_object('sessionId',issued.id,'weekStart',issued.week_start,'startedAt',issued.created_at,
        'existing',true,'caseId',issued.case_id,'caseVersion',issued.case_version,'promptVersion',issued.prompt_version);
    END IF;
  END IF;
  INSERT INTO architetti_private.training_sessions(operator_id,user_id,case_id,case_version,prompt_version,batch_version,case_name,kind,difficulty,material_version,chat_code)
  VALUES(op,auth.uid(),p_input->>'caseId',p_input->>'caseVersion',p_input->>'promptVersion',p_input->>'batchVersion',
    btrim(p_input->>'caseName'),p_input->>'kind',p_input->>'difficulty',btrim(p_input->>'materialVersion'),code) RETURNING * INTO issued;
  RETURN jsonb_build_object('sessionId',issued.id,'weekStart',issued.week_start,'startedAt',issued.created_at);
END $$;

-- Own session by chat code, same snapshot and same identifier-free miss as
-- training_session_context; no issuance, writes, report text or biography.
CREATE FUNCTION architetti_private.training_session_by_code(p_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE op uuid:=architetti_private.training_actor(); result jsonb;
BEGIN
  IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF p_code IS NULL OR p_code !~ '^[A-HJ-NP-Z2-9]{6}$' THEN RETURN jsonb_build_object('status','NOT_FOUND'); END IF;
  SELECT jsonb_build_object('sessionId',s.id,'caseId',s.case_id,
    'caseVersion',s.case_version,'promptVersion',s.prompt_version,'batchVersion',s.batch_version,
    'caseName',s.case_name,'kind',s.kind,'difficulty',s.difficulty,
    'materialVersion',s.material_version,'weekStart',s.week_start,'startedAt',s.created_at)
    INTO result FROM architetti_private.training_sessions s
    WHERE s.operator_id=op AND s.user_id=auth.uid() AND s.chat_code=p_code;
  RETURN coalesce(result,jsonb_build_object('status','NOT_FOUND'));
END $$;

REVOKE ALL ON FUNCTION architetti_private.training_start_session(jsonb),architetti_private.training_session_by_code(text)
  FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_start_session(jsonb),architetti_private.training_session_by_code(text)
  TO horyzon_platform;
NOTIFY pgrst,'reload schema';
COMMIT;
