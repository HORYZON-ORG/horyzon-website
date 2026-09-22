-- Add covering indexes for Annunci 10x foreign keys reported by Supabase advisors.

create index if not exists annunci10x_sessions_current_snapshot_idx
  on public.annunci10x_sessions(current_snapshot_id)
  where current_snapshot_id is not null;

create index if not exists annunci10x_ai_operations_input_snapshot_idx
  on public.annunci10x_ai_operations(input_snapshot_id)
  where input_snapshot_id is not null;

create index if not exists annunci10x_ai_operations_output_snapshot_idx
  on public.annunci10x_ai_operations(output_snapshot_id)
  where output_snapshot_id is not null;

create index if not exists annunci10x_outputs_snapshot_idx
  on public.annunci10x_outputs(snapshot_id);

create index if not exists annunci10x_evaluations_target_output_idx
  on public.annunci10x_evaluations(target_output_id)
  where target_output_id is not null;

notify pgrst, 'reload schema';
