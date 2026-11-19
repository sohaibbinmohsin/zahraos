-- Removing a team member deactivates the staff row and used to leave the
-- Supabase Auth user in place (banned). staff.email and auth.users.email are
-- both unique, so Add Team Member for that same address failed with
-- "A user with this email address has already been registered" and inserted
-- no new account.
--
-- Keep the deactivated row (name, email, audit history). Only one
-- non-deactivated row may hold an email. auth_user_id becomes nullable and
-- ON DELETE SET NULL so the Edge Function can drop the old auth user without
-- cascading the history row away.

alter table staff drop constraint if exists staff_email_key;

create unique index if not exists staff_email_active_key
  on staff (email)
  where status <> 'deactivated';

alter table staff alter column auth_user_id drop not null;

alter table staff drop constraint if exists staff_auth_user_id_fkey;
alter table staff
  add constraint staff_auth_user_id_fkey
  foreign key (auth_user_id)
  references auth.users (id)
  on delete set null;

create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select id
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;
$$;

revoke all on function public.auth_user_id_by_email(text) from public;
revoke all on function public.auth_user_id_by_email(text) from anon;
revoke all on function public.auth_user_id_by_email(text) from authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
