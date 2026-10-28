-- Canonical additive extension; outside the active runner. Production application
-- requires separate approval. Preserve issued sessions and immutable reports.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(741920,4);
DO $$ BEGIN
  IF to_regprocedure('architetti_private.training_start_session(jsonb)') IS NULL OR
     to_regprocedure('architetti_private.training_save(jsonb)') IS NULL OR
     to_regclass('architetti_private.training_sessions') IS NULL THEN
    RAISE EXCEPTION 'ARCHITETTI_TRAINING_ARENA_BASELINE_MISSING';
  END IF;
END $$;

-- Each issued snapshot retains its exact protocol. Mixed pairs are never valid.
ALTER TABLE architetti_private.training_sessions ADD CONSTRAINT training_sessions_version_pair_check
  CHECK((case_version='1.0' AND prompt_version='0.3') OR
        (case_version='1.1' AND prompt_version='0.4'));
ALTER TABLE architetti_private.training_sessions DROP CONSTRAINT training_sessions_case_version_check;
ALTER TABLE architetti_private.training_sessions DROP CONSTRAINT training_sessions_prompt_version_check;
CREATE OR REPLACE FUNCTION architetti_private.training_start_session(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE op uuid:=architetti_private.training_actor(); key_name text;
  issued architetti_private.training_sessions;
BEGIN
  IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>2000 THEN
    RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
  END IF;
  IF (p_input-'caseId'-'caseVersion'-'promptVersion'-'batchVersion'-'caseName'-'kind'-'difficulty'-'materialVersion')<>'{}'::jsonb THEN
    RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
  END IF;
  FOREACH key_name IN ARRAY ARRAY['caseId','caseVersion','promptVersion','batchVersion','caseName','kind','difficulty','materialVersion'] LOOP
    IF jsonb_typeof(p_input->key_name) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
  END LOOP;
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
  INSERT INTO architetti_private.training_sessions(operator_id,user_id,case_id,case_version,prompt_version,batch_version,case_name,kind,difficulty,material_version)
  VALUES(op,auth.uid(),p_input->>'caseId',p_input->>'caseVersion',p_input->>'promptVersion',p_input->>'batchVersion',
    btrim(p_input->>'caseName'),p_input->>'kind',p_input->>'difficulty',btrim(p_input->>'materialVersion')) RETURNING * INTO issued;
  RETURN jsonb_build_object('sessionId',issued.id,'weekStart',issued.week_start,'startedAt',issued.created_at);
END $$;

CREATE OR REPLACE FUNCTION architetti_private.training_save(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE op uuid:=architetti_private.training_actor(); sid uuid; previous architetti_private.training_reports;
  stored architetti_private.training_reports; issued architetti_private.training_sessions;
  payload jsonb; item jsonb; list_name text;
BEGIN
  IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>16000 THEN
    RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
  END IF;
  IF (p_input-'sessionId'-'mode'-'scenarioId'-'scenarioVersion'-'promptVersion'-'outcome'-'summary'-'strengths'-'improvements'-'nextPractice'-'limitations'-'confirmSave')<>'{}'::jsonb OR
     p_input->'confirmSave' IS DISTINCT FROM 'true'::jsonb OR p_input->>'mode' IS DISTINCT FROM 'SIMULATION' OR
     jsonb_typeof(p_input->'sessionId') IS DISTINCT FROM 'string' OR
     jsonb_typeof(p_input->'scenarioId') IS DISTINCT FROM 'string' OR
     jsonb_typeof(p_input->'scenarioVersion') IS DISTINCT FROM 'string' OR
     jsonb_typeof(p_input->'promptVersion') IS DISTINCT FROM 'string' OR
     jsonb_typeof(p_input->'outcome') IS DISTINCT FROM 'string' OR
     jsonb_typeof(p_input->'summary') IS DISTINCT FROM 'string' OR length(btrim(p_input->>'summary')) NOT BETWEEN 1 AND 4000 OR
     jsonb_typeof(p_input->'nextPractice') IS DISTINCT FROM 'string' OR length(btrim(p_input->>'nextPractice')) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
  END IF;
  BEGIN sid:=(p_input->>'sessionId')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END;
  IF sid IS NULL THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
  FOREACH list_name IN ARRAY ARRAY['strengths','improvements','limitations'] LOOP
    IF jsonb_typeof(p_input->list_name) IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->list_name)>6 THEN
      RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_input->list_name) LOOP
      IF jsonb_typeof(item)<>'string' OR length(btrim(item#>>'{}')) NOT BETWEEN 1 AND 600 THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
    END LOOP;
  END LOOP;
  payload:=p_input-'confirmSave';
  IF p_input->>'promptVersion'='0.2' THEN
    IF p_input->>'scenarioId' IS DISTINCT FROM 'cliente-prudente' OR p_input->>'scenarioVersion' IS DISTINCT FROM '0.2' OR
       p_input->>'outcome' IS NULL OR p_input->>'outcome' NOT IN ('FOLLOW_UP','DECLINED','INTERRUPTED') THEN
      RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
    END IF;
  ELSIF p_input->>'promptVersion' IN ('0.3','0.4') THEN
    SELECT * INTO issued FROM architetti_private.training_sessions WHERE id=sid AND operator_id=op AND user_id=auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_TRAINING_SESSION'; END IF;
    IF p_input->>'scenarioId' IS DISTINCT FROM issued.case_id OR
       p_input->>'scenarioVersion' IS DISTINCT FROM issued.case_version OR
       p_input->>'promptVersion' IS DISTINCT FROM issued.prompt_version THEN RAISE EXCEPTION 'INVALID_TRAINING_SESSION'; END IF;
    IF p_input->>'outcome' IS NULL OR p_input->>'outcome' NOT IN ('FOLLOW_UP','DECLINED','INTERRUPTED','OBSERVED') OR
       (issued.kind='ARCHITECT' AND p_input->>'outcome'<>'OBSERVED') OR
       (issued.kind='LEAD' AND p_input->>'outcome'='OBSERVED') THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
    payload:=payload||jsonb_build_object('participantRole',CASE WHEN issued.kind='LEAD' THEN 'ARCHITECT' ELSE 'LEAD' END,
      'caseName',issued.case_name,'kind',issued.kind,'difficulty',issued.difficulty,
      'batchVersion',issued.batch_version,'materialVersion',issued.material_version,'weekStart',issued.week_start);
  ELSE RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
  IF octet_length(payload::text)>16000 THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||sid::text,0));
  SELECT * INTO previous FROM architetti_private.training_reports WHERE user_id=auth.uid() AND session_id=sid;
  IF FOUND THEN
    IF previous.report IS DISTINCT FROM payload THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN jsonb_build_object('id',previous.id,'sessionId',sid,'savedAt',previous.created_at,'status','SAVED','replayed',true);
  END IF;
  INSERT INTO architetti_private.training_reports(operator_id,user_id,session_id,report)
  VALUES(op,auth.uid(),sid,payload) RETURNING * INTO stored;
  PERFORM architetti_private.audit(NULL,'training_saved','Resoconto esercitazione salvato',stored.id,
    jsonb_build_object('operator_id',op,'session_id',sid,'scenario_version',payload->>'scenarioVersion','source','model_self_report'));
  RETURN jsonb_build_object('id',stored.id,'sessionId',sid,'savedAt',stored.created_at,'status','SAVED','replayed',false);
END $$;

-- Recover an issued own snapshot; no issuance, writes, report text or biography.
-- Missing, foreign and unknown UUIDs have the same identifier-free response.
-- Never infer a session from recency: the same persona can be active in two chats.
CREATE FUNCTION architetti_private.training_session_context(p_session uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE op uuid:=architetti_private.training_actor(); result jsonb;
BEGIN
  IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('sessionId',s.id,'caseId',s.case_id,
    'caseVersion',s.case_version,'promptVersion',s.prompt_version,'batchVersion',s.batch_version,
    'caseName',s.case_name,'kind',s.kind,'difficulty',s.difficulty,
    'materialVersion',s.material_version,'weekStart',s.week_start,'startedAt',s.created_at)
    INTO result FROM architetti_private.training_sessions s
    WHERE s.operator_id=op AND s.user_id=auth.uid() AND s.id=p_session;
  RETURN coalesce(result,jsonb_build_object('status','NOT_FOUND'));
END $$;

-- Replacement functions retain their existing permissions; restate the boundary.
REVOKE ALL ON FUNCTION architetti_private.training_start_session(jsonb),architetti_private.training_save(jsonb),
  architetti_private.training_session_context(uuid)
  FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_start_session(jsonb),architetti_private.training_session_context(uuid)
  TO horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_save(jsonb) TO authenticated,horyzon_platform;
NOTIFY pgrst,'reload schema';
COMMIT;
