-- Read-only. Run in the SQL editor for the same project used by the deployed app.
-- Neither query sends email, consumes a reservation, or resets a limit.
select
  to_regclass('public.auth_attempts') is not null as email_attempts_table_exists,
  to_regprocedure('public.reserve_auth_email(text)') is not null as email_reservation_function_exists,
  coalesce(has_function_privilege('service_role', to_regprocedure('public.reserve_auth_email(text)')::oid, 'EXECUTE'), false) as server_can_reserve_email;

-- Run after the first query returns true for all three checks.
-- This count is site-wide; no email addresses or hashes are returned.
select count(*) as site_email_attempts_last_hour,
  greatest(0, 30 - count(*)) as site_attempts_remaining
from public.auth_attempts
where created_at > now() - interval '1 hour';
