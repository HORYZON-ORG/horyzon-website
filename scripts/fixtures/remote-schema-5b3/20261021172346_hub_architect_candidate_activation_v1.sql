-- Horyzon Architetti | automatic activation of approved candidates, v1
-- Applied only after architect_candidates_v1 and separate security/SMTP preflight.
-- No candidate is promoted on migration; the approval workflow starts provisionally pending.
BEGIN;

ALTER TABLE hub.architect_candidates
  ADD COLUMN activation_state text NOT NULL DEFAULT 'not_applicable'
    CHECK (activation_state IN ('not_applicable','pending','inviting','invited','needs_review')),
  ADD COLUMN activation_user_id uuid UNIQUE REFERENCES auth.users(id),
  ADD COLUMN activation_operator_id uuid UNIQUE,
  ADD COLUMN activation_attempted_at timestamptz,
  ADD COLUMN activation_finished_at timestamptz,
  ADD COLUMN activation_issue text CHECK (
    activation_issue IS NULL OR activation_issue IN
    ('EXISTING_ACCOUNT_REVIEW','AUTH_INVITE_UNCONFIRMED',
     'OPERATOR_LINK_FAILED','PERSISTENCE_UNCONFIRMED')
  ),
  ADD CONSTRAINT architect_candidate_activation_link CHECK (
    (activation_user_id IS NULL AND activation_operator_id IS NULL)
    OR (activation_user_id IS NOT NULL AND activation_operator_id IS NOT NULL)
  ),
  ADD CONSTRAINT architect_candidate_invited_link CHECK (
    activation_state <> 'invited' OR
    (status = 'approved' AND activation_user_id IS NOT NULL AND activation_operator_id IS NOT NULL)
  );

ALTER TABLE hub.architect_candidate_history
  DROP CONSTRAINT IF EXISTS architect_candidate_history_kind_check;
ALTER TABLE hub.architect_candidate_history
  ADD CONSTRAINT architect_candidate_history_kind_check CHECK (
    kind IN (
      'received','crm_synced','crm_error','status','step_completed','cv_link_requested',
      'activation_claimed','activation_invited','activation_review'
    )
  );

CREATE FUNCTION hub.architect_candidate_approval_enqueue_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,hub
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.activation_state := 'pending';
    NEW.activation_issue := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER architect_candidate_approval_enqueue_v1
BEFORE UPDATE ON hub.architect_candidates FOR EACH ROW
EXECUTE FUNCTION hub.architect_candidate_approval_enqueue_v1();

-- Explicit claim is a durable, at-most-once invitation reservation.
-- A network timeout after the Auth call must be manually reconciled, never auto-retried.
CREATE FUNCTION hub.architect_candidate_activation_claim_v1(p_candidate_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hub
AS $$
DECLARE c hub.architect_candidates;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(
    SELECT 1 FROM hub.user_roles WHERE user_id=auth.uid() AND role='superadmin'
  ) THEN RAISE EXCEPTION 'ACTIVATION_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM hub.architect_candidates WHERE id=p_candidate_id FOR UPDATE;
  IF c.id IS NULL OR c.status<>'approved' OR c.current_step<>4 THEN
    RAISE EXCEPTION 'CANDIDATE_NOT_APPROVED';
  END IF;
  IF c.activation_state <> 'pending' THEN
    RAISE EXCEPTION 'ACTIVATION_NOT_PENDING';
  END IF;
  UPDATE hub.architect_candidates
    SET activation_state='inviting', activation_attempted_at=now(), updated_at=now()
    WHERE id=c.id;
  INSERT INTO hub.architect_candidate_history(candidate_id,kind,actor_id)
    VALUES(c.id,'activation_claimed',auth.uid());
  RETURN jsonb_build_object(
    'candidateId',c.id, 'email',c.email,
    'displayName',c.first_name||' '||c.last_name
  );
END $$;

CREATE FUNCTION hub.architect_candidate_activation_finish_v1(
  p_candidate_id uuid, p_user_id uuid, p_operator_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hub
AS $$
DECLARE c hub.architect_candidates;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(
    SELECT 1 FROM hub.user_roles WHERE user_id=auth.uid() AND role='superadmin'
  ) THEN RAISE EXCEPTION 'ACTIVATION_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF p_user_id IS NULL OR p_operator_id IS NULL THEN RAISE EXCEPTION 'INVALID_ACTIVATION_LINK'; END IF;
  SELECT * INTO c FROM hub.architect_candidates WHERE id=p_candidate_id FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'approved' THEN RAISE EXCEPTION 'CANDIDATE_NOT_APPROVED'; END IF;
  IF c.activation_state='invited' AND
    c.activation_user_id=p_user_id AND c.activation_operator_id=p_operator_id THEN
    RETURN jsonb_build_object('candidateId',c.id,'state','invited');
  END IF;
  IF c.activation_state <> 'inviting' THEN RAISE EXCEPTION 'ACTIVATION_NOT_CLAIMED'; END IF;
  -- Verify the actual identity + enabled operator; do not trust caller-supplied IDs.
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p_user_id AND lower(u.email)=c.email)
  OR NOT EXISTS (
    SELECT 1 FROM public.patrimonial_operators op
    WHERE op.id=p_operator_id AND op.user_id=p_user_id
      AND op.network_role='architect' AND op.network_enabled AND op.active
  ) THEN RAISE EXCEPTION 'ACTIVATION_IDENTITY_MISMATCH'; END IF;

  UPDATE hub.architect_candidates SET
    activation_state='invited', activation_user_id=p_user_id,
    activation_operator_id=p_operator_id, activation_finished_at=now(),
    activation_issue=NULL, updated_at=now()
  WHERE id=c.id;
  INSERT INTO hub.architect_candidate_history(candidate_id,kind,actor_id)
    VALUES(c.id,'activation_invited',auth.uid());
  RETURN jsonb_build_object('candidateId',c.id,'state','invited');
END $$;

CREATE FUNCTION hub.architect_candidate_activation_issue_v1(
  p_candidate_id uuid, p_issue text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hub
AS $$
DECLARE c hub.architect_candidates;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(
    SELECT 1 FROM hub.user_roles WHERE user_id=auth.uid() AND role='superadmin'
  ) THEN RAISE EXCEPTION 'ACTIVATION_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF p_issue NOT IN ('EXISTING_ACCOUNT_REVIEW','AUTH_INVITE_UNCONFIRMED',
                     'OPERATOR_LINK_FAILED','PERSISTENCE_UNCONFIRMED')
    THEN RAISE EXCEPTION 'INVALID_ACTIVATION_ISSUE'; END IF;
  SELECT * INTO c FROM hub.architect_candidates WHERE id=p_candidate_id FOR UPDATE;
  IF c.id IS NULL OR c.status<>'approved' THEN RAISE EXCEPTION 'CANDIDATE_NOT_APPROVED'; END IF;
  IF c.activation_state='needs_review' AND c.activation_issue=p_issue THEN RETURN; END IF;
  IF c.activation_state<>'inviting' THEN RAISE EXCEPTION 'ACTIVATION_NOT_CLAIMED'; END IF;
  UPDATE hub.architect_candidates
    SET activation_state='needs_review', activation_issue=p_issue, updated_at=now()
    WHERE id=c.id;
  INSERT INTO hub.architect_candidate_history(candidate_id,kind,actor_id)
    VALUES(c.id,'activation_review',auth.uid());
END $$;

-- Only the corresponding approved and enabled operator may see their OWN
-- application data on architetti.horyzon.it; this does not confer Hub roles.
CREATE FUNCTION hub.architect_candidate_portal_profile_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,hub
AS $$
DECLARE c hub.architect_candidates;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM hub.architect_candidates
    WHERE activation_user_id=auth.uid()
      AND status='approved' AND activation_state='invited'
      AND EXISTS (
        SELECT 1 FROM public.patrimonial_operators op
        WHERE op.id=activation_operator_id AND op.user_id=auth.uid()
          AND op.active AND op.network_enabled AND op.network_role='architect'
      )
    LIMIT 1;
  IF c.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'candidateId', c.id,
    'operatorId',c.activation_operator_id,
    'fullName', c.first_name||' '||c.last_name,
    'province',c.province,
    'profile',c.profile,
    'experience',c.experience,
    'goal',c.goal,
    'availability',c.availability,
    'activationState',c.activation_state,
    'professionalEmail',NULL,
    'professionalPhone',NULL
  );
END $$;

REVOKE ALL ON FUNCTION
  hub.architect_candidate_activation_claim_v1(uuid),
  hub.architect_candidate_activation_finish_v1(uuid,uuid,uuid),
  hub.architect_candidate_activation_issue_v1(uuid,text),
  hub.architect_candidate_portal_profile_v1()
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION hub.architect_candidate_activation_claim_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION hub.architect_candidate_activation_finish_v1(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION hub.architect_candidate_activation_issue_v1(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION hub.architect_candidate_portal_profile_v1() TO authenticated;
COMMIT;
