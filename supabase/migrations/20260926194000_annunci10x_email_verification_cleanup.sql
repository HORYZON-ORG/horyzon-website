-- FASE 2C cleanup: remove superseded Annunci 10x email-verification RPC overloads.
-- The hardened signatures from FASE 2B.1 remain authoritative.

drop function if exists public.annunci10x_create_email_verification(
  uuid, uuid, text, uuid, text, text, timestamptz, integer
);

drop function if exists public.annunci10x_verify_email_code(
  uuid, text, text
);

notify pgrst, 'reload schema';
