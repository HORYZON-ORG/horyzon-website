-- Personal Architetti app must be private per operator EVEN for Hub superadmins.
-- Hub supervision keeps its existing architetti_snapshot / architetti_command.
-- PREVIEW / additive capability. No role downgrades or client data backfills.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $pre$
BEGIN
  IF to_regprocedure('architetti_private.snapshot(text)') IS NULL
    OR to_regprocedure('architetti_private.command(text,jsonb)') IS NULL
    OR to_regprocedure('architetti_private.operator_id()') IS NULL THEN
    RAISE EXCEPTION 'ARCHITETTI_WORKSPACE_NOT_READY';
  END IF;
END $pre$;

CREATE FUNCTION architetti_private.personal_snapshot(p_query text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE op uuid; snapshot jsonb;
BEGIN
  op:=architetti_private.operator_id();
  IF auth.uid() IS NULL OR op IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.patrimonial_operators
      WHERE id=op AND user_id=auth.uid() AND active AND network_enabled AND network_role='architect'
  ) THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF length(coalesce(p_query,''))>160 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;

  WITH allowed AS (
    SELECT c.* FROM public.patrimonial_contacts c
    WHERE c.assigned_operator_id=op
      AND (coalesce(p_query,'')='' OR position(lower(p_query) IN
        lower(c.full_name||' '||coalesce(c.email,'')||' '||coalesce(c.phone,'')))>0)
  )
  SELECT jsonb_build_object(
    'contacts',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.updated_at DESC) FROM allowed c),'[]'::jsonb),
    'activities',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.due_at) FROM public.patrimonial_activities a JOIN allowed c ON c.id=a.contact_id),'[]'::jsonb),
    'opportunities',coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id',i.id,'contact_id',i.contact_id,'title',i.workspace_title,'stage_id',i.workspace_stage_id,
        'status',i.status,'next_action',i.workspace_next_action,'due_at',i.next_step_at,
        'revision',i.revision,'sync_state','NOT_CONFIGURED'))
      FROM public.patrimonial_intents i JOIN allowed c ON c.id=i.contact_id
      WHERE i.kind='HORYZON_OPPORTUNITY'),'[]'::jsonb),
    'history',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC)
      FROM public.patrimonial_contact_history h JOIN allowed c ON c.id=h.contact_id),'[]'::jsonb),
    'contracts',coalesce((SELECT jsonb_agg(to_jsonb(k)) FROM public.patrimonial_contracts k
      JOIN allowed c ON c.id=k.contact_id),'[]'::jsonb),
    'stages',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.position)
      FROM public.patrimonial_workspace_stages s),'[]'::jsonb),
    'tools',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',t.id,'label',t.label,'category',t.category,'url',t.url,
      'active',t.active,'verified',t.verified,'revision',t.revision))
      FROM public.patrimonial_tools t
      JOIN public.patrimonial_operator_tool_grants g ON g.tool_id=t.id
      WHERE g.operator_id=op AND g.enabled AND t.active AND t.verified),'[]'::jsonb),
    'operators',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',o.id,'user_id',o.user_id,'display_name',o.display_name,
      'enabled',o.network_enabled,'active',o.active,
      'network_role',o.network_role,'revision',o.revision))
      FROM public.patrimonial_operators o WHERE o.id=op),'[]'::jsonb),
    'viewer',jsonb_build_object('userId',auth.uid(),'operatorId',op,'supervisor',false),
    'counts',jsonb_build_object(
      'contacts',(SELECT count(*) FROM allowed),
      'openActivities',(SELECT count(*) FROM public.patrimonial_activities a
        JOIN allowed c ON c.id=a.contact_id WHERE a.completed_at IS NULL)),
    'integration',jsonb_build_object('state','NOT_CONFIGURED',
      'radar','ASSIGNMENT_NOT_VERIFIED','simulator','PLANNED')
  ) INTO snapshot;
  RETURN snapshot;
END $fn$;

-- The personal API must reject administrative operations and MUST enforce the
-- contact owner before calling the shared DB command (even for superadmins).
CREATE FUNCTION architetti_private.personal_command(p_action text,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE op uuid; c uuid; target uuid;
BEGIN
  IF auth.uid() IS NULL OR p_input IS NULL OR jsonb_typeof(p_input)<>'object' THEN
    RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(741920,2);
  op:=architetti_private.operator_id();
  IF op IS NULL OR NOT EXISTS(SELECT 1 FROM public.patrimonial_operators
      WHERE id=op AND user_id=auth.uid() AND active AND network_enabled AND network_role='architect')
    THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF p_action='create_contact' THEN
    RETURN architetti_private.command(p_action,p_input);
  ELSIF p_action IN ('log_call','add_activity','add_note','create_opportunity','register_contract') THEN
    c:=nullif(p_input->>'contactId','')::uuid;
  ELSIF p_action='update_opportunity' THEN
    SELECT contact_id INTO c FROM public.patrimonial_intents
      WHERE id=(p_input->>'id')::uuid AND kind='HORYZON_OPPORTUNITY';
  ELSIF p_action='complete_activity' THEN
    SELECT contact_id INTO c FROM public.patrimonial_activities WHERE id=(p_input->>'id')::uuid;
  ELSE
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF c IS NULL OR NOT EXISTS(
     SELECT 1 FROM public.patrimonial_contacts WHERE id=c AND assigned_operator_id=op)
    THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  RETURN architetti_private.command(p_action,p_input);
END $fn$;

CREATE FUNCTION hub.architetti_personal_snapshot(p_query text DEFAULT '') RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $fn$
  SELECT architetti_private.personal_snapshot(p_query)
$fn$;
CREATE FUNCTION hub.architetti_personal_command(p_action text,p_input jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
  SELECT architetti_private.personal_command(p_action,p_input)
$fn$;

REVOKE ALL ON FUNCTION architetti_private.personal_snapshot(text),
  architetti_private.personal_command(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION architetti_private.personal_snapshot(text),
  architetti_private.personal_command(text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION hub.architetti_personal_snapshot(text),
  hub.architetti_personal_command(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hub.architetti_personal_snapshot(text),
  hub.architetti_personal_command(text,jsonb) TO authenticated;
COMMIT;
