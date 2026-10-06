-- Radar v3 (call 5 Oct 2026): the seasonal question leaves the questionnaire (the qualification form already
-- asks it), two economic questions join (owner salary, partners and the owner's share), and the qualification
-- gains what the company actually does, the exact turnover and the traffic source (UTM).
-- Additive: v1/v2 assessments keep their rules; no existing answer, grant or purchase changes.

alter table hub.radar_assessments
  add column if not exists descrizione_attivita text,
  add column if not exists volume_affari_euro numeric,
  add column if not exists fonte_utm jsonb;

-- v3 stores 34 answer keys (33 questions + the seasonal answer taken from the qualification form).
alter table hub.radar_assessments
  drop constraint if exists radar_assessments_progress_check,
  add constraint radar_assessments_progress_check check (
    current_step between 0 and 40 and answered_count between 0 and 40 and progress_percent between 0 and 100
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
  v_len integer;
  v_flag numeric;
  v_period numeric;
  v_amount numeric;
  v_days numeric;
begin
  select * into v from hub.radar_assessments where id = p_assessment_id for update;
  if v.id is null or v.owner_secret_hash is distinct from p_owner_secret_hash then raise exception 'assessment ownership failed'; end if;
  if v.expires_at is not null and v.expires_at <= now() then raise exception 'assessment expired'; end if;
  if v.revision <> p_expected_revision then raise exception 'revision conflict'; end if;
  v_total := case v.questionnaire_version when 'radar-v3' then 34 when 'radar-v2' then 32 else 30 end;
  if p_answer_key is null or p_answer_key !~ '^(amministrazione|produzione|commerciale|marketing|risorse-umane)#[0-4]$|^qualificazione#stagionale$|^ai#(uso|leva|pronti|casoUso)$|^economia#(ore|utile|stipendio|soci)$' then raise exception 'invalid answer key'; end if;
  if p_answer_key like 'economia#%' then
    if v_total = 30 then raise exception 'invalid answer key for questionnaire version'; end if;
    if p_answer_key in ('economia#stipendio', 'economia#soci') and v_total <> 34 then raise exception 'invalid answer key for questionnaire version'; end if;
    if jsonb_typeof(p_answer_value) is distinct from 'array' then raise exception 'invalid economic answer'; end if;
    if exists (select 1 from jsonb_array_elements(p_answer_value) e where jsonb_typeof(e) <> 'number') then raise exception 'invalid economic answer'; end if;
    v_len := jsonb_array_length(p_answer_value);
    if p_answer_key = 'economia#ore' then
      -- [0 = weekly / 1 = daily, hours, days per week (0 when weekly)]
      if v_len <> 3 then raise exception 'invalid economic answer'; end if;
      v_period := (p_answer_value->>0)::numeric; v_amount := (p_answer_value->>1)::numeric; v_days := (p_answer_value->>2)::numeric;
      if v_period not in (0,1) or v_amount <= 0 or (v_period = 0 and (v_amount > 168 or v_days <> 0)) or
        (v_period = 1 and (v_amount > 24 or v_days < 1 or v_days > 7 or v_days <> trunc(v_days))) then
        raise exception 'invalid working hours';
      end if;
    elsif p_answer_key = 'economia#utile' then
      -- [0 = annual / 1 = monthly, profit before taxes in euros]
      if v_len <> 2 or (p_answer_value->>0)::numeric not in (0,1) then raise exception 'invalid economic answer'; end if;
    elsif p_answer_key = 'economia#stipendio' then
      -- [0] no salary, or [1, 0 = annual / 1 = monthly, gross amount in euros]
      v_flag := (p_answer_value->>0)::numeric;
      if not ((v_flag = 0 and v_len = 1) or (v_flag = 1 and v_len = 3 and (p_answer_value->>1)::numeric in (0,1) and (p_answer_value->>2)::numeric >= 0)) then
        raise exception 'invalid economic answer';
      end if;
    else
      -- economia#soci: [0] sole owner, or [1, the owner's share in percent, 1-99]
      v_flag := (p_answer_value->>0)::numeric;
      if not ((v_flag = 0 and v_len = 1) or (v_flag = 1 and v_len = 2 and (p_answer_value->>1)::numeric > 0 and (p_answer_value->>1)::numeric < 100)) then
        raise exception 'invalid economic answer';
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
  if v.questionnaire_version in ('radar-v2', 'radar-v3') then v_keys := v_keys || array['economia#ore', 'economia#utile']; end if;
  if v.questionnaire_version = 'radar-v3' then v_keys := v_keys || array['economia#stipendio', 'economia#soci']; end if;
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
