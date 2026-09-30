-- Radar v2 adds hours and profit; v1 assessments remain on their original 30 steps.
-- Apply before releasing the v2 Website. No existing answers or access grants change.
alter table hub.radar_assessments
  drop constraint if exists radar_assessments_progress_check,
  add constraint radar_assessments_progress_check check (
    current_step between 0 and 32 and answered_count between 0 and 32 and progress_percent between 0 and 100
  );

create or replace function hub.radar_save_answer(
  p_assessment_id uuid, p_owner_secret_hash text, p_answer_key text,
  p_answer_value jsonb, p_expected_revision integer, p_current_step integer
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, hub
as $$
declare
  v hub.radar_assessments%rowtype;
  v_total integer;
  v_period numeric;
  v_amount numeric;
  v_days numeric;
begin
  select * into v from hub.radar_assessments where id = p_assessment_id for update;
  if v.id is null or v.owner_secret_hash is distinct from p_owner_secret_hash then raise exception 'assessment ownership failed'; end if;
  if v.expires_at is not null and v.expires_at <= now() then raise exception 'assessment expired'; end if;
  if v.revision <> p_expected_revision then raise exception 'revision conflict'; end if;
  v_total := case when v.questionnaire_version = 'radar-v2' then 32 else 30 end;
  if p_answer_key is null or p_answer_key !~ '^(amministrazione|produzione|commerciale|marketing|risorse-umane)#[0-4]$|^qualificazione#stagionale$|^ai#(uso|leva|pronti|casoUso)$|^economia#(ore|utile)$' then raise exception 'invalid answer key'; end if;
  if p_answer_key like 'economia#%' then
    if v_total <> 32 then raise exception 'invalid answer key for questionnaire version'; end if;
    if jsonb_typeof(p_answer_value) is distinct from 'array' then raise exception 'invalid economic answer'; end if;
    if jsonb_array_length(p_answer_value) <> (case when p_answer_key = 'economia#ore' then 3 else 2 end) then raise exception 'invalid economic answer'; end if;
    if exists (select 1 from jsonb_array_elements(p_answer_value) e where jsonb_typeof(e) <> 'number') then raise exception 'invalid economic answer'; end if;
    v_period := (p_answer_value->>0)::numeric;
    v_amount := (p_answer_value->>1)::numeric;
    if v_period not in (0,1) then raise exception 'invalid economic period'; end if;
    if p_answer_key = 'economia#ore' then
      v_days := (p_answer_value->>2)::numeric;
      if v_amount <= 0 or (v_period = 0 and (v_amount > 168 or v_days <> 0)) or
        (v_period = 1 and (v_amount > 24 or v_days < 1 or v_days > 7 or v_days <> trunc(v_days))) then
        raise exception 'invalid working hours';
      end if;
    end if;
  end if;
  update hub.radar_assessments set
    risposte = coalesce(risposte, '{}'::jsonb) || jsonb_build_object(p_answer_key, p_answer_value),
    journey_status = 'IN_PROGRESS',
    current_step = greatest(current_step, greatest(0, least(v_total, p_current_step))),
    answered_count = (select count(*) from jsonb_object_keys(coalesce(risposte, '{}'::jsonb) || jsonb_build_object(p_answer_key, p_answer_value))),
    progress_percent = least(100, round(((select count(*) from jsonb_object_keys(coalesce(risposte, '{}'::jsonb) || jsonb_build_object(p_answer_key, p_answer_value)))::numeric / v_total) * 100)),
    revision = revision + 1, last_activity_at = now()
  where id = p_assessment_id returning * into v;
  return jsonb_build_object('revision', v.revision, 'currentStep', v.current_step, 'answeredCount', v.answered_count, 'progressPercent', v.progress_percent);
end;
$$;

create or replace function hub.radar_complete_assessment(p_assessment_id uuid, p_owner_secret_hash text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, hub
as $$
declare
  v hub.radar_assessments%rowtype;
  v_keys text[] := array['amministrazione#0', 'amministrazione#1', 'amministrazione#2', 'amministrazione#3', 'amministrazione#4', 'produzione#0', 'produzione#1', 'produzione#2', 'produzione#3', 'produzione#4', 'commerciale#0', 'commerciale#1', 'commerciale#2', 'commerciale#3', 'commerciale#4', 'marketing#0', 'marketing#1', 'marketing#2', 'marketing#3', 'marketing#4', 'risorse-umane#0', 'risorse-umane#1', 'risorse-umane#2', 'risorse-umane#3', 'risorse-umane#4', 'qualificazione#stagionale', 'ai#uso', 'ai#casoUso', 'ai#leva', 'ai#pronti'];
begin
  select * into v from hub.radar_assessments where id = p_assessment_id for update;
  if v.id is null or v.owner_secret_hash is distinct from p_owner_secret_hash then raise exception 'assessment ownership failed'; end if;
  if v.expires_at is not null and v.expires_at <= now() then raise exception 'assessment expired'; end if;
  if v.questionnaire_version = 'radar-v2' then v_keys := v_keys || array['economia#ore', 'economia#utile']; end if;
  if not (coalesce(v.risposte, '{}'::jsonb) ?& v_keys) then raise exception 'assessment is not complete'; end if;
  update hub.radar_assessments set
    journey_status = 'PAYMENT_REQUIRED', current_step = cardinality(v_keys), progress_percent = 100,
    payment_gate_at = coalesce(payment_gate_at, now()), last_activity_at = now()
  where id = p_assessment_id returning * into v;
  return jsonb_build_object('questionnaireVersion', v.questionnaire_version, 'id', v.id, 'status', v.journey_status, 'answers', v.risposte, 'revision', v.revision, 'currentStep', v.current_step, 'answeredCount', v.answered_count, 'progressPercent', v.progress_percent);
end;
$$;

revoke all on function hub.radar_save_answer(uuid,text,text,jsonb,integer,integer) from public, anon, authenticated;
grant execute on function hub.radar_save_answer(uuid,text,text,jsonb,integer,integer) to service_role;
revoke all on function hub.radar_complete_assessment(uuid,text) from public, anon, authenticated;
grant execute on function hub.radar_complete_assessment(uuid,text) to service_role;
