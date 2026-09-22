-- Allow server-side AI Score runtime RPC calls through PostgREST.
-- Function and table privileges remain restricted to service_role.

grant usage on schema public to service_role;

notify pgrst, 'reload schema';
