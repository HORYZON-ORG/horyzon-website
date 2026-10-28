-- Canonical additive extension; outside the active runner. Production application
-- requires separate approval. No accounts, leads, catalogue rows or backfills.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(741920,4);
DO $$ BEGIN
  IF to_regprocedure('architetti_private.training_save(jsonb)') IS NULL OR
     to_regclass('architetti_private.training_reports') IS NULL THEN
    RAISE EXCEPTION 'ARCHITETTI_TRAINING_BASELINE_MISSING';
  END IF;
END $$;

CREATE TABLE architetti_private.training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL,
  user_id uuid NOT NULL,
  case_id text NOT NULL CHECK(case_id ~ '^[a-z][a-z0-9-]{0,79}$'),
  case_version text NOT NULL CHECK(case_version='1.0'),
  prompt_version text NOT NULL CHECK(prompt_version='0.3'),
  batch_version text NOT NULL CHECK(batch_version='pilot-2026w43-v1'),
  case_name text NOT NULL CHECK(length(btrim(case_name)) BETWEEN 1 AND 160),
  kind text NOT NULL CHECK(kind IN ('LEAD','ARCHITECT')),
  difficulty text NOT NULL CHECK(difficulty IN ('EASY','MEDIUM','HARD','EXTREME','GUIDED')),
  material_version text NOT NULL CHECK(length(btrim(material_version)) BETWEEN 1 AND 120),
  week_start date NOT NULL DEFAULT date_trunc('week',now() AT TIME ZONE 'Europe/Rome')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(operator_id,user_id) REFERENCES public.patrimonial_operators(id,user_id),
  CHECK((kind='ARCHITECT' AND difficulty='GUIDED') OR (kind='LEAD' AND difficulty<>'GUIDED')),
  CHECK(extract(isodow FROM week_start)=1)
);
CREATE INDEX training_sessions_operator_week ON architetti_private.training_sessions(operator_id,week_start,batch_version,case_id);
ALTER TABLE architetti_private.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE architetti_private.training_sessions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON architetti_private.training_sessions FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
CREATE TRIGGER training_sessions_append_only BEFORE UPDATE OR DELETE ON architetti_private.training_sessions
FOR EACH ROW EXECUTE FUNCTION architetti_private.training_no_mutation();

-- Only the verified MCP backend may issue a session. The actor is transaction
-- local verified identity, never an argument. No private biography is persisted.
CREATE FUNCTION architetti_private.training_start_session(p_input jsonb) RETURNS jsonb
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
     p_input->>'caseVersion'<>'1.0' OR p_input->>'promptVersion'<>'0.3' OR
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

-- Preserve the legacy v0.2 contract and immutable receipts. Current reports must
-- match an issued own session; metadata is projected from that snapshot only.
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
  ELSIF p_input->>'promptVersion'='0.3' THEN
    SELECT * INTO issued FROM architetti_private.training_sessions WHERE id=sid AND operator_id=op AND user_id=auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_TRAINING_SESSION'; END IF;
    IF p_input->>'scenarioId' IS DISTINCT FROM issued.case_id OR
       p_input->>'scenarioVersion' IS DISTINCT FROM issued.case_version THEN RAISE EXCEPTION 'INVALID_TRAINING_SESSION'; END IF;
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

-- This returns metadata and receipt timestamps, never report text or biographies.
-- The active manifest is selected by trusted application code, not a caller week.
CREATE FUNCTION architetti_private.training_progress(p_operator uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE op uuid:=architetti_private.training_actor(); supervisor boolean:=architetti_private.training_supervisor();
  current_week date:=date_trunc('week',now() AT TIME ZONE 'Europe/Rome')::date; result jsonb;
BEGIN
  IF NOT supervisor AND op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF NOT supervisor AND p_operator IS NOT NULL AND p_operator<>op THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  WITH scoped AS (
    SELECT o.id,o.display_name FROM public.patrimonial_operators o
    WHERE o.active AND o.network_enabled AND o.user_id IS NOT NULL
      AND (supervisor OR o.id=op) AND (p_operator IS NULL OR o.id=p_operator)
  ), cases AS (
    SELECT s.operator_id,s.case_id,
      (array_agg(s.case_name ORDER BY s.created_at,s.id))[1] case_name,
      (array_agg(s.kind ORDER BY s.created_at,s.id))[1] kind,
      (array_agg(s.difficulty ORDER BY s.created_at,s.id))[1] difficulty,
      min(s.created_at) started_at,min(r.created_at) completed_at,count(*)::integer attempts
    FROM architetti_private.training_sessions s JOIN scoped o ON o.id=s.operator_id
    LEFT JOIN architetti_private.training_reports r ON r.session_id=s.id AND r.operator_id=s.operator_id AND r.user_id=s.user_id
      AND r.report->>'promptVersion'=s.prompt_version AND r.report->>'scenarioId'=s.case_id AND r.report->>'scenarioVersion'=s.case_version
    WHERE s.week_start=current_week AND s.batch_version='pilot-2026w43-v1'
    GROUP BY s.operator_id,s.case_id
  ) SELECT jsonb_build_object('weekStart',current_week,'operators',coalesce(jsonb_agg(jsonb_build_object(
    'operatorId',o.id,'displayName',o.display_name,'cases',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'caseId',c.case_id,'caseName',c.case_name,'kind',c.kind,'difficulty',c.difficulty,
      'startedAt',c.started_at,'completedAt',c.completed_at,'attempts',c.attempts) ORDER BY c.started_at,c.case_id)
      FROM cases c WHERE c.operator_id=o.id),'[]'::jsonb)) ORDER BY o.display_name,o.id),'[]'::jsonb))
    INTO result FROM scoped o;
  RETURN result;
END $$;
CREATE FUNCTION hub.architetti_training_progress(p_operator uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT architetti_private.training_progress(p_operator) $$;

REVOKE ALL ON FUNCTION architetti_private.training_start_session(jsonb),architetti_private.training_progress(uuid),hub.architetti_training_progress(uuid)
  FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
-- CREATE OR REPLACE preserves the existing save grants; make that contract explicit.
REVOKE ALL ON FUNCTION architetti_private.training_save(jsonb) FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_start_session(jsonb) TO horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_save(jsonb),architetti_private.training_progress(uuid),hub.architetti_training_progress(uuid)
  TO authenticated,horyzon_platform;
NOTIFY pgrst,'reload schema';
COMMIT;
