-- Additive, versioned training history. Production application needs separate approval.
-- No backfill, report update, catalogue storage, real appointment or CRM mutation.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(741920,4);
DO $$ BEGIN
  IF to_regprocedure('architetti_private.training_session_by_code(text)') IS NULL THEN
    RAISE EXCEPTION 'ARCHITETTI_TRAINING_CHAT_CODE_BASELINE_MISSING';
  END IF;
END $$;

-- Helpers contain no lookup and remain unavailable to browser roles.
CREATE FUNCTION architetti_private.training_history_family(p_case_id text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE WHEN p_case_id ~ '^(giulia|sara|elisa|francesca|marta|valentina|chiara|alessandra|beatrice|diana|irene)-(f|m)$'
    THEN left(p_case_id,length(p_case_id)-2) ELSE p_case_id END
$$;
CREATE FUNCTION architetti_private.training_history_dto(p_id uuid,p_created_at timestamptz,p_session_id uuid,p_report jsonb) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT jsonb_build_object(
    'id',p_id,'createdAt',p_created_at,'sessionId',p_session_id,
    'scenarioId',p_report->>'scenarioId','caseName',coalesce(p_report->>'caseName',p_report->>'scenarioId'),
    'gender',CASE
      WHEN p_report->>'scenarioId' ~ '^(giulia|sara|elisa|francesca|marta|valentina|chiara|alessandra|beatrice|diana|irene)-m$' THEN 'male'
      WHEN p_report->>'scenarioId' ~ '^(giulia|sara|elisa|francesca|marta|valentina|chiara|alessandra|beatrice|diana|irene)(-f)?$' THEN 'female'
      ELSE NULL END,
    'outcome',p_report->>'outcome',
    'score',CASE WHEN p_report->>'promptVersion'='0.5' THEN p_report->'evaluation'->'score' ELSE NULL END,
    'evaluationNote',CASE WHEN p_report->>'promptVersion'='0.5' THEN p_report->'evaluation'->>'note' ELSE NULL END,
    'appointment',CASE WHEN p_report->>'promptVersion'='0.5' THEN p_report->'appointment' ELSE NULL END,
    'summary',p_report->>'summary','strengths',p_report->'strengths','improvements',p_report->'improvements',
    'nextPractice',p_report->>'nextPractice','limitations',p_report->'limitations')
$$;

CREATE FUNCTION architetti_private.training_dashboard_history() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE op uuid:=architetti_private.training_actor(); result jsonb;
  current_week date:=date_trunc('week',now() AT TIME ZONE 'Europe/Rome')::date;
BEGIN
  -- Supervisors receive only their own actor's data, never another operator's reports.
  IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  WITH own AS MATERIALIZED (
    SELECT r.*,architetti_private.training_history_family(r.report->>'scenarioId') family,
      coalesce(s.week_start,date_trunc('week',r.created_at AT TIME ZONE 'Europe/Rome')::date) week_start
    FROM architetti_private.training_reports r
    LEFT JOIN architetti_private.training_sessions s ON s.id=r.session_id
      AND s.operator_id=op AND s.user_id=auth.uid()
      AND s.case_id=r.report->>'scenarioId' AND s.case_version=r.report->>'scenarioVersion'
      AND s.prompt_version=r.report->>'promptVersion'
    WHERE r.operator_id=op AND r.user_id=auth.uid()
  ), counts AS (
    SELECT family,count(*) FILTER(WHERE report->>'outcome'<>'INTERRUPTED')::integer completed_count,
      count(*) FILTER(WHERE report->>'outcome'='INTERRUPTED')::integer interrupted_count,
      bool_or(report->>'outcome'<>'INTERRUPTED' AND week_start=current_week) completed_this_week
    FROM own GROUP BY family
  ), ranked AS (
    SELECT own.*,row_number() OVER(PARTITION BY family ORDER BY created_at DESC,id DESC) ranking
    FROM own WHERE report->>'outcome'<>'INTERRUPTED'
  ) SELECT jsonb_build_object('weekStart',current_week,'groups',coalesce(jsonb_agg(jsonb_build_object(
      'caseId',c.family,'completedCount',c.completed_count,'interruptedCount',c.interrupted_count,
      'completedThisWeek',c.completed_this_week,
      'recentReports',coalesce((SELECT jsonb_agg(architetti_private.training_history_dto(r.id,r.created_at,r.session_id,r.report)
        ORDER BY r.created_at DESC,r.id DESC) FROM ranked r WHERE r.family=c.family AND r.ranking<=3),'[]'::jsonb)
    ) ORDER BY c.family),'[]'::jsonb)) INTO result FROM counts c;
  RETURN result;
END $$;

CREATE FUNCTION architetti_private.training_case_history(p_case_id text,p_offset integer DEFAULT 0,p_include_interrupted boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE op uuid:=architetti_private.training_actor(); result jsonb; family text;
BEGIN
  IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF p_case_id IS NULL OR p_case_id !~ '^[a-z][a-z0-9-]{0,79}$' OR p_offset IS NULL OR p_offset<0 OR p_include_interrupted IS NULL THEN
    RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
  END IF;
  family:=architetti_private.training_history_family(p_case_id);
  WITH own AS MATERIALIZED (
    SELECT r.* FROM architetti_private.training_reports r
    WHERE r.operator_id=op AND r.user_id=auth.uid()
      AND architetti_private.training_history_family(r.report->>'scenarioId')=family
      AND (p_include_interrupted OR r.report->>'outcome'<>'INTERRUPTED')
  ), page AS (
    SELECT * FROM own ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET p_offset
  ), total AS (SELECT count(*) n FROM own)
  SELECT jsonb_build_object('caseId',family,'total',t.n,
    'nextOffset',CASE WHEN p_offset::bigint+20<t.n THEN p_offset::bigint+20 ELSE NULL END,
    'reports',coalesce((SELECT jsonb_agg(architetti_private.training_history_dto(p.id,p.created_at,p.session_id,p.report)
      ORDER BY p.created_at DESC,p.id DESC) FROM page p),'[]'::jsonb)) INTO result FROM total t;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION architetti_private.training_history_family(text),
  architetti_private.training_history_dto(uuid,timestamptz,uuid,jsonb),
  architetti_private.training_dashboard_history(),architetti_private.training_case_history(text,integer,boolean)
  FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_dashboard_history(),
  architetti_private.training_case_history(text,integer,boolean) TO horyzon_platform;

ALTER TABLE architetti_private.training_sessions ADD CONSTRAINT training_sessions_version_pair_v12_check
  CHECK((case_version='1.0' AND prompt_version='0.3') OR
        (case_version='1.1' AND prompt_version='0.4') OR
        (case_version='1.2' AND prompt_version='0.5'));
ALTER TABLE architetti_private.training_sessions DROP CONSTRAINT training_sessions_version_pair_check;
ALTER TABLE architetti_private.training_sessions ADD CONSTRAINT training_sessions_v12_case_check CHECK (
  case_version<>'1.2' OR
  (case_id ~ '^(giulia|sara|elisa|francesca|marta|valentina|chiara|alessandra|beatrice|diana|irene)-(f|m)$'
    AND ((case_id IN ('irene-f','irene-m')) = (kind='ARCHITECT')))
);

-- Validate only new extensions: old immutable JSON remains byte-for-byte unchanged.
-- This also protects privileged INSERT paths in addition to the save RPC.
CREATE FUNCTION architetti_private.training_report_extensions_valid_v12(p_report jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE value jsonb;
BEGIN
  IF p_report->>'promptVersion' IS DISTINCT FROM '0.5' THEN
    RETURN NOT (p_report ? 'evaluation' OR p_report ? 'appointment')
      AND coalesce(p_report->>'outcome' NOT IN ('APPOINTMENT','SIMULATED_PURCHASE'),true);
  END IF;
  IF p_report->>'scenarioVersion' IS DISTINCT FROM '1.2' OR
    (p_report->>'scenarioId') IS NULL OR
    (p_report->>'scenarioId') !~ '^(giulia|sara|elisa|francesca|marta|valentina|chiara|alessandra|beatrice|diana|irene)-(f|m)$' OR
    (p_report->>'outcome') IS NULL OR
    (p_report->>'outcome') NOT IN ('FOLLOW_UP','DECLINED','INTERRUPTED','OBSERVED','APPOINTMENT','SIMULATED_PURCHASE') THEN
    RETURN false;
  END IF;
  IF p_report->>'scenarioId' IN ('irene-f','irene-m') THEN
    IF p_report->>'outcome'<>'OBSERVED' OR p_report ? 'evaluation' OR p_report ? 'appointment' THEN RETURN false; END IF;
  ELSIF p_report->>'outcome'='OBSERVED' THEN RETURN false;
  END IF;
  IF p_report ? 'evaluation' THEN
    value:=p_report->'evaluation';
    IF jsonb_typeof(value) IS DISTINCT FROM 'object' OR
      (value-'score'-'note'-'rubricVersion')<>'{}'::jsonb OR
      NOT (value ?& ARRAY['score','note','rubricVersion']) OR
      jsonb_typeof(value->'note') IS DISTINCT FROM 'string' OR
      length(btrim(value->>'note')) NOT BETWEEN 1 AND 600 OR
      value->>'rubricVersion' IS DISTINCT FROM 'practice-v1' THEN RETURN false; END IF;
    IF value->'score'<>'null'::jsonb THEN
      IF jsonb_typeof(value->'score') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
      IF (value->>'score')::numeric NOT BETWEEN 1 AND 10 OR
        (value->>'score')::numeric<>trunc((value->>'score')::numeric) THEN RETURN false; END IF;
    END IF;
  END IF;
  IF p_report->>'outcome'='APPOINTMENT' AND NOT (p_report ? 'appointment') THEN RETURN false; END IF;
  IF p_report ? 'appointment' THEN
    value:=p_report->'appointment';
    IF p_report->>'outcome'<>'APPOINTMENT' OR
      jsonb_typeof(value) IS DISTINCT FROM 'object' OR
      (value-'whenText'-'note')<>'{}'::jsonb OR NOT (value ?& ARRAY['whenText','note']) OR
      jsonb_typeof(value->'note') IS DISTINCT FROM 'string' OR
      length(btrim(value->>'note')) NOT BETWEEN 1 AND 600 THEN RETURN false; END IF;
    IF value->'whenText'<>'null'::jsonb AND
      (jsonb_typeof(value->'whenText') IS DISTINCT FROM 'string' OR
       length(btrim(value->>'whenText')) NOT BETWEEN 1 AND 160) THEN RETURN false; END IF;
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION architetti_private.training_report_extensions_valid_v12(jsonb)
  FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
ALTER TABLE architetti_private.training_reports ADD CONSTRAINT training_reports_extensions_v12_check
  CHECK(architetti_private.training_report_extensions_valid_v12(report));

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
          (p_input->>'caseVersion'='1.1' AND p_input->>'promptVersion'='0.4') OR
          (p_input->>'caseVersion'='1.2' AND p_input->>'promptVersion'='0.5')) OR
     p_input->>'batchVersion'<>'pilot-2026w43-v1' OR
     length(btrim(p_input->>'caseName')) NOT BETWEEN 1 AND 160 OR
     length(btrim(p_input->>'materialVersion')) NOT BETWEEN 1 AND 120 OR
     p_input->>'kind' NOT IN ('LEAD','ARCHITECT') OR
     p_input->>'difficulty' NOT IN ('EASY','MEDIUM','HARD','EXTREME','GUIDED') OR
     ((p_input->>'kind'='ARCHITECT') IS DISTINCT FROM (p_input->>'difficulty'='GUIDED')) THEN
    RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
  END IF;
  IF p_input->>'caseVersion'='1.2' AND ((p_input->>'caseId') !~ '^(giulia|sara|elisa|francesca|marta|valentina|chiara|alessandra|beatrice|diana|irene)-(f|m)$' OR ((p_input->>'caseId' IN ('irene-f','irene-m')) IS DISTINCT FROM (p_input->>'kind'='ARCHITECT'))) THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
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
  IF (p_input-'sessionId'-'mode'-'scenarioId'-'scenarioVersion'-'promptVersion'-'outcome'-'summary'-'strengths'-'improvements'-'nextPractice'-'limitations'-'confirmSave'-'evaluation'-'appointment')<>'{}'::jsonb OR
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
  IF NOT architetti_private.training_report_extensions_valid_v12(p_input) THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
  payload:=p_input-'confirmSave';
  IF p_input->>'promptVersion'='0.2' THEN
    IF p_input->>'scenarioId' IS DISTINCT FROM 'cliente-prudente' OR p_input->>'scenarioVersion' IS DISTINCT FROM '0.2' OR
       p_input->>'outcome' IS NULL OR p_input->>'outcome' NOT IN ('FOLLOW_UP','DECLINED','INTERRUPTED') THEN
      RAISE EXCEPTION 'INVALID_TRAINING_INPUT';
    END IF;
  ELSIF p_input->>'promptVersion' IN ('0.3','0.4','0.5') THEN
    SELECT * INTO issued FROM architetti_private.training_sessions WHERE id=sid AND operator_id=op AND user_id=auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_TRAINING_SESSION'; END IF;
    IF p_input->>'scenarioId' IS DISTINCT FROM issued.case_id OR
       p_input->>'scenarioVersion' IS DISTINCT FROM issued.case_version OR
       p_input->>'promptVersion' IS DISTINCT FROM issued.prompt_version THEN RAISE EXCEPTION 'INVALID_TRAINING_SESSION'; END IF;
    IF p_input->>'outcome' IS NULL OR (p_input->>'outcome' NOT IN ('FOLLOW_UP','DECLINED','INTERRUPTED','OBSERVED') AND NOT (issued.prompt_version='0.5' AND p_input->>'outcome' IN ('APPOINTMENT','SIMULATED_PURCHASE'))) OR
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

-- CREATE OR REPLACE retains the existing permissions, including legacy direct save.
REVOKE ALL ON FUNCTION architetti_private.training_start_session(jsonb),architetti_private.training_save(jsonb)
  FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_start_session(jsonb) TO horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_save(jsonb) TO authenticated,horyzon_platform;
NOTIFY pgrst,'reload schema';
COMMIT;
