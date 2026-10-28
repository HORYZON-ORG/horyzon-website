-- Reversible owner-only removal. Original reports, receipts and sessions stay immutable.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(741920,4);
CREATE TABLE architetti_private.training_report_visibility (
  report_id uuid PRIMARY KEY REFERENCES architetti_private.training_reports(id),
  hidden_at timestamptz,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid NOT NULL REFERENCES public.users(id)
);
ALTER TABLE architetti_private.training_report_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE architetti_private.training_report_visibility FORCE ROW LEVEL SECURITY;
REVOKE ALL ON architetti_private.training_report_visibility FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;

CREATE FUNCTION architetti_private.training_report_visible(p_report_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT NOT EXISTS(SELECT 1 FROM architetti_private.training_report_visibility WHERE report_id=p_report_id AND hidden_at IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION architetti_private.training_report_visible(uuid) FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;

CREATE FUNCTION architetti_private.training_report_set_visibility(p_report_id uuid,p_hidden boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE op uuid:=architetti_private.training_actor(); source architetti_private.training_reports;
  previous architetti_private.training_report_visibility; was_hidden boolean;
BEGIN
  IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF p_report_id IS NULL OR p_hidden IS NULL THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
  SELECT * INTO source FROM architetti_private.training_reports WHERE id=p_report_id AND operator_id=op AND user_id=auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('status','NOT_FOUND'); END IF;
  IF source.report->>'outcome' IS DISTINCT FROM 'INTERRUPTED' THEN RETURN jsonb_build_object('status','NOT_REMOVABLE'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('training-report-visibility:'||p_report_id::text,0));
  SELECT * INTO previous FROM architetti_private.training_report_visibility WHERE report_id=p_report_id FOR UPDATE;
  was_hidden:=FOUND AND previous.hidden_at IS NOT NULL;
  IF was_hidden=p_hidden THEN
    RETURN jsonb_build_object('id',p_report_id,'status',CASE WHEN p_hidden THEN 'REMOVED' ELSE 'RESTORED' END,'changed',false);
  END IF;
  INSERT INTO architetti_private.training_report_visibility(report_id,hidden_at,changed_by)
    VALUES(p_report_id,CASE WHEN p_hidden THEN now() ELSE NULL END,auth.uid())
    ON CONFLICT(report_id) DO UPDATE SET hidden_at=excluded.hidden_at,changed_at=now(),changed_by=excluded.changed_by;
  PERFORM architetti_private.audit(NULL,CASE WHEN p_hidden THEN 'training_report_removed' ELSE 'training_report_restored' END,
    CASE WHEN p_hidden THEN 'Prova interrotta rimossa dallo storico' ELSE 'Prova interrotta ripristinata' END,p_report_id,
    jsonb_build_object('operator_id',op,'session_id',source.session_id,'reversible',true));
  RETURN jsonb_build_object('id',p_report_id,'status',CASE WHEN p_hidden THEN 'REMOVED' ELSE 'RESTORED' END,'changed',true);
END $$;
REVOKE ALL ON FUNCTION architetti_private.training_report_set_visibility(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_report_set_visibility(uuid,boolean) TO horyzon_platform;

CREATE OR REPLACE FUNCTION architetti_private.training_dashboard_history() RETURNS jsonb
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
    WHERE r.operator_id=op AND r.user_id=auth.uid() AND architetti_private.training_report_visible(r.id)
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

CREATE OR REPLACE FUNCTION architetti_private.training_case_history(p_case_id text,p_offset integer DEFAULT 0,p_include_interrupted boolean DEFAULT false) RETURNS jsonb
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
    WHERE r.operator_id=op AND r.user_id=auth.uid() AND architetti_private.training_report_visible(r.id)
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

CREATE OR REPLACE FUNCTION architetti_private.training_list(p_operator uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path='' AS $$ DECLARE op uuid:=architetti_private.training_actor(); supervisor boolean:=architetti_private.training_supervisor(); result jsonb; BEGIN
 IF NOT supervisor AND op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF NOT supervisor AND p_operator IS NOT NULL AND p_operator<>op THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 WITH allowed AS (
   SELECT r.*,o.display_name FROM architetti_private.training_reports r JOIN public.patrimonial_operators o ON o.id=r.operator_id
   WHERE architetti_private.training_report_visible(r.id) AND (supervisor OR (r.operator_id=op AND r.user_id=auth.uid())) AND (p_operator IS NULL OR r.operator_id=p_operator)
 ), recent AS (SELECT * FROM allowed ORDER BY created_at DESC,id DESC LIMIT 50)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM allowed),'reports',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',id,'operatorId',operator_id,'displayName',display_name,'createdAt',created_at,'report',report) ORDER BY created_at DESC,id DESC) FROM recent),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;


CREATE FUNCTION architetti_private.training_removed_case_history(p_case_id text,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE op uuid:=architetti_private.training_actor(); result jsonb; family text;
BEGIN
  IF op IS NULL THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF p_case_id IS NULL OR p_case_id !~ '^[a-z][a-z0-9-]{0,79}$' OR p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'INVALID_TRAINING_INPUT'; END IF;
  family:=architetti_private.training_history_family(p_case_id);
  WITH own AS MATERIALIZED (
    SELECT r.* FROM architetti_private.training_reports r
    WHERE r.operator_id=op AND r.user_id=auth.uid() AND NOT architetti_private.training_report_visible(r.id)
      AND architetti_private.training_history_family(r.report->>'scenarioId')=family
      AND r.report->>'outcome'='INTERRUPTED'
  ), page AS (SELECT * FROM own ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET p_offset),total AS (SELECT count(*) n FROM own)
  SELECT jsonb_build_object('caseId',family,'total',t.n,'nextOffset',CASE WHEN p_offset::bigint+20<t.n THEN p_offset::bigint+20 ELSE NULL END,
    'reports',coalesce((SELECT jsonb_agg(architetti_private.training_history_dto(p.id,p.created_at,p.session_id,p.report) ORDER BY p.created_at DESC,p.id DESC) FROM page p),'[]'::jsonb)) INTO result FROM total t;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION architetti_private.training_removed_case_history(text,integer) FROM PUBLIC,anon,authenticated,service_role,horyzon_app,horyzon_platform;
GRANT EXECUTE ON FUNCTION architetti_private.training_removed_case_history(text,integer) TO horyzon_platform;
COMMIT;
