-- Reconcile approved architect activations without sending or duplicating invites.
-- Additive revision; no changes to existing identity/provider/outbox data.
BEGIN;

ALTER TABLE hub.architect_candidate_history
 DROP CONSTRAINT architect_candidate_history_kind_check;
ALTER TABLE hub.architect_candidate_history
 ADD CONSTRAINT architect_candidate_history_kind_check CHECK (
  kind IN (
    'received','crm_synced','crm_error','status','step_completed','cv_link_requested',
    'activation_claimed','activation_invited','activation_review','activation_reconciled'
  )
 );

CREATE FUNCTION hub.architect_candidate_activation_reconcile_v1(p_candidate_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, hub
AS $$
DECLARE
  c hub.architect_candidates;
  v_account uuid;
  v_operator uuid;
  v_users integer;
  v_operators integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM hub.user_roles
     WHERE user_id = auth.uid() AND role = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'ACTIVATION_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;

  SELECT * INTO c FROM hub.architect_candidates
   WHERE id = p_candidate_id FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'approved' OR c.current_step <> 4 THEN
    RAISE EXCEPTION 'CANDIDATE_NOT_APPROVED';
  END IF;

  -- Identity matching cannot be based on names alone. A single active Auth user
  -- whose email matches the exact normalized candidature is required.
  SELECT count(*), (array_agg(id))[1] INTO v_users, v_account
    FROM auth.users u
    WHERE lower(u.email) = c.email
      AND u.deleted_at IS NULL
      AND COALESCE(u.is_anonymous, false) = false
      AND (u.banned_until IS NULL OR u.banned_until <= now());
  IF v_users <> 1 THEN
    RETURN jsonb_build_object('state',c.activation_state,'verified',false,
      'reason',CASE WHEN v_users=0 THEN 'ACCOUNT_NOT_FOUND' ELSE 'ACCOUNT_CONFLICT' END);
  END IF;

  SELECT count(*), (array_agg(id))[1] INTO v_operators, v_operator
    FROM public.patrimonial_operators
    WHERE user_id = v_account AND active AND network_enabled
      AND network_role = 'architect';
  IF v_operators <> 1 THEN
    RETURN jsonb_build_object('state',c.activation_state,'verified',false,
      'reason',CASE WHEN v_operators=0 THEN 'OPERATOR_NOT_ACTIVE' ELSE 'OPERATOR_CONFLICT' END);
  END IF;

  IF (c.activation_user_id IS NOT NULL AND c.activation_user_id <> v_account)
    OR (c.activation_operator_id IS NOT NULL AND c.activation_operator_id <> v_operator) THEN
    RETURN jsonb_build_object('state',c.activation_state,'verified',false,'reason','IDENTITY_CONFLICT');
  END IF;

  IF c.activation_state='invited' THEN
    RETURN jsonb_build_object('state','invited','verified',true,'alreadyLinked',true);
  END IF;

  IF c.activation_state NOT IN ('pending','inviting','needs_review') THEN
    RAISE EXCEPTION 'INVALID_ACTIVATION_STATE';
  END IF;

  UPDATE hub.architect_candidates
     SET activation_state='invited',
         activation_user_id=v_account,
         activation_operator_id=v_operator,
         activation_finished_at=now(),
         activation_issue=NULL,
         updated_at=now()
   WHERE id=c.id;
  INSERT INTO hub.architect_candidate_history(candidate_id,kind,actor_id)
    VALUES (c.id,'activation_reconciled',auth.uid());

  RETURN jsonb_build_object('state','invited','verified',true,'alreadyLinked',false);
END;
$$;

REVOKE ALL ON FUNCTION hub.architect_candidate_activation_reconcile_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION hub.architect_candidate_activation_reconcile_v1(uuid)
  TO authenticated;

COMMIT;
