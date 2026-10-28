-- Candidate only. Initialize the existing key binding before the first Event
-- invitation, without requiring an unrelated OTP request as a side effect.
-- Same server-only authority and fixed binding as 4C; never replaces a binding.
begin;
alter function public.patrimonial_foundation_command(jsonb) rename to patrimonial_foundation_command_pre_5b1;
revoke all on function public.patrimonial_foundation_command_pre_5b1(jsonb) from public,anon,authenticated;
create function public.patrimonial_foundation_command(p_command jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if p_command->>'contract' is distinct from 'patrimonial-foundation-5a-1' then
    return jsonb_build_object('ok',false,'code','VERSION_MISMATCH');
  end if;
  if not coalesce(p_command->>'keyBinding' ~ '^[a-f0-9]{64}$',false) then
    return jsonb_build_object('ok',false,'code','UNAVAILABLE');
  end if;
  perform pg_advisory_xact_lock(741921,1);
  insert into patrimonial_radar_private.settings(singleton,key_binding)
    values(true,p_command->>'keyBinding') on conflict do nothing;
  return public.patrimonial_foundation_command_pre_5b1(p_command);
end $$;
revoke all on function public.patrimonial_foundation_command(jsonb) from public,anon,authenticated;
grant execute on function public.patrimonial_foundation_command(jsonb) to service_role;
commit;
