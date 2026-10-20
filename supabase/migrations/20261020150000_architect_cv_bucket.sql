-- Bucket privato per i CV della candidatura Architetto Patrimoniale.
-- Solo PDF, massimo 5 MB. Nessuna policy RLS su storage.objects per questo bucket:
-- accesso esclusivamente server-side con la service role (upload, collegamento, retention).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('architect-cv', 'architect-cv', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
