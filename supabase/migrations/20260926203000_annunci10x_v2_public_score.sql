alter table public.annunci10x_analysis_runs
  drop constraint if exists annunci10x_analysis_runs_evaluation_mode;

alter table public.annunci10x_analysis_runs
  add constraint annunci10x_analysis_runs_evaluation_mode
  check (evaluation_mode in ('V1', 'V2_SHADOW', 'V2_PUBLIC'));
