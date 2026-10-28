-- Personal-only event and Radar dossier reader. Hub supervisors retain their
-- separate global admin endpoint. No raw financial answers are exposed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $pre$
BEGIN
  IF to_regprocedure('architetti_private.personal_snapshot(text)') IS NULL
    OR to_regprocedure('architetti_private.contact_context(uuid)') IS NULL THEN
    RAISE EXCEPTION 'PERSONAL_REFERRAL_PREREQUISITES_MISSING';
  END IF;
END $pre$;
CREATE FUNCTION architetti_private.personal_contact_context(p_contact_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE op uuid;
BEGIN
  IF auth.uid() IS NULL OR p_contact_id IS NULL
    THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  op:=architetti_private.operator_id();
  IF op IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.patrimonial_operators o
      JOIN public.patrimonial_contacts c ON c.assigned_operator_id=o.id
      WHERE o.id=op AND o.user_id=auth.uid() AND o.active AND o.network_enabled
        AND o.network_role='architect' AND c.id=p_contact_id
  ) THEN RAISE EXCEPTION 'NETWORK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  RETURN architetti_private.contact_context(p_contact_id);
END $fn$;
CREATE FUNCTION hub.architetti_personal_contact_context(p_contact_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $fn$
  SELECT architetti_private.personal_contact_context(p_contact_id)
$fn$;
REVOKE ALL ON FUNCTION architetti_private.personal_contact_context(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION architetti_private.personal_contact_context(uuid) TO authenticated;
REVOKE ALL ON FUNCTION hub.architetti_personal_contact_context(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hub.architetti_personal_contact_context(uuid) TO authenticated;
COMMIT;
